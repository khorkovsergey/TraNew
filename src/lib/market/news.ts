import 'server-only';
import { collectStories, toStory, type FinnhubArticle, type LiveStory, type NewsFeed } from './newsShape';

/**
 * Live market news.
 *
 * Finnhub's free tier, like the rest of the data layer: a demo portal, so the
 * trade is real headlines rather than a real-time feed, and the screens say
 * which they are looking at.
 *
 * Two rules this file exists to enforce.
 *
 * A story is a headline, a short summary, a source and a link out. The article
 * body is not ours and is never fetched or stored — the vendor's terms forbid
 * it and so does the copyright underneath them.
 *
 * And nothing here writes a "why it matters" line. The curated stories carry
 * one because somebody wrote it against reporting; a wire item does not, and an
 * explanation assembled for it would be a claim nobody checked. That rule is
 * already written on the news page; this feature does not get to be the
 * exception to it.
 *
 * The shape and the sanitising live in `newsShape.ts`, which holds no key and
 * is unit-tested directly.
 */

const FINNHUB = 'https://finnhub.io/api/v1';

/*
 * News moves faster than a quote but slower than a page refresh. Ten minutes
 * keeps the feed current, keeps a reload free, and keeps a busy page inside a
 * free tier that is generous but not infinite.
 */
const NEWS_TTL = 10 * 60;

export type { LiveStory, NewsFeed };

async function fetchArticles(path: string): Promise<FinnhubArticle[] | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;

  try {
    const response = await fetch(`${FINNHUB}${path}&token=${key}`, {
      next: { revalidate: NEWS_TTL },
    });

    if (!response.ok) return null;

    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as FinnhubArticle[]) : null;
  } catch {
    /*
     * Returned rather than thrown. A news feed that throws takes the whole page
     * with it; the caller degrades to the written stories, which is a poorer
     * page but a page.
     */
    return null;
  }
}

/** Finnhub's categories, mapped from the tabs the design already had. */
const CATEGORY: Record<string, string> = {
  top: 'general',
  markets: 'general',
  economy: 'general',
  stocks: 'general',
  crypto: 'crypto',
  earnings: 'merger',
};

export async function getMarketNews(tab = 'top', limit = 12): Promise<NewsFeed | null> {
  const category = CATEGORY[tab] ?? 'general';
  const articles = await fetchArticles(`/news?category=${category}&minId=0`);
  if (!articles) return null;

  const stories = collectStories(articles, limit);
  if (!stories.length) return null;

  return {
    stories,
    fetchedAt: new Date().toISOString(),
    attribution: 'Live headlines via Finnhub. Summaries and links belong to the publishers.',
  };
}

/** The last month of news for one instrument, for a symbol page. */
export async function getCompanyNews(symbol: string, limit = 6): Promise<NewsFeed | null> {
  const ticker = symbol.trim().toUpperCase();
  // The vendor takes a bare ticker. Anything else is a request built from
  // something that is not a ticker, and it does not get made.
  if (!/^[A-Z.\-]{1,10}$/.test(ticker)) return null;

  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const day = (date: Date) => date.toISOString().slice(0, 10);

  const articles = await fetchArticles(
    `/company-news?symbol=${ticker}&from=${day(from)}&to=${day(to)}`
  );
  if (!articles) return null;

  const stories = articles
    .map(toStory)
    .filter((story): story is LiveStory => story !== null)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);

  if (!stories.length) return null;

  return {
    stories,
    fetchedAt: new Date().toISOString(),
    attribution: `Live headlines for ${ticker} via Finnhub. Summaries and links belong to the publishers.`,
  };
}

/** Whether the live feed is configured at all, for the label the page shows. */
export function liveNewsConfigured(): boolean {
  return Boolean(process.env.FINNHUB_API_KEY);
}
