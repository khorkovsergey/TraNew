/**
 * Everything the Ideas landing page says.
 *
 * Deliberate placeholders, not fetched data. Every figure here is illustrative
 * and the page says so on screen next to each set of them; the point of keeping
 * them in one file is that when a real source arrives, the shape it has to
 * produce is written down in one place rather than spread across six sections.
 *
 * The language rule for this whole section: never *buy*, *best*, *strong buy*
 * or *guaranteed*. Ideas describes what is happening and what is connected to
 * what. The moment it recommends, it is a different product with a different
 * licence.
 */

/** A theme card in "Trending now". */
export type Trend = {
  /** Stable id — the seed for its sparkline and the subject it hands to Voyager. */
  key: string;
  title: string;
  body: string;
  /** How much attention it is getting, not how it has performed. */
  status: 'Trending' | 'Gaining attention' | 'Steady';
  /**
   * The chain of dependent industries — chips to charts is what makes this an
   * idea rather than a quote. Read left to right: each link is downstream of
   * the one before it.
   */
  chain: string[];
  change: string;
  direction: 'up' | 'down';
  companies: number;
  etfs: number;
};

export const TRENDING: Trend[] = [
  {
    key: 'ai-infrastructure',
    title: 'AI Infrastructure',
    body: 'The physical build-out behind AI growth.',
    status: 'Trending',
    chain: ['Chips', 'Networking', 'Data centers', 'Power'],
    change: '+18.4% 1Y',
    direction: 'up',
    companies: 12,
    etfs: 3,
  },
  {
    key: 'nuclear-energy',
    title: 'Nuclear Energy',
    body: 'Reactors back on the table as electricity demand climbs.',
    status: 'Trending',
    chain: ['Uranium', 'Reactors', 'Utilities'],
    change: '+24.1% 1Y',
    direction: 'up',
    companies: 9,
    etfs: 2,
  },
  {
    key: 'european-defense',
    title: 'European Defense',
    body: 'Rearmament budgets across the continent.',
    status: 'Gaining attention',
    chain: ['Budgets', 'Primes', 'Suppliers'],
    change: '+31.7% 1Y',
    direction: 'up',
    companies: 11,
    etfs: 2,
  },
  {
    key: 'cybersecurity',
    title: 'Cybersecurity',
    body: 'Spending that rarely gets cut when budgets tighten.',
    status: 'Steady',
    chain: ['Threats', 'Software', 'Services'],
    change: '−2.3% 1Y',
    direction: 'down',
    companies: 14,
    etfs: 4,
  },
];

/**
 * The browse-by-concept surface: the market grouped the way a person thinks
 * about it rather than the way an exchange lists it.
 *
 * Five columns and no filters, on purpose. The moment this grows a minimum
 * market capitalisation and a sector dropdown it is a screener, and a screener
 * is the thing somebody comes to Ideas instead of.
 */
export const THEME_COLUMNS: Array<{ title: string; items: string[] }> = [
  {
    title: 'Technology',
    items: [
      'Artificial Intelligence',
      'Robotics',
      'Cybersecurity',
      'Semiconductors',
      'Cloud Infrastructure',
    ],
  },
  {
    title: 'Energy',
    items: ['Nuclear', 'Renewable Energy', 'Grid Infrastructure', 'Oil & Gas', 'Energy Storage'],
  },
  {
    title: 'Society',
    items: ['Aging Population', 'Digital Payments', 'Future of Work', 'Healthcare Innovation'],
  },
  {
    title: 'Industries',
    items: ['Space Economy', 'Defense', 'Biotechnology', 'Electric Vehicles', 'Data Centers'],
  },
  { title: 'Income', items: ['Dividend Stocks', 'Bonds', 'REITs'] },
];

/**
 * Three situations, each led by what kind of change it is.
 *
 * The label carries the honesty: "Something is changing" is a description,
 * "Worth exploring" is an invitation, and neither is a call. The card explains
 * the mechanism and stops there.
 */
export const OPPORTUNITIES: Array<{
  key: string;
  label: string;
  title: string;
  body: string;
}> = [
  {
    key: 'lower-interest-rates',
    label: 'Something is changing',
    title: 'Lower Interest Rates',
    body: 'Rate-cut expectations are moving again, and the parts of the market most sensitive to borrowing costs are moving with them.',
  },
  {
    key: 'data-centers',
    label: 'Gaining attention',
    title: 'Data Centers',
    body: 'Power, land and cooling have become the constraint on computing — and a market of their own.',
  },
  {
    key: 'dividend-income',
    label: 'Worth exploring',
    title: 'Dividend Income',
    body: 'When cash yields fall, income-paying equities start getting a second look.',
  },
];

/**
 * What other people are looking at — attention, not endorsement.
 *
 * The signal column says which kind of attention, because "popular" on its own
 * is the sentence this section exists to avoid: a thing many people are
 * watching is a thing worth investigating, and nothing more than that.
 */
export const POPULAR: Array<{
  key: string;
  name: string;
  kind: 'Theme' | 'ETF';
  signal: string;
}> = [
  { key: 'ai-infrastructure', name: 'AI Infrastructure', kind: 'Theme', signal: 'Most viewed this week' },
  { key: 'nuclear-energy', name: 'Nuclear Energy', kind: 'Theme', signal: 'Rising attention' },
  {
    key: 'global-technology-etf',
    name: 'Global Technology ETF',
    kind: 'ETF',
    signal: 'Most added to watchlists',
  },
  { key: 'european-defense', name: 'European Defense', kind: 'Theme', signal: 'Rising attention' },
  { key: 'dividend-income', name: 'Dividend Income', kind: 'Theme', signal: 'Most followed' },
  { key: 'robotics', name: 'Robotics', kind: 'Theme', signal: 'New in the top ten' },
];

/** One band of an allocation bar. The four tones are the portal's chart set. */
export type Slice = { label: string; weight: number; tone: 'mint' | 'blue' | 'purple' | 'cyan' };

/**
 * Ideas combined, so the shape of a whole holding is visible.
 *
 * Illustrative compositions and nothing more: there is no portfolio
 * construction here, no rebalancing and no brokerage. The bar answers "what
 * would this idea consist of", which is a question about the idea.
 */
export const PORTFOLIOS: Array<{
  key: string;
  title: string;
  body: string;
  slices: Slice[];
  holdings: number;
  etfs: number;
}> = [
  {
    key: 'ai-ecosystem',
    title: 'AI Ecosystem',
    body: 'Every layer of the build-out, from chips to the grid.',
    slices: [
      { label: 'Semiconductors', weight: 4, tone: 'mint' },
      { label: 'Networking', weight: 2, tone: 'blue' },
      { label: 'Data centers', weight: 2, tone: 'purple' },
      { label: 'Utilities', weight: 2, tone: 'cyan' },
    ],
    holdings: 9,
    etfs: 3,
  },
  {
    key: 'defensive',
    title: 'Defensive',
    body: 'What tends to keep working when growth slows.',
    slices: [
      { label: 'Consumer staples', weight: 3, tone: 'mint' },
      { label: 'Healthcare', weight: 3, tone: 'blue' },
      { label: 'Utilities', weight: 2, tone: 'purple' },
      { label: 'Short bonds', weight: 2, tone: 'cyan' },
    ],
    holdings: 11,
    etfs: 4,
  },
  {
    key: 'dividend-income',
    title: 'Dividend Income',
    body: 'Companies and funds that pay you to wait.',
    slices: [
      { label: 'Dividend equity', weight: 5, tone: 'mint' },
      { label: 'REITs', weight: 2, tone: 'blue' },
      { label: 'Bonds', weight: 3, tone: 'purple' },
    ],
    holdings: 8,
    etfs: 3,
  },
];

/** Two themes and the one sentence that separates them. */
export const COMPARISONS: Array<{ left: string; right: string; body: string }> = [
  {
    left: 'AI',
    right: 'Cybersecurity',
    body: 'Both ride software budgets — one grows with build-out, one with risk.',
  },
  {
    left: 'Nuclear',
    right: 'Renewables',
    body: 'Two answers to the same electricity question, on very different timelines.',
  },
  {
    left: 'Dividend Income',
    right: 'Growth',
    body: 'Cash paid out now against value compounded later.',
  },
];

/** The chips under the Explore-an-idea field, for somebody with no idea yet. */
export const STARTERS = [
  'AI infrastructure',
  'Lower interest rates',
  'Energy demand',
  'Dividend income',
  'European defense',
  'Nuclear energy',
];
