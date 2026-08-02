import type { Bar, ChartInterval, DataStatus } from '../chart-engine/types';

/**
 * The market data contract.
 *
 * Provider-agnostic on purpose. The portal's own provider returns daily closes
 * with no volume and no intraday; the design needs OHLCV at eight intervals.
 * Rather than dress one up as the other, an adapter declares what it can
 * actually supply and the chart shows the difference honestly.
 *
 * Import-free apart from the engine's own types, so the unit harness can
 * compile it alone.
 */

export type AssetClass = 'stock' | 'etf' | 'index' | 'crypto' | 'forex' | 'commodity' | 'unknown';

export type SymbolSearchResult = {
  id: string;
  ticker: string;
  name: string;
  exchange: string;
  assetClass: AssetClass;
};

export type ResolvedSymbol = {
  id: string;
  ticker: string;
  name: string;
  exchange: string;
  assetClass: AssetClass;
  currency: string;
  timezone: string;
  /** Regular session in exchange-local time, for the status strip. */
  session: string;
  pricePrecision: number;
  minimumTick: number;
  supportedIntervals: ChartInterval[];
  dataStatus: DataStatus;
};

export type Quote = {
  symbolId: string;
  price: number;
  change: number;
  changePercent: number;
  at: string;
  dataStatus: DataStatus;
};

export type BarsRequest = {
  symbolId: string;
  interval: ChartInterval;
  /** Unix seconds. Inclusive of `from`, exclusive of `to`. */
  from: number;
  to: number;
  /** Aborts a request the person has already superseded. */
  signal?: AbortSignal;
};

export type BarsResponse = {
  bars: Bar[];
  dataStatus: DataStatus;
  /** False when the provider has no more history before `from`. */
  hasMoreBefore: boolean;
  /** Present when the provider could not honour the request as asked. */
  note?: string;
};

export interface MarketDataAdapter {
  readonly id: string;
  searchSymbols(query: string): Promise<SymbolSearchResult[]>;
  resolveSymbol(symbolId: string): Promise<ResolvedSymbol | null>;
  getBars(request: BarsRequest): Promise<BarsResponse>;
  getQuote(symbolId: string): Promise<Quote | null>;
}

/* ------------------------------------------------------------ Normalising */

/**
 * Sorts, de-duplicates and drops anything unusable.
 *
 * Providers repeat the boundary bar between pages, occasionally return a bar
 * out of order, and sometimes send a row with a null close. Each of those
 * produces a different visible fault — a doubled candle, a line that jumps
 * backwards, a gap — and all three are cheaper to fix here than to notice on a
 * chart.
 *
 * The last bar for a timestamp wins, because a repeated bar is usually a
 * revision rather than a duplicate.
 */
export function normaliseBars(bars: Bar[]): Bar[] {
  const byTime = new Map<number, Bar>();

  for (const bar of bars) {
    if (!Number.isFinite(bar.time)) continue;
    if (![bar.open, bar.high, bar.low, bar.close].every(Number.isFinite)) continue;

    byTime.set(bar.time, bar);
  }

  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/** True when two bars describe the same instant. */
export function sameBar(a: Bar, b: Bar): boolean {
  return a.time === b.time;
}
