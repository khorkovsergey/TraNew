import type { IconName } from '@/components/ui/Icon';
import type { AppPathname, StaticPathname } from '@/i18n/routing';

/**
 * The public home, as data.
 *
 * The brief asks for a connector layer between the backend and the new screens
 * and for no business logic in components; this is the near end of it. Copy,
 * destinations and the accent each block carries live here, so changing what the
 * page says is an edit to one list rather than a hunt through JSX.
 *
 * Every destination is an existing route. Nothing on this page invents one.
 */

export type Accent = 'mint' | 'blue' | 'purple' | 'amber' | 'lime' | 'cyan';

export type IntentCard = {
  id: string;
  icon: IconName;
  accent: Accent;
  title: string;
  body: string;
  /** Where it goes inside the portal. Omitted when `external` is set. */
  href?: AppPathname;
  params?: Record<string, string>;
  /**
   * The state the destination should open in.
   *
   * The section asks what brings somebody here and then has to act on the
   * answer. Without this the three cards that opened Explore all landed on the
   * same tab, which is a labelled door into an unlabelled room.
   */
  query?: Record<string, string>;
  /** A full URL, when the card leaves TradingNew. Marked as such on the card. */
  external?: string;
};

/**
 * "What brings you here today?" — entry intents, not financial goals.
 *
 * The distinction is the whole point of the section: a first-time visitor is
 * asked what they are curious about, and is never asked to name a goal they may
 * not have yet.
 */
export const INTENT_CARDS: IntentCard[] = [
  {
    id: 'understand',
    icon: 'bulb',
    accent: 'amber',
    title: 'I want to understand investing',
    body: 'Learn the basics and build strong foundations.',
    href: '/academy',
  },
  {
    id: 'options',
    icon: 'wallet',
    accent: 'mint',
    title: 'I have money and want to explore options',
    body: 'See what the choices are, starting with the safest.',
    href: '/explore',
    /*
     * Cash, not stocks. Somebody with money in hand is deciding what to do with
     * it, and the first honest answer is how much should stay reachable — which
     * is also where our own plan builder starts them.
     */
    query: { tab: 'cash' },
  },
  {
    id: 'markets',
    icon: 'bars',
    accent: 'blue',
    title: 'Research',
    body: 'Markets, symbols, economy.',
    href: '/explore',
  },
  {
    id: 'practice',
    icon: 'flask',
    accent: 'purple',
    title: 'I want to see how investments work',
    body: 'Watch a sample portfolio react to real market events.',
    href: '/portfolio',
    /*
     * Straight into the sample. The card promises to show how investing works
     * and the page opened on a chooser asking which broker to connect — the one
     * tile of four that matched the promise was the last one.
     */
    query: { start: 'sample' },
  },
  {
    id: 'improve',
    icon: 'trendUp',
    accent: 'lime',
    title: 'I already invest and want to improve',
    body: 'Four questions, and a plan that says why each step is on it.',
    /*
     * The four-question funnel, not the seven-question interview. That one
     * opened by asking a stranger how much money they have, in five bands up to
     * half a million; it is still reachable from the plan, for somebody who has
     * decided to give numbers.
     */
    href: '/start',
  },
  {
    id: 'pro',
    icon: 'chart',
    accent: 'cyan',
    title: 'Trading Pro',
    body: 'Advanced charts, indicators and screeners on TradingView.',
    external: 'https://www.tradingview.com',
  },
];

/**
 * Three questions about today, in the order a beginner asks them.
 *
 * The copy describes what markets did and what that may mean, and stops there.
 * Card three is deliberately about not overreacting: this section is the most
 * likely place on the site for someone to read a number and do something with
 * their savings, so it is the place that has to be calmest.
 */
export const TODAY_CARDS = [
  {
    step: 1,
    accent: 'mint' as Accent,
    title: 'What happened',
    body: 'Global markets slipped as investors reacted to mixed economic data and rate uncertainty.',
  },
  {
    step: 2,
    accent: 'blue' as Accent,
    icon: 'fileSearch' as IconName,
    title: 'Why it happened',
    body: 'Stronger jobs data raised questions about when rate cuts might begin.',
  },
  {
    step: 3,
    accent: 'purple' as Accent,
    icon: 'shieldCheck' as IconName,
    title: 'Why it may matter to you',
    body: 'Short-term volatility is normal. Staying diversified and focused on long-term goals can help.',
  },
];

/** The index quoted beside card one. Illustrative, and labelled as such on screen. */
export const TODAY_INDEX = {
  name: 'S&P 500',
  value: '5,268.44',
  change: '−0.45%',
  direction: 'down' as const,
};

export const PATH_STEPS: Array<{
  step: number;
  accent: Accent;
  title: string;
  body: string;
  href: StaticPathname;
}> = [
  {
    step: 1,
    accent: 'mint',
    title: 'Learn the basics',
    body: 'Understand key concepts in plain language.',
    href: '/academy',
  },
  {
    step: 2,
    accent: 'blue',
    title: 'Compare options',
    body: 'See different investment choices side by side.',
    href: '/explore',
  },
  {
    step: 3,
    accent: 'purple',
    title: 'Try simulations',
    body: 'Practice with real market scenarios — risk-free.',
    href: '/portfolio',
  },
  {
    step: 4,
    accent: 'mint',
    title: 'Build a simple plan',
    body: 'Create a personalised plan and take the first step.',
    href: '/strategy',
  },
];

export const TRUST_ITEMS: Array<{ icon: IconName; accent: Accent; label: string }> = [
  { icon: 'checkCircle', accent: 'mint', label: 'Clear explanations' },
  { icon: 'bubble', accent: 'blue', label: 'No jargon' },
  { icon: 'grad', accent: 'amber', label: 'Learn as you go' },
];

/**
 * The three questions offered beside the Voyager input.
 *
 * They are the ones the brief names, and they are questions rather than
 * commands: this box is for understanding something, not for being told what to
 * buy.
 */
export const VOYAGER_SUGGESTIONS: Array<{ icon: IconName; accent: Accent; text: string }> = [
  { icon: 'coins', accent: 'mint', text: 'I have savings. What should I do first?' },
  { icon: 'layers', accent: 'blue', text: 'What is an ETF?' },
  { icon: 'trendDown', accent: 'amber', text: 'Why are markets falling?' },
];
