import type { ScriptStatus } from './document';

/**
 * Checks on a Pine v6 script.
 *
 * This is a checker, not an interpreter, and the distinction is the whole point
 * of the file. It reads the source for things it recognises and reports what it
 * finds; it does not evaluate Pine, does not know Pine's type system, and
 * cannot tell you a script is correct.
 *
 * So the vocabulary is deliberately one-sided. A clean result says "nothing
 * here was recognised as a problem", never "valid" — because the second is a
 * claim about a language this file does not implement, and somebody would rely
 * on it. The design's acceptance list puts it plainly: unsupported functions
 * are named, with no implication of full compatibility.
 *
 * Import-free beyond a type, so the harness compiles it alone.
 */

export type Diagnostic = {
  severity: 'error' | 'warning' | 'note';
  /** 1-based, so it matches what the editor's gutter shows. */
  line: number;
  message: string;
};

/**
 * Built-ins this preview knows how to compute.
 *
 * Deliberately short. Phase 8 brings a restricted runtime; until then the list
 * is what the chart's own studies use, and everything else is named as
 * unsupported rather than assumed to work.
 */
export const SUPPORTED_FUNCTIONS = [
  'ta.sma',
  'ta.ema',
  'ta.rsi',
  'ta.stdev',
  'ta.cross',
  'ta.crossover',
  'ta.crossunder',
  'ta.highest',
  'ta.lowest',
  'ta.change',
  'plot',
  'plotshape',
  'hline',
  'fill',
  'input.int',
  'input.float',
  'input.bool',
  'input.string',
  'indicator',
  'color.new',
  'math.abs',
  'math.max',
  'math.min',
  'math.round',
  'nz',
];

/**
 * Calls that will not run in the preview even though they are real Pine.
 *
 * Named individually, because "some functions are unsupported" tells nobody
 * which line to change.
 */
const KNOWN_UNSUPPORTED: Record<string, string> = {
  'request.security': 'reads another symbol or timeframe, which the preview does not fetch',
  'request.financial': 'reads fundamentals, which the preview does not fetch',
  'request.dividends': 'reads corporate actions, which the preview does not fetch',
  strategy: 'is a strategy declaration; the preview runs indicators only',
  'strategy.entry': 'places orders, which this workspace never does',
  'strategy.close': 'places orders, which this workspace never does',
  alertcondition: 'creates alerts, which are not wired to a live feed yet',
  'array.new_float': 'uses arrays, which the preview does not implement',
  'matrix.new': 'uses matrices, which the preview does not implement',
  label: 'draws labels, which the preview does not render',
  table: 'draws tables, which the preview does not render',
  'box.new': 'draws boxes, which the preview does not render',
  'line.new': 'draws lines, which the preview does not render',
};

/** Every `name(` in the source, with the line it appears on. */
function callsIn(source: string): Array<{ name: string; line: number }> {
  const out: Array<{ name: string; line: number }> = [];

  source.split('\n').forEach((text, index) => {
    // Comments are not code. Without this, naming an unsupported function while
    // explaining why you avoided it would be reported as using it.
    const code = text.split('//')[0];
    for (const match of code.matchAll(/([A-Za-z_][A-Za-z0-9_.]*)\s*\(/g)) {
      out.push({ name: match[1], line: index + 1 });
    }
  });

  return out;
}

export function diagnose(source: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = source.split('\n');

  /* ------------------------------------------------------------- Structure */

  const versionLine = lines.findIndex((line) => line.trim().startsWith('//@version='));
  if (versionLine === -1) {
    diagnostics.push({
      severity: 'error',
      line: 1,
      message: 'No //@version= directive. Pine needs one on the first line.',
    });
  } else if (versionLine !== 0) {
    diagnostics.push({
      severity: 'error',
      line: versionLine + 1,
      message: 'The //@version= directive has to be the first line of the script.',
    });
  } else if (!lines[0].includes('//@version=6')) {
    diagnostics.push({
      severity: 'warning',
      line: 1,
      message: `This workspace generates Pine v6. "${lines[0].trim()}" is a different version, and the differences between versions are not cosmetic.`,
    });
  }

  const declarations = lines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => /^(indicator|strategy|library)\s*\(/.test(line));

  if (!declarations.length) {
    diagnostics.push({
      severity: 'error',
      line: 1,
      message: 'No indicator(), strategy() or library() declaration. A Pine script needs exactly one.',
    });
  } else if (declarations.length > 1) {
    diagnostics.push({
      severity: 'error',
      line: declarations[1].index + 1,
      message: `${declarations.length} declarations. Pine allows exactly one per script — split this into separate scripts.`,
    });
  }

  /* ----------------------------------------------------------- Brackets */

  lines.forEach((text, index) => {
    const code = text.split('//')[0];
    let depth = 0;
    for (const character of code) {
      if (character === '(') depth += 1;
      if (character === ')') depth -= 1;
      if (depth < 0) break;
    }
    if (depth !== 0) {
      diagnostics.push({
        severity: depth > 0 ? 'warning' : 'error',
        line: index + 1,
        message:
          depth > 0
            ? `${depth} bracket${depth === 1 ? '' : 's'} left open on this line. That is legal across a continuation, so check it rather than trusting it.`
            : 'A closing bracket here has no opening one.',
      });
    }
  });

  /* ------------------------------------------------------------- Calls */

  const seen = new Set<string>();

  for (const call of callsIn(source)) {
    const unsupported = KNOWN_UNSUPPORTED[call.name];

    if (unsupported) {
      diagnostics.push({
        severity: 'warning',
        line: call.line,
        message: `${call.name}() ${unsupported}.`,
      });
      continue;
    }

    /*
     * Namespaced calls this checker does not know are reported as unknown to
     * the checker — not as invalid Pine. The difference matters: Pine has far
     * more built-ins than the list above, and telling somebody their correct
     * script is wrong is how a linter gets ignored.
     */
    if (call.name.includes('.') && !SUPPORTED_FUNCTIONS.includes(call.name) && !seen.has(call.name)) {
      seen.add(call.name);
      diagnostics.push({
        severity: 'note',
        line: call.line,
        message: `${call.name}() is real Pine but outside what this preview computes, so it will not be evaluated here.`,
      });
    }
  }

  /* ----------------------------------------------------------- Plotting */

  if (!/\b(plot|plotshape|plotchar|plotcandle|hline)\s*\(/.test(source)) {
    diagnostics.push({
      severity: 'warning',
      line: lines.length,
      message: 'Nothing is plotted, so this script would compute and show nothing.',
    });
  }

  return diagnostics.sort((a, b) => a.line - b.line);
}

/** The document status implied by its diagnostics. */
export function statusFor(diagnostics: Diagnostic[]): ScriptStatus {
  if (diagnostics.some((item) => item.severity === 'error')) return 'error';
  if (diagnostics.some((item) => item.severity === 'warning')) return 'warning';
  return 'valid';
}

/**
 * What the status means, in words, so nothing implies more than was checked.
 *
 * `valid` in the type means "nothing was recognised as a problem". Saying that
 * out loud is the difference between a checker somebody uses correctly and one
 * they trust with a script that does not compile.
 */
export function statusLabel(status: ScriptStatus): string {
  switch (status) {
    case 'error':
      return 'Errors found';
    case 'warning':
      return 'Check the warnings';
    case 'valid':
      return 'Nothing flagged — not the same as verified';
    case 'applied':
      return 'On the chart';
    default:
      return 'Draft';
  }
}
