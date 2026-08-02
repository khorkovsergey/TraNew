import { INTERVAL_SECONDS, type ChartInterval } from '../chart-engine/types';
import { demoBars } from './demo';
import type {
  BarsRequest,
  BarsResponse,
  MarketDataAdapter,
  Quote,
  ResolvedSymbol,
  SymbolSearchResult,
} from './types';

/**
 * The demo adapter.
 *
 * Generates a complete OHLCV series at any interval, deterministically, so the
 * workspace is fully usable with no provider configured — and says `demo`
 * everywhere the status is read, so nothing it produces can be mistaken for a
 * market feed.
 *
 * The catalogue is small and real-looking rather than exhaustive: enough
 * symbols to exercise search, resolution and switching, none of them claiming
 * to carry live prices.
 */

const ALL_INTERVALS: ChartInterval[] = ['1m', '5m', '15m', '1H', '4H', '1D', '1W', '1M'];

type DemoSymbol = ResolvedSymbol & { lastPrice: number };

const CATALOGUE: DemoSymbol[] = [
  sym('NASDAQ:TSLA', 'TSLA', 'Tesla, Inc.', 'NASDAQ', 'stock', 311.21),
  sym('NASDAQ:AAPL', 'AAPL', 'Apple Inc.', 'NASDAQ', 'stock', 232.4),
  sym('NASDAQ:NVDA', 'NVDA', 'NVIDIA Corporation', 'NASDAQ', 'stock', 128.9),
  sym('NYSE:JPM', 'JPM', 'JPMorgan Chase & Co.', 'NYSE', 'stock', 214.6),
  sym('INDEX:SPX', 'SPX', 'S&P 500 Index', 'INDEX', 'index', 5432.1),
  sym('AMEX:SPY', 'SPY', 'SPDR S&P 500 ETF Trust', 'AMEX', 'etf', 541.3),
  sym('TSE:7203', '7203', 'Toyota Motor Corporation', 'TSE', 'stock', 2810, 'JPY', 'Asia/Tokyo'),
];

function sym(
  id: string,
  ticker: string,
  name: string,
  exchange: string,
  assetClass: ResolvedSymbol['assetClass'],
  lastPrice: number,
  currency = 'USD',
  timezone = 'America/New_York'
): DemoSymbol {
  return {
    id,
    ticker,
    name,
    exchange,
    assetClass,
    currency,
    timezone,
    session: timezone === 'Asia/Tokyo' ? '09:00–11:30 and 12:30–15:30' : '09:30–16:00',
    pricePrecision: 2,
    minimumTick: 0.01,
    supportedIntervals: ALL_INTERVALS,
    dataStatus: 'demo',
    lastPrice,
  };
}

export class DemoDatafeed implements MarketDataAdapter {
  readonly id = 'demo';

  async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    const needle = query.trim().toLowerCase();
    if (!needle) return CATALOGUE.slice(0, 6).map(toResult);

    return CATALOGUE.filter(
      (entry) =>
        entry.ticker.toLowerCase().includes(needle) ||
        entry.name.toLowerCase().includes(needle) ||
        entry.exchange.toLowerCase().includes(needle)
    ).map(toResult);
  }

  async resolveSymbol(symbolId: string): Promise<ResolvedSymbol | null> {
    // Accept a bare ticker as well as a qualified id, because a link from
    // elsewhere in the portal carries only the ticker.
    const entry =
      CATALOGUE.find((candidate) => candidate.id === symbolId) ??
      CATALOGUE.find((candidate) => candidate.ticker === symbolId.split(':').pop());

    return entry ? stripPrice(entry) : null;
  }

  async getBars(request: BarsRequest): Promise<BarsResponse> {
    const entry = CATALOGUE.find((candidate) => candidate.id === request.symbolId);
    if (!entry) return { bars: [], dataStatus: 'demo', hasMoreBefore: false };

    const step = INTERVAL_SECONDS[request.interval];
    const wanted = Math.max(1, Math.ceil((request.to - request.from) / step));

    // Generated from the end of the window backwards, so a series is the same
    // whichever page of history asked for it.
    const bars = demoBars({
      symbol: entry.id,
      interval: request.interval,
      bars: Math.min(wanted, 6000),
      lastPrice: entry.lastPrice,
    });

    return {
      bars: bars.filter((bar) => bar.time >= request.from && bar.time < request.to),
      dataStatus: 'demo',
      // The generator has no floor, so there is always more; a real provider
      // says otherwise and the chart stops asking.
      hasMoreBefore: true,
    };
  }

  async getQuote(symbolId: string): Promise<Quote | null> {
    const entry = CATALOGUE.find((candidate) => candidate.id === symbolId);
    if (!entry) return null;

    const recent = demoBars({
      symbol: entry.id,
      interval: '1D',
      bars: 2,
      lastPrice: entry.lastPrice,
    });

    const change = recent[1].close - recent[0].close;

    return {
      symbolId,
      price: recent[1].close,
      change,
      changePercent: (change / recent[0].close) * 100,
      at: new Date().toISOString(),
      dataStatus: 'demo',
    };
  }
}

function toResult(entry: DemoSymbol): SymbolSearchResult {
  return {
    id: entry.id,
    ticker: entry.ticker,
    name: entry.name,
    exchange: entry.exchange,
    assetClass: entry.assetClass,
  };
}

/** The demo price stays inside the adapter; a resolved symbol has no such field. */
function stripPrice(entry: DemoSymbol): ResolvedSymbol {
  return {
    id: entry.id,
    ticker: entry.ticker,
    name: entry.name,
    exchange: entry.exchange,
    assetClass: entry.assetClass,
    currency: entry.currency,
    timezone: entry.timezone,
    session: entry.session,
    pricePrecision: entry.pricePrecision,
    minimumTick: entry.minimumTick,
    supportedIntervals: entry.supportedIntervals,
    dataStatus: entry.dataStatus,
  };
}

export const DEMO_SYMBOLS = CATALOGUE.map(toResult);
