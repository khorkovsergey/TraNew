import 'server-only';
import { getBars, getQuote, marketDataStatus, type DailyBar } from '@/lib/market/client';
import {
  clarification,
  resolveAsset,
  type AssetCandidate,
} from './assets';
import {
  coverageOf,
  describeCoverage,
  isValidInterval,
  MAX_OUTPUTSIZE,
  normalizeRange,
  outputsizeFor,
  resample,
  trimToRange,
  type Bar,
  type Coverage,
  type DateRange,
  type Interval,
} from './range';
import { seriesMetrics, type SeriesMetrics } from './metrics';
import { argString, toolFailure, type VoyagerToolResult } from './types';

/**
 * Real prices, or nothing that looks like them.
 *
 * Built on the market client the rest of the portal already uses — same key on
 * the server, same cache, same fifteen-minute delay disclosed the same way. A
 * second provider client inside Voyager would be a second set of rate limits
 * against one free-tier allowance and a second idea of what a bar is.
 *
 * What this adds is the part the client does not do: reaching a *period*. It
 * returns the most recent N daily bars, so a request for January 2024 is
 * translated into "how many bars is that from here", fetched once, and cut down
 * to what was asked for. The arithmetic lives in `range.ts` where it can be
 * tested without a key.
 *
 * The limits of this first version, stated here because they are stated on
 * screen too:
 *
 * - **Daily source data only.** Weekly and monthly bars are folded from it, and
 *   say so; there is no intraday, and nothing here will pretend otherwise.
 * - **History reaches as far as the provider's page does.** Beyond that the
 *   answer starts where the data starts and says the request went further.
 * - **First and last observation are trading days**, so they routinely differ
 *   from the dates somebody typed. Both are reported.
 * - **No data means no data.** There is a demo bar generator in this repository
 *   and it is not reachable from here. An invented series with a real
 *   instrument's name on it is the failure every label in this product exists
 *   to prevent.
 */

const PROVIDER = 'Twelve Data';

/** Comparing more than this is a screener, and it is not one. */
export const MAX_COMPARE_ASSETS = 5;

export type MarketMeta = {
  provider: string;
  symbol: string;
  displayName: string;
  currency?: string;
  exchange?: string;
  interval: Interval;
  requested: DateRange;
  coverage: Coverage;
  /** The last observation this answer rests on. */
  asOf: string | null;
  /** Always true on this tier, and the interface says so wherever it renders. */
  delayed: boolean;
  notes: string[];
};

export type HistoryResult = {
  asset: AssetCandidate;
  bars: Bar[];
  metrics: SeriesMetrics;
  meta: MarketMeta;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------- Resolution */

/**
 * A query turned into an instrument, verified against the provider when the
 * catalogue does not already know it.
 *
 * The verification is the point. A ticker the catalogue has never heard of is
 * not rejected and not trusted either — it is looked up, and it exists only if
 * a quote comes back with a name and a currency attached. That is what stops
 * the answer from charting whatever four letters somebody typed.
 */
export async function resolveVerified(
  query: unknown
): Promise<VoyagerToolResult<AssetCandidate>> {
  const text = argString(query, 64);
  if (!text) {
    return toolFailure('bad_arguments', 'I need the name or ticker of an instrument.', true);
  }

  const resolved = resolveAsset(text);

  if (resolved.status === 'exact') {
    return {
      ok: true,
      data: resolved.asset,
      summary: `${text} → ${resolved.asset.symbol} (${resolved.asset.displayName})`,
    };
  }

  if (resolved.status === 'ambiguous') {
    /*
     * Not an error, and not something to pick a winner for. The planner is
     * given the sentence to ask, because "gold" is two instruments and the
     * person is the only one who knows which they meant.
     */
    return toolFailure('bad_arguments', clarification(resolved.alternatives), true);
  }

  if (resolved.status === 'unknown') {
    return toolFailure(
      'not_found',
      `I could not tell which instrument "${text}" is. A ticker would settle it.`,
      true
    );
  }

  if (!marketDataStatus().quotes) {
    return toolFailure('unavailable', 'The market data provider is not configured here.', false);
  }

  const quote = await getQuote(resolved.symbol);
  if (!quote) {
    return toolFailure(
      'not_found',
      `The market data provider has no instrument called ${resolved.symbol}.`,
      true
    );
  }

  return {
    ok: true,
    data: {
      canonicalId: `provider:${quote.symbol}`,
      symbol: quote.symbol,
      providerSymbol: quote.symbol,
      displayName: quote.name || quote.symbol,
      assetClass: 'stock',
      exchange: quote.exchange || undefined,
      currency: quote.currency || undefined,
    },
    summary: `${text} → ${quote.symbol} (${quote.name}), verified against ${PROVIDER}`,
  };
}

/* ----------------------------------------------------------------- Quotes */

export type QuoteResult = {
  asset: AssetCandidate;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  exchange: string;
  asOf: string;
  delayed: boolean;
};

export async function getQuoteFor(input: {
  query?: unknown;
}): Promise<VoyagerToolResult<QuoteResult>> {
  const resolved = await resolveVerified(input.query);
  if (!resolved.ok) return resolved;

  const asset = resolved.data;
  const quote = await getQuote(asset.providerSymbol);

  if (!quote) {
    return toolFailure(
      'no_data',
      `${PROVIDER} has no current price for ${asset.symbol} right now.`,
      true
    );
  }

  return {
    ok: true,
    data: {
      asset,
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      currency: quote.currency,
      exchange: quote.exchange,
      asOf: quote.asOf,
      delayed: quote.delayed,
    },
    summary:
      `${asset.symbol} ${quote.price} ${quote.currency} ` +
      `(${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent}%), ` +
      `as of ${quote.asOf}, delayed, from ${PROVIDER}.`,
  };
}

/* ---------------------------------------------------------------- History */

/** Structural narrowing: the client's bar is this module's bar. */
function asBars(bars: DailyBar[]): Bar[] {
  return bars;
}

export async function getHistoryFor(input: {
  query?: unknown;
  start?: unknown;
  end?: unknown;
  interval?: unknown;
}): Promise<VoyagerToolResult<HistoryResult>> {
  const resolved = await resolveVerified(input.query);
  if (!resolved.ok) return resolved;
  const asset = resolved.data;

  const interval: Interval = isValidInterval(input.interval) ? input.interval : '1D';

  const now = today();
  const range = normalizeRange({ start: input.start, end: input.end }, now);
  if (!range.ok) {
    const message =
      range.problem === 'reversed'
        ? 'The period ends before it begins.'
        : range.problem === 'future'
          ? 'That period has not happened yet.'
          : 'I need dates as YYYY-MM-DD.';
    return toolFailure('bad_arguments', message, true);
  }

  if (!marketDataStatus().quotes) {
    return toolFailure('unavailable', 'The market data provider is not configured here.', false);
  }

  const outputsize = outputsizeFor(range.range, now);
  const daily = await getBars(asset.providerSymbol, outputsize);

  if (!daily || daily.length === 0) {
    /*
     * No fallback, and this is the load-bearing refusal of the whole file. The
     * demo datafeed could fill this in and the chart would look identical —
     * which is exactly why it is not called. A no-data state with a way forward
     * is worth more than a picture nobody can trust.
     */
    return toolFailure(
      'no_data',
      `${PROVIDER} returned no daily history for ${asset.symbol}. That happens with an unsupported symbol or a spent rate limit — it does not mean the price is unknown, only that I could not fetch it.`,
      true
    );
  }

  const trimmed = trimToRange(asBars(daily), range.range);
  const bars = resample(trimmed, interval);

  const coverage = coverageOf(bars, range.range, interval, {
    // The provider ran out of page rather than out of history: only then does a
    // late start mean the request could not be met.
    reachedProviderCap: outputsize >= MAX_OUTPUTSIZE || daily.length >= outputsize,
  });

  const metrics = seriesMetrics(bars, interval);
  if (!metrics) {
    return toolFailure(
      'no_data',
      `There are ${bars.length} ${interval} bars between ${range.range.start} and ${range.range.end} — not enough to measure anything. A longer period, or a daily interval, would give more.`,
      true
    );
  }

  const notes: string[] = [...metrics.caveats];
  if (interval !== '1D') notes.push('weekly and monthly bars are folded from daily data');
  if (coverage.truncated) {
    notes.push(`history from the provider does not reach ${range.range.start}`);
  }

  return {
    ok: true,
    data: {
      asset,
      bars,
      metrics,
      meta: {
        provider: PROVIDER,
        symbol: asset.symbol,
        displayName: asset.displayName,
        currency: asset.currency,
        exchange: asset.exchange,
        interval,
        requested: range.range,
        coverage,
        asOf: coverage.lastObservation,
        delayed: true,
        notes,
      },
    },
    summary:
      `${asset.symbol} ${describeCoverage(coverage)}. ` +
      `Close ${metrics.first.close} → ${metrics.last.close} ` +
      `(${metrics.changePercent >= 0 ? '+' : ''}${metrics.changePercent}%), ` +
      `high ${metrics.periodHigh.value} on ${metrics.periodHigh.date}, ` +
      `low ${metrics.periodLow.value} on ${metrics.periodLow.date}, ` +
      `max drawdown ${metrics.maxDrawdown}%` +
      (metrics.annualisedVolatility === null
        ? ', volatility not measurable over this period'
        : `, annualised volatility ${metrics.annualisedVolatility}%`) +
      (metrics.cagr === null ? '' : `, CAGR ${metrics.cagr}%`) +
      `. Delayed data from ${PROVIDER}.` +
      (notes.length ? ` Notes: ${notes.join('; ')}.` : ''),
  };
}
