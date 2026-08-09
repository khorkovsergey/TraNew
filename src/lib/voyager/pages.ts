/**
 * What each screen is, and what may be known about it.
 *
 * The context package was a prompt and four suggested questions per screen. It
 * said what to ask and nothing about what the page *is* — so an answer on a
 * symbol page and an answer on the wealth page were shaped by the same
 * information, and "what can I do on this page?" could only ever be a site tour.
 *
 * This is the same table grown into the capability registry the brief asks for:
 * per screen, the subject, the facts a page may declare, the actions reachable
 * from it, the tools that make sense on it, and the context sources that are
 * legitimate there. One table, read by the full page and by the floating widget
 * alike — a second copy for the widget is how the two came to answer the same
 * question differently.
 *
 * Two refusals are structural rather than remembered:
 *
 * **A page declares facts from a closed list.** `facts` used to be an open map,
 * so any page — or anything that could reach the widget — could put whatever it
 * liked in front of the model. Each screen now names the keys it may set, and
 * the server drops the rest. What Voyager is allowed to see stays reviewable,
 * which is the promise the whole context package exists to keep.
 *
 * **No page sends raw anything.** Not HTML, not a screenshot, not the URL.
 * A screen name, a subject, and named facts.
 *
 * Import-free, so the unit harness compiles it alone.
 */

import { type VoyagerActionId } from './actions';
import { MARKET_DATA_SCREENS, VOYAGER_SCREENS, type VoyagerScreen } from './screens';
import type { VoyagerToolId } from './tools/types';

/**
 * Every fact a page may state about itself.
 *
 * A closed list, because this is the data that reaches a language model. A key
 * nobody planned for is a key nobody reviewed.
 */
export const FACT_KEYS = [
  'ticker',
  'exchange',
  'currency',
  /** A comparison names its instruments, rather than flattening them into prose. */
  'symbols',
  'period',
  'interval',
  'filters',
  'indicator',
  'lesson',
  'event',
  'idea',
] as const;

export type FactKey = (typeof FACT_KEYS)[number];

export type PageCapability = {
  screen: VoyagerScreen;
  /** What the screen is about when the page does not name something more specific. */
  subject: string;
  /** The collapsed pill, and the input placeholder. */
  prompt: string;
  /** Two to four openings, offered before anybody types. */
  quick: string[];
  /** One line for the model and for "what can I do here?". */
  purpose: string;
  /** The only facts this screen may declare. Anything else is dropped. */
  facts: FactKey[];
  /** Actions that make sense from here, beyond the ones every screen offers. */
  actions: VoyagerActionId[];
  /** Tools worth reaching for on this screen. */
  tools: VoyagerToolId[];
};

const MARKET_TOOLS: VoyagerToolId[] = ['resolve_asset', 'get_quote', 'get_history', 'compare_assets'];

export const PAGE_CAPABILITIES: Record<VoyagerScreen, PageCapability> = {
  chart: {
    screen: 'chart',
    subject: 'this chart',
    prompt: 'Ask about this chart',
    // Two of these apply a study and one explains the language behind it. The
    // point of the screen is that the way into an indicator is a sentence.
    quick: [
      'Show RSI on this chart',
      'Add 50/200 moving averages',
      'Explain this chart',
      'What is Pine Script?',
    ],
    purpose: 'A price chart with studies, and the Pine behind them.',
    facts: ['ticker', 'exchange', 'currency', 'interval', 'period'],
    actions: ['view_pine', 'open_symbol', 'add_to_watchlist', 'create_alert'],
    tools: [...MARKET_TOOLS, 'pine_script', 'tradingview_handoff', 'investment_analysis'],
  },

  market: {
    screen: 'market',
    subject: 'this market',
    prompt: 'Ask about this market',
    quick: [
      'Why is this market moving today?',
      'Which exchanges trade here and when?',
      'How does this market work?',
      'What should I look at next?',
    ],
    purpose: 'Market overview: what is moving, and where it trades.',
    facts: ['symbols', 'period', 'filters'],
    actions: ['open_explore', 'open_news', 'open_screener'],
    tools: [...MARKET_TOOLS],
  },

  symbol: {
    screen: 'symbol',
    subject: 'this symbol',
    prompt: 'Ask about this symbol',
    quick: [
      'Why is it moving today?',
      'What are the key risks?',
      'Compare with sector',
      'Create an alert',
    ],
    purpose: 'One instrument: its price, its history, and what is said about it.',
    facts: ['ticker', 'exchange', 'currency', 'period'],
    actions: ['open_chart', 'add_to_watchlist', 'create_alert', 'open_news'],
    tools: [...MARKET_TOOLS, 'investment_analysis', 'tradingview_handoff'],
  },

  ideas: {
    screen: 'ideas',
    subject: 'this idea',
    prompt: 'Ask about this idea',
    quick: [
      'What is the argument here, in plain terms?',
      'What would have to be true for this to work?',
      'What are the risks the author does not mention?',
      'Show me the chart behind this',
    ],
    purpose: 'A published argument about an instrument, and what would test it.',
    facts: ['idea', 'ticker', 'period'],
    actions: ['open_chart', 'open_symbol', 'add_to_watchlist'],
    tools: [...MARKET_TOOLS, 'investment_analysis'],
  },

  events: {
    screen: 'events',
    subject: 'financial events',
    prompt: 'Ask about events',
    quick: [
      'Any beginner investing events near me this month?',
      'What online sessions are coming up?',
      'Find a workshop on portfolio construction',
      'What am I registered for?',
    ],
    purpose: 'Talks, workshops and sessions, online and near you.',
    facts: ['event', 'filters'],
    actions: ['open_events', 'open_my_events'],
    tools: ['portal_navigation'],
  },

  economy: {
    screen: 'economy',
    subject: 'the economy',
    prompt: 'Ask about the economy',
    quick: [
      'Why is inflation falling so slowly?',
      'How do rates affect bonds?',
      'Compare US and Eurozone',
      'What should I watch this week?',
    ],
    purpose: 'Macro indicators and what they do to markets.',
    facts: ['indicator', 'period'],
    actions: ['open_economy', 'open_indicator'],
    tools: ['portal_navigation', 'get_history'],
  },

  indicator: {
    screen: 'indicator',
    subject: 'US CPI',
    prompt: 'Ask about this indicator',
    quick: [
      'Explain this in simple terms',
      'How could this affect my assets?',
      'Create a release alert',
    ],
    purpose: 'One macro series, its releases and what moves with it.',
    facts: ['indicator', 'period'],
    actions: ['open_indicator', 'open_economy', 'create_alert'],
    tools: ['portal_navigation', 'get_history'],
  },

  wealth: {
    screen: 'wealth',
    subject: 'My Wealth',
    prompt: 'Ask about your wealth',
    quick: [
      'What needs my attention?',
      'How liquid is my capital?',
      'What if I sell the apartment?',
      'Check my concentration risks',
    ],
    purpose: 'Your own holdings, with your permission, and what they add up to.',
    facts: ['period'],
    actions: ['open_wealth', 'open_wealth_assets', 'open_wealth_scenarios', 'open_wealth_insights'],
    tools: ['portal_navigation'],
  },

  academy: {
    screen: 'academy',
    subject: 'this lesson',
    prompt: 'Ask about this lesson',
    quick: ['Explain this more simply', 'Give me another example', 'Quiz me'],
    purpose: 'A lesson, and another way of explaining it.',
    facts: ['lesson'],
    actions: ['open_academy'],
    tools: ['portal_navigation'],
  },

  experts: {
    screen: 'experts',
    subject: 'Expert Marketplace',
    prompt: 'Help me find an expert',
    quick: [
      'Help me formulate my request',
      'Which expert type do I need?',
      'Prepare questions for a consultation',
    ],
    purpose: 'People you can hire, and how to say what you need from them.',
    facts: ['filters'],
    actions: ['open_experts', 'open_experts_intake'],
    tools: ['portal_navigation'],
  },

  news: {
    screen: 'news',
    subject: 'News',
    prompt: 'Ask about this news',
    quick: [
      'Summarize what matters today',
      'How does this affect my watchlist?',
      'Explain why markets reacted',
    ],
    purpose: 'What happened, and what it did to prices.',
    facts: ['ticker', 'period', 'filters'],
    actions: ['open_news', 'open_symbol'],
    tools: [...MARKET_TOOLS],
  },

  portfolio: {
    screen: 'portfolio',
    subject: 'Portfolio',
    prompt: 'Ask about this portfolio',
    quick: [
      'Analyze the allocation',
      'What events affect these holdings?',
      'How concentrated is it?',
    ],
    purpose: 'A practice portfolio — simulated money, real prices.',
    facts: ['symbols', 'period'],
    actions: ['open_practice', 'open_chart'],
    tools: [...MARKET_TOOLS],
  },

  strategy: {
    screen: 'strategy',
    subject: 'Strategy Builder',
    prompt: 'Help with my strategy',
    quick: [
      'Explain this question',
      'What do typical investors choose?',
      'Why does this matter?',
    ],
    purpose: 'Questions that turn into a plan, and why each one is asked.',
    facts: ['filters'],
    actions: ['open_strategy', 'open_academy', 'open_experts'],
    tools: ['portal_navigation'],
  },

  generic: {
    screen: 'generic',
    subject: 'TradingNew',
    // With no page subject to name, the pill carries the product name.
    prompt: 'Voyager AI',
    quick: [
      'What can I do on this page?',
      'How do I start investing?',
      'Find a tool for me',
      'Explain a term',
    ],
    purpose: 'The whole portal — ask for a section, a concept, or an instrument.',
    facts: [],
    actions: ['open_explore', 'open_academy', 'open_events', 'open_experts'],
    tools: ['portal_navigation', ...MARKET_TOOLS],
  },
};

/* ------------------------------------------------------------- The facts */

/**
 * The facts a page is allowed to have stated, and nothing else.
 *
 * Applied on the server, so a client that sent more than its screen declares
 * gets the extra dropped rather than forwarded. Values are bounded and stripped
 * of control characters for the same reason the status strip strips its
 * subject: this is rendered, and it reaches a model.
 */
export function clampFacts(
  screen: VoyagerScreen,
  facts: unknown
): Record<string, string> | undefined {
  if (!facts || typeof facts !== 'object') return undefined;

  const allowed = new Set<string>(PAGE_CAPABILITIES[screen].facts);
  const source = facts as Record<string, unknown>;
  const kept: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    if (!allowed.has(key)) continue;
    if (typeof value !== 'string') continue;

    /* Control characters stripped without writing any into this file: a
       regex class of literal control bytes is unreadable in a diff and
       makes the source itself binary to half the tools that read it. */
    const clean = [...value]
      .map((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code < 32 || code === 127 ? ' ' : character;
      })
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    if (clean) kept[key] = clean;
  }

  return Object.keys(kept).length ? kept : undefined;
}

/** Which context sources are legitimate on a screen. Market data is not universal. */
export function sourcesForScreen(screen: VoyagerScreen): string[] {
  return ['page', ...(MARKET_DATA_SCREENS.includes(screen) ? ['market'] : [])];
}

/**
 * What this page can do, in the shape an answer can use.
 *
 * The answer to "what can I do on this page?" — built from the registry rather
 * than from a paragraph in a system prompt, so it is about the screen somebody
 * is actually on and cannot describe a capability that was removed.
 */
export function describePage(screen: VoyagerScreen, subject?: string): {
  screen: VoyagerScreen;
  subject: string;
  purpose: string;
  canDo: string[];
  knows: FactKey[];
} {
  const page = PAGE_CAPABILITIES[screen];
  return {
    screen,
    subject: subject?.trim() || page.subject,
    purpose: page.purpose,
    canDo: page.quick,
    knows: page.facts,
  };
}

export const CAPABILITY_SCREENS = VOYAGER_SCREENS;
