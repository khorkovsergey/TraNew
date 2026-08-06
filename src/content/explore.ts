import type { IconName } from '@/components/ui/Icon';
import type { AssetAccent, AssetClassKey } from '@/content/assetClasses';
import type { StaticPathname } from '@/i18n/routing';

/**
 * Explore, minus the classes themselves.
 *
 * The asset classes and the comparison matrix moved to `assetClasses.ts`, which
 * is the single place they are described. What is left here is the furniture:
 * the products people start from, the market tiles, and the sections that are
 * not asset classes and were never tabs.
 */

export type ExploreAccent = AssetAccent | 'cyan';

/**
 * Popular starting points.
 *
 * Each one is a product shape rather than a class, and each now opens the class
 * page behind it. They used to open `/tool/*`, which is the placeholder screen
 * — a card that says "Understand" and delivers "high-fidelity build in
 * progress" is worse than no card.
 */
export const STARTERS: Array<{
  name: string;
  text: string;
  badge: string;
  accent: ExploreAccent;
  seed: number;
  klass: AssetClassKey;
}> = [
  {
    name: 'Global ETF',
    text: 'One fund holding the developed world’s largest companies.',
    badge: 'Diversified',
    accent: 'blue',
    seed: 3.1,
    klass: 'etfs',
  },
  {
    name: 'Bond income ETF',
    text: 'A fund of bonds, paying out what they pay in.',
    badge: 'Income',
    accent: 'purple',
    seed: 5.4,
    klass: 'bonds',
  },
  {
    name: 'High-yield savings',
    text: 'A deposit that pays more than a current account.',
    badge: 'Low risk',
    accent: 'green',
    seed: 7.7,
    klass: 'cash',
  },
  {
    name: 'Dividend ETF',
    text: 'Companies that hand back a share of profit.',
    badge: 'Income',
    accent: 'amber',
    seed: 9.2,
    klass: 'etfs',
  },
  {
    name: 'Single company shares',
    text: 'One business, chosen deliberately.',
    badge: 'Concentrated',
    accent: 'green',
    seed: 4.5,
    klass: 'stocks',
  },
  {
    name: 'Listed property (REIT)',
    text: 'Rent from buildings, bought like a share.',
    badge: 'Income',
    accent: 'rose',
    seed: 6.3,
    klass: 'property',
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
 * "Explore more" — the sections that are not asset classes.
 *
 * These six used to sit in the row above the tabs, styled as pills beside
 * "Investment types", so switching a tab and leaving the page looked like the
 * same gesture. Economy was worse: it was a seventh tab in a row of asset
 * classes, and it is not one. They are a labelled block at the foot of the page
 * now, which is what they always were.
 */
export const EXPLORE_MORE: Array<{
  label: string;
  text: string;
  icon: IconName;
  accent: ExploreAccent;
  href: StaticPathname;
}> = [
  {
    label: 'Economy & your money',
    text: 'Rates, inflation and growth, and what they do to a plan.',
    icon: 'globe',
    accent: 'cyan',
    href: '/economy',
  },
  {
    label: 'Today in markets',
    text: 'What moved, and whether it matters.',
    icon: 'bars',
    accent: 'green',
    href: '/markets/global',
  },
  {
    label: 'News',
    text: 'Headlines with the reason underneath them.',
    icon: 'fileSearch',
    accent: 'blue',
    href: '/news',
  },
  {
    label: 'Market Views',
    text: 'What other people think, labelled as opinion.',
    icon: 'chat',
    accent: 'amber',
    href: '/ideas',
  },
  {
    label: 'Research an asset',
    text: 'Ask about one company or fund in particular.',
    icon: 'search',
    accent: 'purple',
    href: '/research',
  },
  {
    label: 'Advanced charts',
    text: 'The professional workspace, when you want it.',
    icon: 'chart',
    accent: 'rose',
    href: '/supercharts',
  },
];
