import type { IconName } from '@/components/ui/Icon';
import type { AppPathname } from '@/i18n/routing';
import type { ExploreIconId } from './ExploreMenuIcons';

/**
 * The header dropdowns.
 *
 * Four sections carry one: Explore, Ideas, Learn and Marketplace. Explore was
 * the strongest of them and is now the reference — one row anatomy, an icon per
 * line, a label and a description — and the other three were brought up to it
 * rather than left as lists of links beside it. One component, four datasets;
 * the difference between them is the shape of the panel, not the shape of a row.
 *
 * Explore is still the exception in what it promises: it announces a market data
 * product that is being built, so nothing in it clicks yet. Everywhere else a row
 * that looks clickable is clickable.
 *
 * `Start Investing` used to be here. Its menu named five ways into a
 * questionnaire, which put a form on the same level as four sections of the
 * product. `/start` is still the hero call to action on Home and the
 * `Get started` button in the header; the practice portfolio and the beginner
 * path are in Learn, where somebody looking for them would read first.
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
   * Explore only. Its twenty glyphs are circles, rectangles and stacked strokes
   * that `Icon` cannot hold — every icon there is a single `d` string on
   * purpose — so they live in a sprite of their own.
   */
  icon?: ExploreIconId;
  /**
   * The same slot, filled from `Icon` instead.
   *
   * Two fields rather than one, because the two sets overlap by name: `search`
   * and `calendar` exist in both, and a single field would have to guess which
   * one a row meant.
   */
  glyph?: IconName;
} & (
  | {
      kind: 'route';
      href: AppPathname;
      params?: Record<string, string>;
      query?: Record<string, string>;
      /**
       * The section of the destination page this row is about, as an anchor.
       *
       * Ideas is one page with six named parts, so its six rows would otherwise
       * all be the same link — the failure Voyager's dropdown was deleted for.
       * The hash makes each row land on the thing it names.
       */
      hash?: string;
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

export type MenuKey = 'explore' | 'ideas' | 'learn' | 'marketplace';

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

/** An Ideas row: one part of the landing page, named and pointed at. */
const idea = (
  label: string,
  sub: string,
  hash: string,
  glyph: IconName
): MenuEntry => ({ kind: 'route', href: '/ideas', hash, label, sub, glyph });

export const MENUS: Record<MenuKey, MenuGroup[]> = {
  /*
   * Explore is a roadmap, not a set of shortcuts.
   *
   * It held five groups of working links — investment types, and the three
   * sections that used to be top-level headings, plus an advanced layer. What it
   * describes now is the market data product being built: three questions, in
   * the order somebody actually asks them, and twenty answers none of which
   * exists yet. So none of them clicks. A row that navigates to a page which
   * cannot answer it spends the trust the row was meant to build.
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

  /*
   * Ideas: six ways into one page.
   *
   * The section answers "what should I look at?", and the two groups are the two
   * halves of that — what is in front of you now, and what you do once something
   * has caught your eye. Every row lands on the part of `/ideas` it names, so
   * this is a menu of six destinations and not six links to the same one.
   */
  ideas: [
    {
      title: 'DISCOVER',
      items: [
        idea('Trending Ideas', 'What is gaining attention now', 'trending', 'trendUp'),
        idea(
          'Investment Themes',
          'Explore markets through understandable themes',
          'themes',
          'layers'
        ),
        idea('Market Opportunities', 'Situations worth exploring', 'opportunities', 'target'),
      ],
    },
    {
      title: 'GO DEEPER',
      items: [
        idea(
          'Popular With Investors',
          'What investors are paying attention to',
          'popular',
          'users'
        ),
        idea('Explore Portfolios', 'See ideas combined into portfolios', 'portfolios', 'pie'),
        idea('Compare Ideas', 'Compare themes, assets and approaches', 'compare', 'scale'),
      ],
    },
  ],

  learn: [
    {
      title: 'Learn',
      items: [
        {
          label: 'Learn',
          sub: 'Short lessons, in plain language',
          kind: 'route',
          href: '/academy',
          glyph: 'book',
        },
        {
          label: 'Beginner path',
          sub: 'Five lessons that build on each other',
          kind: 'route',
          href: '/academy/path',
          glyph: 'compass',
        },
        {
          label: 'Where should I start?',
          sub: 'Two minutes of questions',
          kind: 'route',
          href: '/academy/setup',
          glyph: 'help',
        },
        {
          label: 'My progress',
          kind: 'route',
          href: '/academy/dashboard',
          glyph: 'checkCircle',
        },
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
          glyph: 'wallet',
        },
        {
          label: 'First lesson',
          sub: 'Why people invest',
          kind: 'route',
          href: '/academy/lesson/[slug]',
          params: { slug: 'why-people-invest' },
          glyph: 'play',
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
          glyph: 'user',
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
          glyph: 'sliders',
        },
        {
          label: 'Academy',
          sub: 'Paid courses from checked providers',
          kind: 'route',
          href: '/marketplace/academy',
          glyph: 'grad',
        },
        {
          label: 'Events near you',
          sub: 'Meetups, webinars and conferences',
          kind: 'route',
          href: '/events',
          glyph: 'calendar',
        },
        {
          label: 'Subscriptions',
          sub: 'Plans, Voyager tiers and limits',
          kind: 'route',
          href: '/marketplace/subscriptions',
          glyph: 'star',
        },
        {
          label: 'Create an event',
          sub: 'Publish yours to the community',
          kind: 'route',
          href: '/events/create',
          glyph: 'plus',
        },
        // There is no store, so there is nowhere for this to go. It used to
        // open the generic placeholder screen.
        {
          label: 'Merchandise',
          sub: 'Physical goods and limited editions',
          kind: 'inert',
          soon: true,
          glyph: 'bookmark',
        },
      ],
    },
  ],
};
