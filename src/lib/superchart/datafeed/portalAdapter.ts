import type { Bar, ChartInterval } from '../chart-engine/types';
import type {
  BarsRequest,
  BarsResponse,
  MarketDataAdapter,
  Quote,
  ResolvedSymbol,
  SymbolSearchResult,
} from './types';

/**
 * The portal's own provider, behind the chart's contract.
 *
 * It supplies **daily closing prices and nothing else**: no intraday, no open,
 * high or low, no volume. The design asks for eight intervals of OHLCV.
 *
 * So this adapter declares only the intervals it can honour and refuses the
 * rest with a reason, rather than resampling a daily close into a fake hourly
 * candle. A synthetic candle from a single close has an open, a high and a low
 * that were never traded, and it looks exactly like a real one.
 *
 * Where a bar has only a close, open/high/low are set to that close and the
 * response carries a note. A flat candle is visibly not a real one; an invented
 * range is not.
 *
 * Runs server-side — it reaches the provider through the portal's cached
 * client, which is what keeps the free tier's eight requests a minute usable.
 */

const SUPPORTED: ChartInterval[] = ['1D', '1W', '1M'];

export type PortalSeries = {
  closes: number[];
  dates: string[];
  asOf: string;
  delayed: boolean;
};

/** Injected rather than imported, so this file stays free of `server-only`. */
export type PortalSeriesLoader = (symbol: string) => Promise<PortalSeries | null>;

export class PortalDatafeed implements MarketDataAdapter {
  readonly id = 'portal';

  constructor(
    private readonly load: PortalSeriesLoader,
    private readonly known: SymbolSearchResult[]
  ) {}

  async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    const needle = query.trim().toLowerCase();
    if (!needle) return this.known.slice(0, 6);

    return this.known.filter(
      (entry) =>
        entry.ticker.toLowerCase().includes(needle) || entry.name.toLowerCase().includes(needle)
    );
  }

  async resolveSymbol(symbolId: string): Promise<ResolvedSymbol | null> {
    const ticker = symbolId.split(':').pop() ?? symbolId;
    const entry = this.known.find((candidate) => candidate.ticker === ticker);
    if (!entry) return null;

    return {
      ...entry,
      currency: 'USD',
      timezone: 'America/New_York',
      session: '09:30–16:00',
      pricePrecision: 2,
      minimumTick: 0.01,
      // Only what it can actually serve. The chart hides the rest rather than
      // offering an interval that returns nothing.
      supportedIntervals: SUPPORTED,
      dataStatus: 'delayed',
    };
  }

  async getBars(request: BarsRequest): Promise<BarsResponse> {
    if (!SUPPORTED.includes(request.interval)) {
      return {
        bars: [],
        dataStatus: 'delayed',
        hasMoreBefore: false,
        note: `This provider has daily data only, so ${request.interval} is not available. Switch to 1D, 1W or 1M, or use demo data.`,
      };
    }

    const ticker = request.symbolId.split(':').pop() ?? request.symbolId;
    const series = await this.load(ticker);

    if (!series) {
      return {
        bars: [],
        dataStatus: 'delayed',
        hasMoreBefore: false,
        note: 'No data came back from the provider. The chart keeps what it has.',
      };
    }

    const daily = series.closes.map((close, index) => toBar(series.dates[index], close));
    const bars = aggregate(daily, request.interval).filter(
      (bar) => bar.time >= request.from && bar.time < request.to
    );

    return {
      bars,
      dataStatus: 'delayed',
      // 260 closes is the whole window this provider returns.
      hasMoreBefore: false,
      note: 'Daily closes only — each bar has no separate open, high, low or volume.',
    };
  }

  async getQuote(): Promise<Quote | null> {
    // Quotes come from the portal's own quote endpoint, which the chart header
    // already reads; duplicating that call here would spend the allowance twice.
    return null;
  }
}

function toBar(date: string, close: number): Bar {
  const time = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
  // Open, high and low equal the close because that is all that is known. A
  // flat candle reads as "one price"; an invented range reads as a real bar.
  return { time, open: close, high: close, low: close, close };
}

/**
 * Rolls daily bars up to a week or a month.
 *
 * Aggregation is honest where resampling downwards is not: a week built from
 * five daily closes has a real open, high, low and close, because all five
 * prices actually happened.
 */
function aggregate(daily: Bar[], interval: ChartInterval): Bar[] {
  if (interval === '1D' || !daily.length) return daily;

  const bucketOf = (time: number) => {
    const date = new Date(time * 1000);
    if (interval === '1M') return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;

    // ISO week, so a week bucket does not straddle a year boundary oddly.
    const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.floor((date.getTime() - start.getTime()) / 604_800_000);
    return `${date.getUTCFullYear()}-w${week}`;
  };

  const buckets = new Map<string, Bar[]>();
  for (const bar of daily) {
    const bucket = bucketOf(bar.time);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(bar);
  }

  return [...buckets.values()].map((group) => ({
    time: group[0].time,
    open: group[0].open,
    close: group[group.length - 1].close,
    high: Math.max(...group.map((bar) => bar.high)),
    low: Math.min(...group.map((bar) => bar.low)),
  }));
}

export { aggregate as aggregateDaily, SUPPORTED as PORTAL_INTERVALS };
