// Relative, not the `@/` alias: the unit harness compiles these files on their
// own without a tsconfig, and an alias it cannot resolve fails the whole run.
import { cleanLine } from '../events/sanitize';

/**
 * The shape of a news story, and the gate it has to pass through.
 *
 * Split from `news.ts` because that file is `server-only` — it holds a vendor
 * key and a `fetch`. This half holds no secret and touches no network, which is
 * what lets the unit harness compile and run it directly. The boundary between
 * "outside data" and "something a page renders" is the security-relevant part
 * of this feature, and a boundary that cannot be tested on its own is a
 * boundary nobody checks.
 */

export type LiveStory = {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  /** ISO 8601, so the page can say how old the story is rather than implying it is now. */
  publishedAt: string;
  /** Tickers the vendor associated with the story; may be empty. */
  related: string[];
};

export type NewsFeed = {
  stories: LiveStory[];
  fetchedAt: string;
  /** What the page tells the reader about where this came from. */
  attribution: string;
};

export type FinnhubArticle = {
  id?: unknown;
  headline?: unknown;
  summary?: unknown;
  source?: unknown;
  url?: unknown;
  datetime?: unknown;
  related?: unknown;
};

/** Long enough to be a headline, short enough that no card can be a wall. */
export const MAX_TITLE = 200;
const MAX_SUMMARY = 400;
const MAX_SOURCE = 60;

/**
 * A URL safe to put in an href.
 *
 * Scheme-checked against an allow-list rather than pattern-matched against a
 * blocklist. `javascript:` and `data:` are the two that matter, and casing,
 * leading whitespace and encoding all defeat a blocklist — `new URL` normalises
 * every one of those before the protocol is read.
 *
 * A story whose link fails is dropped rather than shown without one: a headline
 * nobody can open is not a story, and rendering it would leave a reader with a
 * claim and no source.
 */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;

  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function toStory(article: FinnhubArticle): LiveStory | null {
  const url = safeUrl(article.url);
  if (!url) return null;

  const title = cleanLine(article.headline, MAX_TITLE);
  if (!title) return null;

  const seconds = typeof article.datetime === 'number' ? article.datetime : 0;
  // Undated news is not news; it is a claim about now that may be a year old.
  if (!seconds) return null;

  const related =
    typeof article.related === 'string'
      ? article.related
          .split(',')
          .map((ticker) => cleanLine(ticker, 12).toUpperCase())
          .filter(Boolean)
          .slice(0, 4)
      : [];

  return {
    // The vendor's id when there is one, the URL otherwise: two stories sharing
    // a key collide in the list and one silently vanishes.
    id: typeof article.id === 'number' || typeof article.id === 'string' ? String(article.id) : url,
    title,
    summary: cleanLine(article.summary, MAX_SUMMARY),
    source: cleanLine(article.source, MAX_SOURCE) || 'Unknown source',
    url,
    publishedAt: new Date(seconds * 1000).toISOString(),
    related,
  };
}

/**
 * Stories worth showing, in order, without the repeats.
 *
 * Wires echo: the same headline arrives from several outlets inside a minute,
 * and a feed showing all of them looks broken rather than busy.
 */
export function collectStories(articles: FinnhubArticle[], limit: number): LiveStory[] {
  const stories: LiveStory[] = [];
  const seen = new Set<string>();

  for (const article of articles) {
    const story = toStory(article);
    if (!story) continue;

    const fingerprint = story.title.toLowerCase().slice(0, 60);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    stories.push(story);
    if (stories.length >= limit) break;
  }

  return stories;
}
