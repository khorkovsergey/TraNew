import type { Localized } from './types';

export type DiagOption = {
  id: string;
  label: Localized;
  /** Only the first question's options carry a description card. */
  desc?: Localized;
};

export type DiagQuestion = {
  id: string;
  title: Localized;
  sub?: Localized;
  multi: boolean;
  max?: number;
  options: DiagOption[];
};

export const DIAGNOSTIC: DiagQuestion[] = [
  {
    id: 'level',
    title: {
      en: 'How familiar are you with investing?',
    },
    multi: false,
    options: [
      {
        id: 'new',
        label: { en: "I'm completely new" },
        desc: {
          en: "I don't yet understand assets, markets or investing terminology.",
        },
      },
      {
        id: 'basics',
        label: { en: 'I know a few basics' },
        desc: {
          en: "I've heard about stocks, bonds or ETFs, but I'm not confident yet.",
        },
      },
      {
        id: 'tried',
        label: { en: 'I have tried investing' },
        desc: {
          en: 'I already own something or have used a broker before.',
        },
      },
      {
        id: 'check',
        label: {
          en: 'Let me take a quick knowledge check',
        },
        desc: {
          en: "Answer five simple questions and we'll suggest a starting point.",
        },
      },
    ],
  },
  {
    id: 'topics',
    title: {
      en: 'What would you most like to understand?',
    },
    sub: { en: 'Choose as many as apply' },
    multi: true,
    options: [
      { id: 'how', label: { en: 'How investing works' } },
      { id: 'assets', label: { en: 'What different assets are' } },
      {
        id: 'choose',
        label: { en: 'How to choose an investment' },
      },
      {
        id: 'read',
        label: {
          en: 'How to read market information',
        },
      },
      { id: 'risk', label: { en: 'How to manage risk' } },
      {
        id: 'portfolio',
        label: {
          en: 'How to build a simple portfolio',
        },
      },
      {
        id: 'product',
        label: { en: 'How to use TradingNew' },
      },
      { id: 'unsure', label: { en: "I'm not sure yet" } },
    ],
  },
  {
    id: 'why',
    title: { en: 'Why are you learning now?' },
    multi: false,
    options: [
      {
        id: 'start',
        label: { en: 'I want to start investing' },
      },
      {
        id: 'savings',
        label: {
          en: 'I already have savings and want to understand my options',
        },
      },
      {
        id: 'news',
        label: {
          en: 'I want to understand financial news',
        },
      },
      {
        id: 'manage',
        label: {
          en: 'I want to manage my existing investments better',
        },
      },
      {
        id: 'curiosity',
        label: { en: "I'm learning out of curiosity" },
      },
    ],
  },
  {
    id: 'time',
    title: {
      en: 'How much time would you like to spend?',
    },
    multi: false,
    options: [
      { id: '5min', label: { en: '5 minutes a day' } },
      { id: '15min', label: { en: '15 minutes a day' } },
      {
        id: '30min',
        label: {
          en: '30 minutes a few times a week',
        },
      },
      { id: 'free', label: { en: 'No fixed schedule' } },
    ],
  },
  {
    id: 'format',
    title: { en: 'How do you prefer to learn?' },
    sub: { en: 'Choose up to two' },
    multi: true,
    max: 2,
    options: [
      { id: 'short', label: { en: 'Short explanations' } },
      {
        id: 'interactive',
        label: { en: 'Interactive exercises' },
      },
      {
        id: 'examples',
        label: { en: 'Real market examples' },
      },
      { id: 'video', label: { en: 'Video lessons' } },
      {
        id: 'practice',
        label: { en: 'Practice inside the product' },
      },
      { id: 'ai', label: { en: 'Ask questions to AI' } },
    ],
  },
];

export type Stage = {
  name: Localized;
  outcome: Localized;
  lessons: Localized[];
};

export const STAGES: Stage[] = [
  {
    name: { en: 'Stage 1 — Understand the basics' },
    outcome: {
      en: 'Know why people invest and how investing differs from trading.',
    },
    lessons: [
      { en: 'Why people invest' },
      { en: 'Inflation and purchasing power' },
      { en: 'Risk and return' },
      { en: 'Investing versus trading' },
      { en: 'Time horizon and liquidity' },
    ],
  },
  {
    name: { en: 'Stage 2 — Understand the main assets' },
    outcome: {
      en: 'Recognize every major asset class and its risks.',
    },
    lessons: [
      { en: 'Cash and deposits' },
      { en: 'Bonds' },
      { en: 'Stocks' },
      { en: 'ETFs' },
      { en: 'Indices' },
      { en: 'Commodities and gold' },
      { en: 'Currencies' },
      { en: 'Crypto assets' },
    ],
  },
  {
    name: { en: 'Stage 3 — Learn how to research' },
    outcome: {
      en: 'Run your own research session on a real asset.',
    },
    lessons: [
      { en: 'How to read a Symbol Page' },
      { en: 'Price and performance' },
      { en: 'Fundamental information' },
      { en: 'News and events' },
      { en: 'Simple chart reading' },
      { en: 'Understanding volatility' },
      { en: 'Comparing assets' },
      { en: 'How screeners work' },
      {
        en: 'Technical signals and their limitations',
      },
      { en: 'Community ideas and opinions' },
    ],
  },
  {
    name: { en: 'Stage 4 — Build a simple approach' },
    outcome: {
      en: 'Assemble principles into a simple personal approach.',
    },
    lessons: [
      { en: 'Goals and horizon' },
      { en: 'Risk tolerance' },
      { en: 'Diversification' },
      { en: 'Asset allocation' },
      { en: 'Regular investing' },
      { en: 'Rebalancing' },
      { en: 'Fees and taxes' },
      { en: 'Common behavioural mistakes' },
    ],
  },
  {
    name: { en: 'Stage 5 — Practise without risk' },
    outcome: {
      en: 'Complete your first research-to-decision journey.',
    },
    lessons: [
      { en: 'Create a practice watchlist' },
      { en: 'Add several asset classes' },
      { en: 'Set a price or event alert' },
      { en: 'Create a virtual portfolio' },
      { en: 'Make a Paper Trading transaction' },
      { en: 'Record your reasoning' },
      { en: 'Review the outcome' },
    ],
  },
];

export type QuizOption = { id: string; label: Localized; correct: boolean };

/** The first lesson — the only one built out in full in the prototype. */
export const FIRST_LESSON = {
  slug: 'why-people-invest',
  title: { en: 'Why people invest' },
  minutes: 8,
  objective: {
    en: "By the end of this lesson, you'll understand why people invest and how inflation, time and goals shape investment decisions.",
  },
  ideaTitle: { en: 'The idea in plain words' },
  paragraphs: [
    {
      en: "Money kept in cash slowly loses buying power because prices rise over time — that's inflation. Investing means putting money into assets that can grow or pay income, so your savings keep up with — or outgrow — rising prices.",
    },
    {
      en: 'The trade-off: assets that can grow can also fall in price. How much movement you can accept depends on your goals and how long you can leave the money invested.',
    },
  ],
  keyTermsLabel: { en: 'Key terms:' },
  glossary: [
    {
      id: 'stock',
      term: { en: 'stock' },
      definition: {
        en: "A share of ownership in a company. Its price changes with the company's results and investor expectations.",
      },
    },
    {
      id: 'dividend',
      term: { en: 'dividend' },
      definition: {
        en: 'A portion of company profit paid to shareholders, usually quarterly.',
      },
    },
    {
      id: 'volatility',
      term: { en: 'volatility' },
      definition: {
        en: 'How much and how fast a price moves. Higher volatility means larger swings in both directions.',
      },
    },
  ],
  exampleTitle: { en: 'Real market example' },
  exampleLabels: [
    { en: 'Real market data' },
    { en: 'Updated 09:45 UTC' },
    { en: 'Illustrative example' },
    { en: 'Not investment advice' },
  ],
  exampleText: {
    en: 'The S&P 500 — a basket of 500 large US companies — is up +11.2% this year, while US inflation runs near 2.6%. Cash left in a drawer lost buying power; money in the index grew faster than prices rose.',
  },
  interactive: {
    title: { en: 'Try it: which of these is a stock?' },
    options: [
      { id: 'apple', label: { en: 'Apple shares' }, correct: true },
      { id: 'btc', label: { en: 'Bitcoin' }, correct: false },
      { id: 'gold', label: { en: 'A gold bar' }, correct: false },
      {
        id: 'bond',
        label: { en: 'A government bond' },
        correct: false,
      },
    ] as QuizOption[],
    correctMessage: {
      en: 'Correct — a share of Apple is a small ownership stake in the company.',
    },
    wrongMessage: {
      en: 'Not quite. That is an asset, but not a share of ownership in a company. Try again.',
    },
  },
  practice: {
    title: { en: 'Try it in TradingNew' },
    text: {
      en: "Open Tesla in Simple Mode, find today's price change and add it to your practice watchlist.",
    },
    cta: { en: 'Open Tesla in Simple Mode' },
    done: { en: '✓ Task completed' },
  },
  quickCheck: {
    title: { en: 'Quick check' },
    question: { en: 'Owning a stock means…' },
    options: [
      {
        id: 'lend',
        label: {
          en: 'You lend money to the company',
        },
        correct: false,
      },
      {
        id: 'own',
        label: {
          en: 'You own a small share of the company',
        },
        correct: true,
      },
      {
        id: 'guaranteed',
        label: {
          en: 'You are guaranteed dividends',
        },
        correct: false,
      },
    ] as QuizOption[],
    correctMessage: {
      en: 'Correct. A stock is ownership — dividends are possible, never guaranteed.',
    },
    wrongMessage: {
      en: "Not quite. Here's the key difference: lending money to a company is a bond. A stock makes you a part-owner, and dividends are never guaranteed.",
    },
  },
  completion: {
    title: { en: 'Lesson complete' },
    text: {
      en: 'You can now explain why people invest, how inflation erodes savings, and what a stock represents.',
    },
  },
  ask: {
    title: { en: 'Ask about this lesson' },
    chips: [
      {
        id: 'simpler',
        label: { en: 'Explain more simply' },
        answer: {
          en: 'Investing means putting money into something that can grow or pay you back more later — instead of letting inflation slowly shrink it.',
        },
      },
      {
        id: 'example',
        label: { en: 'Give me another example' },
        answer: {
          en: 'If you had put $100 into a broad S&P 500 fund in 2016, it would be worth roughly $330 today. The same $100 in cash buys about 25% less than it did then.',
        },
      },
      {
        id: 'matters',
        label: { en: 'Why does this matter?' },
        answer: {
          en: 'Because cash quietly loses buying power every year. Investing is the main tool ordinary people have to keep and grow long-term savings.',
        },
      },
      {
        id: 'quiz',
        label: { en: 'Quiz me' },
        answer: {
          en: 'Quick one: if inflation is 3% and your savings earn 1%, is your money growing or shrinking in real terms? — Shrinking, by about 2% a year.',
        },
      },
    ],
  },
};

/** Profile summary rows on the "learning path ready" screen. */
export const PROFILE_FALLBACKS = {
  level: { en: 'Complete beginner' },
  goal: { en: 'Understand how to start investing' },
  format: {
    en: 'Interactive lessons and real examples',
  },
  pace: { en: '15 minutes a day' },
  estimate: { en: '3–4 weeks' },
};
