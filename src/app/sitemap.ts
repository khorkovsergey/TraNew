import type { MetadataRoute } from 'next';
import { EXPERTS } from '@/content/experts';
import { isIndexable, listMarkets, type MarketSection } from '@/content/markets';
import { getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/metadata';

/**
 * The sitemap.
 *
 * The project had none, so nothing was being offered to a search engine at all —
 * which is worth saying plainly, because it means this file is the difference
 * between the cluster existing and being findable.
 *
 * What goes in is deliberately narrower than what exists. A page is listed only
 * if the markets registry says `index` for it, so a market that is reachable but
 * still thin stays out, and the decision to publish is made in one place rather
 * than inferred from whether a route happens to resolve. That is the quality
 * gate the brief asks for, expressed as code rather than as a process.
 */

/** Public screens that exist today and are worth a search result. */
const STATIC_PAGES: Array<{ href: Parameters<typeof getPathname>[0]['href']; priority: number }> = [
  { href: '/', priority: 1 },
  { href: '/market', priority: 0.8 },
  { href: '/news', priority: 0.8 },
  { href: '/ideas', priority: 0.6 },
  { href: '/explore', priority: 0.6 },
  { href: '/supercharts', priority: 0.7 },
  { href: '/economy', priority: 0.7 },
  { href: '/events', priority: 0.7 },
  { href: '/learning-events', priority: 0.6 },
  { href: '/academy', priority: 0.7 },
  { href: '/community', priority: 0.6 },
  { href: '/marketplace', priority: 0.5 },
  { href: '/marketplace/experts', priority: 0.5 },
  /*
   * The expert catalogue, but not the screens behind it.
   *
   * `/marketplace/experts` is a conversation with nothing to index until
   * somebody has had it; the catalogue is the page that actually answers "who
   * is on this marketplace". The intake, the matches-for-a-brief and the
   * booking steps are states of one person's session, not pages.
   */
  { href: '/marketplace/experts/matches', priority: 0.5 },
  { href: '/marketplace/tools', priority: 0.6 },
  /*
   * The catalogue, not a product.
   *
   * `?script=…` is a state of this URL rather than a page of its own, so
   * listing nine query strings would be listing one page nine times. The
   * catalogue is what a search result should land on.
   */
  { href: '/marketplace/tools/chart-market', priority: 0.6 },
  { href: '/marketplace/tools/supercharts', priority: 0.6 },
  { href: '/brokers', priority: 0.5 },
  { href: '/trust', priority: 0.4 },
  { href: '/how-we-explain', priority: 0.4 },
  { href: '/why', priority: 0.4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  // One timestamp for the run rather than per entry: `lastmod` is meant to mark
  // a content change, and stamping every URL with "now" on every build teaches a
  // crawler to ignore the field.
  const lastModified = new Date();
  const locale = routing.defaultLocale;

  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({
    url: SITE_URL + getPathname({ href: page.href, locale }),
    lastModified,
    priority: page.priority,
  }));

  /*
   * Every expert profile. They are public pages about a real professional's
   * credentials, which is exactly what somebody searches for by name — and a
   * catalogue that is only reachable through a conversation is a catalogue no
   * search engine ever sees.
   */
  for (const expert of EXPERTS) {
    entries.push({
      url:
        SITE_URL +
        getPathname({
          href: { pathname: '/marketplace/experts/[id]', params: { id: expert.id } },
          locale,
        }),
      lastModified,
      priority: 0.4,
    });
  }

  for (const market of listMarkets()) {
    if (market.slug === 'global') {
      if (isIndexable(market, 'overview')) {
        entries.push({
          url: SITE_URL + getPathname({ href: '/markets/global', locale }),
          lastModified,
          priority: 0.9,
        });
      }
      continue;
    }

    if (isIndexable(market, 'overview')) {
      entries.push({
        url:
          SITE_URL +
          getPathname({
            href: { pathname: '/markets/[market]', params: { market: market.slug } },
            locale,
          }),
        lastModified,
        priority: 0.8,
      });
    }

    const sections: Array<{ section: MarketSection; suffix: '/news' }> = [
      { section: 'news', suffix: '/news' },
    ];

    for (const entry of sections) {
      if (!isIndexable(market, entry.section)) continue;
      entries.push({
        url:
          SITE_URL +
          getPathname({
            href: { pathname: '/markets/[market]/news', params: { market: market.slug } },
            locale,
          }),
        lastModified,
        priority: 0.7,
      });
    }
  }

  return entries;
}
