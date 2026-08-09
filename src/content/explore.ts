import type { AssetAccent, AssetClassKey } from '@/content/assetClasses';

/**
 * Investment options, minus the classes themselves.
 *
 * The asset classes and the comparison matrix live in `assetClasses.ts`, which
 * is the single place they are described. What is left here is the catalogue
 * behind "Every option, in one list".
 *
 * The market tiles and the "Explore more" cards used to be here too. Both were
 * removed with the Investment options redesign: this is an education section
 * that states at the top that it carries no live prices, and four tiles with a
 * percentage on them made that untrue on the same screen that said it. The live
 * markets are one link away, at `/markets/global`, which is where somebody who
 * wanted them should have been all along.
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
