import type { AppPathname } from '@/i18n/routing';

/**
 * Structure of the five header dropdowns. Labels are message keys under `menu.*`,
 * resolved at render time so both locales stay in lockstep with the route map.
 */
export type MenuEntry = {
  labelKey: string;
  subKey?: string;
} & (
  | { kind: 'route'; href: AppPathname; params?: Record<string, string> }
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
          labelKey: 'economy.calendar',
          subKey: 'economy.calendarSub',
          ...tool('economic-calendar'),
        },
        { labelKey: 'economy.macroMaps', subKey: 'economy.macroMapsSub', ...tool('macro-maps') },
        {
          labelKey: 'economy.yieldCurves',
          subKey: 'economy.yieldCurvesSub',
          ...tool('yield-curves'),
        },
        {
          labelKey: 'economy.inflation',
          subKey: 'economy.inflationSub',
          kind: 'route',
          href: '/economy',
        },
        { labelKey: 'economy.economyNews', kind: 'route', href: '/news' },
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
          href: '/academy',
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
