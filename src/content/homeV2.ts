import type { IconName } from '@/components/ui/Icon';
import type { StaticPathname } from '@/i18n/routing';

/**
 * The public home, as data.
 *
 * Copy and destinations live here so changing what the page says is an edit to
 * one list rather than a hunt through JSX. Every destination is an existing
 * route; nothing on this page invents one.
 *
 * Every figure below is illustrative and is labelled as such on screen. When
 * real data arrives, the labels go with it.
 */

/**
 * The two ways out of the product.
 *
 * Named once because six links point at the social network and one at the
 * professional product — a typo in one of seven copies is a card that silently
 * lands somewhere else.
 */
export const TRADINGVIEW_SOCIAL = 'https://www.tradingview.com/social-network/';
export const TRADINGVIEW = 'https://www.tradingview.com';

/**
 * A card either stays in the portal or leaves it — never both, never neither.
 * A union rather than two optional fields, so the tile that renders it does not
 * have to assert which one it got.
 */
export type IntentCard = { id: string; icon: IconName; title: string; body: string } & (
  | { href: StaticPathname; external?: never }
  /** A full URL. The card says so before the click. */
  | { external: string; href?: never }
);

/**
 * "What do you want to do?" — intent, not persona.
 *
 * The cards name what somebody wants to do now. Not who they are: no beginner,
 * no pro, no "new investor". Beginner-friendly is not beginner-only, and a
 * person who has to pick a label for themselves before they can press anything
 * has been asked the wrong question.
 */
export const INTENT_CARDS: IntentCard[] = [
  {
    id: 'markets',
    icon: 'bars',
    title: 'Explore markets',
    body: 'Stocks, ETFs, crypto and the economy.',
    href: '/explore',
  },
  {
    id: 'ideas',
    icon: 'bulb',
    title: 'Discover ideas',
    body: 'See what other investors are watching and thinking.',
    href: '/ideas',
  },
  {
    id: 'learn',
    icon: 'grad',
    title: 'Learn & practice',
    body: 'Understand concepts and try them without risk.',
    href: '/academy',
  },
  {
    id: 'community',
    icon: 'users',
    title: 'Join the community',
    body: 'Follow people, discussions and market conversations.',
    external: TRADINGVIEW_SOCIAL,
  },
  {
    id: 'marketplace',
    icon: 'sliders',
    title: 'Find tools & expertise',
    body: 'Courses, experts, scripts and advanced tools.',
    href: '/marketplace',
  },
  {
    id: 'voyager',
    icon: 'sparkle',
    title: 'Ask Voyager',
    body: 'Not sure? Just describe what you are looking for.',
    href: '/voyager',
  },
];

/**
 * Today in 3 minutes, in the order the questions get asked: what moved, why,
 * what people are saying about it, and what to do with any of that.
 */

export type Direction = 'up' | 'down';

/**
 * The three quotes in "What moved".
 *
 * `seed` picks the shape out of `wave()`. It is a constant rather than a random
 * number so the server and the browser draw the same line — and so nothing
 * labelled illustrative can change on a refresh and start looking live.
 */
export const TODAY_QUOTES: Array<{
  name: string;
  value: string;
  change: string;
  direction: Direction;
  seed: number;
}> = [
  { name: 'S&P 500', value: '5,268.44', change: '−0.45%', direction: 'down', seed: 2.1 },
  { name: 'Nasdaq 100', value: '18,742.10', change: '−0.62%', direction: 'down', seed: 6.4 },
  { name: 'Bitcoin', value: '68,412', change: '+1.28%', direction: 'up', seed: 8.8 },
];

/** "What happened", in one sentence. One, deliberately — this is a summary. */
export const TODAY_SUMMARY =
  'Markets moved lower as investors reacted to new economic data and shifting rate expectations.';

/** "What people are discussing" — the bridge from the snapshot to the social layer. */
export const TODAY_TOPICS = ['NVIDIA valuation', 'Rate cuts', 'Bitcoin momentum'];

/**
 * The question the fourth card carries into the workspace.
 *
 * Seeded rather than left blank: a card that promises to explain today and
 * delivers an empty composer is the dead end this page keeps removing.
 */
export const TODAY_VOYAGER_QUESTION = 'What do today’s market moves mean for me?';

/**
 * Ideas worth exploring.
 *
 * `thesis` is a stance, never an instruction — no buy, no sell, no price
 * target, no "strong". The job of this block is a reason to open Ideas, not a
 * second implementation of it.
 */
export const IDEAS: Array<{
  ticker: string;
  direction: Direction;
  thesis: string;
  meta: string;
  headline: string;
  author: string;
  seed: number;
}> = [
  {
    ticker: 'NVDA',
    direction: 'up',
    thesis: 'Growth thesis',
    meta: 'Long term · Semiconductors',
    headline: 'Does the AI build-out justify the multiple?',
    author: 'M. Ivanova',
    seed: 3.3,
  },
  {
    ticker: 'SPX',
    direction: 'down',
    thesis: 'Cautious',
    meta: 'Macro · 3 months',
    headline: 'How much rate-cut hope is already priced in',
    author: 'D. Whitfield',
    seed: 7.1,
  },
  {
    ticker: 'BTC',
    direction: 'up',
    thesis: 'Constructive',
    meta: 'Crypto · 12 months',
    headline: 'Halving cycle math, one year on',
    author: 'A. Petrov',
    seed: 4.9,
  },
];

/**
 * From the community — three curated objects at a fixed height, not a feed.
 *
 * Every one of them opens the TradingView social network in a new tab, which is
 * where the community actually is.
 */
export const COMMUNITY_ROWS: Array<{ kind: string; title: string; meta: string; icon: IconName }> =
  [
    {
      kind: 'Trending discussion',
      title: 'Is 30× earnings still expensive for infrastructure?',
      meta: '412 replies · started 6h ago',
      icon: 'chat',
    },
    {
      kind: 'Popular author',
      title: 'M. Ivanova — macro and semiconductors',
      meta: '18.2k followers · 9 ideas this month',
      icon: 'users',
    },
    {
      kind: 'Upcoming',
      title: 'Rate decision watch party',
      meta: 'Thu 19:00 CET · 1,240 going',
      icon: 'calendar',
    },
  ];

/**
 * The four questions offered beside the Voyager input.
 *
 * Four, never more: the card is the calmest thing in the hero and a fifth chip
 * is what turns it into a menu. They span the whole surface Voyager covers —
 * a decision, the market, discovery and the community — because Voyager is the
 * AI layer across the product and not a beginner's help desk.
 */
export const VOYAGER_SUGGESTIONS = [
  'I have savings. What should I do first?',
  'Why are markets falling?',
  'Find ideas about NVIDIA',
  'What are investors discussing today?',
];
