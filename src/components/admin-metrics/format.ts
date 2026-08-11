import { explain, isNumeric, type MetricState, type MetricValue } from '@/lib/analytics/states';

/**
 * How a `MetricValue` becomes something a reader can see.
 *
 * One module, because the alternative is fourteen sections each deciding for
 * themselves what a missing source looks like — and the moment two of them
 * disagree, the page has two vocabularies and the provenance system stops
 * meaning anything.
 *
 * Nothing here can turn an absent metric into a number. `display()` returns a
 * discriminated result and the caller has to look at `kind` before it can read
 * a figure, which is the same discipline `states.ts` enforces on the query
 * side, carried through to the pixel.
 */

/* ------------------------------------------------------------ State labels */

/**
 * The badge word for each canonical state.
 *
 * The design shipped eight states and `states.ts` defines eleven. The three it
 * did not have — `instrumented_going_forward`, `not_measurable`, `stale` — are
 * corrections engineering made after the design was drawn, so they get the
 * design's visual grammar rather than being folded into a neighbour. Colour is
 * assigned in the stylesheet against the same `data-state` attribute.
 */
export const STATE_LABEL: Record<MetricState, string> = {
  live: 'Live',
  derived: 'Derived',
  instrumented_going_forward: 'Collecting',
  insufficient_sample: 'Low n',
  source_not_connected: 'No source',
  feature_disabled: 'Not exposed',
  coming_soon: 'Coming soon',
  external: 'External',
  legacy: 'Legacy',
  stale: 'Delayed',
  not_measurable: 'Not measurable',
};

/** What the state means, for the badge's tooltip and the rail legend. */
export const STATE_MEANING: Record<MetricState, string> = {
  live: 'Measured directly from the live event stream.',
  derived: 'Computed from live events rather than counted from one.',
  instrumented_going_forward:
    'Instrumented and collecting, with no history before the sink was connected.',
  insufficient_sample: 'Data exists but n is below the minimum, so the count shows and the rate does not.',
  source_not_connected: 'An external source nobody has connected. Excluded from every roll-up.',
  feature_disabled: 'A feature flag is off, so the surface is unreachable and a zero would be false.',
  coming_soon: 'Announced but inert. A click on it is demand, not usage.',
  external: 'Measured outside the portal — and actually measured, which is the test.',
  legacy: 'A retired flow. Never merged into a current funnel and never into PMCR.',
  stale: 'Telemetry has not arrived inside the freshness budget.',
  not_measurable: 'No mechanism exists to know this, and none is being faked.',
};

/** The states that mean "there is no number here", for absence-aware layout. */
export function isAbsent(metric: MetricValue): boolean {
  return !isNumeric(metric);
}

/* --------------------------------------------------------------- Numbers */

export type ValueFormat = 'count' | 'percent' | 'seconds' | 'milliseconds' | 'score' | 'ratio';

const COUNT = new Intl.NumberFormat('en-US');

export function formatNumber(value: number, format: ValueFormat = 'count'): string {
  switch (format) {
    case 'percent':
      /* One decimal place: a continuation rate that moves by a tenth of a point
         is a real movement at this volume, and rounding it away would make two
         genuinely different weeks print the same figure. */
      return `${(value * 100).toFixed(1)}%`;
    case 'seconds':
      return value >= 60 ? `${(value / 60).toFixed(1)} min` : `${value.toFixed(1)} s`;
    case 'milliseconds':
      return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
    case 'score':
      return value.toFixed(3);
    case 'ratio':
      return value.toFixed(2);
    case 'count':
    default:
      return COUNT.format(Math.round(value));
  }
}

export function formatCount(value: number): string {
  return COUNT.format(Math.round(value));
}

/* --------------------------------------------------------------- Display */

export type Display =
  | { kind: 'value'; text: string; state: MetricState; sample: number }
  | { kind: 'absent'; text: string; detail: string; state: MetricState };

/**
 * The only way a component turns a metric into text.
 *
 * An absent metric gets a short label for the big slot and the full sentence
 * for the line underneath, so a card is never both blank and silent — the whole
 * point of the provenance system is that a reader can tell "this is bad" from
 * "there is no number", without opening anything.
 */
export function display(metric: MetricValue, format: ValueFormat = 'count'): Display {
  if (isNumeric(metric)) {
    return {
      kind: 'value',
      text: formatNumber(metric.value, format),
      state: metric.state,
      sample: metric.sample,
    };
  }

  return {
    kind: 'absent',
    text: STATE_LABEL[metric.state],
    detail: explain(metric),
    state: metric.state,
  };
}

/** The subline under a value: what the denominator was, when one exists. */
export function sampleLine(metric: MetricValue, noun = 'observations'): string {
  if (isNumeric(metric)) return `n = ${formatCount(metric.sample)} ${noun}`;
  if (metric.state === 'insufficient_sample') {
    return `${formatCount(metric.sample)} of ${formatCount(metric.threshold)} ${noun} needed`;
  }
  return '';
}

/* ----------------------------------------------------------------- Times */

/**
 * A timestamp as an age, measured **against query time** rather than now.
 *
 * `anchor` is required and is always the server's `queriedAt`. Two reasons, and
 * the second is why it is not optional.
 *
 * The design handoff asks for exactly this: freshness is "a query-time snapshot
 * — last telemetry 9s before query — not a ticking live counter". An age
 * against the reader's wall clock would keep growing while they read the page
 * and imply the data was decaying in front of them, when in fact it is a fixed
 * observation about one query.
 *
 * And `Date.now()` inside a render is a hydration bug. This component tree is
 * server-rendered and then hydrated, the two clocks are milliseconds apart, and
 * rounding to whole seconds turns that into "38s ago" on the server against
 * "39s ago" in the browser — a text mismatch React reports as an error. An
 * anchor from the payload is identical in both passes.
 */
export function ago(iso: string | null | undefined, anchor: number): string {
  if (!iso) return 'never';
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return 'unknown';

  const seconds = Math.max(0, Math.round((anchor - at) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

/** `HH:MM:SS UTC`, the design's own stamp format. */
export function utcClock(iso: string | null | undefined): string {
  if (!iso) return '—';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}:${pad(at.getUTCSeconds())} UTC`;
}

export function utcDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '—' : at.toISOString().slice(0, 10);
}

/* ----------------------------------------------------------------- Words */

/** `voyager_request_completed` → `voyager request completed`. */
export function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}

/** Sentence case for an enum-ish token, for headings and badges. */
export function titleize(value: string): string {
  const words = humanize(value);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A share as a percentage, or an em dash when the denominator is zero. */
export function share(numerator: number, denominator: number): string {
  if (denominator <= 0) return '—';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

/** Bar width as a CSS percentage, clamped so a rounding error cannot overflow. */
export function widthOf(numerator: number, denominator: number): string {
  if (denominator <= 0) return '0%';
  return `${Math.max(0, Math.min(100, (numerator / denominator) * 100)).toFixed(1)}%`;
}
