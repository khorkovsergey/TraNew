import type { VoyagerContext, VoyagerScreen } from './types';

/**
 * Per-page context packages.
 *
 * A page states what it is about; the widget never guesses from the URL. Keeping
 * these in one table makes it obvious what Voyager knows on any given screen —
 * which is the thing a person is entitled to be able to check.
 */

type Template = Omit<VoyagerContext, 'screen' | 'subject'> & { subject: string };

const TEMPLATES: Record<VoyagerScreen, Template> = {
  chart: {
    subject: 'this chart',
    prompt: 'Ask about this chart',
    quick: [
      'Explain this chart',
      'Find key levels',
      'Compare with another asset',
      'Create an alert',
    ],
  },
  symbol: {
    subject: 'this symbol',
    prompt: 'Ask about this symbol',
    quick: [
      'Why is it moving today?',
      'What are the key risks?',
      'Compare with sector',
      'Create an alert',
    ],
  },
  economy: {
    subject: 'the economy',
    prompt: 'Ask about the economy',
    quick: [
      'Why is inflation falling so slowly?',
      'How do rates affect bonds?',
      'Compare US and Eurozone',
      'What should I watch this week?',
    ],
  },
  indicator: {
    subject: 'US CPI',
    prompt: 'Ask about this indicator',
    quick: [
      'Explain this in simple terms',
      'How could this affect my assets?',
      'Create a release alert',
    ],
  },
  wealth: {
    subject: 'My Wealth',
    prompt: 'Ask about your wealth',
    quick: [
      'What needs my attention?',
      'How liquid is my capital?',
      'What if I sell the apartment?',
      'Check my concentration risks',
    ],
  },
  academy: {
    subject: 'this lesson',
    prompt: 'Ask about this lesson',
    quick: ['Explain this more simply', 'Give me another example', 'Quiz me'],
  },
  experts: {
    subject: 'Expert Marketplace',
    prompt: 'Help me find an expert',
    quick: [
      'Help me formulate my request',
      'Which expert type do I need?',
      'Prepare questions for a consultation',
    ],
  },
  news: {
    subject: 'News',
    prompt: 'Ask about this news',
    quick: [
      'Summarize what matters today',
      'How does this affect my watchlist?',
      'Explain why markets reacted',
    ],
  },
  portfolio: {
    subject: 'Portfolio',
    prompt: 'Ask about this portfolio',
    quick: [
      'Analyze the allocation',
      'What events affect these holdings?',
      'How concentrated is it?',
    ],
  },
  strategy: {
    subject: 'Strategy Builder',
    prompt: 'Help with my strategy',
    quick: [
      'Explain this question',
      'What do typical investors choose?',
      'Why does this matter?',
    ],
  },
  generic: {
    subject: 'TradingNew',
    // Screenshot 01: with no page subject to name, the pill carries the product
    // name. Contextual prompts ('Ask about Tesla') are unchanged.
    prompt: 'Voyager AI',
    quick: [
      'What can I do on this page?',
      'How do I start investing?',
      'Find a tool for me',
      'Explain a term',
    ],
  },
};

/**
 * Builds a page's context package. `subject` overrides the template so a symbol
 * page can say "Tesla" rather than "this symbol", which is what the collapsed
 * pill and the input placeholder read from.
 */
export function buildContext(
  screen: VoyagerScreen,
  subject?: string,
  facts?: Record<string, string>
): VoyagerContext {
  const template = TEMPLATES[screen];
  const name = subject ?? template.subject;

  return {
    screen,
    subject: name,
    prompt: subject ? `Ask about ${subject}` : template.prompt,
    quick: template.quick,
    facts,
  };
}

export const GENERIC_CONTEXT = buildContext('generic');
