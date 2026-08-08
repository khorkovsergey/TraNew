import type { AppPathname } from '@/i18n/routing';
import type { ExploreIconId } from './ExploreMenuIcons';

/**
 * The header dropdowns.
 *
 * Four sections carry one: Start Investing, Explore, Learn and Marketplace. The
 * redesign shipped with only Marketplace, on the argument that a beginner should
 * be able to read the top of the page rather than navigate it; the sections
 * underneath then had to be reached through the page they belonged to. These
 * bring the shortcuts back without taking the destinations away — three of the
 * four open with the section itself, so the label is still a way in and not only
 * a way to a list.
 *
 * Explore is the exception and says so below: it announces a market data product
 * that is being built, so nothing in it clicks yet. The routes it used to hold
 * are all still linked from the footer.
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
  /**
   * The glyph on the left of the row, from the Explore sprite.
   *
   * Only Explore draws one. The other three menus are short lists of
   * destinations where an icon per line would be decoration standing in a
   * column; Explore is twenty rows that a reader scans rather than reads, and
   * there the glyph is what makes a row findable a second time.
   */
  icon?: ExploreIconId;
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
  /**
   * The question the group answers, set beside its title. Three columns of
   * financial nouns are hard to tell apart at a glance; "What is happening?"
   * beside MARKET says which column to read without adding a row to it.
   */
  hint?: string;
  items: MenuEntry[];
};

export type MenuKey = 'start' | 'explore' | 'learn' | 'marketplace';

/**
 * An Explore row: named, described, illustrated, and going nowhere yet.
 *
 * All twenty are built through this rather than written out, because the one
 * thing that must not vary between them is the part that matters — a row that
 * quietly gained an `href` would be the single clickable line in a panel where
 * nothing else clicks, and nobody would notice until it 404s.
 */
const soon = (
  label: string,
  sub: string,
  icon: ExploreIconId
): MenuEntry => ({ kind: 'inert', soon: true, label, sub, icon });

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

  /*
   * Explore is a roadmap, not a set of shortcuts.
   *
   * It held five groups of working links — investment types, and the three
   * sections that used to be top-level headings, plus an advanced layer. What it
   * describes now is the market data product being built: three questions, in
   * the order somebody actually asks them, and twenty answers none of which
   * exists yet. So none of them clicks. A row that navigates to a page which
   * cannot answer it spends the trust the row was meant to build.
   *
   * The three names are the ones the sections carried before Explore absorbed
   * them, and the destinations they used to hold have not gone anywhere: every
   * one of them is in the footer, which is what the footer is for.
   */
  explore: [
    {
      title: 'MARKET',
      hint: 'What is happening?',
      items: [
        soon('Market overview', 'See what is moving today', 'overview'),
        soon('Stocks', 'Global equity markets', 'stocks'),
        soon('ETFs', 'Funds across markets and themes', 'etfs'),
        soon('Indices', 'Major global benchmarks', 'indices'),
        soon('Crypto', 'Digital asset markets', 'crypto'),
        soon('Forex', 'Global currencies', 'forex'),
        soon('Futures & Commodities', 'Energy, metals, agriculture', 'futures'),
        soon('Bonds', 'Government and corporate debt', 'bonds'),
      ],
    },
    {
      title: 'SYMBOLS',
      hint: 'What is this asset?',
      items: [
        soon('Search an asset', 'Stocks, ETFs, crypto and more', 'search'),
        soon('Stock screener', 'Find stocks by fundamentals and performance', 'filter'),
        soon('ETF screener', 'Compare funds and strategies', 'filter'),
        soon('Crypto screener', 'Explore digital assets', 'filterCrypto'),
        soon('Bond screener', 'Compare yields and maturities', 'filterDoc'),
        soon('Popular symbols', 'What investors are looking at', 'popular'),
      ],
    },
    {
      title: 'ECONOMY',
      hint: 'Why is it happening?',
      items: [
        soon('World economy', 'The global macro picture', 'world'),
        soon('Countries', 'Explore economies by country', 'flag'),
        soon('Economic indicators', 'Inflation, rates, GDP and more', 'indicators'),
        soon('Economic calendar', 'Events that can move markets', 'calendar'),
        soon('Macro maps', 'Compare economies visually', 'map'),
        soon('Yield curves', 'Interest rates across maturities', 'yield'),
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
    /*
     * Events is not here. It had a group of its own, which put the section in
     * two menus at once and read as though meetups were part of the syllabus.
     * They are a marketplace of other people's events, and that is the menu
     * that carries them.
     */
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
        /*
         * One entry per section, not one per screen.
         *
         * Chart Market and Supercharts were listed here beside Tools & Data,
         * and My Learning beside Academy. Both pairs put a section and its own
         * inside on the same level, which reads as four products rather than
         * two — and the first thing either section shows is the way to the
         * screens that were listed. A menu that names what is behind a door as
         * well as the door is a longer menu, not a shorter path.
         */
        {
          label: 'Tools and data',
          sub: 'Chart Market, Supercharts and what is coming',
          kind: 'route',
          href: '/marketplace/tools',
        },
        {
          label: 'Academy',
          sub: 'Paid courses from checked providers',
          kind: 'route',
          href: '/marketplace/academy',
        },
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
