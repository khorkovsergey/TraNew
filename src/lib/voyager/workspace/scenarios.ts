import { findAnswer } from '../../explore/answers';
import type { VoyagerPlan } from './contract';
import {
  BEGINNER,
  CHART,
  COMPARE,
  GOLD,
  MONITOR,
  PINE,
  PORTFOLIO,
  SCREEN,
  SELLOFF,
} from './scenarioData';

/**
 * Scripted responses, behind the structured contract.
 *
 * Two reasons these exist rather than a model call. The product has to
 * demonstrate with no `ANTHROPIC_API_KEY`, like the rest of Voyager. And a
 * scripted response proves the boundary is real *before* anything unpredictable
 * is on the other side of it: these go through `parsePlan` exactly as a model
 * response would, so a scenario that forgets a source or invents a module kind
 * is refused here, in a test, rather than in production.
 *
 * When the model layer lands it produces the same object and nothing
 * downstream changes. That is what the boundary is for.
 *
 * Import-free beyond the contract, so the harness compiles it alone.
 */

const NOW = '2026-08-03T09:15:00Z';

/** Routed on keywords, as the prototype does. Narrow and honest about it. */
export function scenarioFor(question: string): string {
  const q = question.toLowerCase();

  /*
   * Order matters, and the specific tests come first.
   *
   * "Create a Pine Script indicator" and "Build a Tesla chart with RSI" both
   * read as building; "What are the risks in my portfolio" and "Find companies
   * with growing revenue" both read as searching. Whichever test runs first
   * wins, so the narrowest go at the top and the market summary is the fallback
   * rather than a match.
   */
  /*
   * Matched on whole words through a padded string rather than with regular
   * expressions.
   *
   * Two reasons. Substring matching sends the wrong request to the wrong
   * scenario in ways that are hard to spot: "vs" lives inside "investing"
   * and "risk" inside "brisk", so a beginner asking about investing would
   * have been handed a comparison. And the escaping is a trap on its own —
   * the first version of this went in with real control characters where
   * the word boundaries were meant, so every question routed to the market
   * summary and the only thing that noticed was a test.
   */
  const padded = ` ${q.replace(/[^a-z]+/g, " ").trim()} `;
  const has = (...words: string[]) => words.some((word) => padded.includes(` ${word} `));

  /*
   * A question about what something *is* comes first.
   *
   * It has to, because the concept words collide with almost every other test:
   * "What are the risks of bonds" would have gone to the portfolio scenario and
   * "What is the difference between ETFs and stocks" to the comparison. Both
   * are somebody asking to be taught, and answering either with a portfolio
   * review is the failure this branch exists to stop — before it existed, every
   * such question fell through to the market summary and got told where the S&P
   * closed.
   */
  // An exact match against a question the product offers wins outright: those
  // have answers written for them, and no keyword rule should be able to send
  // one somewhere else.
  if (findAnswer(question)) return 'explain';

  if (asksForAnExplanation(padded) && conceptIn(padded)) return 'explain';

  if (has('pine', 'script', 'indicator')) return 'pine';
  if (has('beginner') || padded.includes(' every month ')) return 'beginner';
  if (has('monitor', 'alert') || padded.includes(' tell me if ')) return 'monitor';
  if (has('portfolio', 'risk', 'risks')) return 'portfolio';
  if (has('screen', 'screener') || (has('find') && has('companies', 'company'))) return 'screen';
  if (has('compare', 'versus', 'vs')) return 'compare';
  if (has('chart', 'rsi', 'support')) return 'chart';
  if (has('gold')) return 'gold';
  if (padded.includes(' technology stocks ') || has('falling', 'fell', 'selloff')) return 'selloff';

  /*
   * Nothing else claimed it. If it was still a question about what something
   * *is*, answering with today's index levels is the original failure — the
   * explanation scenario admits it has no written answer, which is the honest
   * end of this branch. Questions about today are excluded by name, because
   * "what is happening today" opens exactly like a definition question.
   */
  if (asksForAnExplanation(padded) && !has('today', 'now', 'happening', 'market', 'markets')) {
    return 'explain';
  }

  return 'market';
}



/**
 * What a beginner asks about, and the plain answer to each.
 *
 * A closed table rather than a generator. Everything here is a claim about how
 * money works, made to somebody who came to be taught, and a sentence assembled
 * at runtime is a sentence nobody checked. When a question names a concept that
 * is not on this list, the scenario says so instead of improvising — see
 * `explainFor`.
 */
type Concept = {
  words: string[];
  title: string;
  /** What it is, in one paragraph, no jargon. */
  body: string;
  /** The part people are not told, which is usually the part that costs them. */
  catch: string;
  next: string[];
};

const CONCEPTS: Concept[] = [
  {
    words: ['etf', 'etfs', 'fund', 'funds'],
    title: 'What an ETF is',
    body:
      'An ETF is a single thing you buy that holds many other things — often every company in an index. One purchase spreads your money across hundreds of businesses, so no single one of them can sink you, and it trades on an exchange like an ordinary share.',
    catch:
      'It spreads company risk, not market risk. When the whole market falls, an ETF that holds the whole market falls with it. The fee is small and it is charged every year, whether the fund rose or fell.',
    next: [
      'Compare a broad ETF against a deposit over ten years',
      'Read what an index actually is',
      'See what the annual fee costs over a long horizon',
    ],
  },
  {
    words: ['bond', 'bonds'],
    title: 'What a bond is',
    body:
      'A bond is a loan. You lend money to a government or a company for a fixed period, they pay you interest along the way, and they return the amount at the end. That schedule is the whole appeal: you know what is meant to arrive and when.',
    catch:
      'Two things can break the schedule. If interest rates rise, the price of a bond you already hold falls — you can still hold it to the end, but selling early may lose money. And the borrower can fail to pay, which is why a government bond and a struggling company\u2019s bond are not the same instrument.',
    next: [
      'Compare government and corporate bonds',
      'See what happens to bond prices when rates move',
      'Read how bonds and shares behave differently',
    ],
  },
  {
    words: ['inflation'],
    title: 'What inflation does to money',
    body:
      'Inflation is prices rising over time, which is the same thing as money buying less. Cash that sits still does not lose a number — it loses what the number can buy. At 3% a year, money left alone buys roughly a quarter less after ten years.',
    catch:
      'It is the reason "safe" is not the same as "no risk". A deposit cannot fall in value and can still leave you worse off, quietly, over a long enough period. That is a real cost and it does not appear on any statement.',
    next: [
      'See what inflation did to savings over the last decade',
      'Compare a deposit rate against the inflation rate',
      'Read why a cash reserve is still worth holding',
    ],
  },
  {
    words: ['diversification', 'diversify', 'diversified'],
    title: 'What diversification does',
    body:
      'Diversification is holding things that do not all fall together. It does not raise your expected return — it narrows the range of what can happen to you, which matters most when you cannot afford the bad end of that range.',
    catch:
      'It works on the risk of being wrong about one company. It does not work on the risk of a whole market falling, because in a bad enough month most things fall at once. Holding twenty companies in one industry is not diversification.',
    next: [
      'See how a single stock and a broad fund behave in the same year',
      'Read what correlation means, in plain terms',
      'Try a practice portfolio with two very different holdings',
    ],
  },
  {
    words: ['dividend', 'dividends'],
    title: 'What a dividend is',
    body:
      'A dividend is a company handing part of its profit to the people who own it. It arrives as cash, usually a few times a year, and it is one of the two ways a share can pay you — the other being the price going up.',
    catch:
      'A dividend is not free money: the share price drops by roughly the amount paid out on the day it is paid. And a high dividend yield is sometimes a falling price rather than a generous company, which is the opposite of what it looks like.',
    next: [
      'Compare a dividend fund against a broad market fund',
      'Read why a high yield can be a warning',
      'See how dividends are taxed where you live',
    ],
  },
];

/** "What is…", "how does…", "explain…", "what is the difference between…" */
function asksForAnExplanation(padded: string): boolean {
  const openers = [
    ' what is ',
    ' what are ',
    ' whats ',
    ' how does ',
    ' how do ',
    ' how is ',
    ' what does ',
  ];
  if (openers.some((opener) => padded.includes(opener))) return true;
  return [' explain ', ' difference ', ' means ', ' meaning '].some((word) =>
    padded.includes(word)
  );
}

function conceptFor(padded: string): Concept | null {
  return (
    CONCEPTS.find((concept) =>
      concept.words.some((word) => padded.includes(` ${word} `))
    ) ?? null
  );
}

function conceptIn(padded: string): boolean {
  return conceptFor(padded) !== null;
}

/**
 * The educational answer.
 *
 * Built from the table above, with the question repeated at the top: the person
 * has to be able to see what was asked on their behalf, especially when the
 * question arrived in a URL rather than from their keyboard.
 *
 * When the concept is not one this table covers, the scenario says so. A demo
 * that invents a definition of something it has never been taught is worse than
 * a demo that admits the gap.
 */
function explainFor(question: string): unknown {
  const padded = ` ${question.toLowerCase().replace(/[^a-z]+/g, ' ').trim()} `;

  /*
   * An exact match against a question the product itself offers comes first.
   *
   * Every "Try asking" chip on Explore is in that library with an answer
   * written for it. Falling through to the concept table would answer "Are ETFs
   * suitable for beginners?" with the definition of an ETF — related, and not
   * what was asked.
   */
  const written = findAnswer(question);
  if (written) {
    return {
      mode: 'learn',
      because: 'this is a question the product offers, and it has a written answer',
      steps: ['Read the request as a question about a concept', 'Find the written answer'],
      work: [{ id: 'w1', label: 'Finding the written answer', done: false }],
      sources: [
        {
          id: 'src_academy',
          kind: 'EDUCATIONAL',
          provider: 'TradingNew Learn',
          at: NOW,
          detail: 'Written lesson material, reviewed',
        },
      ],
      assumptions: [],
      modules: [
        {
          id: 'm_asked',
          kind: 'text-insight',
          title: 'You asked',
          provenance: ['educational'],
          sourceIds: [],
          data: { body: written.question },
          actions: [],
        },
        {
          id: 'm_answer',
          kind: 'text-insight',
          title: 'The short answer',
          provenance: ['educational'],
          sourceIds: ['src_academy'],
          data: { body: written.answer },
          actions: [{ id: 'save_workspace', label: 'Save this explanation', mutates: true }],
        },
      ],
    };
  }

  const concept = conceptFor(padded);

  if (!concept) {
    return {
      mode: 'learn',
      because: 'you asked to have something explained rather than analysed',
      steps: ['Read the request as a question about a concept', 'Look for a written explanation'],
      work: [{ id: 'w1', label: 'Looking for a written explanation', done: false }],
      sources: [],
      assumptions: [],
      modules: [
        {
          id: 'm_gap',
          kind: 'text-insight',
          title: 'I do not have a written explanation of that yet',
          provenance: ['educational'],
          sourceIds: [],
          data: {
            body:
              'This demo answers a fixed set of concepts — ETFs, bonds, inflation, diversification and dividends — from explanations that were written and checked. Rather than assemble a definition of something nobody has checked, it says so. The lessons cover more ground than this list does.',
          },
          actions: [],
        },
      ],
    };
  }

  return {
    mode: 'learn',
    because: 'you asked what something is rather than what the market did',
    steps: [
      'Read the request as a question about a concept',
      'Find the written explanation',
      'Add what the explanation usually leaves out',
    ],
    work: [
      { id: 'w1', label: 'Finding the written explanation', done: false },
      { id: 'w2', label: 'Adding the part that usually gets left out', done: false },
    ],
    sources: [
      {
        id: 'src_academy',
        kind: 'EDUCATIONAL',
        provider: 'TradingNew Learn',
        at: NOW,
        detail: 'Written lesson material, reviewed',
      },
    ],
    assumptions: [],
    modules: [
      {
        id: 'm_asked',
        kind: 'text-insight',
        title: 'You asked',
        provenance: ['educational'],
        sourceIds: [],
        data: { body: question.trim() },
        actions: [],
      },
      {
        id: 'm_explain',
        kind: 'text-insight',
        title: concept.title,
        provenance: ['educational'],
        sourceIds: ['src_academy'],
        data: { body: concept.body },
        /* An action the workspace actually knows. Inventing an id here would
           render a button that does nothing when pressed. */
        actions: [{ id: 'save_workspace', label: 'Save this explanation', mutates: true }],
      },
      {
        id: 'm_catch',
        kind: 'text-insight',
        /* The half that gets left out of most explanations, and the half that
           costs people money. It is a separate module so it cannot be skimmed
           past as a caveat at the end of a paragraph. */
        title: 'What that leaves out',
        provenance: ['educational'],
        sourceIds: ['src_academy'],
        data: { body: concept.catch },
        actions: [],
      },
      {
        id: 'm_next',
        kind: 'next-actions',
        title: 'Where to look next',
        provenance: ['educational'],
        sourceIds: [],
        data: { items: concept.next },
        actions: [],
      },
    ],
  };
}

/**
 * The market summary, written as the response a model would have to produce.
 *
 * Every claim carries a source with a provider and a timestamp, because the
 * contract refuses one that does not — including the ones written here. The
 * interpretation is labelled as interpretation and kept apart from the
 * measurement it rests on.
 */
const MARKET: unknown = {
  mode: 'analyse',
  because: 'you asked what the market did rather than what to do about it',
  steps: [
    'Read the request as a market summary',
    'Fetch index levels and sector moves',
    'Find the largest movers',
    'Write the summary with its sources',
  ],
  work: [
    { id: 'w1', label: 'Reading index levels', done: false },
    { id: 'w2', label: 'Comparing 11 sectors', done: false },
    { id: 'w3', label: 'Finding the largest movers', done: false },
  ],
  sources: [
    {
      id: 'src_quotes',
      kind: 'MARKET DATA',
      provider: 'Twelve Data',
      at: NOW,
      detail: 'Index and sector levels',
      delayed: true,
    },
    {
      id: 'src_macro',
      kind: 'ESTIMATES',
      provider: 'FRED',
      at: '2026-08-01T12:00:00Z',
      detail: 'CPI series, monthly',
    },
  ],
  assumptions: [
    { id: 'a_window', label: 'Window', value: 'Today’s session', editable: true },
    { id: 'a_universe', label: 'Universe', value: 'US large cap', editable: true },
  ],
  modules: [
    {
      id: 'm_headline',
      kind: 'metric-row',
      title: 'Where the US market closed',
      subtitle: 'Delayed by 15 minutes on this plan',
      provenance: ['market-data'],
      sourceIds: ['src_quotes'],
      data: {
        metrics: [
          { label: 'S&P 500', value: '5 412.30', sign: -1 },
          { label: 'Nasdaq 100', value: '18 902.10', sign: -1 },
          { label: 'Dow Jones', value: '39 118.40', sign: 1 },
          { label: 'VIX', value: '16.2', sign: 1 },
        ],
      },
      actions: [{ id: 'open_chart', label: 'Open in Supercharts', mutates: false }],
    },
    {
      id: 'm_movers',
      kind: 'ranked-rows',
      title: 'What moved most',
      provenance: ['market-data'],
      sourceIds: ['src_quotes'],
      data: {
        rows: [
          { name: 'NVDA', note: 'Semiconductors', value: '−4.1%', sign: -1 },
          { name: 'AVGO', note: 'Semiconductors', value: '−3.4%', sign: -1 },
          { name: 'XOM', note: 'Energy', value: '+2.2%', sign: 1 },
          { name: 'JNJ', note: 'Healthcare', value: '+1.4%', sign: 1 },
        ],
      },
      actions: [{ id: 'watchlist', label: 'Create a watchlist', mutates: true }],
    },
    {
      id: 'm_read',
      kind: 'text-insight',
      title: 'How to read this',
      /*
       * Interpretation, labelled as interpretation and separated from the
       * measurement above it. The two carry different provenance for exactly
       * this reason.
       */
      provenance: ['inference', 'educational'],
      sourceIds: ['src_macro'],
      data: {
        body:
          'The fall is concentrated in semiconductors rather than spread across technology, and the defensive sectors rose. That pattern is consistent with positioning moving out of one crowded trade rather than with a broad change in risk appetite — but this is a reading of one session, and one session is not a trend. Nothing here says what will happen next.',
      },
      actions: [],
    },
    {
      id: 'm_next',
      kind: 'next-actions',
      title: 'Where to look next',
      provenance: ['educational'],
      sourceIds: [],
      data: {
        items: [
          'Compare NVIDIA, AMD and Broadcom over three months',
          'Check whether the move shows up in volume as well as price',
          'Set a rule to watch semiconductors and tell you if it continues',
        ],
      },
      actions: [],
    },
  ],
};

const SCENARIOS: Record<string, unknown> = {
  market: MARKET,
  selloff: SELLOFF,
  compare: COMPARE,
  chart: CHART,
  screen: SCREEN,
  portfolio: PORTFOLIO,
  monitor: MONITOR,
  beginner: BEGINNER,
  gold: GOLD,
  pine: PINE,
};

/**
 * Every scenario the workspace can answer, for the tests that check them all.
 *
 * `explain` is listed by hand because it is not in `SCENARIOS` — it is built per
 * question rather than looked up, and a test that walked only the record would
 * have left the one branch a beginner is most likely to hit unchecked.
 */
export const SCENARIO_IDS = [...Object.keys(SCENARIOS), 'explain'];

/** The raw response for a question, or null where the scenario is not written yet. */
export function responseFor(question: string): unknown | null {
  const id = scenarioFor(question);
  // The explanation depends on which concept was named, so it is built rather
  // than looked up. Everything else is one fixed response per scenario.
  if (id === 'explain') return explainFor(question);
  return SCENARIOS[id] ?? null;
}

export type { VoyagerPlan };
