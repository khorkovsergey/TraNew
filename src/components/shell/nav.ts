import type { StaticPathname } from '@/i18n/routing';
import type { MenuKey } from './menu';

/**
 * The redesigned primary navigation.
 *
 * Six items for a guest, seven signed in, and one of them is a dropdown. That is
 * the whole of it — Market, Symbols, Economy, Community and Academy no longer
 * have a menu of their own.
 *
 * They have not been removed. Every route they used to open is still routed and
 * still reachable: the market/asset/economy cluster through Explore's sub-nav,
 * Academy and events through Learn, community through Market Views, and the
 * long tail through the footer, which exists for exactly this reason. A link
 * with no way in is a deleted feature wearing a route.
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
};

const START: NavItem = {
  key: 'start',
  labelKey: 'start',
  href: '/start',
  prefixes: ['/start', '/strategy'],
  menu: 'start',
};

const EXPLORE: NavItem = {
  key: 'explore',
  labelKey: 'explore',
  href: '/explore',
  // Everything the three old market menus covered, plus the advanced layer.
  prefixes: [
    '/explore',
    '/market',
    '/markets',
    '/symbols',
    '/economy',
    '/news',
    '/ideas',
    '/research',
    '/tool',
    '/supercharts',
    '/community',
    '/brokers',
  ],
  menu: 'explore',
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
  START,
  EXPLORE,
  LEARN,
  MARKETPLACE,
  VOYAGER,
];

export const AUTHED_NAV: NavItem[] = [
  { key: 'mine', labelKey: 'mine', href: '/account', prefixes: ['/account'] },
  START,
  EXPLORE,
  LEARN,
  { key: 'money', labelKey: 'money', href: '/account/wealth', prefixes: ['/account/wealth'] },
  MARKETPLACE,
  VOYAGER,
];

/**
 * Which item is current.
 *
 * Longest prefix wins, and `/` only ever matches itself — otherwise the home
 * item would be active on every page in the portal.
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
