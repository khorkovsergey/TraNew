import type { Argument, Expression, Program, Statement } from './parser';
import { parse, PineSyntaxError } from './parser';

/**
 * The interpreter.
 *
 * Walks the AST. Nothing is compiled, nothing is stringified into JavaScript,
 * and `eval` and `new Function` appear nowhere in this project — a script that
 * arrived from a model, or from a person, or from a paste is data here and
 * stays data.
 *
 * Series are evaluated whole rather than bar by bar. Pine's own model is
 * per-bar with state, and the two agree for everything in this subset because
 * every supported built-in is a function of a series. What the whole-series
 * model genuinely cannot express — `var`, `:=`, `if` blocks, loops — is refused
 * by name rather than approximated, because a preview that quietly computes
 * something else is worse than one that declines.
 *
 * Import-free beyond the parser, so the harness compiles it alone.
 */

/** A value is a series of numbers, a scalar, a string, or nothing. */
export type PineValue =
  | { kind: 'series'; values: (number | null)[] }
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'na' };

export type PinePlot = {
  title: string;
  values: (number | null)[];
  style: 'line' | 'columns' | 'shape';
};

export type PineRunResult = {
  plots: PinePlot[];
  /** What the script declared itself to be, for the panel's title. */
  title: string;
  overlay: boolean;
  /** Operations spent, so a person can see what a limit cost them. */
  operations: number;
};

export class PineRuntimeError extends Error {
  readonly line: number;

  constructor(message: string, line: number) {
    super(message);
    this.name = 'PineRuntimeError';
    this.line = line;
  }
}

/**
 * Ceilings.
 *
 * The worker is terminated from outside on a wall-clock timeout, but a budget
 * inside gives a message with a line number instead of a silent kill — and it
 * stops a script that is merely enormous before it exhausts memory.
 */
export const MAX_OPERATIONS = 2_000_000;
export const MAX_SERIES = 64;
export const MAX_BARS = 20_000;

type Bars = {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  time: number[];
};

/* ------------------------------------------------------------- Primitives */

function sma(values: (number | null)[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (length < 1) return out;

  let sum = 0;
  let count = 0;

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    // A null inside the window makes the whole window unusable; carrying it as
    // zero would quietly bias the average toward zero.
    if (value === null) {
      sum = 0;
      count = 0;
      continue;
    }

    sum += value;
    count += 1;

    if (count > length) {
      const leaving = values[i - length];
      if (leaving !== null) sum -= leaving;
      count = length;
    }

    if (count === length) out[i] = sum / length;
  }

  return out;
}

function ema(values: (number | null)[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (length < 1) return out;

  const k = 2 / (length + 1);
  let previous: number | null = null;
  let seed = 0;
  let seen = 0;

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value === null) continue;

    if (previous === null) {
      // Seeded with a simple average, like the chart's own EMA. Seeding from a
      // single close makes the first `length` bars an artefact of one value.
      seed += value;
      seen += 1;
      if (seen === length) {
        previous = seed / length;
        out[i] = previous;
      }
      continue;
    }

    previous = value * k + previous * (1 - k);
    out[i] = previous;
  }

  return out;
}

function rsi(values: (number | null)[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (length < 1 || values.length <= length) return out;

  let gain = 0;
  let loss = 0;

  for (let i = 1; i <= length; i += 1) {
    const change = (values[i] ?? 0) - (values[i - 1] ?? 0);
    if (change >= 0) gain += change;
    else loss -= change;
  }

  // Wilder's smoothing, not an EMA of the same length. They differ, and RSI
  // computed with the wrong one is off by enough to move a reading across 70.
  let averageGain = gain / length;
  let averageLoss = loss / length;
  out[length] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);

  for (let i = length + 1; i < values.length; i += 1) {
    const change = (values[i] ?? 0) - (values[i - 1] ?? 0);
    averageGain = (averageGain * (length - 1) + Math.max(0, change)) / length;
    averageLoss = (averageLoss * (length - 1) + Math.max(0, -change)) / length;
    out[i] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }

  return out;
}

function rolling(
  values: (number | null)[],
  length: number,
  pick: (window: number[]) => number
): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);

  for (let i = length - 1; i < values.length; i += 1) {
    const window: number[] = [];
    for (let j = i - length + 1; j <= i; j += 1) {
      const value = values[j];
      if (value === null) break;
      window.push(value);
    }
    if (window.length === length) out[i] = pick(window);
  }

  return out;
}

function stdev(values: (number | null)[], length: number): (number | null)[] {
  return rolling(values, length, (window) => {
    const mean = window.reduce((total, value) => total + value, 0) / window.length;
    // Population deviation, which is what Pine's ta.stdev computes.
    return Math.sqrt(
      window.reduce((total, value) => total + (value - mean) ** 2, 0) / window.length
    );
  });
}

/* --------------------------------------------------------------- Evaluator */

class Evaluator {
  private bars: Bars;
  private scope = new Map<string, PineValue>();
  private plots: PinePlot[] = [];
  private operations = 0;
  private seriesAllocated = 0;
  private title = 'Preview';
  private overlay = false;

  constructor(bars: Bars) {
    this.bars = bars;
  }

  private spend(cost: number, line: number): void {
    this.operations += cost;
    if (this.operations > MAX_OPERATIONS) {
      throw new PineRuntimeError(
        `This script exceeded the preview's budget of ${MAX_OPERATIONS.toLocaleString('en-US')} operations. Export it to run it somewhere without that limit.`,
        line
      );
    }
  }

  private allocate(line: number): void {
    this.seriesAllocated += 1;
    if (this.seriesAllocated > MAX_SERIES) {
      throw new PineRuntimeError(
        `This script builds more than ${MAX_SERIES} series, which is past what the preview holds.`,
        line
      );
    }
  }

  /** A value as a series, whatever it arrived as. */
  private toSeries(value: PineValue, line: number): (number | null)[] {
    if (value.kind === 'series') return value.values;
    if (value.kind === 'number') return new Array(this.bars.close.length).fill(value.value);
    if (value.kind === 'na') return new Array(this.bars.close.length).fill(null);
    throw new PineRuntimeError('A text value was used where a number was expected.', line);
  }

  /** A value as a single number, for a length or a multiplier. */
  private toNumber(value: PineValue, line: number, what: string): number {
    if (value.kind === 'number') return value.value;

    if (value.kind === 'series') {
      /*
       * A length has to be constant. Pine enforces this too, and for the same
       * reason: a window that changes per bar is not a window. A constant
       * series (an input, a literal) is fine, and that is the common case.
       */
      const first = value.values.find((item) => item !== null);
      if (first !== undefined && value.values.every((item) => item === null || item === first)) {
        return first as number;
      }
      throw new PineRuntimeError(`${what} has to be the same on every bar.`, line);
    }

    throw new PineRuntimeError(`${what} has to be a number.`, line);
  }

  /**
   * An argument by name, falling back to a position.
   *
   * Pine allows both in the same call, and the named form wins — `plot(x,
   * title = "a")` and `plot(x, "a")` are the same call. A negative index means
   * the argument has no fixed position and is only ever named, which is how
   * `overlay` and `style` are written in practice.
   */
  private argument(args: Argument[], index: number, name: string): Expression | null {
    const named = args.find((argument) => argument.name === name);
    if (named) return named.value;

    if (index < 0) return null;

    const positional = args.filter((argument) => argument.name === null)[index];
    return positional ? positional.value : null;
  }

  run(program: Program): PineRunResult {
    for (const statement of program.statements) this.execute(statement);

    if (!this.plots.length) {
      throw new PineRuntimeError(
        'Nothing is plotted, so there is nothing to preview.',
        program.statements[program.statements.length - 1]?.line ?? 1
      );
    }

    return {
      plots: this.plots,
      title: this.title,
      overlay: this.overlay,
      operations: this.operations,
    };
  }

  private execute(statement: Statement): void {
    if (statement.type === 'assignment') {
      this.scope.set(statement.name, this.evaluate(statement.value));
      return;
    }

    this.evaluate(statement.value);
  }

  private evaluate(expression: Expression): PineValue {
    this.spend(1, expression.line);

    switch (expression.type) {
      case 'number':
        return { kind: 'number', value: expression.value };

      case 'string':
        return { kind: 'string', value: expression.value };

      case 'identifier':
        return this.identifier(expression.name, expression.line);

      case 'unary':
        return this.unary(expression);

      case 'binary':
        return this.binary(expression);

      case 'ternary':
        return this.ternary(expression);

      case 'history':
        return this.history(expression);

      case 'call':
        return this.call(expression);
    }
  }

  private identifier(name: string, line: number): PineValue {
    const local = this.scope.get(name);
    if (local) return local;

    const bars = this.bars;

    switch (name) {
      case 'open':
        return { kind: 'series', values: [...bars.open] };
      case 'high':
        return { kind: 'series', values: [...bars.high] };
      case 'low':
        return { kind: 'series', values: [...bars.low] };
      case 'close':
        return { kind: 'series', values: [...bars.close] };
      case 'volume':
        return { kind: 'series', values: [...bars.volume] };
      case 'hl2':
        return { kind: 'series', values: bars.high.map((h, i) => (h + bars.low[i]) / 2) };
      case 'hlc3':
        return {
          kind: 'series',
          values: bars.high.map((h, i) => (h + bars.low[i] + bars.close[i]) / 3),
        };
      case 'ohlc4':
        return {
          kind: 'series',
          values: bars.high.map((h, i) => (bars.open[i] + h + bars.low[i] + bars.close[i]) / 4),
        };
      case 'bar_index':
        return { kind: 'series', values: bars.close.map((_, index) => index) };
      case 'na':
        return { kind: 'na' };
      case 'true':
        return { kind: 'number', value: 1 };
      case 'false':
        return { kind: 'number', value: 0 };
      default:
        throw new PineRuntimeError(
          `"${name}" is not defined, and is not a built-in this preview provides.`,
          line
        );
    }
  }

  private unary(expression: Extract<Expression, { type: 'unary' }>): PineValue {
    const operand = this.evaluate(expression.operand);

    if (expression.operator === '+') return operand;

    const values = this.toSeries(operand, expression.line);
    this.spend(values.length, expression.line);
    this.allocate(expression.line);

    if (expression.operator === 'not') {
      return { kind: 'series', values: values.map((value) => (value === null ? null : value ? 0 : 1)) };
    }

    return { kind: 'series', values: values.map((value) => (value === null ? null : -value)) };
  }

  private binary(expression: Extract<Expression, { type: 'binary' }>): PineValue {
    const left = this.evaluate(expression.left);
    const right = this.evaluate(expression.right);

    // Two scalars stay a scalar, so a length expression like `20 * 2` is still
    // usable where a constant is required.
    if (left.kind === 'number' && right.kind === 'number') {
      return { kind: 'number', value: applyOperator(expression.operator, left.value, right.value) };
    }

    const a = this.toSeries(left, expression.line);
    const b = this.toSeries(right, expression.line);

    this.spend(a.length, expression.line);
    this.allocate(expression.line);

    const values = a.map((value, index) => {
      const other = b[index];
      // `na` propagates rather than being treated as zero. Arithmetic on a
      // missing value produces a missing value, not a confident wrong one.
      if (value === null || other === null || other === undefined) return null;
      return applyOperator(expression.operator, value, other);
    });

    return { kind: 'series', values };
  }

  private ternary(expression: Extract<Expression, { type: 'ternary' }>): PineValue {
    const test = this.toSeries(this.evaluate(expression.test), expression.line);
    const whenTrue = this.toSeries(this.evaluate(expression.whenTrue), expression.line);
    const whenFalse = this.toSeries(this.evaluate(expression.whenFalse), expression.line);

    this.spend(test.length, expression.line);
    this.allocate(expression.line);

    return {
      kind: 'series',
      values: test.map((value, index) =>
        value === null ? null : value ? whenTrue[index] ?? null : whenFalse[index] ?? null
      ),
    };
  }

  private history(expression: Extract<Expression, { type: 'history' }>): PineValue {
    const series = this.toSeries(this.evaluate(expression.series), expression.line);
    const offset = this.toNumber(this.evaluate(expression.offset), expression.line, 'A history offset');

    if (offset < 0 || !Number.isInteger(offset)) {
      throw new PineRuntimeError(
        'A history offset has to be a whole number of bars, and cannot look forward.',
        expression.line
      );
    }

    this.spend(series.length, expression.line);
    this.allocate(expression.line);

    // Bars before the start have no value; null rather than the first bar's,
    // which would invent history the instrument does not have.
    return {
      kind: 'series',
      values: series.map((_, index) => (index - offset >= 0 ? series[index - offset] : null)),
    };
  }

  private call(expression: Extract<Expression, { type: 'call' }>): PineValue {
    const { callee, args, line } = expression;

    /* ------------------------------------------------------ Declarations */

    if (callee === 'indicator') {
      const titleArgument = this.argument(args, 0, 'title');
      if (titleArgument) {
        const value = this.evaluate(titleArgument);
        if (value.kind === 'string') this.title = value.value;
      }

      const overlayArgument = this.argument(args, -1, 'overlay');
      if (overlayArgument) {
        const value = this.evaluate(overlayArgument);
        this.overlay = value.kind === 'number' ? Boolean(value.value) : false;
      }

      return { kind: 'na' };
    }

    /* ----------------------------------------------------------- Inputs */

    if (callee.startsWith('input')) {
      /*
       * An input evaluates to its default. The preview has no settings dialog,
       * and inventing a value other than the one written in the script would
       * mean previewing something the author did not write.
       */
      const defaultArgument = this.argument(args, 0, 'defval');
      if (!defaultArgument) {
        throw new PineRuntimeError(`${callee}() needs a default value.`, line);
      }
      return this.evaluate(defaultArgument);
    }

    /* ------------------------------------------------------------ Plots */

    if (callee === 'plot' || callee === 'plotshape' || callee === 'hline') {
      const seriesArgument = this.argument(args, 0, callee === 'hline' ? 'price' : 'series');
      if (!seriesArgument) {
        throw new PineRuntimeError(`${callee}() needs something to plot.`, line);
      }

      const values = this.toSeries(this.evaluate(seriesArgument), line);
      const titleArgument = this.argument(args, 1, 'title');
      const titleValue = titleArgument ? this.evaluate(titleArgument) : null;

      const styleArgument = this.argument(args, -1, 'style');
      const styleValue = styleArgument ? this.evaluate(styleArgument) : null;
      const columns = styleValue?.kind === 'string' && styleValue.value.includes('columns');

      this.plots.push({
        title:
          titleValue?.kind === 'string'
            ? titleValue.value
            : `Plot ${this.plots.length + 1}`,
        values,
        style: callee === 'plotshape' ? 'shape' : columns ? 'columns' : 'line',
      });

      return { kind: 'na' };
    }

    /* -------------------------------------------------------- Colours */

    if (callee.startsWith('color.')) {
      // Colours are parsed and discarded. The preview draws with the chart's
      // study palette so the lines match everything else on it, and pretending
      // to honour a Pine colour it does not use would be a lie in the output.
      return { kind: 'string', value: 'color' };
    }

    /* ------------------------------------------------ Series functions */

    const seriesFunctions: Record<string, (values: (number | null)[], length: number) => (number | null)[]> =
      {
        'ta.sma': sma,
        'ta.ema': ema,
        'ta.rsi': rsi,
        'ta.stdev': stdev,
        'ta.highest': (values, length) => rolling(values, length, (window) => Math.max(...window)),
        'ta.lowest': (values, length) => rolling(values, length, (window) => Math.min(...window)),
      };

    const seriesFunction = seriesFunctions[callee];
    if (seriesFunction) {
      const sourceArgument = this.argument(args, 0, 'source');
      const lengthArgument = this.argument(args, 1, 'length');

      if (!sourceArgument || !lengthArgument) {
        throw new PineRuntimeError(`${callee}() needs a source and a length.`, line);
      }

      const source = this.toSeries(this.evaluate(sourceArgument), line);
      const length = Math.round(this.toNumber(this.evaluate(lengthArgument), line, 'A length'));

      if (length < 1 || length > MAX_BARS) {
        throw new PineRuntimeError(`A length of ${length} is outside what the preview computes.`, line);
      }

      this.spend(source.length * 2, line);
      this.allocate(line);

      return { kind: 'series', values: seriesFunction(source, length) };
    }

    /* ------------------------------------------------------- Crossings */

    if (callee === 'ta.cross' || callee === 'ta.crossover' || callee === 'ta.crossunder') {
      const first = this.argument(args, 0, 'source1');
      const second = this.argument(args, 1, 'source2');
      if (!first || !second) throw new PineRuntimeError(`${callee}() needs two series.`, line);

      const a = this.toSeries(this.evaluate(first), line);
      const b = this.toSeries(this.evaluate(second), line);

      this.spend(a.length, line);
      this.allocate(line);

      const values = a.map((value, index) => {
        if (index === 0) return 0;
        const previousA = a[index - 1];
        const previousB = b[index - 1];
        const other = b[index];
        if (value === null || other === null || previousA === null || previousB === null) return null;

        // A crossing is a change of sign, not a touch. Equal values on one bar
        // are not a cross until the difference actually reverses.
        const wasAbove = previousA > previousB;
        const isAbove = value > other;
        if (wasAbove === isAbove) return 0;
        if (callee === 'ta.crossover') return isAbove ? 1 : 0;
        if (callee === 'ta.crossunder') return isAbove ? 0 : 1;
        return 1;
      });

      return { kind: 'series', values };
    }

    if (callee === 'ta.change') {
      const sourceArgument = this.argument(args, 0, 'source');
      if (!sourceArgument) throw new PineRuntimeError('ta.change() needs a source.', line);

      const source = this.toSeries(this.evaluate(sourceArgument), line);
      this.spend(source.length, line);
      this.allocate(line);

      return {
        kind: 'series',
        values: source.map((value, index) => {
          const previous = index > 0 ? source[index - 1] : null;
          return value === null || previous === null ? null : value - previous;
        }),
      };
    }

    /* --------------------------------------------------------- Scalars */

    const scalarFunctions: Record<string, (values: number[]) => number> = {
      'math.abs': ([value]) => Math.abs(value),
      'math.round': ([value]) => Math.round(value),
      'math.floor': ([value]) => Math.floor(value),
      'math.ceil': ([value]) => Math.ceil(value),
      'math.sqrt': ([value]) => Math.sqrt(value),
      'math.max': (values) => Math.max(...values),
      'math.min': (values) => Math.min(...values),
    };

    const scalarFunction = scalarFunctions[callee];
    if (scalarFunction) {
      const evaluated = args.map((argument) => this.evaluate(argument.value));
      const series = evaluated.map((value) => this.toSeries(value, line));
      const length = series[0]?.length ?? 0;

      this.spend(length, line);
      this.allocate(line);

      return {
        kind: 'series',
        values: Array.from({ length }, (_, index) => {
          const row = series.map((item) => item[index]);
          return row.some((value) => value === null) ? null : scalarFunction(row as number[]);
        }),
      };
    }

    if (callee === 'nz') {
      const sourceArgument = this.argument(args, 0, 'source');
      const replacementArgument = this.argument(args, 1, 'replacement');
      if (!sourceArgument) throw new PineRuntimeError('nz() needs a value.', line);

      const source = this.toSeries(this.evaluate(sourceArgument), line);
      const replacement = replacementArgument
        ? this.toNumber(this.evaluate(replacementArgument), line, 'A replacement')
        : 0;

      this.spend(source.length, line);
      this.allocate(line);

      return { kind: 'series', values: source.map((value) => (value === null ? replacement : value)) };
    }

    throw new PineRuntimeError(
      `${callee}() is not in the subset this preview computes. The script is unchanged — export it to run it in full.`,
      line
    );
  }
}

function applyOperator(operator: string, a: number, b: number): number {
  switch (operator) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      // Division by zero yields Infinity in JavaScript and `na` in Pine. `na`
      // is the honest one: the result is not a number anybody can plot.
      return b === 0 ? Number.NaN : a / b;
    case '%':
      return b === 0 ? Number.NaN : a % b;
    case '==':
      return a === b ? 1 : 0;
    case '!=':
      return a !== b ? 1 : 0;
    case '<':
      return a < b ? 1 : 0;
    case '<=':
      return a <= b ? 1 : 0;
    case '>':
      return a > b ? 1 : 0;
    case '>=':
      return a >= b ? 1 : 0;
    case 'and':
      return a && b ? 1 : 0;
    case 'or':
      return a || b ? 1 : 0;
    default:
      return Number.NaN;
  }
}

/** Runs a script against a series of bars. Throws with a line number, or returns plots. */
export function runPine(source: string, bars: Bars): PineRunResult {
  if (bars.close.length > MAX_BARS) {
    throw new PineRuntimeError(
      `The preview runs on up to ${MAX_BARS.toLocaleString('en-US')} bars; this chart has more.`,
      1
    );
  }

  const result = new Evaluator(bars).run(parse(source));

  // NaN reaches the plot from division by zero and from math on missing data.
  // It is not a number and must not be drawn as one.
  return {
    ...result,
    plots: result.plots.map((plot) => ({
      ...plot,
      values: plot.values.map((value) =>
        value === null || Number.isNaN(value) || !Number.isFinite(value) ? null : value
      ),
    })),
  };
}

export { PineSyntaxError };
