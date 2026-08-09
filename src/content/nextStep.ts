import type { ComponentProps } from 'react';
import type { IconName } from '@/components/ui/Icon';
import type { Link } from '@/i18n/navigation';
import { TRADINGVIEW, TRADINGVIEW_SOCIAL } from '@/content/homeV2';

/**
 * "Find my next step", as data.
 *
 * The router is a navigation recommendation and nothing else. It never says what
 * to hold, how much, or for how long; it asks where somebody is, what they want
 * to do, and answers with a place in the product. Every destination below is a
 * route that already exists — this file invents none of them.
 *
 * Copy lives here, the rules that choose between it live in `lib/start/nextStep`,
 * and the screens live in `components/start/NextStepRouter`. Splitting it three
 * ways is what lets the routing table be read, and tested, without a browser.
 */

/* ------------------------------------------------------------------ answers */

export type NextStepLevel = 'new' | 'basics' | 'investor' | 'active' | 'pro' | 'unsure';

export type NextStepIntent =
  | 'learn'
  | 'explore'
  | 'improve'
  | 'organize'
  | 'expert'
  | 'courses'
  | 'tools'
  | 'unsure';

/**
 * Every clarifying answer across every intent, in one union.
 *
 * A few ids are shared — `try` belongs to both `learn` and `tools`, `course` to
 * both `learn` and `courses` — and that is deliberate: they mean the same thing
 * in both places, and the intent beside them is what makes the pair unambiguous.
 */
export type NextStepClarification =
  | 'steps'
  | 'try'
  | 'course'
  | 'unsure'
  | 'understand'
  | 'ideas'
  | 'research'
  | 'self'
  | 'ai'
  | 'full'
  | 'person'
  | 'pace'
  | 'online'
  | 'near'
  | 'meet'
  | 'anyway'
  | 'ground';

export type NextStepAnswers = {
  level: NextStepLevel | null;
  intent: NextStepIntent | null;
  clarification: NextStepClarification | null;
};

/** A card somebody presses to answer a question. */
export type AnswerOption<T extends string> = {
  id: T;
  icon: IconName;
  title: string;
  desc: string;
};

/* ------------------------------------------------------- step 1 · about you */

export const LEVELS: AnswerOption<NextStepLevel>[] = [
  {
    id: 'new',
    icon: 'rocket',
    title: 'I’m new to investing',
    desc: 'I haven’t invested before or I’m only getting started.',
  },
  {
    id: 'basics',
    icon: 'book',
    title: 'I know the basics',
    desc: 'I understand the main concepts but I’m still building confidence.',
  },
  {
    id: 'investor',
    icon: 'wallet',
    title: 'I already invest',
    desc: 'I have investments and want to make better-informed decisions.',
  },
  {
    id: 'active',
    icon: 'chart',
    title: 'I actively analyze or trade',
    desc: 'I regularly research markets, assets or trading opportunities.',
  },
  {
    id: 'pro',
    icon: 'building',
    title: 'I work with markets professionally',
    desc: 'I need professional-grade research, charts or trading tools.',
  },
  {
    id: 'unsure',
    icon: 'help',
    title: 'I’m not sure',
    desc: 'Help me figure out where I fit.',
  },
];

/* ------------------------------------------------------ step 2 · your goal */

export const INTENTS: Record<NextStepIntent, Omit<AnswerOption<NextStepIntent>, 'id'>> = {
  learn: {
    icon: 'grad',
    title: 'Learn how investing works',
    desc: 'Understand the basics and build confidence step by step.',
  },
  explore: {
    icon: 'compass',
    title: 'Explore markets & opportunities',
    desc: 'Research markets, assets and investment ideas.',
  },
  improve: {
    icon: 'refresh',
    title: 'Improve what I already have',
    desc: 'Understand my investments and make better decisions around them.',
  },
  organize: {
    icon: 'layers',
    title: 'Organize my financial picture',
    desc: 'See my assets, liabilities, goals and wealth in one place.',
  },
  expert: {
    icon: 'user',
    title: 'Get help from an expert',
    desc: 'Talk to a specialist about a financial or investment question.',
  },
  courses: {
    icon: 'calendar',
    title: 'Find courses or events',
    desc: 'Learn from structured courses, workshops, webinars and people.',
  },
  tools: {
    icon: 'sliders',
    title: 'Use advanced trading tools',
    desc: 'Charts, screeners, indicators and professional workflows.',
  },
  unsure: {
    icon: 'sparkle',
    title: 'I’m not sure what I need',
    desc: 'Let Voyager help me work it out.',
  },
};

/**
 * The order the goals are offered in.
 *
 * Two orders, not two sets: everybody is offered all eight. What changes is
 * which one is read first, because a list is an opinion about what is likely
 * and a professional scanning for "advanced tools" should not have to walk past
 * four beginner rows to find it.
 *
 * The order is never a filter. An explicit choice always wins over the level
 * that suggested it — a professional who picks "Get help from an expert" gets
 * Expert Services, not a chart.
 */
export const INTENT_ORDER_EXPERIENCED: NextStepIntent[] = [
  'explore',
  'improve',
  'tools',
  'organize',
  'expert',
  'courses',
  'learn',
  'unsure',
];

export const INTENT_ORDER_BEGINNER: NextStepIntent[] = [
  'learn',
  'explore',
  'improve',
  'organize',
  'expert',
  'courses',
  'tools',
  'unsure',
];

/* ------------------------------------------------- the clarifying question */

export type ClarificationSpec = {
  title: string;
  sub: string;
  options: AnswerOption<NextStepClarification>[];
};

/**
 * The one extra question, asked only when it changes where somebody lands.
 *
 * Four intents route to a single place on their own and are not in this table.
 * A question whose answers all lead to the same screen is a question that costs
 * the reader time and buys them nothing.
 */
export const CLARIFICATIONS: Partial<Record<NextStepIntent, ClarificationSpec>> = {
  learn: {
    title: 'How would you like to start?',
    sub: 'All four routes lead somewhere real — pick whichever fits how you like to learn.',
    options: [
      { id: 'steps', icon: 'grad', title: 'Learn step by step', desc: 'Short lessons in plain language.' },
      {
        id: 'try',
        icon: 'play',
        title: 'Try things yourself',
        desc: 'Practice with virtual money and market scenarios.',
      },
      {
        id: 'course',
        icon: 'book',
        title: 'Take a structured course',
        desc: 'Follow a complete learning programme.',
      },
      {
        id: 'unsure',
        icon: 'search',
        title: 'I’m still not sure',
        desc: 'Help me choose what to learn first.',
      },
    ],
  },
  explore: {
    title: 'What are you looking for?',
    sub: 'We’ll take you straight into the right part of the product.',
    options: [
      {
        id: 'understand',
        icon: 'compass',
        title: 'Understand what’s happening',
        desc: 'Markets, economy and current moves.',
      },
      {
        id: 'ideas',
        icon: 'bulb',
        title: 'Find investment ideas',
        desc: 'See themes and what investors are watching.',
      },
      {
        id: 'research',
        icon: 'sparkle',
        title: 'Research something specific',
        desc: 'Ask questions and dig deeper with AI.',
      },
    ],
  },
  improve: {
    title: 'What kind of help would be most useful?',
    sub: 'From doing it yourself to having a person look at it with you.',
    options: [
      {
        id: 'self',
        icon: 'compass',
        title: 'I want to understand it myself',
        desc: 'Research holdings, markets and alternatives.',
      },
      {
        id: 'ai',
        icon: 'sparkle',
        title: 'I want AI to help me analyze it',
        desc: 'Work through questions and research with Voyager.',
      },
      {
        id: 'full',
        icon: 'layers',
        title: 'I want a complete view of my finances',
        desc: 'Bring assets, liabilities and goals together.',
      },
      {
        id: 'person',
        icon: 'user',
        title: 'I want a person to review it with me',
        desc: 'Find a specialist for my situation.',
      },
    ],
  },
  courses: {
    title: 'What sounds more useful right now?',
    sub: 'Events keeps its own filters for topic, language and location — no need to answer that twice.',
    options: [
      {
        id: 'pace',
        icon: 'grad',
        title: 'Learn at my own pace',
        desc: 'Short lessons you can pick up any time.',
      },
      {
        id: 'course',
        icon: 'book',
        title: 'Take a structured course',
        desc: 'A complete programme with a clear path.',
      },
      { id: 'online', icon: 'globe', title: 'Join an online event', desc: 'Live webinars and workshops.' },
      { id: 'near', icon: 'pin', title: 'Find events near me', desc: 'Meetups and sessions in your city.' },
      {
        id: 'meet',
        icon: 'users',
        title: 'Meet people around markets',
        desc: 'Follow discussions and find people to learn with.',
      },
    ],
  },
  /*
   * Asked of a beginner only. Somebody who already trades has answered it by
   * saying so, and asking again would read as being told they are not ready.
   */
  tools: {
    title: 'Advanced tools are built for active market work',
    sub: 'You can go straight there, or build the ground under it first. Both stay open to you.',
    options: [
      {
        id: 'anyway',
        icon: 'chart',
        title: 'Take me to the professional tools',
        desc: 'Charts, screeners and indicators on TradingView.',
      },
      {
        id: 'ground',
        icon: 'grad',
        title: 'Show me the basics first',
        desc: 'Understand what those tools actually do.',
      },
      {
        id: 'try',
        icon: 'play',
        title: 'Let me practice first',
        desc: 'Test decisions with virtual money.',
      },
    ],
  },
};

/* -------------------------------------------------------------- the answer */

export type NextStepResultKey =
  | 'learn'
  | 'practice'
  | 'academy'
  | 'learnDiag'
  | 'explore'
  | 'ideas'
  | 'voyager'
  | 'voyagerCtx'
  | 'wealth'
  | 'experts'
  | 'eventsOnline'
  | 'eventsNear'
  | 'community'
  | 'tradingview';

/**
 * Where a result sends somebody.
 *
 * A union rather than an optional URL beside an optional route: a destination is
 * inside the portal or outside it, the two are rendered by different elements,
 * and the tile that renders one should not have to assert which it received.
 */
/**
 * Exactly what the app's `Link` accepts.
 *
 * Borrowed from the component rather than rebuilt from `StaticPathname`,
 * because the object form (`{ pathname, query }`) is a discriminated union over
 * every route literal: a field typed as the whole union of pathnames matches
 * none of its branches, and every route in this table would fail to compile for
 * the sake of two that carry a query string. Declaring the href here, where the
 * literal is still visible, is what keeps the routes checked.
 */
export type AppHref = ComponentProps<typeof Link>['href'];

export type NextStepDestination =
  | { kind: 'internal'; href: AppHref }
  /** A full URL, opened in a new tab and labelled as leaving before the click. */
  | { kind: 'external'; url: string };

/** A card under "You may also find useful". Always a real link, never decoration. */
export type SecondaryKey =
  | 'learn'
  | 'practice'
  | 'academy'
  | 'explore'
  | 'ideas'
  | 'voyager'
  | 'experts'
  | 'events'
  | 'community'
  | 'wealth';

export const SECONDARY: Record<
  SecondaryKey,
  { icon: IconName; title: string; desc: string; destination: NextStepDestination }
> = {
  learn: {
    icon: 'grad',
    title: 'Learn',
    desc: 'Short lessons in plain language, whenever a concept is unclear.',
    destination: { kind: 'internal', href: '/academy' },
  },
  practice: {
    icon: 'play',
    title: 'Practice portfolio',
    desc: 'Try market scenarios without using real money.',
    destination: { kind: 'internal', href: '/portfolio' },
  },
  academy: {
    icon: 'book',
    title: 'Academy courses',
    desc: 'Structured programmes taught by practitioners.',
    destination: { kind: 'internal', href: '/marketplace/academy' },
  },
  explore: {
    icon: 'compass',
    title: 'Explore',
    desc: 'Markets, symbols and the economy in one view.',
    destination: { kind: 'internal', href: '/explore' },
  },
  ideas: {
    icon: 'bulb',
    title: 'Discover Ideas',
    desc: 'Explore themes and investor thinking.',
    destination: { kind: 'internal', href: '/ideas' },
  },
  voyager: {
    icon: 'sparkle',
    title: 'Ask Voyager',
    desc: 'Research markets with AI whenever something isn’t clear.',
    destination: { kind: 'internal', href: '/voyager' },
  },
  experts: {
    icon: 'user',
    title: 'Expert Services',
    desc: 'Have a specialist review your situation with you.',
    destination: { kind: 'internal', href: '/marketplace/experts' },
  },
  events: {
    icon: 'calendar',
    title: 'Events',
    desc: 'Online sessions and meetups around markets.',
    destination: { kind: 'internal', href: '/events' },
  },
  community: {
    icon: 'users',
    title: 'Community',
    desc: 'Follow people and market conversations.',
    destination: { kind: 'external', url: TRADINGVIEW_SOCIAL },
  },
  wealth: {
    icon: 'layers',
    title: 'Wealth Hub',
    desc: 'Bring assets, liabilities and goals together privately.',
    destination: { kind: 'internal', href: '/account/wealth' },
  },
};

export type NextStepResult = {
  icon: IconName;
  title: string;
  cta: string;
  destination: NextStepDestination;
  /** Shown under the CTA. Present wherever pressing it leaves the portal. */
  helper?: string;
  /** At most two, always. A page of recommendations is not a recommendation. */
  secondary: SecondaryKey[];
};

export const RESULTS: Record<NextStepResultKey, NextStepResult> = {
  learn: {
    icon: 'grad',
    title: 'Learn',
    cta: 'Start learning',
    destination: { kind: 'internal', href: '/academy' },
    secondary: ['practice', 'voyager'],
  },
  practice: {
    icon: 'play',
    title: 'Practice',
    cta: 'Open Practice',
    destination: { kind: 'internal', href: '/portfolio' },
    secondary: ['learn', 'voyager'],
  },
  academy: {
    icon: 'book',
    title: 'Academy courses',
    cta: 'Browse courses',
    destination: { kind: 'internal', href: '/marketplace/academy' },
    secondary: ['learn', 'events'],
  },
  learnDiag: {
    icon: 'search',
    title: 'Where should I start?',
    cta: 'Open the Learn diagnostic',
    destination: { kind: 'internal', href: '/academy/setup' },
    secondary: ['practice', 'voyager'],
  },
  explore: {
    icon: 'compass',
    title: 'Explore',
    cta: 'Open Explore',
    destination: { kind: 'internal', href: '/explore' },
    secondary: ['ideas', 'voyager'],
  },
  ideas: {
    icon: 'bulb',
    title: 'Ideas',
    cta: 'Discover ideas',
    destination: { kind: 'internal', href: '/ideas' },
    secondary: ['explore', 'voyager'],
  },
  voyager: {
    icon: 'sparkle',
    title: 'Voyager',
    cta: 'Ask Voyager',
    destination: { kind: 'internal', href: '/voyager' },
    secondary: ['ideas', 'explore'],
  },
  voyagerCtx: {
    icon: 'chat',
    title: 'Voyager, with your context',
    cta: 'Continue in Voyager',
    destination: { kind: 'internal', href: '/voyager' },
    secondary: ['ideas', 'explore'],
  },
  wealth: {
    icon: 'layers',
    title: 'Wealth Hub',
    cta: 'Open Wealth Hub',
    destination: { kind: 'internal', href: '/account/wealth' },
    secondary: ['voyager', 'experts'],
  },
  experts: {
    icon: 'user',
    title: 'Find the right expert',
    cta: 'Find an expert',
    destination: { kind: 'internal', href: '/marketplace/experts' },
    secondary: ['voyager', 'community'],
  },
  /*
   * Events owns its own filters for topic, language and location. The router
   * lands somebody on the right view of them and stops — asking for a city here
   * would be the same question twice, and the second one would be the one that
   * did not know about "Use my location".
   */
  eventsOnline: {
    icon: 'globe',
    title: 'Online events',
    cta: 'Browse online events',
    destination: { kind: 'internal', href: { pathname: '/events', query: { format: 'online' } } },
    secondary: ['academy', 'community'],
  },
  eventsNear: {
    icon: 'pin',
    title: 'Events near you',
    cta: 'See events near me',
    destination: { kind: 'internal', href: { pathname: '/events', query: { view: 'map', sort: 'nearest' } } },
    secondary: ['academy', 'community'],
  },
  community: {
    icon: 'users',
    title: 'Community',
    cta: 'Open Community',
    destination: { kind: 'external', url: TRADINGVIEW_SOCIAL },
    helper: 'Opens tradingview.com in a new tab.',
    secondary: ['events', 'ideas'],
  },
  tradingview: {
    icon: 'chart',
    title: 'TradingView',
    cta: 'Continue to TradingView',
    destination: { kind: 'external', url: TRADINGVIEW },
    helper: 'Opens TradingView in a new tab.',
    secondary: ['voyager', 'ideas'],
  },
};

/* ------------------------------------------------------------- explanations */

/**
 * How the reason paragraph opens, per level.
 *
 * A description of what somebody said about themselves, handed straight back —
 * never a grade. There is no "only a beginner" and no "advanced user" here,
 * because the router is choosing a door, not ranking the people walking through
 * it.
 */
export const LEVEL_PHRASE: Record<NextStepLevel, string> = {
  new: 'You’re just starting out',
  basics: 'You know the basics',
  investor: 'You already invest',
  active: 'You already work with markets regularly',
  pro: 'You work with markets professionally',
  unsure: 'You’re still mapping out where you fit',
};

/**
 * Why this destination, in one paragraph.
 *
 * `withLevel` decides whether the sentence opens with what the person said about
 * themselves. Four of them do not, because the reason is the question rather
 * than the questioner — somebody who needs an expert needs one whatever they
 * answered first.
 */
export type ResultReason =
  | { withLevel: true; tail: string }
  | { withLevel: false; text: string };

export const RESULT_REASON: Record<NextStepResultKey, ResultReason> = {
  learn: {
    withLevel: true,
    tail:
      ', and you want to understand how investing actually works. Short lessons in plain language will give you the strongest base — no jargon, no pressure to act.',
  },
  practice: {
    withLevel: true,
    tail:
      ', and the fastest way to make this stick is to try it. Practice lets you test decisions with virtual money against real market data.',
  },
  academy: {
    withLevel: true,
    tail:
      ', and you want a complete programme rather than scattered lessons. Academy courses are structured, paced and taught by practitioners.',
  },
  learnDiag: {
    withLevel: false,
    text:
      'You know you want to learn but not where to begin. Learn has a short diagnostic that maps your starting point to a specific first path — it takes a minute.',
  },
  explore: {
    withLevel: true,
    tail:
      ', and you want to see what’s actually happening. Explore brings symbols, sectors and the economy into one place you can read at a glance.',
  },
  ideas: {
    withLevel: true,
    tail:
      ', and you’re looking for where other investors are pointing. Ideas collects themes, watchlists and the reasoning behind them.',
  },
  voyager: {
    withLevel: false,
    text:
      'Your question is specific, so asking is faster than browsing. Voyager researches with you and links back to the underlying data.',
  },
  voyagerCtx: {
    withLevel: false,
    text:
      'You’ve told us enough to start a real conversation. Voyager picks up what you’ve already said, so you don’t begin from a blank page.',
  },
  wealth: {
    withLevel: true,
    tail:
      ', and you want your assets, liabilities and financial goals in one private view. See how your wealth is structured and use Voyager with your financial context.',
  },
  experts: {
    withLevel: false,
    text:
      'This needs a person, not a page. Tell Voyager what you’re trying to solve — it turns your request into a brief and helps you find relevant specialists.',
  },
  eventsOnline: {
    withLevel: false,
    text:
      'You learn better with other people in the room. Events lists live webinars and workshops you can join from anywhere.',
  },
  eventsNear: {
    withLevel: false,
    text:
      'You learn better with other people in the room. Events shows workshops and meetups happening near you.',
  },
  community: {
    withLevel: false,
    text:
      'You want the conversation, not just the data. Community is where people share what they’re watching and why.',
  },
  tradingview: {
    withLevel: false,
    text:
      'You look like you’re ready for the professional layer: advanced charts, screeners, indicators and trading workflows.',
  },
};

/**
 * The same two answers in the first person, for the sentence Voyager opens with.
 *
 * Written out rather than derived from the card titles: "I’m not sure what I
 * need" is already a sentence about the reader, and any rule general enough to
 * turn the other seven titles into first person mangles that one.
 */
export const LEVEL_SELF: Record<NextStepLevel, string> = {
  new: 'I’m new to investing.',
  basics: 'I know the basics.',
  investor: 'I already invest.',
  active: 'I actively analyze or trade.',
  pro: 'I work with markets professionally.',
  unsure: 'I’m not sure where I fit.',
};

export const INTENT_SELF: Record<NextStepIntent, string> = {
  learn: 'I’m trying to learn how investing works.',
  explore: 'I’m trying to explore markets and opportunities.',
  improve: 'I’m trying to improve what I already have.',
  organize: 'I’m trying to organize my financial picture.',
  expert: 'I’m looking for help from an expert.',
  courses: 'I’m looking for courses or events.',
  tools: 'I’m looking for advanced trading tools.',
  unsure: 'I’m not sure yet what I need.',
};

/* ------------------------------------------------------ the two open screens */

/** The progress rail. A clarification lives inside step 2 and never adds a fourth. */
export const NEXT_STEP_STEPS = ['About you', 'Your goal', 'Recommendation'] as const;

/** Shown beside the free-text box, so the empty field is not the only instruction. */
export const FREE_TEXT_EXAMPLES = [
  'I have €50,000 sitting in cash and I’m not sure what to do next…',
  'I already invest but I want better tools for research…',
  'I want to understand what my pension is actually invested in…',
];

/**
 * The Wealth Hub gate, for a visitor without an account.
 *
 * The reason paragraph is shown first and the gate second — always in that
 * order. Registration is asked for here because the hub holds financial
 * information that has to be tied to somebody and kept across devices, and that
 * sentence is on screen before the button is.
 */
export const WEALTH_GATE = {
  chip: 'Available with a TradingNew account',
  body:
    'Wealth Hub is a private space tied to your account, so your financial information can be saved securely and used across devices.',
  primary: 'Create account & open Wealth Hub',
  secondary: 'Sign in',
  /** Where both auth links come back to once the account exists. */
  returnTo: '/account/wealth',
} as const;

/** With the hub switched off, the result is honest rather than a broken button. */
export const WEALTH_UNAVAILABLE = {
  chip: 'Not open yet',
  body:
    'Wealth Hub is not available in this build. Voyager can still work through how your finances fit together, and an expert can review the whole picture with you.',
} as const;

/** The neutral question the Wealth Hub helper link carries into Voyager. */
export const WEALTH_VOYAGER_PROMPT =
  'Help me understand how Wealth Hub can help organize my financial picture.';
