import type { Bar, ChartInterval } from '../chart-engine/types';
import { normaliseBars, type BarsRequest, type BarsResponse, type MarketDataAdapter } from './types';

/**
 * A caching, de-duplicating wrapper around any adapter.
 *
 * Three jobs, each of which is a bug if left out.
 *
 * **Caching**, because the provider behind this portal allows roughly eight
 * requests a minute. Switching interval and back would otherwise spend two of
 * them on data already in memory.
 *
 * **De-duplication**, because two components asking for the same bars at the
 * same moment is normal — the chart and the data window mount together — and
 * two identical requests in flight is one wasted.
 *
 * **Cancellation**, because a person clicking through 1m, 5m and 15m in a
 * second starts three requests and wants the third. Without this the first to
 * return wins, which is usually not the one they are looking at.
 */

type CacheEntry = {
  bars: Bar[];
  from: number;
  to: number;
  fetchedAt: number;
  hasMoreBefore: boolean;
};

/** Bars for a closed period do not change; a live one does. */
const TTL_MS = 60_000;

function key(symbolId: string, interval: ChartInterval): string {
  return `${symbolId}::${interval}`;
}

export class CachingDatafeed implements MarketDataAdapter {
  readonly id: string;

  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<BarsResponse>>();
  /** The most recent request per symbol+interval, so older ones can be ignored. */
  private latest = new Map<string, number>();
  private sequence = 0;

  constructor(private readonly inner: MarketDataAdapter) {
    this.id = `caching(${inner.id})`;
  }

  searchSymbols(query: string) {
    return this.inner.searchSymbols(query);
  }

  resolveSymbol(symbolId: string) {
    return this.inner.resolveSymbol(symbolId);
  }

  getQuote(symbolId: string) {
    return this.inner.getQuote(symbolId);
  }

  async getBars(request: BarsRequest): Promise<BarsResponse> {
    const cacheKey = key(request.symbolId, request.interval);
    const ticket = (this.sequence += 1);
    this.latest.set(cacheKey, ticket);

    const cached = this.cache.get(cacheKey);

    // A cached window that covers what was asked for is served whole; a partial
    // overlap is not stitched, because a seam between two fetches is where a
    // duplicated or missing bar hides.
    if (
      cached &&
      Date.now() - cached.fetchedAt < TTL_MS &&
      cached.from <= request.from &&
      cached.to >= request.to
    ) {
      return {
        bars: cached.bars.filter((bar) => bar.time >= request.from && bar.time < request.to),
        dataStatus: 'demo',
        hasMoreBefore: cached.hasMoreBefore,
      };
    }

    const existing = this.inFlight.get(cacheKey);
    if (existing) return existing;

    const promise = this.inner
      .getBars(request)
      .then((response) => {
        const bars = normaliseBars(response.bars);

        this.cache.set(cacheKey, {
          bars,
          from: request.from,
          to: request.to,
          fetchedAt: Date.now(),
          hasMoreBefore: response.hasMoreBefore,
        });

        return { ...response, bars };
      })
      .finally(() => {
        this.inFlight.delete(cacheKey);
      });

    this.inFlight.set(cacheKey, promise);
    const response = await promise;

    // Superseded while in flight: the person has moved on, and applying this
    // would replace what they are looking at with what they left.
    if (this.latest.get(cacheKey) !== ticket) {
      return { ...response, bars: [], note: 'superseded' };
    }

    return response;
  }

  /** Used when a symbol changes, so stale bars cannot be served for a new one. */
  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }
}
