/**
 * Freshness, judged against the cadence of the data rather than the clock.
 *
 * Import-free, so every boundary below is checkable with fixtures.
 *
 * One global `now - asOf > X` rule would be wrong for every dataset this
 * product has. A quote is *deliberately* fifteen minutes old on the free tier
 * and that is a policy, not an outage. Friday's close is the correct answer all
 * weekend. A monthly macro series is months old by design and always will be.
 * A single threshold would have reported the product as broken every Saturday
 * and permanently broken on macro, which is the fastest way to teach somebody
 * to ignore a health indicator.
 */

export const FRESHNESS_BUCKETS = [
  'current',
  /** Old by design — the free tier's fifteen-minute quote delay. */
  'delayed_expected',
  'stale_1d',
  'stale_3d',
  'stale_7d_plus',
  /** The dataset has no meaningful staleness, so none is claimed. */
  'not_applicable',
  'unknown',
] as const;

export type FreshnessBucket = (typeof FRESHNESS_BUCKETS)[number];

export type DataKind = 'quote' | 'quotes_batch' | 'series' | 'bars' | 'macro';

/** The free tier's documented quote delay, with room for the cache behind it. */
const QUOTE_DELAY_MINUTES = 15;
const QUOTE_TOLERANCE_MINUTES = 45;

const DAY_MS = 86_400_000;

function isWeekend(at: Date): boolean {
  const day = at.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Trading days between two instants, weekends removed.
 *
 * Deliberately naive about public holidays: this product has no market-calendar
 * source, and inventing one would produce a health indicator that is confidently
 * wrong a dozen days a year. Weekends alone remove the failure that would
 * otherwise happen every week, and the buckets are coarse enough that a single
 * holiday cannot cross one.
 */
export function tradingDaysBetween(from: Date, to: Date): number {
  if (to <= from) return 0;

  let days = 0;
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));

  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!isWeekend(cursor)) days += 1;
  }

  return days;
}

/**
 * Which bucket an observation falls in, given what kind of data it is.
 *
 * `asOf` may be a date (`2026-08-10`) or an instant; both appear in the market
 * client's own types.
 */
export function freshnessOf(kind: DataKind, asOf: Date | null, now: Date): FreshnessBucket {
  if (!asOf || Number.isNaN(asOf.getTime())) return 'unknown';

  switch (kind) {
    case 'quote':
    case 'quotes_batch': {
      const minutes = (now.getTime() - asOf.getTime()) / 60_000;

      /*
       * A quote that is younger than the delay is as current as this tier can
       * be. Between the delay and the tolerance it is exactly what the product
       * promised, so it is `delayed_expected` — a state, not a complaint.
       */
      if (minutes <= QUOTE_DELAY_MINUTES) return 'current';
      if (minutes <= QUOTE_TOLERANCE_MINUTES) return 'delayed_expected';

      /*
       * Beyond that, counted in trading days. Friday's close read on Sunday is
       * zero trading days old and still the right answer; the market has not
       * produced anything newer.
       */
      return byTradingDays(tradingDaysBetween(asOf, now));
    }

    case 'series':
    case 'bars': {
      // A daily series' last observation is a trading day by construction.
      return byTradingDays(tradingDaysBetween(asOf, now));
    }

    case 'macro': {
      /*
       * Monthly and quarterly by nature, and this product has no cadence
       * metadata to judge against. Rather than guess a threshold and be
       * confidently wrong, the dashboard shows the observation date itself and
       * claims nothing about health — see the Metric Dictionary.
       */
      return 'not_applicable';
    }
  }
}

function byTradingDays(days: number): FreshnessBucket {
  if (days <= 0) return 'current';
  if (days <= 1) return 'stale_1d';
  if (days <= 3) return 'stale_3d';
  return 'stale_7d_plus';
}

/* ------------------------------------------- Observability source freshness */

/**
 * Whether an observability source may be called stale at all.
 *
 * "Last seen three days ago" and "stale" are different claims. Portal telemetry
 * arrives whenever anybody is using the product, so a long gap is worth
 * noticing. Web Vitals only exist when a page loads, and market operational
 * telemetry only exists when something asks for data — silence there means
 * nobody asked, which is a fact about usage and not about the pipeline.
 *
 * Only sources with an expected cadence get a staleness budget; the rest report
 * their last-seen time and nothing more.
 */
export type SourceCadence = { source: string; budgetHours: number | null; why: string };

export const SOURCE_CADENCE: readonly SourceCadence[] = [
  {
    source: 'portal telemetry',
    budgetHours: 24,
    why: 'Arrives whenever anybody uses the portal. A full day of silence is worth noticing.',
  },
  {
    source: 'web vitals',
    budgetHours: null,
    why: 'Only exists when a page loads. Silence means nobody visited, which is a fact about traffic rather than about the pipeline.',
  },
  {
    source: 'market data requests',
    budgetHours: null,
    why: 'Only exists when something asks a provider for data. Silence means nothing asked.',
  },
  {
    source: 'voyager requests',
    budgetHours: null,
    why: 'Only exists when somebody asks a question.',
  },
];

export function sourceIsStale(cadence: SourceCadence, lastSeen: Date | null, now: Date): boolean {
  if (cadence.budgetHours === null) return false;
  if (!lastSeen) return false;
  return now.getTime() - lastSeen.getTime() > cadence.budgetHours * 3_600_000;
}

export { DAY_MS };
