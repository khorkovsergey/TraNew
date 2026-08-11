import 'server-only';
import { freshnessOf, type DataKind } from '@/lib/admin-metrics/freshness';
import { trackServerEvent } from '@/lib/analytics/server';

/**
 * Market and macro data.
 *
 * Two vendors, both on free tiers: Twelve Data for quotes, FRED for US macro
 * series. This is a demo portal, so delayed data is the right trade — but a
 * delayed price must say it is delayed. The screens read `asOf` and `delayed`
 * from every result and label accordingly; nothing here is allowed to look live.
 *
 * Twelve Data's free tier is roughly 8 requests a minute and 800 a day for the
 * whole service, so caching is not an optimisation here — it is the only reason
 * the pages work at all. Values are cached long enough that a page refresh costs
 * nothing, and a missing key or a failed call degrades to the reference content
 * rather than an error.
 */

const TWELVE_DATA = 'https://api.twelvedata.com';
const FRED = 'https://api.stlouisfed.org/fred';

/** Quotes move; macro series do not. Cache each for as long as it stays true. */
const QUOTE_TTL = 15 * 60; // matches the vendor's own 15-minute delay
const MACRO_TTL = 12 * 60 * 60; // CPI is monthly — a half-day cache is generous
/* A daily candle changes once a day; an hour of cache costs nothing and one
   uncached chart load would otherwise spend an eighth of a minute's allowance. */
const SERIES_TTL = 60 * 60;

export type Quote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  exchange: string;
  asOf: string;
  /** Always true on the free tier. Drives the "15-minute delay" label. */
  delayed: boolean;
};

export type Series = {
  symbol: string;
  interval: '1day';
  /** Oldest first, so an index into `closes` is an index into `dates`. */
  closes: number[];
  dates: string[];
  asOf: string;
  /** Always true on the free tier. Drives the "15-minute delay" label. */
  delayed: boolean;
};

export type MacroSeries = {
  seriesId: string;
  title: string;
  latest: { date: string; value: number };
  previous: { date: string; value: number } | null;
  /**
   * Percent change against the observation twelve periods back.
   *
   * For a price index this is the number people mean by "inflation" — the index
   * level on its own is accurate and useless to a reader. Null when there is not
   * a year of history to compare against.
   */
  yearOverYear: number | null;
  units: string;
  asOf: string;
};

function quotesConfigured(): boolean {
  return Boolean(process.env.TWELVE_DATA_API_KEY);
}

function macroConfigured(): boolean {
  return Boolean(process.env.FRED_API_KEY);
}

export function marketDataStatus() {
  return { quotes: quotesConfigured(), macro: macroConfigured() };
}

/* -------------------------------------------------------------- Observation */

/**
 * Every function below returns `null` when anything goes wrong, and a `null`
 * that means "no key" is indistinguishable from one that means "the vendor is
 * down" the moment it leaves the function. This says which it was, and nothing
 * else — see `docs/admin-metrics/market-data-instrumentation-request.md`.
 *
 * Two things it deliberately does not claim:
 *
 * It is **not** a count of upstream requests. The fetches below go through
 * `next: { revalidate }`, and cache resolution is transparent at this layer, so
 * a success may have been served from cache and nothing here can tell. For the
 * same reason `durationMs` is this call site's resolution latency, not the
 * provider's.
 *
 * It never carries the subject. No symbol, no series id, no query, no URL, no
 * response body, no vendor message — the registry declares no property that
 * could hold one, so a slip is refused rather than written.
 */
type MarketDataOutcome = 'success' | 'not_configured' | 'no_data' | 'provider_error';

function emitMarketData(fields: {
  source: 'twelve_data' | 'fred';
  kind: DataKind;
  outcome: MarketDataOutcome;
  /** From `performance.now()`, so a clock adjustment cannot make this negative. */
  startedAt: number;
  /** The observation the product actually got, or null when there was none. */
  asOf?: Date | null;
  delayed?: boolean;
  hasVolume?: boolean;
}): void {
  trackServerEvent({
    name: 'market_data_request_completed',
    properties: {
      source: fields.source,
      kind: fields.kind,
      outcome: fields.outcome,
      delayed: fields.delayed ?? false,
      durationMs: Math.round(performance.now() - fields.startedAt),
      hasVolume: fields.hasVolume ?? false,
      /*
       * Never computed here. "Is Friday's close stale on Sunday" is source-aware
       * and lives in one place; a second copy would drift the week somebody
       * fixed one of them. A resolution with no observation passes null and is
       * reported `unknown` rather than being given an invented `asOf`.
       */
      freshnessBucket: freshnessOf(fields.kind, fields.asOf ?? null, new Date()),
    },
    surface: 'markets',
  });
}

/**
 * Fetches a quote, or null.
 *
 * Null is a first-class answer: no key, a rate limit, a vendor outage. Callers
 * fall back to the reference content and say so on screen, which is honest and
 * keeps the page working. Throwing would take a whole page down over a price.
 */
export async function getQuote(symbol: string): Promise<Quote | null> {
  const startedAt = performance.now();
  const emit = (outcome: MarketDataOutcome, quote?: Quote) =>
    emitMarketData({
      source: 'twelve_data',
      kind: 'quote',
      outcome,
      startedAt,
      asOf: quote ? new Date(quote.asOf) : null,
      delayed: quote?.delayed ?? false,
    });

  if (!quotesConfigured()) {
    emit('not_configured');
    return null;
  }

  try {
    const url = new URL(`${TWELVE_DATA}/quote`);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY!);

    const response = await fetch(url, { next: { revalidate: QUOTE_TTL } });
    if (!response.ok) {
      emit('provider_error');
      return null;
    }

    const data = await response.json();
    // The vendor reports rate limits and unknown symbols as 200 with a status
    // field, so the HTTP code alone does not tell you whether this worked.
    // Which of the two it was would mean reading `data.message`, so the event
    // says only that nothing usable came back.
    if (data?.status === 'error' || !data?.close) {
      console.warn(`[market] quote for ${symbol} unavailable: ${data?.message ?? 'no data'}`);
      emit('no_data');
      return null;
    }

    const quote: Quote = {
      symbol: data.symbol ?? symbol,
      name: data.name ?? symbol,
      price: Number(data.close),
      change: Number(data.change ?? 0),
      changePercent: Number(data.percent_change ?? 0),
      currency: data.currency ?? 'USD',
      exchange: data.exchange ?? '',
      asOf: data.datetime ?? new Date().toISOString().slice(0, 10),
      delayed: true,
    };

    emit('success', quote);
    return quote;
  } catch (error) {
    console.warn(`[market] quote for ${symbol} failed`, error);
    emit('provider_error');
    return null;
  }
}

/**
 * Daily closes, or null.
 *
 * Studies need history, not a price: an RSI(14) has nothing to say until it has
 * fifteen bars, and a 200-day average needs two hundred. 260 is about a trading
 * year, which is enough for every study in the registry and still one request.
 *
 * The vendor returns newest-first and every number as a string, so both are
 * corrected here rather than in each caller.
 */
export async function getSeries(symbol: string, outputsize = 260): Promise<Series | null> {
  const startedAt = performance.now();
  const emit = (outcome: MarketDataOutcome, series?: Series) =>
    emitMarketData({
      source: 'twelve_data',
      kind: 'series',
      outcome,
      startedAt,
      asOf: series ? new Date(series.asOf) : null,
      delayed: series?.delayed ?? false,
    });

  if (!quotesConfigured()) {
    emit('not_configured');
    return null;
  }

  try {
    const url = new URL(`${TWELVE_DATA}/time_series`);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', '1day');
    url.searchParams.set('outputsize', String(outputsize));
    url.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY!);

    const response = await fetch(url, { next: { revalidate: SERIES_TTL } });
    if (!response.ok) {
      emit('provider_error');
      return null;
    }

    const data = await response.json();
    // Rate limits and unknown symbols come back as 200 with a status field, so
    // the HTTP code alone does not say whether this worked.
    if (data?.status === 'error' || !Array.isArray(data?.values)) {
      console.warn(`[market] series for ${symbol} unavailable: ${data?.message ?? 'no data'}`);
      emit('no_data');
      return null;
    }

    const rows = [...data.values].reverse();
    const closes: number[] = [];
    const dates: string[] = [];

    for (const row of rows) {
      const close = Number.parseFloat(row?.close);
      if (!Number.isFinite(close)) continue;
      closes.push(close);
      dates.push(String(row?.datetime ?? ''));
    }

    // A handful of bars is worse than none: every study would be null and the
    // chart would claim to be real while showing almost nothing.
    // The response arrived and parsed, but nothing usable came out of it, which
    // is the same answer to the caller and the same bucket as `status: error`.
    if (closes.length < 30) {
      emit('no_data');
      return null;
    }

    const series: Series = {
      symbol: data.meta?.symbol ?? symbol,
      interval: '1day',
      closes,
      dates,
      asOf: dates[dates.length - 1],
      delayed: true,
    };

    emit('success', series);
    return series;
  } catch (error) {
    console.warn(`[market] series for ${symbol} failed`, error);
    emit('provider_error');
    return null;
  }
}

/**
 * Fetches several quotes without spending one request each.
 *
 * The free tier counts requests, not symbols, so batching is what keeps a page
 * with six tickers from using most of a minute's allowance.
 */
export async function getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const startedAt = performance.now();

  /*
   * Once per call, never once per symbol. The batch is the operation being
   * observed; a row per instrument would multiply the count by however many
   * tickers a page happened to render and turn one provider call into six.
   *
   * The batch is only as fresh as its stalest member, so freshness is taken
   * from the oldest observation in the map rather than the newest — one
   * instrument lagging is a thing worth seeing, not worth hiding behind five
   * current ones. Nothing about which instrument it was leaves this function.
   */
  const emit = (outcome: MarketDataOutcome, quotes?: Record<string, Quote>) => {
    const values = Object.values(quotes ?? {});
    const oldest = values.reduce<number | null>((worst, quote) => {
      const at = new Date(quote.asOf).getTime();
      if (Number.isNaN(at)) return worst;
      return worst === null || at < worst ? at : worst;
    }, null);

    emitMarketData({
      source: 'twelve_data',
      kind: 'quotes_batch',
      outcome,
      startedAt,
      asOf: oldest === null ? null : new Date(oldest),
      delayed: values.some((quote) => quote.delayed),
    });
  };

  if (!quotesConfigured()) {
    emit('not_configured');
    return {};
  }

  /*
   * Split out of the guard above, which read `!quotesConfigured() || symbols
   * .length === 0`, so the two can be told apart — same return, same order, no
   * change to what a caller sees.
   *
   * Nothing is emitted for an empty list, and that is the one place this file
   * does not emit per invocation. No provider resolution happened: it is not
   * `no_data`, which the Observatory reads as the vendor returning nothing
   * usable, and it is certainly not `not_configured`. A silent row here would
   * be a fault on a dashboard where nobody had asked for anything.
   */
  if (symbols.length === 0) return {};

  try {
    const url = new URL(`${TWELVE_DATA}/quote`);
    url.searchParams.set('symbol', symbols.join(','));
    url.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY!);

    const response = await fetch(url, { next: { revalidate: QUOTE_TTL } });
    if (!response.ok) {
      emit('provider_error');
      return {};
    }

    const data = await response.json();
    if (data?.status === 'error') {
      console.warn(`[market] batch quote unavailable: ${data.message}`);
      emit('no_data');
      return {};
    }

    // One symbol comes back as a bare object, several as a keyed map.
    const entries = symbols.length === 1 ? { [symbols[0]]: data } : data;
    const quotes: Record<string, Quote> = {};

    for (const [key, value] of Object.entries(entries as Record<string, Record<string, unknown>>)) {
      if (!value || value.status === 'error' || !value.close) continue;
      quotes[key] = {
        symbol: (value.symbol as string) ?? key,
        name: (value.name as string) ?? key,
        price: Number(value.close),
        change: Number(value.change ?? 0),
        changePercent: Number(value.percent_change ?? 0),
        currency: (value.currency as string) ?? 'USD',
        exchange: (value.exchange as string) ?? '',
        asOf: (value.datetime as string) ?? new Date().toISOString().slice(0, 10),
        delayed: true,
      };
    }

    // Success even when the map came back partly empty: the call resolved and
    // the product got the answer the vendor gave. Individual symbols the vendor
    // skipped are not separable here without naming them.
    emit('success', quotes);
    return quotes;
  } catch (error) {
    console.warn('[market] batch quote failed', error);
    emit('provider_error');
    return {};
  }
}

/** A FRED series with its two most recent observations, so a change can be shown. */
export async function getMacroSeries(seriesId: string): Promise<MacroSeries | null> {
  const startedAt = performance.now();

  /*
   * `seriesId` is as much a subject as a ticker is, and never travels — the
   * argument is read by the request below and by nothing here.
   *
   * The observation date is passed rather than `asOf`, which carries FRED's
   * `last_updated` publication stamp in a format that does not always parse.
   * The helper answers `not_applicable` for macro either way; a date it cannot
   * read would have downgraded that to `unknown` and made a monthly series look
   * unmeasured rather than deliberately unjudged.
   */
  const emit = (outcome: MarketDataOutcome, observedAt?: string) =>
    emitMarketData({
      source: 'fred',
      kind: 'macro',
      outcome,
      startedAt,
      asOf: observedAt ? new Date(observedAt) : null,
    });

  if (!macroConfigured()) {
    emit('not_configured');
    return null;
  }

  try {
    const key = process.env.FRED_API_KEY!;

    const observationsUrl = new URL(`${FRED}/series/observations`);
    observationsUrl.searchParams.set('series_id', seriesId);
    observationsUrl.searchParams.set('api_key', key);
    observationsUrl.searchParams.set('file_type', 'json');
    observationsUrl.searchParams.set('sort_order', 'desc');
    // Two years of monthly history. More than the year-over-year figure strictly
    // needs, because the comparison is made by date rather than by counting back a
    // fixed number of rows — a series with a gap or an irregular period would make
    // index arithmetic quietly wrong.
    observationsUrl.searchParams.set('limit', '25');

    const metaUrl = new URL(`${FRED}/series`);
    metaUrl.searchParams.set('series_id', seriesId);
    metaUrl.searchParams.set('api_key', key);
    metaUrl.searchParams.set('file_type', 'json');

    const [observationsResponse, metaResponse] = await Promise.all([
      fetch(observationsUrl, { next: { revalidate: MACRO_TTL } }),
      fetch(metaUrl, { next: { revalidate: MACRO_TTL } }),
    ]);

    if (!observationsResponse.ok || !metaResponse.ok) {
      emit('provider_error');
      return null;
    }

    const observations = await observationsResponse.json();
    const meta = await metaResponse.json();

    const rows = (observations?.observations ?? []).filter(
      (row: { value: string }) => row.value !== '.'
    );
    if (rows.length === 0) {
      emit('no_data');
      return null;
    }

    const series = meta?.seriess?.[0];

    const latest = Number(rows[0].value);

    /*
     * Find the observation closest to twelve months before the latest one, and
     * only accept it if it really is about a year old. Counting back twelve rows
     * would silently compare the wrong periods whenever the series is missing an
     * observation — which is exactly the kind of error nobody notices in a number
     * that looks plausible.
     */
    const latestDate = new Date(rows[0].date);
    const target = new Date(latestDate);
    target.setFullYear(target.getFullYear() - 1);

    let yearAgo: number | null = null;
    let bestGap = Infinity;
    for (const row of rows.slice(1) as { date: string; value: string }[]) {
      const gap = Math.abs(new Date(row.date).getTime() - target.getTime());
      if (gap < bestGap) {
        bestGap = gap;
        yearAgo = Number(row.value);
      }
    }
    // Within 45 days of the target, or the comparison is not a year-over-year one.
    if (bestGap > 45 * 86_400_000) yearAgo = null;

    const macro: MacroSeries = {
      seriesId,
      title: series?.title ?? seriesId,
      latest: { date: rows[0].date, value: latest },
      previous: rows[1] ? { date: rows[1].date, value: Number(rows[1].value) } : null,
      yearOverYear:
        yearAgo && yearAgo !== 0 ? ((latest - yearAgo) / yearAgo) * 100 : null,
      units: series?.units_short ?? '',
      asOf: series?.last_updated ?? rows[0].date,
    };

    emit('success', macro.latest.date);
    return macro;
  } catch (error) {
    console.warn(`[market] macro series ${seriesId} failed`, error);
    emit('provider_error');
    return null;
  }
}

/** One daily candle. Matches the chart engine's `Bar`, deliberately. */
export type DailyBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

/**
 * Real daily candles for a symbol.
 *
 * `getSeries` above keeps only the closes, because everything reading it draws
 * a line. A candlestick chart needs the other three, and the provider was
 * sending them all along — they were being thrown away on the way in.
 *
 * Returns null rather than a shortened series when anything is wrong: an
 * unknown ticker, a spent rate limit, or fewer than thirty bars. A chart with
 * eight candles on it claims to show a year and does not, which is worse than a
 * chart that admits it has no data.
 */
export async function getBars(symbol: string, outputsize = 260): Promise<DailyBar[] | null> {
  const startedAt = performance.now();

  /*
   * `hasVolume` answers whether the chart could draw a volume pane — a real
   * product question, and one that needs no symbol to answer. `false` on a
   * failure means "no volume was returned", not "the request failed"; the
   * outcome says that.
   */
  const emit = (outcome: MarketDataOutcome, bars?: DailyBar[]) => {
    const last = bars?.[bars.length - 1];
    emitMarketData({
      source: 'twelve_data',
      kind: 'bars',
      outcome,
      startedAt,
      asOf: last ? new Date(last.time * 1000) : null,
      // Daily candles on the free tier carry the same delay the quotes do.
      delayed: Boolean(bars),
      hasVolume: bars?.some((bar) => typeof bar.volume === 'number') ?? false,
    });
  };

  if (!quotesConfigured()) {
    emit('not_configured');
    return null;
  }

  try {
    const url = new URL(`${TWELVE_DATA}/time_series`);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', '1day');
    url.searchParams.set('outputsize', String(outputsize));
    url.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY!);

    const response = await fetch(url, { next: { revalidate: SERIES_TTL } });
    if (!response.ok) {
      emit('provider_error');
      return null;
    }

    const data = await response.json();
    // Rate limits and unknown symbols arrive as 200 with a status field, so the
    // HTTP code alone does not say whether this worked.
    if (data?.status === 'error' || !Array.isArray(data?.values)) {
      console.warn(`[market] bars for ${symbol} unavailable: ${data?.message ?? 'no data'}`);
      emit('no_data');
      return null;
    }

    const bars: DailyBar[] = [];
    for (const row of [...data.values].reverse()) {
      const open = Number.parseFloat(row?.open);
      const high = Number.parseFloat(row?.high);
      const low = Number.parseFloat(row?.low);
      const close = Number.parseFloat(row?.close);
      const time = Date.parse(`${row?.datetime}T00:00:00Z`) / 1000;

      if (![open, high, low, close, time].every(Number.isFinite)) continue;

      const volume = Number.parseFloat(row?.volume);
      bars.push({
        time,
        open,
        high,
        low,
        close,
        ...(Number.isFinite(volume) ? { volume } : {}),
      });
    }

    // Same reasoning as `getSeries`: the response parsed but produced nothing a
    // chart could honestly draw, which is `no_data` rather than a success that
    // happens to return null.
    if (bars.length < 30) {
      emit('no_data');
      return null;
    }

    emit('success', bars);
    return bars;
  } catch (error) {
    console.warn('[market] bars request failed', error);
    emit('provider_error');
    return null;
  }
}
