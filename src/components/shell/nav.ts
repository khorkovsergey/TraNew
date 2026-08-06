import type { StaticPathname } from '@/i18n/routing';

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
};

const START: NavItem = {
  key: 'start',
  labelKey: 'start',
  href: '/start',
  prefixes: ['/start', '/strategy'],
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
};

const LEARN: NavItem = {
  key: 'learn',
  labelKey: 'learn',
  href: '/academy',
  prefixes: ['/academy', '/events', '/learning-events', '/organizers', '/portfolio'],
};

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
  VOYAGER,
];

export const AUTHED_NAV: NavItem[] = [
  { key: 'mine', labelKey: 'mine', href: '/account', prefixes: ['/account'] },
  START,
  EXPLORE,
  LEARN,
  { key: 'money', labelKey: 'money', href: '/account/wealth', prefixes: ['/account/wealth'] },
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
