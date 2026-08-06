import { assetClass, type AssetClassKey } from '@/content/assetClasses';

/**
 * Where "Compare in detail" goes, and how the comparison screen reads it back.
 *
 * Both halves live here so they cannot drift: the link is built from the same
 * list the page parses, and a class the parser does not recognise is dropped
 * rather than rendered as an empty column.
 *
 * `q` is written out in words as well as `assets` being listed. The words are
 * what a person sees at the top of the answer and what a shared link says it
 * is about; the list is what the page actually renders from. One without the
 * other is either an unreadable URL or an unparseable one.
 */
export function compareHref(key: AssetClassKey) {
  const entry = assetClass(key);
  const set = entry ? [entry.key, ...entry.alternatives] : ['stocks', 'etfs', 'bonds'];
  const names = set.map((slug) => assetClass(slug)?.name ?? slug);

  return {
    pathname: '/research' as const,
    query: {
      q: `Compare ${names.join(', ')}`,
      assets: set.join(','),
    },
  };
}

/**
 * The classes a comparison URL asks for.
 *
 * Returns null when there is nothing usable, so the caller can fall back to its
 * own behaviour rather than render a table with one column or none. Duplicates
 * are collapsed and unknown slugs dropped: the parameter comes from a URL, and
 * a URL is written by anybody.
 */
export function parseCompare(raw: unknown): AssetClassKey[] | null {
  if (typeof raw !== 'string') return null;

  const keys: AssetClassKey[] = [];
  for (const part of raw.split(',')) {
    const entry = assetClass(part.trim().toLowerCase());
    if (entry && !keys.includes(entry.key)) keys.push(entry.key);
  }

  // One column is not a comparison, and six is a table nobody reads across.
  if (keys.length < 2) return null;
  return keys.slice(0, 4);
}
