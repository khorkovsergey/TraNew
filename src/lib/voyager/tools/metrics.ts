/**
 * The arithmetic, done here so nobody asks a language model to do it.
 *
 * Every figure an answer states about a price series is computed by one of
 * these functions. Not because a model cannot multiply, but because a model
 * asked to compute a drawdown from four hundred numbers will produce a
 * plausible one, and a plausible drawdown in a financial product is worse than
 * no drawdown at all — it is wrong in a way that reads as right.
 *
 * Two rules the shape of this file enforces:
 *
 * **A metric that is not meaningful is null, not zero.** Annualised volatility
 * over six observations is arithmetic, not information; CAGR over four months
 * is a number that will be read as a yearly rate. Each of these returns null
 * with a stated minimum rather than a figure somebody would quote.
 *
 * **Every figure carries how it was measured.** The observation count, the
 * interval and the period travel with the numbers, because "up 40%" means
 * different things over a month and over five years.
 *
 * Import-free, so the unit harness compiles it alone.
 */

import type { Bar, Interval } from './range';

/** Trading periods in a year, by interval. Used for annualising. */
const PERIODS_PER_YEAR: Record<Interval, number> = {
  '1D': 252,
  '1W': 52,
  '1M': 12,
};

/**
 * The fewest observations each metric needs before it means anything.
 *
 * Deliberately conservative. A volatility from twelve daily closes is a
 * fortnight's noise annualised into a headline figure.
 */
export const MIN_OBSERVATIONS = {
  change: 2,
  volatility: 20,
  drawdown: 2,
  cagr: 2,
  correlation: 20,
} as const;

/** How long a period must be before a compound annual rate is honest. */
const MIN_CAGR_DAYS = 365;

export type SeriesMetrics = {
  observations: number;
  interval: Interval;
  first: { date: string; close: number };
  last: { date: string; close: number };
  /** Absolute move, in the instrument's own currency. */
  change: number;
  /** Percentage return over the period. */
  changePercent: number;
  periodHigh: { date: string; value: number };
  periodLow: { date: string; value: number };
  /** Deepest peak-to-trough fall inside the period, as a negative percentage. */
  maxDrawdown: number;
  /** Annualised standard deviation of returns, or null when the period is too short. */
  annualisedVolatility: number | null;
  /** Compound annual growth rate, or null when the period is under a year. */
  cagr: number | null;
  /** Mean volume per bar, or null when the provider sent none. */
  averageVolume: number | null;
  /** Anything a reader would need to know before quoting the figures above. */
  caveats: string[];
};

function isoOf(time: number): string {
  return new Date(time * 1000).toISOString().slice(0, 10);
}

function round(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Simple returns between consecutive closes. One shorter than the series. */
export function returnsOf(bars: Bar[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < bars.length; i += 1) {
    const previous = bars[i - 1].close;
    // A zero or negative close is not a price; skipping it beats an infinity
    // propagating into every figure downstream.
    if (!(previous > 0)) continue;
    out.push(bars[i].close / previous - 1);
  }
  return out;
}

/**
 * Annualised volatility, from the sample standard deviation of returns.
 *
 * Sample rather than population — n−1 — because these returns are a sample of
 * the instrument's behaviour rather than the whole of it, which is the
 * convention every other tool a reader might compare against uses.
 */
export function annualisedVolatility(bars: Bar[], interval: Interval): number | null {
  const returns = returnsOf(bars);
  if (returns.length + 1 < MIN_OBSERVATIONS.volatility) return null;

  const mean = returns.reduce((total, value) => total + value, 0) / returns.length;
  const variance =
    returns.reduce((total, value) => total + (value - mean) ** 2, 0) / (returns.length - 1);

  return round(Math.sqrt(variance) * Math.sqrt(PERIODS_PER_YEAR[interval]) * 100, 2);
}

/**
 * The deepest peak-to-trough fall, as a negative percentage.
 *
 * Measured on the running maximum of closes rather than on intraday lows: a
 * daily bar's low is a moment, and a drawdown quoted from it is deeper than the
 * one anybody actually lived through holding the instrument.
 */
export function maxDrawdown(bars: Bar[]): number {
  let peak = -Infinity;
  let worst = 0;

  for (const bar of bars) {
    if (bar.close > peak) peak = bar.close;
    if (peak > 0) {
      const fall = bar.close / peak - 1;
      if (fall < worst) worst = fall;
    }
  }

  return round(worst * 100, 2);
}

/**
 * Compound annual growth rate, or null.
 *
 * Null under a year, on purpose. A four-month gain of 30% annualises to
 * something near 130%, which is arithmetically correct and will be read as a
 * forecast.
 */
export function cagr(bars: Bar[]): number | null {
  if (bars.length < MIN_OBSERVATIONS.cagr) return null;

  const first = bars[0];
  const last = bars[bars.length - 1];
  if (!(first.close > 0)) return null;

  const days = (last.time - first.time) / 86_400;
  if (days < MIN_CAGR_DAYS) return null;

  const years = days / 365.25;
  return round(((last.close / first.close) ** (1 / years) - 1) * 100, 2);
}

/**
 * Every figure for one series.
 *
 * Returns null rather than a shape full of zeroes when there is not enough to
 * measure: two observations is the floor for saying anything at all about a
 * change, and one is a price rather than a period.
 */
export function seriesMetrics(bars: Bar[], interval: Interval): SeriesMetrics | null {
  if (bars.length < MIN_OBSERVATIONS.change) return null;

  const first = bars[0];
  const last = bars[bars.length - 1];

  let high = bars[0];
  let low = bars[0];
  for (const bar of bars) {
    if (bar.high > high.high) high = bar;
    if (bar.low < low.low) low = bar;
  }

  const volumes = bars
    .map((bar) => bar.volume)
    .filter((volume): volume is number => typeof volume === 'number' && Number.isFinite(volume));

  const volatility = annualisedVolatility(bars, interval);
  const compound = cagr(bars);

  const caveats: string[] = [];
  if (volatility === null) {
    caveats.push(
      `volatility needs at least ${MIN_OBSERVATIONS.volatility} observations; this period has ${bars.length}`
    );
  }
  if (compound === null) {
    caveats.push('CAGR is not quoted for a period under a year');
  }
  if (volumes.length === 0) {
    caveats.push('the provider sent no volume for this instrument');
  } else if (volumes.length < bars.length) {
    caveats.push(`volume is missing on ${bars.length - volumes.length} of ${bars.length} bars`);
  }

  return {
    observations: bars.length,
    interval,
    first: { date: isoOf(first.time), close: round(first.close, 4) },
    last: { date: isoOf(last.time), close: round(last.close, 4) },
    change: round(last.close - first.close, 4),
    changePercent: first.close > 0 ? round((last.close / first.close - 1) * 100, 2) : 0,
    periodHigh: { date: isoOf(high.time), value: round(high.high, 4) },
    periodLow: { date: isoOf(low.time), value: round(low.low, 4) },
    maxDrawdown: maxDrawdown(bars),
    annualisedVolatility: volatility,
    cagr: compound,
    averageVolume: volumes.length
      ? Math.round(volumes.reduce((total, value) => total + value, 0) / volumes.length)
      : null,
    caveats,
  };
}

/* ------------------------------------------------------------- Comparison */

/**
 * The dates two or more series share.
 *
 * Intersection rather than union, and this is the part that quietly goes wrong
 * everywhere else: two instruments that do not trade on the same holidays have
 * different date sets, and pairing them by index rather than by date compares
 * Monday against Tuesday for the rest of the series. An instrument listed after
 * the period began shortens the common period for everybody, which is correct —
 * a comparison over dates one of them did not exist for is not a comparison.
 */
export function commonDates(series: Bar[][]): string[] {
  if (series.length === 0) return [];

  const sets = series.map((bars) => new Set(bars.map((bar) => isoOf(bar.time))));
  const [first, ...rest] = sets;

  return [...first].filter((date) => rest.every((set) => set.has(date))).sort();
}

/** One series restricted to a set of dates, in that order. */
export function alignTo(bars: Bar[], dates: string[]): Bar[] {
  const byDate = new Map(bars.map((bar) => [isoOf(bar.time), bar]));
  return dates.map((date) => byDate.get(date)).filter((bar): bar is Bar => bar !== undefined);
}

/**
 * Every series rebased to 100 at the first shared date.
 *
 * The default for comparing instruments, and the reason is arithmetic rather
 * than aesthetic: a share at $400 and a share at $40 plotted together produce a
 * chart of the first one and a flat line. Normalising asks the question people
 * actually mean — which grew more — and the base is stated so nobody reads 118
 * as a price.
 */
export function normalise(bars: Bar[], base = 100): (number | null)[] {
  const start = bars[0]?.close;
  if (!(start > 0)) return bars.map(() => null);
  return bars.map((bar) => round((bar.close / start) * base, 4));
}

/**
 * Pearson correlation of two return series, or null.
 *
 * Both must already be aligned to the same dates — correlating unaligned series
 * is the same off-by-a-holiday error as pairing by index, with a single number
 * at the end that hides it.
 */
export function correlation(a: Bar[], b: Bar[]): number | null {
  if (a.length !== b.length) return null;
  if (a.length < MIN_OBSERVATIONS.correlation) return null;

  const x = returnsOf(a);
  const y = returnsOf(b);
  if (x.length !== y.length || x.length < 2) return null;

  const meanX = x.reduce((total, value) => total + value, 0) / x.length;
  const meanY = y.reduce((total, value) => total + value, 0) / y.length;

  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;

  for (let i = 0; i < x.length; i += 1) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }

  if (varianceX === 0 || varianceY === 0) return null;
  return round(covariance / Math.sqrt(varianceX * varianceY), 4);
}
