import type { StaticPathname } from '@/i18n/routing';
import type { MenuKey } from './menu';

/**
 * The primary navigation.
 *
 * Seven items for a guest, and four of them carry a dropdown: Explore, Ideas,
 * Learn and Marketplace. Market, Symbols, Economy and Academy no longer have a
 * menu of their own — the market/asset/economy cluster is named inside Explore,
 * Academy and the practice portfolio inside Learn.
 *
 * `Start Investing` is gone from this row. It was a menu of five ways into a
 * questionnaire standing beside four sections of the product, which read as
 * though answering questions were a fifth section; `/start` is still the hero
 * call to action on Home and the `Get started` button in this header, which is
 * where somebody who has not started looks for it.
 *
 * Ideas takes its place, and it is not the same kind of thing wearing a new
 * label: Start asked the reader about themselves, Ideas shows them the market
 * grouped by concepts they already understand.
 */
export type NavItem = {
  key: string;
  /** Message key under `header.nav`. */
  labelKey: string;
  href: StaticPathname;
  /**
   * Route prefixes that light this item up. Matching is longest-prefix-wins, so
   * `/account/wealth` picks My Money over My TradingNew without either needing
   * to know about the other.
   */
  prefixes: string[];
  /**
   * The dropdown this item opens, if it has one.
   *
   * An item with a menu is still a destination: the menu's first entry is the
   * section itself, so the label is a way in and not only a way to a list.
   */
  menu?: MenuKey;
  /**
   * An absolute URL, opened in a new tab. Only Community has one, and it is why
   * `href` cannot simply carry it: the portal's own links go through the locale
   * router, which would turn `https://…` into `/en/https://…`.
   *
   * An item with this is never `current` — the reader is not on it, they left
   * for it, and the tab they left from is still where they were.
   */
  external?: string;
};

const EXPLORE: NavItem = {
  key: 'explore',
  labelKey: 'explore',
  href: '/explore',
  // Everything the three old market menus covered, plus the advanced layer.
  // `/ideas` is deliberately not here any more: it is its own section now, and
  // a prefix in two items is an underline in two places.
  prefixes: [
    '/explore',
    '/market',
    '/markets',
    '/symbols',
    '/economy',
    '/news',
    '/research',
    '/tool',
    '/supercharts',
    '/community',
    '/brokers',
  ],
  menu: 'explore',
};

/**
 * Ideas — "what should I look at?".
 *
 * A discovery layer rather than a data one: it starts from a concept somebody
 * already understands (electricity demand, defence budgets) and works down to
 * the companies and funds, which is the opposite of arriving with a ticker and
 * looking for a reason.
 */
const IDEAS: NavItem = {
  key: 'ideas',
  labelKey: 'ideas',
  href: '/ideas',
  prefixes: ['/ideas'],
  menu: 'ideas',
};

const LEARN: NavItem = {
  key: 'learn',
  labelKey: 'learn',
  href: '/academy',
  // Lessons and the practice portfolio. Events used to be here too, which lit
  // Learn while someone was reading about a meetup in Berlin.
  prefixes: ['/academy', '/portfolio'],
  menu: 'learn',
};

const MARKETPLACE: NavItem = {
  key: 'marketplace',
  labelKey: 'marketplace',
  href: '/marketplace',
  // Tools & Data lives under `/marketplace/tools`, so the one prefix covers it.
  // `/tool/[slug]` belongs to Explore and does not match: a prefix matches the
  // path exactly or with a slash after it, so the two never collide.
  //
  // Events, their organizers and the combined hub sit here: they are things
  // other people offer, which is what this section is.
  prefixes: ['/marketplace', '/events', '/organizers', '/learning-events'],
  menu: 'marketplace',
};

/**
 * Community, which is TradingView's and not ours.
 *
 * A first-level item with the same weight as the rest — same colour, same size,
 * no de-emphasis — because it is one of the seven things this product offers,
 * and half of what makes it worth using is the network it is part of. What it
 * does not have is a dropdown or a page here: there is no community inside
 * TradingNew to put behind either, and a menu that opens onto a description of
 * somebody else's product is a detour.
 *
 * `href` is the local fallback for anything that reads this list without
 * knowing about `external` — the sitemap, a future mobile nav. It is never
 * followed while `external` is set.
 */
const COMMUNITY: NavItem = {
  key: 'community',
  labelKey: 'community',
  href: '/community',
  prefixes: [],
  external: 'https://www.tradingview.com/social-network/',
};

/**
 * Voyager has no dropdown, and is last on purpose.
 *
 * It had one, and every entry in it led to `/voyager` — the workspace, a seeded
 * question, another seeded question — plus a "Plans and limits" link pointing at
 * the same page as Marketplace's own Subscriptions. A menu whose options are all
 * one destination is a door with a list of ways to open it.
 *
 * Clicking the label opens the workspace, which is where all of it was going.
 */
const VOYAGER: NavItem = {
  key: 'voyager',
  labelKey: 'voyager',
  href: '/voyager',
  prefixes: ['/voyager'],
};

export const GUEST_NAV: NavItem[] = [
  { key: 'home', labelKey: 'home', href: '/', prefixes: ['/'] },
  EXPLORE,
  IDEAS,
  LEARN,
  MARKETPLACE,
  COMMUNITY,
  VOYAGER,
];

export const AUTHED_NAV: NavItem[] = [
  { key: 'mine', labelKey: 'mine', href: '/account', prefixes: ['/account'] },
  EXPLORE,
  IDEAS,
  LEARN,
  { key: 'money', labelKey: 'money', href: '/account/wealth', prefixes: ['/account/wealth'] },
  MARKETPLACE,
  COMMUNITY,
  VOYAGER,
];

/**
 * Which item is current.
 *
 * Longest prefix wins, and `/` only ever matches itself — otherwise the home
 * item would be active on every page in the portal. An item with no prefixes
 * (Community, which leaves the portal) can never win.
 */
export function activeNavKey(items: NavItem[], pathname: string): string | null {
  let best: { key: string; length: number } | null = null;

  for (const item of items) {
    for (const prefix of item.prefixes) {
      const matches =
        prefix === '/'
          ? pathname === '/'
          : pathname === prefix || pathname.startsWith(`${prefix}/`);

      if (matches && (!best || prefix.length > best.length)) {
        best = { key: item.key, length: prefix.length };
      }
    }
  }

  return best?.key ?? null;
}
