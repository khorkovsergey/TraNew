import type { AppPathname } from '@/i18n/routing';

/**
 * Structure of the five header dropdowns. Labels are message keys under `menu.*`,
 * resolved at render time so both locales stay in lockstep with the route map.
 */
export type MenuEntry = {
  labelKey: string;
  subKey?: string;
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

export type NavKey = 'home' | 'market' | 'symbols' | 'economy' | 'community' | 'marketplace';

const tool = (slug: string): { kind: 'route'; href: AppPathname; params: Record<string, string> } => ({
  kind: 'route',
  href: '/tool/[slug]',
  params: { slug },
});

const symbol = (
  ticker: string
): { kind: 'route'; href: AppPathname; params: Record<string, string> } => ({
  kind: 'route',
  href: '/symbols/[ticker]',
  params: { ticker },
});

export const MENUS: Record<Exclude<NavKey, 'home'>, MenuGroup[]> = {
  market: [
    {
      titleKey: 'market.overviewTitle',
      items: [
        {
          labelKey: 'market.entireWorld',
          subKey: 'market.entireWorldSub',
          kind: 'route',
          href: '/market/brief',
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
        {
          labelKey: 'marketplace.goBeyond',
          subKey: 'marketplace.goBeyondSub',
          kind: 'route',
          href: '/marketplace',
        },
        {
          labelKey: 'marketplace.expertServices',
          subKey: 'marketplace.expertServicesSub',
          kind: 'route',
          href: '/marketplace/experts',
        },
        {
          labelKey: 'marketplace.toolsData',
          subKey: 'marketplace.toolsDataSub',
          ...tool('tools-and-data'),
        },
        {
          labelKey: 'marketplace.learningEvents',
          subKey: 'marketplace.learningEventsSub',
          kind: 'route',
          href: '/learning-events',
        },
        {
          labelKey: 'marketplace.events',
          subKey: 'marketplace.eventsSub',
          kind: 'route',
          href: '/events',
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
  market: ['/market', '/news', '/ideas', '/explore', '/supercharts'],
  symbols: ['/symbols', '/research', '/portfolio'],
  economy: ['/economy'],
  community: ['/community', '/brokers'],
  marketplace: ['/marketplace', '/academy', '/strategy'],
};
