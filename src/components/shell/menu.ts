import type { AppPathname } from '@/i18n/routing';

/**
 * The header dropdowns.
 *
 * Four sections carry one: Start Investing, Explore, Learn and Marketplace. The
 * redesign shipped with only Marketplace, on the argument that a beginner should
 * be able to read the top of the page rather than navigate it; the sections
 * underneath then had to be reached through the page they belonged to. These
 * bring the shortcuts back without taking the destinations away — every menu
 * opens with the section itself, so the label is still a way in and not only a
 * way to a list.
 *
 * Voyager is not among them. Its menu offered three entries that all opened
 * `/voyager` and a "Plans and limits" link pointing at the same page as
 * Marketplace's Subscriptions — a list of ways to reach one destination. The
 * label now simply goes there. Nothing was lost with it: Voyager settings live
 * in the account menu, and saved workspaces are on the workspace itself.
 *
 * Copy is literal rather than message keys. The portal is English-only by an
 * explicit decision, and every other file the redesign added carries its
 * English copy directly; a `menu.*` namespace for one file would be the odd one
 * out and a second place to look for a label.
 */
export type MenuEntry = {
  label: string;
  sub?: string;
  /** Carries the "Soon" badge. */
  soon?: boolean;
} & (
  | {
      kind: 'route';
      href: AppPathname;
      params?: Record<string, string>;
      query?: Record<string, string>;
    }
  | { kind: 'auth' }
  /**
   * Announced but not routed: the entry names something that does not exist
   * yet, so it does not click at all. A badge that warns and then navigates to
   * a placeholder still spends the click it warned about.
   */
  | { kind: 'inert' }
);

export type MenuGroup = {
  title: string;
  items: MenuEntry[];
};

export type MenuKey = 'start' | 'explore' | 'learn' | 'marketplace';

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

const klass = (
  key: string
): { kind: 'route'; href: AppPathname; params: Record<string, string> } => ({
  kind: 'route',
  href: '/explore/[class]',
  params: { class: key },
});

export const MENUS: Record<MenuKey, MenuGroup[]> = {
  start: [
    {
      title: 'Find your footing',
      items: [
        {
          label: 'Start Investing',
          sub: 'Four questions and a starting path',
          kind: 'route',
          href: '/start',
        },
        {
          label: 'Build my plan',
          sub: 'The longer interview, and what it produces',
          kind: 'route',
          href: '/strategy',
        },
        {
          label: 'My learning path',
          sub: 'What to read, in the order it builds',
          kind: 'route',
          href: '/academy/path',
        },
      ],
    },
    {
      title: 'If you already invest',
      items: [
        {
          label: 'Practice portfolio',
          sub: 'Try a decision with virtual money',
          kind: 'route',
          href: '/portfolio',
        },
        {
          label: 'Compare the options',
          sub: 'Every category, side by side',
          kind: 'route',
          href: '/explore/options',
        },
      ],
    },
  ],

  explore: [
    {
      title: 'Investment types',
      items: [
        { label: 'Stocks', ...klass('stocks') },
        { label: 'ETFs', ...klass('etfs') },
        { label: 'Bonds', ...klass('bonds') },
        { label: 'Cash & deposits', ...klass('cash') },
        { label: 'Crypto', ...klass('crypto') },
        { label: 'Property', ...klass('property') },
        { label: 'See all options', kind: 'route', href: '/explore/options' },
      ],
    },
    /*
     * Market, Symbols and Economy are named groups here on purpose. They were
     * three top-level sections before the redesign folded them into Explore,
     * and somebody who knew where they used to be should find them by that name
     * rather than by guessing which tab absorbed them.
     */
    {
      title: 'Market',
      items: [
        {
          label: 'Today in markets',
          sub: 'What moved, and whether it matters',
          kind: 'route',
          href: '/markets/global',
        },
        { label: 'Market news', sub: 'Headlines with the reason under them', kind: 'route', href: '/news' },
        { label: 'Market Views', sub: 'Opinion, labelled as opinion', kind: 'route', href: '/ideas' },
      ],
    },
    {
      title: 'Symbols',
      items: [
        { label: 'Research an asset', sub: 'Ask about one in particular', kind: 'route', href: '/research' },
        { label: 'Tesla', ...symbol('TSLA') },
        { label: 'S&P 500', ...symbol('SPX') },
        { label: 'NVIDIA', ...symbol('NVDA') },
        { label: 'Bitcoin', ...symbol('BTC') },
        { label: 'Gold', ...symbol('GOLD') },
      ],
    },
    {
      title: 'Economy',
      items: [
        {
          label: 'Economy & your money',
          sub: 'Rates, inflation, and what they do to a plan',
          kind: 'route',
          href: '/economy',
        },
        { label: 'Countries', kind: 'route', href: '/economy', query: { tab: 'countries' } },
        { label: 'Indicators', kind: 'route', href: '/economy', query: { tab: 'indicators' } },
        { label: 'Calendar', kind: 'route', href: '/economy', query: { tab: 'calendar' } },
      ],
    },
    {
      title: 'Advanced',
      items: [
        { label: 'Advanced charts', sub: 'The professional workspace', kind: 'route', href: '/supercharts' },
        { label: 'Find investments', ...tool('screeners') },
        { label: 'Brokers', kind: 'route', href: '/brokers' },
        { label: 'How we explain markets', kind: 'route', href: '/how-we-explain' },
      ],
    },
  ],

  learn: [
    {
      title: 'Learn',
      items: [
        { label: 'Learn', sub: 'Short lessons, in plain language', kind: 'route', href: '/academy' },
        { label: 'Beginner path', sub: 'Five lessons that build on each other', kind: 'route', href: '/academy/path' },
        { label: 'Where should I start?', sub: 'Two minutes of questions', kind: 'route', href: '/academy/setup' },
        { label: 'My progress', kind: 'route', href: '/academy/dashboard' },
      ],
    },
    {
      title: 'Practise',
      items: [
        {
          label: 'Practice portfolio',
          sub: 'Virtual money, real prices',
          kind: 'route',
          href: '/portfolio',
        },
        {
          label: 'First lesson',
          sub: 'Why people invest',
          kind: 'route',
          href: '/academy/lesson/[slug]',
          params: { slug: 'why-people-invest' },
        },
      ],
    },
    {
      title: 'Events',
      items: [
        { label: 'Events', sub: 'Meetups, webinars and conferences', kind: 'route', href: '/events' },
        { label: 'Create an event', kind: 'route', href: '/events/create' },
        { label: 'Learning & events hub', kind: 'route', href: '/learning-events' },
      ],
    },
  ],

  marketplace: [
    {
      title: 'Featured',
      items: [
        {
          label: 'Expert services',
          sub: 'Book a consultation',
          kind: 'route',
          href: '/marketplace/experts',
        },
        {
          label: 'Tools and data',
          sub: 'Indicators, screeners, data feeds',
          kind: 'route',
          href: '/tools',
        },
        { label: 'Academy', sub: 'Courses and learning paths', kind: 'route', href: '/academy' },
        {
          label: 'Events near you',
          sub: 'Meetups, webinars and conferences',
          kind: 'route',
          href: '/events',
        },
        {
          label: 'Subscriptions',
          sub: 'Plans, Voyager tiers and limits',
          kind: 'route',
          href: '/marketplace/subscriptions',
        },
        {
          label: 'Create an event',
          sub: 'Publish yours to the community',
          kind: 'route',
          href: '/events/create',
        },
        // There is no store, so there is nowhere for this to go. It used to
        // open the generic placeholder screen.
        { label: 'Merchandise', sub: 'Physical goods and limited editions', kind: 'inert', soon: true },
      ],
    },
  ],
};
