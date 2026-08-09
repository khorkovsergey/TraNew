import { assetClass, type AssetClassKey } from '@/content/assetClasses';

/**
 * Where "Compare" goes.
 *
 * It used to go to `/research` — the instrument-research workspace, with a
 * search box, a chart and a canned answer on it. Somebody still deciding
 * whether they want bonds or a fund at all was being handed a screen built for
 * choosing between two tickers, and the way back was the browser button.
 *
 * The comparison lives on the Investment options page now, at `#compare`, so
 * this is a link into the page rather than out of it. The class travels in
 * `tab` because the comparison always opens with the class you were reading
 * about in the first column.
 *
 * `/research?assets=…` still renders a comparison for anyone holding an old
 * link — see `parseCompare`, which is why it is still here although nothing in
 * this section builds those URLs any more.
 */
export function compareHref(key: AssetClassKey) {
  return {
    pathname: '/explore' as const,
    query: { tab: key },
    hash: 'compare',
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
