import type { IconName } from '@/components/ui/Icon';
import type { AppPathname, StaticPathname } from '@/i18n/routing';

/**
 * Explore — the beginner layer over Market, Symbols and Economy.
 *
 * Three old sections became one, and the three levels the brief asks for are the
 * shape of this page: Essential is the category card, Detailed is the asset
 * pages behind it, Advanced is the charts link in the sub-nav. Nothing was
 * dropped on the way; the routes are the same ones the old menus opened.
 *
 * The ratings below are the part to be careful with. They are coarse, ordinal,
 * and about a *category* rather than any instrument in it — a scale of eight
 * dots is a way of saying "more than that one, less than this one", and the page
 * says so beside them. They are not scores, and nothing here is a
 * recommendation.
 */

export type ExploreAccent = 'green' | 'blue' | 'purple' | 'amber' | 'orange' | 'rose' | 'cyan';

export type CategoryKey =
  | 'stocks'
  | 'etfs'
  | 'bonds'
  | 'cash'
  | 'crypto'
  | 'property'
  | 'economy';

export type Category = {
  key: CategoryKey;
  name: string;
  icon: IconName;
  accent: ExploreAccent;
  tagline: string;
  /** The four questions a beginner asks, in the order they ask them. */
  what: string;
  why: string;
  risks: string;
  suit: string;
  questions: string[];
  /** Where "Learn more" goes. The route the old Market menu used for this class. */
  href: AppPathname;
  params?: Record<string, string>;
  /** Routed, but the screen behind it is still being built. */
  soon?: boolean;
};

const toolHref = (slug: string) => ({
  href: '/tool/[slug]' as AppPathname,
  params: { slug },
  soon: true,
});

export const CATEGORIES: Category[] = [
  {
    key: 'stocks',
    name: 'Stocks',
    icon: 'trendUp',
    accent: 'green',
    tagline: 'Shares of ownership in individual companies.',
    what: 'A stock is a small ownership share in one company that trades on an exchange.',
    why: 'Potential for long-term growth, and a share of profits where a company pays dividends.',
    risks: 'A single company can fall sharply. Far less diversified than a fund.',
    suit: 'People comfortable researching companies and holding through swings.',
    questions: [
      'Are single stocks risky for beginners?',
      'How many stocks would I need to own?',
      'Stocks or ETFs — where would I start?',
    ],
    ...toolHref('stocks'),
  },
  {
    key: 'etfs',
    name: 'ETFs',
    icon: 'layers',
    accent: 'blue',
    tagline: 'Baskets of investments you can buy in one go.',
    what: 'A collection of stocks, bonds or other assets that trades on an exchange like a share.',
    why: 'Diversification in a single purchase, simple to buy, and often low-cost.',
    risks: 'The whole market can fall, and a cheap fund is still exposed to what it holds.',
    suit: 'Beginners and long-horizon investors who want spread without picking.',
    questions: [
      'What is the difference between an ETF and a stock?',
      'Are ETFs suitable for beginners?',
      'How are ETFs taxed where I live?',
    ],
    ...toolHref('etfs'),
  },
  {
    key: 'bonds',
    name: 'Bonds',
    icon: 'shieldCheck',
    accent: 'purple',
    tagline: 'Loans to governments or companies that pay interest.',
    what: 'You lend money for a fixed period and receive regular interest payments.',
    why: 'Steadier income and smaller swings than shares, in most conditions.',
    risks: 'Rising rates push bond prices down, and an issuer can default.',
    suit: 'People who want income and would rather not watch a value move much.',
    questions: [
      'How does a bond actually pay interest?',
      'What happens to my bonds when rates rise?',
      'Government or corporate — what is the difference?',
    ],
    ...toolHref('bonds'),
  },
  {
    key: 'cash',
    name: 'Cash & Deposits',
    icon: 'wallet',
    accent: 'amber',
    tagline: 'Savings accounts and deposits with easy access.',
    what: 'Money held in a savings account, a term deposit or a money-market fund.',
    why: 'Safety and access — the base every other decision is built on.',
    risks: 'Inflation erodes what it buys, quietly, and a rate can be cut.',
    suit: 'An emergency fund, and any goal close enough that a fall would matter.',
    questions: [
      'How much cash should I keep aside?',
      'What is a high-yield savings account?',
      'Does inflation really eat my savings?',
    ],
    ...toolHref('cash'),
  },
  {
    key: 'crypto',
    name: 'Crypto',
    icon: 'coins',
    accent: 'orange',
    tagline: 'Digital assets with large and frequent price swings.',
    what: 'Currencies and tokens recorded on public blockchains, traded around the clock.',
    why: 'Some hold a small slice for growth potential and for its different behaviour.',
    risks: 'Extreme volatility. Values can fall a long way, quickly, and stay there.',
    suit: 'People risking only what losing entirely would not change.',
    questions: [
      'Is crypto too risky for someone starting out?',
      'What is Bitcoin, in plain terms?',
      'How much of a portfolio would be sensible?',
    ],
    ...toolHref('crypto'),
  },
  {
    key: 'property',
    name: 'Property',
    icon: 'building',
    accent: 'rose',
    tagline: 'Real estate, held directly or through listed funds.',
    what: 'Physical property, or shares in funds that own income-producing buildings.',
    why: 'Rent, long-run appreciation, and behaviour that differs from shares.',
    risks: 'Hard to sell quickly, expensive to enter, and markets move in long cycles.',
    suit: 'Long horizons, and people who will not need the money back at short notice.',
    questions: [
      'What is a REIT?',
      'Property or an ETF, over ten years?',
      'How much would I need to start?',
    ],
    ...toolHref('property'),
  },
  {
    key: 'economy',
    name: 'Economy',
    icon: 'globe',
    accent: 'cyan',
    tagline: 'How rates, inflation and growth shape your money.',
    what: 'The forces — interest rates, inflation, employment — that move every market at once.',
    why: 'Understanding them is what makes it possible to read a headline calmly.',
    risks: 'Headlines invite overreaction, and cycles are far harder to time than to explain.',
    suit: 'Everyone. It is the context that makes every other choice legible.',
    questions: [
      'Why does a rate change matter to me?',
      'What does inflation do to savings?',
      'What is a recession, simply?',
    ],
    href: '/economy',
  },
];

export function categoryByKey(key: string): Category | null {
  return CATEGORIES.find((entry) => entry.key === key) ?? null;
}

/**
 * The comparison strip.
 *
 * Eight dots, filled to a level. Ordinal and coarse on purpose: a number would
 * imply a precision that does not exist for a whole asset class, and a
 * percentage would imply a measurement.
 */
export const DOT_SCALE = 8;

export type CompareMetric = { label: string; value: string; level: number };

export type CompareCard = {
  name: string;
  icon: IconName;
  accent: ExploreAccent;
  tag: string;
  metrics: CompareMetric[];
};

export const COMPARE_CARDS: CompareCard[] = [
  {
    name: 'ETFs',
    icon: 'layers',
    accent: 'blue',
    tag: 'Spread, in one purchase',
    metrics: [
      { label: 'Risk', value: 'Medium', level: 4 },
      { label: 'Growth potential', value: 'Medium to high', level: 5 },
      { label: 'Stability', value: 'Medium', level: 4 },
      { label: 'Ease of selling', value: 'High', level: 7 },
    ],
  },
  {
    name: 'Bonds',
    icon: 'shieldCheck',
    accent: 'purple',
    tag: 'Income, with smaller swings',
    metrics: [
      { label: 'Risk', value: 'Low to medium', level: 3 },
      { label: 'Growth potential', value: 'Low to medium', level: 3 },
      { label: 'Stability', value: 'High', level: 6 },
      { label: 'Ease of selling', value: 'Medium to high', level: 5 },
    ],
  },
  {
    name: 'Cash deposit',
    icon: 'wallet',
    accent: 'amber',
    tag: 'Safety and access',
    metrics: [
      { label: 'Risk', value: 'Very low', level: 2 },
      { label: 'Growth potential', value: 'Very low', level: 1 },
      { label: 'Stability', value: 'Very high', level: 8 },
      { label: 'Ease of selling', value: 'High', level: 7 },
    ],
  },
];

export const RATING_NOTE =
  'These are general guides to a whole category, not measurements and not guarantees.';

/** Popular starting points. Each opens the asset-class page it belongs to. */
export const STARTERS: Array<{
  name: string;
  text: string;
  badge: string;
  accent: ExploreAccent;
  seed: number;
  cta: string;
  href: AppPathname;
  params?: Record<string, string>;
  soon?: boolean;
}> = [
  {
    name: 'Global ETF',
    text: 'Broad exposure to developed markets.',
    badge: 'Diversified',
    accent: 'blue',
    seed: 3.1,
    cta: 'Understand',
    ...toolHref('etfs'),
  },
  {
    name: 'Bond income ETF',
    text: 'Seeks steady income from bonds.',
    badge: 'Income',
    accent: 'purple',
    seed: 5.4,
    cta: 'Understand',
    ...toolHref('bonds'),
  },
  {
    name: 'High-yield savings',
    text: 'Earns more than a standard account.',
    badge: 'Low risk',
    accent: 'green',
    seed: 7.7,
    cta: 'Compare',
    ...toolHref('cash'),
  },
  {
    name: 'Dividend ETF',
    text: 'Companies that pay out a share of profits.',
    badge: 'Income',
    accent: 'amber',
    seed: 9.2,
    cta: 'Compare',
    ...toolHref('etfs'),
  },
];

/** Four tiles of what moved. Illustrative shapes, delayed figures, both labelled. */
export const MARKET_TILES: Array<{
  name: string;
  change: string;
  up: boolean;
  accent: ExploreAccent;
  seed: number;
}> = [
  { name: 'Global markets', change: '+0.68%', up: true, accent: 'green', seed: 2.3 },
  { name: 'US stocks', change: '+0.92%', up: true, accent: 'green', seed: 4.8 },
  { name: 'Global bonds', change: '−0.12%', up: false, accent: 'rose', seed: 6.6 },
  { name: 'Gold', change: '+0.31%', up: true, accent: 'amber', seed: 8.9 },
];

/**
 * The sub-nav.
 *
 * This is where Market, Symbols and Economy went. Every entry is a route that
 * existed before the redesign — the section headings changed, the destinations
 * did not.
 */
export const EXPLORE_SUBNAV: Array<{ label: string; href: StaticPathname | null }> = [
  { label: 'Investment types', href: null },
  { label: 'Today in markets', href: '/markets/global' },
  { label: 'News', href: '/news' },
  { label: 'Market Views', href: '/ideas' },
  { label: 'Economy & your money', href: '/economy' },
  { label: 'Research an asset', href: '/research' },
  { label: 'Advanced charts', href: '/supercharts' },
];
