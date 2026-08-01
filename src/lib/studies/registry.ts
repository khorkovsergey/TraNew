/**
 * Chart studies.
 *
 * The rule this module exists to enforce: the model never writes a calculation
 * and never writes Pine. It picks an id from `STUDIES` and, at most, numbers
 * that `clampSpec` pulls into range. Everything a person then sees — the line on
 * the chart and the code beside it — comes from the deterministic functions
 * below. That is the same guarantee `actionRoutes` makes about navigation: a
 * model that could emit its own code could emit code that does not compute what
 * the chart is drawing, and the two would disagree in front of someone deciding
 * what to do with their money.
 *
 * Isomorphic on purpose — no `server-only`. The computation runs in the browser
 * because the chart is a client component, and the Pine templates are wanted on
 * both sides.
 */

export type StudyId = 'sma' | 'rsi' | 'bbands' | 'macd';

export type StudyParams = Record<string, number>;

export type StudySpec = {
  id: StudyId;
  params: StudyParams;
};

export type StudyLine = {
  /** 'fast' | 'slow' | 'rsi' | 'upper' | 'basis' | 'lower' | 'macd' | 'signal' | 'hist' */
  key: string;
  /** Null until the indicator has enough history to mean anything. */
  values: (number | null)[];
  /** An index, not a colour — the stylesheet owns the palette. */
  color: number;
};

export type ParamRange = { default: number; min: number; max: number };

export type StudyDefinition = {
  id: StudyId;
  /** "MA 50/200", "RSI 14" — built from the params actually in force. */
  label: (params: StudyParams) => string;
  /** Drawn over the price, or in its own pane with its own scale. */
  placement: 'overlay' | 'pane';
  params: Record<string, ParamRange>;
  compute: (closes: number[], params: StudyParams) => StudyLine[];
  /** A template, not a generated string. Never an LLM. */
  pine: (params: StudyParams) => string;
};

/* ------------------------------------------------------------- Primitives */

/** Simple moving average. Null until `length` values exist. */
function sma(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (length < 1) return out;

  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= length) sum -= values[i - length];
    if (i >= length - 1) out[i] = sum / length;
  }

  return out;
}

/**
 * Exponential moving average, seeded with the simple average of the first
 * `length` values.
 *
 * Seeding matters: starting from the first close instead makes the early part of
 * the line depend almost entirely on one bar, and the MACD built on top of it
 * then disagrees with every other chart for the first hundred bars.
 */
function ema(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (length < 1 || values.length < length) return out;

  const k = 2 / (length + 1);
  let previous = values.slice(0, length).reduce((total, value) => total + value, 0) / length;
  out[length - 1] = previous;

  for (let i = length; i < values.length; i += 1) {
    previous = values[i] * k + previous * (1 - k);
    out[i] = previous;
  }

  return out;
}

/**
 * Population standard deviation over a rolling window.
 *
 * Population, not sample — `ta.stdev` in Pine divides by n, so a sample
 * deviation here would draw bands slightly wider than the code printed beside
 * them, which is exactly the kind of quiet disagreement this module exists to
 * prevent.
 */
function stdev(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (length < 1) return out;

  for (let i = length - 1; i < values.length; i += 1) {
    const window = values.slice(i - length + 1, i + 1);
    const mean = window.reduce((total, value) => total + value, 0) / length;
    const variance = window.reduce((total, value) => total + (value - mean) ** 2, 0) / length;
    out[i] = Math.sqrt(variance);
  }

  return out;
}

/**
 * Wilder's RSI.
 *
 * The smoothing is Wilder's own — the first average is the plain mean of the
 * first `length` changes, and every one after it is
 * `(previous * (length - 1) + current) / length`. An ordinary EMA is close
 * enough to look right and far enough off to disagree with `ta.rsi`, which is
 * what the Pine block claims this is.
 */
function rsi(closes: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= length || length < 1) return out;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= length; i += 1) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }

  let averageGain = gains / length;
  let averageLoss = losses / length;
  out[length] = toRsi(averageGain, averageLoss);

  for (let i = length + 1; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    averageGain = (averageGain * (length - 1) + gain) / length;
    averageLoss = (averageLoss * (length - 1) + loss) / length;
    out[i] = toRsi(averageGain, averageLoss);
  }

  return out;
}

function toRsi(averageGain: number, averageLoss: number): number {
  // No losses in the window means no downside to divide by; the index is at its
  // ceiling, which is what every implementation reports rather than an error.
  if (averageLoss === 0) return 100;
  const rs = averageGain / averageLoss;
  return 100 - 100 / (1 + rs);
}

/* --------------------------------------------------------------- Studies */

/**
 * Normalises the line endings of a Pine template.
 *
 * The templates are literals in a checked-out file, so a Windows checkout gives
 * them CRLF and a Linux one LF: the string this module produces would otherwise
 * differ by build machine. It is a small thing — nothing downstream reads a line
 * ending — but a pure function whose output depends on how git happened to write
 * the file is not really a pure function, and the unit test pins it.
 *
 * It is *not* what makes a copied snippet match the one on screen. Reading the
 * clipboard back on Windows always returns CRLF whatever was written to it —
 * `writeText('a
b')` reads back as `a
b` — so a test comparing the two will
 * differ by one character per line and mean nothing. That cost an hour of
 * chasing a deploy that was fine; it is written down here so it costs nobody
 * else one.
 */
function lf(template: string): string {
  return template.replace(/\r\n/g, '\n');
}

export const STUDIES: Record<StudyId, StudyDefinition> = {
  sma: {
    id: 'sma',
    label: (params) => `MA ${params.fast}/${params.slow}`,
    placement: 'overlay',
    params: {
      fast: { default: 50, min: 2, max: 200 },
      slow: { default: 200, min: 2, max: 400 },
    },
    compute: (closes, params) => [
      { key: 'fast', values: sma(closes, params.fast), color: 0 },
      { key: 'slow', values: sma(closes, params.slow), color: 1 },
    ],
    pine: (params) => lf(`//@version=6
indicator("Moving Averages", overlay = true)
fastLen = input.int(${params.fast}, "Fast MA length", minval = 2)
slowLen = input.int(${params.slow}, "Slow MA length", minval = 2)
fastMa = ta.sma(close, fastLen)
slowMa = ta.sma(close, slowLen)
plot(fastMa, "Fast MA", color = color.new(color.blue, 0))
plot(slowMa, "Slow MA", color = color.new(color.orange, 0))`),
  },

  rsi: {
    id: 'rsi',
    label: (params) => `RSI ${params.length}`,
    placement: 'pane',
    params: {
      length: { default: 14, min: 2, max: 50 },
    },
    compute: (closes, params) => [
      { key: 'rsi', values: rsi(closes, params.length), color: 2 },
    ],
    pine: (params) => lf(`//@version=6
indicator("RSI", overlay = false)
length = input.int(${params.length}, "Length", minval = 2)
rsi = ta.rsi(close, length)
plot(rsi, "RSI", color = color.new(color.purple, 0))
hline(70, "Overbought", color = color.new(color.red, 50))
hline(30, "Oversold", color = color.new(color.green, 50))`),
  },

  bbands: {
    id: 'bbands',
    label: (params) => `BB ${params.length}/${params.mult}`,
    placement: 'overlay',
    params: {
      length: { default: 20, min: 2, max: 100 },
      mult: { default: 2, min: 1, max: 4 },
    },
    compute: (closes, params) => {
      const basis = sma(closes, params.length);
      const deviation = stdev(closes, params.length);

      const band = (sign: 1 | -1) =>
        basis.map((value, i) => {
          const spread = deviation[i];
          return value === null || spread === null ? null : value + sign * params.mult * spread;
        });

      return [
        { key: 'upper', values: band(1), color: 1 },
        { key: 'basis', values: basis, color: 0 },
        { key: 'lower', values: band(-1), color: 1 },
      ];
    },
    pine: (params) => lf(`//@version=6
indicator("Bollinger Bands", overlay = true)
length = input.int(${params.length}, "Length", minval = 2)
mult = input.float(${params.mult}, "Standard deviations", minval = 1, maxval = 4)
basis = ta.sma(close, length)
dev = mult * ta.stdev(close, length)
upper = basis + dev
lower = basis - dev
plot(basis, "Basis", color = color.new(color.blue, 0))
plot(upper, "Upper", color = color.new(color.orange, 0))
plot(lower, "Lower", color = color.new(color.orange, 0))
fill(plot(upper, display = display.none), plot(lower, display = display.none), color = color.new(color.blue, 92))`),
  },

  macd: {
    id: 'macd',
    label: (params) => `MACD ${params.fast}/${params.slow}/${params.signal}`,
    placement: 'pane',
    params: {
      fast: { default: 12, min: 2, max: 50 },
      slow: { default: 26, min: 3, max: 100 },
      signal: { default: 9, min: 2, max: 50 },
    },
    compute: (closes, params) => {
      const fast = ema(closes, params.fast);
      const slow = ema(closes, params.slow);

      const macdLine = fast.map((value, i) =>
        value === null || slow[i] === null ? null : value - (slow[i] as number)
      );

      // The signal line is an EMA of the MACD line, which only exists once both
      // averages do — so it is computed over the defined part and put back in
      // place, rather than over an array with holes in it.
      const defined = macdLine.filter((value): value is number => value !== null);
      const offset = macdLine.length - defined.length;
      const signalDefined = ema(defined, params.signal);

      const signal: (number | null)[] = new Array(macdLine.length).fill(null);
      signalDefined.forEach((value, i) => {
        signal[offset + i] = value;
      });

      const hist = macdLine.map((value, i) =>
        value === null || signal[i] === null ? null : value - (signal[i] as number)
      );

      return [
        { key: 'macd', values: macdLine, color: 0 },
        { key: 'signal', values: signal, color: 3 },
        { key: 'hist', values: hist, color: 1 },
      ];
    },
    pine: (params) => lf(`//@version=6
indicator("MACD", overlay = false)
fastLen = input.int(${params.fast}, "Fast length", minval = 2)
slowLen = input.int(${params.slow}, "Slow length", minval = 3)
signalLen = input.int(${params.signal}, "Signal length", minval = 2)
[macdLine, signalLine, histLine] = ta.macd(close, fastLen, slowLen, signalLen)
plot(macdLine, "MACD", color = color.new(color.blue, 0))
plot(signalLine, "Signal", color = color.new(color.orange, 0))
plot(histLine, "Histogram", style = plot.style_columns, color = color.new(color.gray, 40))
hline(0, "Zero", color = color.new(color.gray, 60))`),
  },
};

export const STUDY_IDS = Object.keys(STUDIES) as StudyId[];

function isStudyId(value: unknown): value is StudyId {
  return typeof value === 'string' && value in STUDIES;
}

/**
 * The only way a study specification enters the product.
 *
 * An unknown id is null rather than a nearest guess — a model asking for VWAP
 * should get no indicator, not a moving average pretending to be one. Missing
 * parameters take the defaults and out-of-range ones are pulled in, because a
 * length of 4,000 on a 260-bar series is a blank line and a length of 0 is a
 * division by zero.
 */
export function clampSpec(raw: { id?: unknown; params?: unknown } | null | undefined): StudySpec | null {
  if (!raw || !isStudyId(raw.id)) return null;

  const definition = STUDIES[raw.id];
  const supplied =
    raw.params && typeof raw.params === 'object' ? (raw.params as Record<string, unknown>) : {};

  const params: StudyParams = {};

  for (const [name, range] of Object.entries(definition.params)) {
    const value = supplied[name];
    const numeric = typeof value === 'number' && Number.isFinite(value) ? value : range.default;
    params[name] = Math.min(range.max, Math.max(range.min, Math.round(numeric * 100) / 100));
  }

  return { id: raw.id, params };
}

/** The spec a chip produces when someone turns a study on by hand. */
export function defaultSpec(id: StudyId): StudySpec {
  return clampSpec({ id }) as StudySpec;
}
