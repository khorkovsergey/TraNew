/**
 * What the landing screen offers before anybody has asked for anything.
 *
 * Data, not markup, because the same five starters appear on the landing and as
 * shortcuts in the conversation panel once the workspace assembles — and two
 * copies of a list are two lists that disagree by the end of the month.
 *
 * The wording is the handoff's, verbatim. It is specific on purpose: each
 * starter is a whole request a person could mean, not a topic. "Compare NVIDIA,
 * AMD and Broadcom" tells somebody what this thing does; "Comparison" does not.
 *
 * Import-free, so the harness compiles it alone.
 */

export type StarterId =
  | 'market-today'
  | 'compare'
  | 'tesla-chart'
  | 'screen-tech'
  | 'portfolio-risks';

export type Starter = {
  id: StarterId;
  /** The icon name in the shared registry; never a glyph typed into markup. */
  icon: string;
  text: string;
};

/** Five, and only five. A sixth turns a menu of things to try into a list to read. */
export const STARTERS: Starter[] = [
  { id: 'market-today', icon: 'globe', text: 'What is happening in the US market today?' },
  { id: 'compare', icon: 'bars', text: 'Compare NVIDIA, AMD and Broadcom' },
  { id: 'tesla-chart', icon: 'chart', text: 'Build a Tesla chart with RSI and support levels' },
  { id: 'screen-tech', icon: 'search', text: 'Find US technology companies with growing revenue' },
  { id: 'portfolio-risks', icon: 'shield', text: 'What are the main risks in my portfolio?' },
];

export type PromptCard = {
  text: string;
  /** Marked where the plan gates it, so nobody discovers the wall after asking. */
  pro?: boolean;
};

export type PromptCategory = {
  id: string;
  title: string;
  /** One line saying who the category is for. */
  subtitle: string;
  icon: string;
  cards: PromptCard[];
};

/**
 * The five categories behind "More things I can do".
 *
 * Editorial groups with a title and a reason, not a wall of identical chips —
 * the difference between a menu somebody reads and a tag cloud they skim past.
 */
export const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    id: 'understand',
    title: 'Understand the market',
    subtitle: 'Start here if you want the picture',
    icon: 'globe',
    cards: [
      { text: 'What is happening in the US market today?' },
      { text: 'Why are technology stocks falling?' },
      { text: 'Why has gold risen over the last three months?' },
    ],
  },
  {
    id: 'opportunity',
    title: 'Find an opportunity',
    subtitle: 'Screens built from a sentence',
    icon: 'search',
    cards: [
      {
        text: 'Find US technology companies with growing revenue and positive free cash flow',
        pro: true,
      },
      { text: 'Show strong dividend payers I could research', pro: true },
    ],
  },
  {
    id: 'compare',
    title: 'Analyse and compare',
    subtitle: 'Company research in one workspace',
    icon: 'bars',
    cards: [{ text: 'Compare NVIDIA, AMD and Broadcom as long-term investments' }],
  },
  {
    id: 'build',
    title: 'Build and test',
    subtitle: 'Charts, indicators and scripts',
    icon: 'chart',
    cards: [
      { text: 'Build a Tesla chart with RSI, volume and support levels' },
      { text: 'Create a Pine Script indicator that shows a possible trend reversal', pro: true },
    ],
  },
  {
    id: 'wealth',
    title: 'Manage my wealth and watch the market',
    subtitle: 'Uses your data only with permission',
    icon: 'shield',
    cards: [
      { text: 'What are the main risks in my portfolio?', pro: true },
      { text: 'I am a beginner and want to invest €500 every month' },
      {
        text: 'Monitor NVIDIA and tell me if its valuation falls below its five-year average',
        pro: true,
      },
    ],
  },
];

export type BriefingCard = {
  id: string;
  /** The category label above the card — WATCHLIST, MONITORING, CONTINUE, PORTFOLIO. */
  kind: string;
  title: string;
  /**
   * Why this card is on screen.
   *
   * Required by the type, not optional. A personalised card that cannot say why
   * it was chosen is indistinguishable from an advert, and the handoff makes
   * stating the reason a condition of showing one at all.
   */
  because: string;
};

export type Briefing = {
  greeting: string;
  /** One sentence. Not a digest — a sentence. */
  summary: string;
  cards: BriefingCard[];
};

/**
 * The returning person's briefing.
 *
 * Fixtures for now, behind the same shape the server will fill: every card is
 * derived from something the person did — a watchlist they built, a rule they
 * created, work they left unfinished, a holding they own. Nothing here is a
 * recommendation, and nothing is inferred from a cohort.
 */
export function briefingFor(name: string, hour: number): Briefing {
  const partOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  return {
    greeting: `Good ${partOfDay}, ${name}.`,
    summary:
      'Technology stocks are falling, two companies in your watchlist report earnings this week, and one monitoring rule is close to its threshold.',
    cards: [
      {
        id: 'earnings',
        kind: 'Watchlist',
        title: 'Two of your names report earnings this week',
        because: 'NVDA on Wednesday, AVGO on Thursday',
      },
      {
        id: 'rule',
        kind: 'Monitoring',
        title: 'NVDA valuation is 12% above your threshold',
        because: 'Rule you created on 24 July',
      },
      {
        id: 'continue',
        kind: 'Continue',
        title: 'AI Infrastructure Research',
        because: 'You left a comparison half-finished yesterday',
      },
      {
        id: 'concentration',
        kind: 'Portfolio',
        title: 'Technology is now 46% of your liquid assets',
        because: 'Up from 39% three months ago',
      },
    ],
  };
}
