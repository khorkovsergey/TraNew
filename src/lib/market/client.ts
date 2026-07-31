import 'server-only';

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

/**
 * Fetches a quote, or null.
 *
 * Null is a first-class answer: no key, a rate limit, a vendor outage. Callers
 * fall back to the reference content and say so on screen, which is honest and
 * keeps the page working. Throwing would take a whole page down over a price.
 */
export async function getQuote(symbol: string): Promise<Quote | null> {
  if (!quotesConfigured()) return null;

  try {
    const url = new URL(`${TWELVE_DATA}/quote`);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY!);

    const response = await fetch(url, { next: { revalidate: QUOTE_TTL } });
    if (!response.ok) return null;

    const data = await response.json();
    // The vendor reports rate limits and unknown symbols as 200 with a status
    // field, so the HTTP code alone does not tell you whether this worked.
    if (data?.status === 'error' || !data?.close) {
      console.warn(`[market] quote for ${symbol} unavailable: ${data?.message ?? 'no data'}`);
      return null;
    }

    return {
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
  } catch (error) {
    console.warn(`[market] quote for ${symbol} failed`, error);
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
  if (!quotesConfigured() || symbols.length === 0) return {};

  try {
    const url = new URL(`${TWELVE_DATA}/quote`);
    url.searchParams.set('symbol', symbols.join(','));
    url.searchParams.set('apikey', process.env.TWELVE_DATA_API_KEY!);

    const response = await fetch(url, { next: { revalidate: QUOTE_TTL } });
    if (!response.ok) return {};

    const data = await response.json();
    if (data?.status === 'error') {
      console.warn(`[market] batch quote unavailable: ${data.message}`);
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

    return quotes;
  } catch (error) {
    console.warn('[market] batch quote failed', error);
    return {};
  }
}

/** A FRED series with its two most recent observations, so a change can be shown. */
export async function getMacroSeries(seriesId: string): Promise<MacroSeries | null> {
  if (!macroConfigured()) return null;

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

    if (!observationsResponse.ok || !metaResponse.ok) return null;

    const observations = await observationsResponse.json();
    const meta = await metaResponse.json();

    const rows = (observations?.observations ?? []).filter(
      (row: { value: string }) => row.value !== '.'
    );
    if (rows.length === 0) return null;

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

    return {
      seriesId,
      title: series?.title ?? seriesId,
      latest: { date: rows[0].date, value: latest },
      previous: rows[1] ? { date: rows[1].date, value: Number(rows[1].value) } : null,
      yearOverYear:
        yearAgo && yearAgo !== 0 ? ((latest - yearAgo) / yearAgo) * 100 : null,
      units: series?.units_short ?? '',
      asOf: series?.last_updated ?? rows[0].date,
    };
  } catch (error) {
    console.warn(`[market] macro series ${seriesId} failed`, error);
    return null;
  }
}
