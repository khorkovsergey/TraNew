import type { AppPathname } from '@/i18n/routing';

/**
 * Structure of the five header dropdowns. Labels are message keys under `menu.*`,
 * resolved at render time so both locales stay in lockstep with the route map.
 */
export type MenuEntry = {
  labelKey: string;
  subKey?: string;
  /** Routed, but the screen behind it is still being built. */
  soon?: boolean;
} & (
  | {
      kind: 'route';
      href: AppPathname;
      params?: Record<string, string>;
      query?: Record<string, string>;
    }
  | { kind: 'auth' }
  | { kind: 'focusSearch' }
);

export type MenuGroup = {
  titleKey: string;
  items: MenuEntry[];
};

export type NavKey =
  | 'home'
  | 'market'
  | 'symbols'
  | 'economy'
  | 'community'
  | 'marketplace'
  | 'voyager';

/**
 * A destination that is routed but not yet built.
 *
 * Half the navigation currently lands on the generic tool page, which says the
 * screen is still being built — but it only says so *after* the click. Marking
 * them here means the menu tells the truth before someone spends a navigation
 * finding out, and it gives one list to work through as each screen lands:
 * delete the flag, and the badge goes with it.
 */
const tool = (
  slug: string
): { kind: 'route'; href: AppPathname; params: Record<string, string>; soon: true } => ({
  kind: 'route',
  href: '/tool/[slug]',
  params: { slug },
  soon: true,
});

const symbol = (
  ticker: string
): { kind: 'route'; href: AppPathname; params: Record<string, string> } => ({
  kind: 'route',
  href: '/symbols/[ticker]',
  params: { ticker },
});

export const MENUS: Record<Exclude<NavKey, 'home' | 'voyager'>, MenuGroup[]> = {
  market: [
    {
      titleKey: 'market.overviewTitle',
      items: [
        {
          labelKey: 'market.globalMarkets',
          subKey: 'market.globalMarketsSub',
          kind: 'route',
          href: '/markets/global',
        },
        {
          labelKey: 'market.marketNews',
          subKey: 'market.marketNewsSub',
          kind: 'route',
          href: '/news',
        },
        {
          labelKey: 'market.tradingIdeas',
          subKey: 'market.tradingIdeasSub',
          kind: 'route',
          href: '/ideas',
        },
      ],
    },
    {
      titleKey: 'market.assetsTitle',
      items: [
        { labelKey: 'market.indices', ...tool('indices') },
        { labelKey: 'market.stocks', ...tool('stocks') },
        { labelKey: 'market.crypto', ...tool('crypto') },
        { labelKey: 'market.forex', ...tool('forex') },
        { labelKey: 'market.bonds', ...tool('bonds') },
        { labelKey: 'market.etfs', ...tool('etfs') },
        { labelKey: 'market.commodities', ...tool('commodities') },
      ],
    },
    {
      titleKey: 'market.toolsTitle',
      items: [
        { labelKey: 'market.supercharts', kind: 'route', href: '/supercharts' },
        { labelKey: 'market.screeners', ...tool('screeners') },
        { labelKey: 'market.calendars', ...tool('calendars') },
        { labelKey: 'market.brokers', kind: 'route', href: '/brokers' },
      ],
    },
  ],

  symbols: [
    {
      titleKey: 'symbols.popularTitle',
      items: [
        { labelKey: 'symbols.tesla', ...symbol('TSLA') },
        { labelKey: 'symbols.sp500', ...symbol('SPX') },
        { labelKey: 'symbols.bitcoin', ...symbol('BTC') },
        { labelKey: 'symbols.gold', ...symbol('GOLD') },
        { labelKey: 'symbols.nvidia', ...symbol('NVDA') },
      ],
    },
    {
      titleKey: 'symbols.researchTitle',
      items: [
        {
          labelKey: 'symbols.researchAsset',
          subKey: 'symbols.researchAssetSub',
          kind: 'focusSearch',
        },
        { labelKey: 'symbols.compare', subKey: 'symbols.compareSub', ...tool('compare') },
        { labelKey: 'symbols.watchlists', subKey: 'symbols.watchlistsSub', kind: 'auth' },
      ],
    },
  ],

  economy: [
    {
      titleKey: 'economy.sectionTitle',
      items: [
        {
          labelKey: 'economy.overview',
          subKey: 'economy.overviewSub',
          kind: 'route',
          href: '/economy',
        },
        {
          labelKey: 'economy.countries',
          subKey: 'economy.countriesSub',
          kind: 'route',
          href: '/economy',
          query: { tab: 'countries' },
        },
        {
          labelKey: 'economy.indicators',
          subKey: 'economy.indicatorsSub',
          kind: 'route',
          href: '/economy',
          query: { tab: 'indicators' },
        },
        {
          labelKey: 'economy.calendar',
          subKey: 'economy.calendarSub',
          kind: 'route',
          href: '/economy',
          query: { tab: 'calendar' },
        },
        {
          labelKey: 'economy.news',
          subKey: 'economy.newsSub',
          kind: 'route',
          href: '/economy',
          query: { tab: 'news' },
        },
      ],
    },
    {
      // Tools, not sections — kept visually separate so the section list stays readable.
      titleKey: 'economy.toolsTitle',
      items: [
        { labelKey: 'economy.macroMaps', ...tool('macro-maps') },
        { labelKey: 'economy.countryCompare', ...tool('country-compare') },
        { labelKey: 'economy.yieldCurves', ...tool('yield-curves') },
        { labelKey: 'economy.indicatorCompare', ...tool('indicator-compare') },
        { labelKey: 'economy.scenarioExplorer', ...tool('scenario-explorer') },
      ],
    },
  ],

  community: [
    {
      titleKey: 'community.contestsTitle',
      items: [{ labelKey: 'community.theLeap', subKey: 'community.theLeapSub', ...tool('the-leap') }],
    },
    {
      titleKey: 'community.createdTitle',
      items: [
        { labelKey: 'community.ideas', kind: 'route', href: '/ideas' },
        { labelKey: 'community.indicators', ...tool('indicators') },
        { labelKey: 'community.topAuthors', ...tool('top-authors') },
      ],
    },
    {
      titleKey: 'community.growthTitle',
      items: [
        { labelKey: 'community.referral', ...tool('referral') },
        { labelKey: 'community.rewards', ...tool('rewards') },
        { labelKey: 'community.powerOfCommunity', kind: 'route', href: '/community' },
      ],
    },
  ],

  marketplace: [
    {
      titleKey: 'marketplace.featuredTitle',
      items: [
        /*
         * "Go beyond your plan" used to lead this list. It opened the Marketplace
         * hub, whose entire content is the four links directly below it — a click
         * that costs a navigation and returns the menu you were already looking
         * at. The hub is still reachable from the home carousel, from Community
         * and from the breadcrumb on the expert pages, where it lands as a
         * destination rather than as a detour.
         */
        {
          labelKey: 'marketplace.expertServices',
          subKey: 'marketplace.expertServicesSub',
          kind: 'route',
          href: '/marketplace/experts',
        },
        {
          labelKey: 'marketplace.toolsData',
          subKey: 'marketplace.toolsDataSub',
          kind: 'route',
          // The real screen, not the placeholder the menu used to point at while
          // the hub page pointed here.
          href: '/tools',
        },
        /*
         * "Learning and events" used to sit here, and it was the same shape as
         * "Go beyond your plan" above: a hub whose entire content is two links,
         * one of which — Events near you — was the very next row of this menu.
         *
         * Removing it outright would have hidden Academy, which had no menu
         * entry of its own and was only reachable through that hub. So the hub
         * is replaced by the destination it was standing in front of, and the
         * two event rows below stop being duplicates of something above them.
         *
         * `/learning-events` is untouched and still linked from the Marketplace
         * hub, where a page that groups two sections belongs.
         */
        {
          labelKey: 'marketplace.academy',
          subKey: 'marketplace.academySub',
          kind: 'route',
          href: '/academy',
        },
        {
          labelKey: 'marketplace.events',
          subKey: 'marketplace.eventsSub',
          kind: 'route',
          href: '/events',
        },
        {
          labelKey: 'marketplace.subscriptions',
          subKey: 'marketplace.subscriptionsSub',
          kind: 'route',
          href: '/marketplace/subscriptions',
        },
        {
          labelKey: 'marketplace.createEvent',
          subKey: 'marketplace.createEventSub',
          kind: 'route',
          href: '/events/create',
        },
        { labelKey: 'marketplace.merchandise', ...tool('merchandise') },
      ],
    },
  ],
};

/** Route prefixes that light up each nav item. */
export const NAV_ACTIVE_PREFIXES: Record<NavKey, string[]> = {
  home: ['/'],
  voyager: ['/voyager'],
  market: ['/market', '/markets', '/news', '/ideas', '/explore', '/supercharts'],
  symbols: ['/symbols', '/research', '/portfolio'],
  economy: ['/economy'],
  community: ['/community', '/brokers'],
  marketplace: ['/marketplace', '/academy', '/strategy'],
};
