/**
 * Periods, and how many bars one costs.
 *
 * The old chart path asked the provider for "about 260 daily bars" and drew
 * whatever came back, whatever had been asked for. So "show Nvidia from January
 * 2024 to June 2025" produced a year of the wrong dates with a caption claiming
 * otherwise, and nothing in the picture said so.
 *
 * This is the arithmetic that fixes it, kept away from anything that fetches so
 * it can be tested without a provider or a key. Four jobs:
 *
 * - **Normalise** what somebody asked for into a real, bounded period.
 * - **Size the request.** The provider returns the most recent N daily bars, so
 *   reaching a start date means asking for enough bars to walk back to it — and
 *   asking for no more than that, because every bar is somebody's rate limit.
 * - **Resample** daily bars into weekly and monthly ones, deterministically.
 * - **Report coverage honestly.** Markets are shut on weekends and holidays, so
 *   the first bar in a period is rarely the date that was typed. The answer says
 *   which dates it actually has rather than repeating the ones it was given.
 *
 * Import-free, so the unit harness compiles it alone.
 */

export type Interval = '1D' | '1W' | '1M';

export const INTERVALS: Interval[] = ['1D', '1W', '1M'];

/** One daily candle, structurally the market client's `DailyBar`. */
export type Bar = {
  /** Unix seconds at the bar's open, UTC midnight for a daily bar. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type DateRange = { start: string; end: string };

/**
 * The provider's ceiling, and the reason a twenty-year request is answered with
 * what it can reach rather than refused.
 */
export const MAX_OUTPUTSIZE = 5000;

/**
 * Below this the market client returns nothing at all.
 *
 * Its reasoning is sound — eight candles claiming to be a year is worse than an
 * empty chart — but it means a five-day request cannot simply ask for five
 * days. So a short period fetches a floor of history and is trimmed afterwards.
 */
export const PROVIDER_MIN_BARS = 30;

/** Enough to survive holidays and a long weekend at the edges of a period. */
const EDGE_BUFFER_BARS = 12;

export function isValidInterval(value: unknown): value is Interval {
  return typeof value === 'string' && (INTERVALS as string[]).includes(value);
}

/** `2026-08-09` from unix seconds, in UTC — the day the bar belongs to. */
export function isoOf(time: number): string {
  return new Date(time * 1000).toISOString().slice(0, 10);
}

function isIsoDay(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function shiftDays(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export type RangeProblem = 'bad_dates' | 'reversed' | 'future';

/**
 * What was asked for, made real.
 *
 * Defaults are the ones somebody means when they leave a side off: no end date
 * means up to now, no start date means the last year. An end date in the future
 * is pulled back to today rather than refused — asking for "through the end of
 * the month" on the ninth is a reasonable thing to say, and there is an obvious
 * right answer.
 */
export function normalizeRange(
  input: { start?: unknown; end?: unknown },
  today: string
): { ok: true; range: DateRange } | { ok: false; problem: RangeProblem } {
  const hasStart = input.start !== undefined && input.start !== null && input.start !== '';
  const hasEnd = input.end !== undefined && input.end !== null && input.end !== '';

  if ((hasStart && !isIsoDay(input.start)) || (hasEnd && !isIsoDay(input.end))) {
    return { ok: false, problem: 'bad_dates' };
  }

  const end = hasEnd
    ? // Clamped rather than refused: "to the end of the year" is a normal thing
      // to ask in August, and the honest answer is everything up to today.
      (input.end as string) > today
      ? today
      : (input.end as string)
    : today;

  const start = hasStart ? (input.start as string) : shiftDays(end, -365);

  if (start > today) return { ok: false, problem: 'future' };
  if (start > end) return { ok: false, problem: 'reversed' };

  return { ok: true, range: { start, end } };
}

/**
 * How many daily bars to ask the provider for.
 *
 * It returns the most recent N, so the count has to reach from *today* back to
 * the start of the period — not merely span the period. A request for January
 * 2024 costs the walk back to January 2024 whether or not the period itself is
 * short.
 *
 * Five sevenths of the calendar is the trading week, plus a buffer for holidays
 * at each edge, plus the floor the client refuses to go below. Capped, because
 * a request for 1970 should come back with what exists rather than an error.
 */
export function outputsizeFor(range: DateRange, today: string): number {
  const calendarDays = Math.max(0, daysBetween(range.start, today));
  const tradingDays = Math.ceil((calendarDays * 5) / 7) + EDGE_BUFFER_BARS;

  // Twice the client's floor: at exactly thirty it returns the series, and one
  // holiday inside a short period would take it under.
  const floor = PROVIDER_MIN_BARS * 2;

  return Math.min(MAX_OUTPUTSIZE, Math.max(floor, tradingDays));
}

/** The bars inside the period, from a series that reaches further back. */
export function trimToRange(bars: Bar[], range: DateRange): Bar[] {
  return bars.filter((bar) => {
    const day = isoOf(bar.time);
    return day >= range.start && day <= range.end;
  });
}

/** The Monday of a bar's week, in UTC — the label a weekly bar carries. */
function weekStart(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  // getUTCDay: 0 is Sunday, so Sunday belongs to the week that began six days
  // earlier rather than starting one of its own.
  const offset = (date.getUTCDay() + 6) % 7;
  return shiftDays(day, -offset);
}

function bucketKey(day: string, interval: Interval): string {
  if (interval === '1W') return weekStart(day);
  if (interval === '1M') return `${day.slice(0, 7)}-01`;
  return day;
}

/**
 * Weekly and monthly bars, derived from daily ones.
 *
 * Derived rather than fetched, and the difference is worth stating on screen:
 * the source data is daily, so a weekly bar is the week's daily bars folded
 * together — first open, highest high, lowest low, last close, summed volume.
 * A partial week at the edge of a period is a partial week, and it is kept
 * rather than dropped, because dropping it would silently move the end date
 * away from the one the person asked for.
 */
export function resample(bars: Bar[], interval: Interval): Bar[] {
  if (interval === '1D') return bars;

  const buckets = new Map<string, Bar>();
  const order: string[] = [];

  for (const bar of bars) {
    const key = bucketKey(isoOf(bar.time), interval);
    const existing = buckets.get(key);

    if (!existing) {
      order.push(key);
      buckets.set(key, {
        // The bucket's own start, so two runs over the same data label the bar
        // identically whichever day of the week the series happens to begin on.
        time: Date.parse(`${key}T00:00:00Z`) / 1000,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        ...(bar.volume === undefined ? {} : { volume: bar.volume }),
      });
      continue;
    }

    existing.high = Math.max(existing.high, bar.high);
    existing.low = Math.min(existing.low, bar.low);
    existing.close = bar.close;
    if (bar.volume !== undefined) {
      existing.volume = (existing.volume ?? 0) + bar.volume;
    }
  }

  return order.map((key) => buckets.get(key)!);
}

export type Coverage = {
  requestedStart: string;
  requestedEnd: string;
  /** The first and last dates there is actually a bar for. */
  firstObservation: string | null;
  lastObservation: string | null;
  bars: number;
  interval: Interval;
  /**
   * True when the provider could not reach back as far as the request did, so
   * the period on screen starts later than the one that was typed.
   */
  truncated: boolean;
  /** Weekly and monthly bars are folded from daily ones, and say so. */
  derivedFromDaily: boolean;
};

export function coverageOf(
  bars: Bar[],
  range: DateRange,
  interval: Interval,
  options: { reachedProviderCap: boolean }
): Coverage {
  const first = bars.length ? isoOf(bars[0].time) : null;
  const last = bars.length ? isoOf(bars[bars.length - 1].time) : null;

  return {
    requestedStart: range.start,
    requestedEnd: range.end,
    firstObservation: first,
    lastObservation: last,
    bars: bars.length,
    interval,
    /*
     * Truncation is about the provider running out of history, not about a
     * weekend. A period starting on a Saturday legitimately has its first bar
     * on the Monday, and calling that truncated would cry wolf on most requests.
     */
    truncated: options.reachedProviderCap && first !== null && first > range.start,
    derivedFromDaily: interval !== '1D',
  };
}

/** The coverage as one line, for the answer and for the planner. */
export function describeCoverage(coverage: Coverage): string {
  if (!coverage.bars || !coverage.firstObservation) {
    return `no observations between ${coverage.requestedStart} and ${coverage.requestedEnd}`;
  }

  const parts = [
    `${coverage.bars} ${coverage.interval} bars`,
    `${coverage.firstObservation} to ${coverage.lastObservation}`,
  ];

  if (coverage.firstObservation > coverage.requestedStart) {
    parts.push(
      coverage.truncated
        ? `history does not reach ${coverage.requestedStart}`
        : `first trading day on or after ${coverage.requestedStart}`
    );
  }
  if (coverage.derivedFromDaily) parts.push('folded from daily bars');

  return parts.join(' · ');
}
