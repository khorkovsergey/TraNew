/**
 * The contract every Voyager tool obeys.
 *
 * The rule this file exists to enforce: **the model never manufactures a tool
 * result.** It picks a tool, supplies arguments this module validates, and
 * reasons over what came back. Everything that retrieves, computes or resolves
 * is deterministic code on the server, and what it returns is the only thing
 * the answer may rest on.
 *
 * Two consequences shape the types below.
 *
 * **A failure is a value, not an exception.** An unknown symbol, a provider
 * with nothing to say, an unsupported period — those are product states. A
 * person is owed a sentence about them, and the planner is owed a chance to try
 * something else. A thrown error gives neither: it collapses the whole answer
 * into the scripted fallback, which is how "no data for that period" used to
 * read as "Voyager is temporarily unavailable".
 *
 * **What ran is recorded, not described.** The trace is built from the calls
 * that actually returned, so the chips under an answer are evidence rather than
 * the model's account of itself. A chip claiming a tool ran when none did is
 * the same lie as an invented source.
 *
 * Import-free, so the unit harness compiles it alone.
 */

export type VoyagerToolId = 'portal_navigation' | 'investment_analysis';

export const VOYAGER_TOOL_IDS: VoyagerToolId[] = [
  'portal_navigation',
  'investment_analysis',
];

export function isVoyagerToolId(value: unknown): value is VoyagerToolId {
  return typeof value === 'string' && (VOYAGER_TOOL_IDS as string[]).includes(value);
}

/**
 * Why a tool did not produce a result.
 *
 * A closed set, because each one is a different sentence to the person and a
 * different decision for the planner. "Something went wrong" is neither.
 */
export type ToolErrorCode =
  /** The planner named a tool that does not exist. */
  | 'unknown_tool'
  /** The arguments did not validate, or were outside their bounds. */
  | 'bad_arguments'
  /** The thing asked for does not exist here — an unknown instrument, an unmapped destination. */
  | 'not_found'
  /** It exists, and there is nothing to say about it right now. */
  | 'no_data'
  /** A real request for something this product does not do. */
  | 'unsupported'
  /** A dependency was down, rate-limited or unconfigured. Trying again may work. */
  | 'unavailable'
  /** The tier, consent or session does not reach it. */
  | 'not_permitted';

export type VoyagerToolFailure = {
  ok: false;
  code: ToolErrorCode;
  /** Said to the person, in their terms. Never a stack trace. */
  message: string;
  /** Whether trying again, or trying differently, could work. */
  recoverable: boolean;
};

export type VoyagerToolSuccess<T> = {
  ok: true;
  data: T;
  /**
   * The result as one line for the planner.
   *
   * Compact on purpose: the model needs the finding, not the array. A thousand
   * price points in a prompt is a thousand price points the model will be
   * tempted to do arithmetic on, and arithmetic is what the deterministic half
   * of this architecture is for.
   */
  summary: string;
};

export type VoyagerToolResult<T = unknown> = VoyagerToolSuccess<T> | VoyagerToolFailure;

export function toolFailure(
  code: ToolErrorCode,
  message: string,
  recoverable = false
): VoyagerToolFailure {
  return { ok: false, code, message, recoverable };
}

/* --------------------------------------------------------------- The trace */

/**
 * One tool call that actually happened.
 *
 * `call` is what the chip under the answer says. It names the tool and its
 * subject — `investment-analysis(TSLA)`, `web-search(3)` — so somebody reading
 * an answer can see what it was built from.
 */
export type ToolTraceEntry = {
  id: string;
  ok: boolean;
  code?: ToolErrorCode;
  call: string;
};

/**
 * How many rounds of tool calls one answer may run.
 *
 * A ceiling rather than a target. A question that genuinely needs four rounds
 * exists; a loop that needs forty is a loop that has stopped making progress,
 * and the person waiting for it has no way to tell the difference.
 */
export const MAX_TOOL_STEPS = 4;

/** How many tool calls one round may contain, so a single step cannot fan out forever. */
export const MAX_CALLS_PER_STEP = 6;

/** The chips an answer shows: successful calls, in the order they ran. */
export function traceChips(trace: ToolTraceEntry[]): string[] {
  return trace.filter((entry) => entry.ok).map((entry) => entry.call);
}

/**
 * What the person is told about a tool that did not work.
 *
 * Shown rather than swallowed. An answer built with one of its three tools
 * missing is a different answer, and saying which one is missing is the
 * difference between a limitation and a mistake.
 */
export function failureNotes(trace: ToolTraceEntry[]): string[] {
  return trace
    .filter((entry) => !entry.ok)
    .map((entry) => `${entry.call} — ${entry.code ?? 'failed'}`);
}

/**
 * A key for a call, so the same failing call is not made twice.
 *
 * §17's guardrail: a planner that retries an identical failed call is a planner
 * that will retry it until the step cap, spending the person's wait on a
 * question already answered with "no".
 */
export function callKey(id: string, input: unknown): string {
  let serialised: string;
  try {
    serialised = JSON.stringify(input ?? null);
  } catch {
    serialised = String(input);
  }
  return `${id}:${serialised}`;
}

/* ---------------------------------------------------------- Argument gates */

/**
 * A string argument, bounded and trimmed, or null.
 *
 * Every argument from the model passes through one of these. Not because the
 * model is hostile, but because a tool that trusts its input is a tool whose
 * behaviour depends on a sentence somebody typed.
 */
export function argString(value: unknown, max = 120): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim().slice(0, max);
  return trimmed || null;
}

/** A ticker-shaped argument, or null. Letters, digits and the separators real symbols use. */
export function argTicker(value: unknown): string | null {
  const candidate = argString(value, 16)?.toUpperCase();
  if (!candidate) return null;
  return /^[A-Z0-9][A-Z0-9.\-:/]{0,15}$/.test(candidate) ? candidate : null;
}
