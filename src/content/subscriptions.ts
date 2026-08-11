/**
 * The four Voyager plans, and the single place their copy and prices live.
 *
 * The lineup is Free → Plus → Pro → Private. The five-plan range that used to
 * be here (Essential / Plus / Premium / Ultimate / Voyager Private) is gone
 * rather than kept beside this one: it sold platform limits — charts per tab,
 * alerts, historical bars — and the approved design sells one thing, how much
 * Voyager does for you. Two lineups in one file is how a screen ends up showing
 * a plan nobody sells.
 *
 * **Prices are placeholders.** `PLACEHOLDER_PRICES` is on, so every paid card
 * renders `€XX` and says why underneath. The monthly numbers below exist only
 * so a scenario can be previewed by flipping one constant; nothing on the page
 * treats them as approved commercial pricing, and no checkout reads them.
 *
 * Import-free, so the harness compiles it alone.
 */

export type SubscriptionPlanId = 'free' | 'plus' | 'pro' | 'private';

/** The order the cards, the matrix columns and the comparison tuples follow. */
export const PLAN_ORDER: SubscriptionPlanId[] = ['free', 'plus', 'pro', 'private'];

export type BillingPeriod = 'monthly' | 'annual';

/**
 * Accent per plan — colour as intelligence, not as four brands.
 *
 * Free is neutral slate, Plus the TradingNew mint, Pro the research cyan,
 * Private violet. Same card geometry and type scale throughout; only the accent
 * and the elevation change.
 */
export type PlanAccent = 'neutral' | 'mint' | 'blue' | 'violet';

/**
 * `primary` is the one filled badge on the grid ("Most popular"); `secondary`
 * is a quieter cue that does not compete for the same slot. Which plan carries
 * which is data, so moving the highlight is an edit here rather than a layout
 * change.
 */
export type PlanBadge = { label: string; kind: 'primary' | 'secondary' };

export type PlanCta = {
  label: string;
  /** `solid` is the one filled action on the grid; the rest sit under it. */
  variant: 'neutral' | 'solid' | 'outline' | 'violet';
};

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  /** The short column label: Free, Plus, Pro, Private. */
  label: string;
  /** The card heading: "Voyager Plus". */
  name: string;
  accent: PlanAccent;
  tagline: string;
  /** Euros per month at the monthly rate. `null` on the free plan. */
  monthly: number | null;
  badge?: PlanBadge;
  /** "Everything in Free, plus" — omitted on the entry plan. */
  inherits?: string;
  features: string[];
  bestFor: string;
  cta: PlanCta;
  /** Private's consent line, which belongs on the card rather than in a modal. */
  consentNote?: string;
};

/* ------------------------------------------------------------------- Money */

/**
 * Provisional prices are shown as `€XX`, not as numbers.
 *
 * Nothing on this screen is approved commercial pricing, and a number on a
 * pricing card is read as a commitment however much small print sits under it.
 * Turn this off only to preview a numeric scenario in development.
 */
export const PLACEHOLDER_PRICES = true;

/** What a paid plan renders while `PLACEHOLDER_PRICES` is on. */
export const PLACEHOLDER_PRICE = '€XX';

/** Illustrative, and labelled as such wherever it appears. */
export const ANNUAL_SAVING_PERCENT = 20;

export const PRICE_DISCLAIMER =
  'Prices shown are provisional placeholders for design review — not approved commercial pricing.';

/** The headline figure on a card. */
export function planPrice(plan: SubscriptionPlan, period: BillingPeriod): string {
  if (plan.monthly === null) return '€0';
  if (PLACEHOLDER_PRICES) return PLACEHOLDER_PRICE;

  const value =
    period === 'annual'
      ? Math.round(plan.monthly * (1 - ANNUAL_SAVING_PERCENT / 100))
      : plan.monthly;

  return `€${value}`;
}

/** The unit beside the figure. */
export function planPriceUnit(plan: SubscriptionPlan, period: BillingPeriod): string {
  if (plan.monthly === null) return 'forever';
  return period === 'annual' ? 'per month, billed annually' : 'per month';
}

/**
 * The line under the price.
 *
 * While the prices are placeholders this says so and does not change with the
 * toggle — a billing caption under `€XX` would imply the `€XX` was a rate.
 */
export function planPriceNote(plan: SubscriptionPlan, period: BillingPeriod): string {
  if (plan.monthly === null) return 'No card required';
  if (PLACEHOLDER_PRICES) return 'Final price not yet approved';
  return period === 'annual' ? 'Billed annually' : 'Cancel anytime';
}

/* ------------------------------------------------------------------- Plans */

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    label: 'Free',
    name: 'Voyager Free',
    accent: 'neutral',
    tagline: 'Ask. Explore. Understand.',
    monthly: null,
    features: [
      'Financial and market Q&A',
      'Page-aware help across TradingNew',
      'Quotes, price history, basic charts',
      'Asset and symbol explanations',
      'A daily allowance of Voyager questions',
    ],
    bestFor: 'getting your bearings in the market',
    cta: { label: 'Start with Voyager', variant: 'neutral' },
  },
  {
    id: 'plus',
    label: 'Plus',
    name: 'Voyager Plus',
    accent: 'mint',
    tagline: 'Analyze the market.',
    monthly: 14,
    badge: { label: 'Most popular', kind: 'primary' },
    inherits: 'Everything in Free, plus',
    features: [
      'Flexible date ranges, candles, volume',
      'SMA, RSI, MACD, Bollinger Bands',
      'Multi-asset comparison, normalized performance',
      'Return, volatility, max drawdown, period high / low',
      'Chat history and reusable chart context',
    ],
    bestFor: 'active private investors',
    cta: { label: 'Choose Plus', variant: 'solid' },
  },
  {
    id: 'pro',
    label: 'Pro',
    name: 'Voyager Pro',
    accent: 'blue',
    tagline: 'Research. Compare. Decide.',
    monthly: 39,
    badge: { label: 'Best for research', kind: 'secondary' },
    inherits: 'Everything in Plus, plus',
    features: [
      'Deep research across multiple sources',
      'Multi-step agent workflows across 2–5 assets',
      'Investment analysis with evidence, risks, bull / bear case',
      'Generate, explain and debug Pine Script',
      'Longer working context and higher agent limits',
    ],
    bestFor: 'serious research before a decision',
    cta: { label: 'Choose Pro', variant: 'outline' },
  },
  {
    id: 'private',
    label: 'Private',
    name: 'Voyager Private',
    accent: 'violet',
    tagline: 'Your private financial intelligence.',
    monthly: 99,
    inherits: 'Everything in Pro, plus',
    features: [
      'Persistent private research context',
      'Private knowledge vault for your own documents',
      'Saved theses and research memory across sessions',
      'Highest limits and longer multi-step research jobs',
      'Privacy controls with full visibility into what is stored',
    ],
    bestFor: 'research that has to survive the session',
    cta: { label: 'Explore Private', variant: 'violet' },
    consentNote:
      'Nothing is remembered until you choose to save it. You can review and delete stored context at any time.',
  },
];

export const PLANS_BY_ID: Record<SubscriptionPlanId, SubscriptionPlan> = Object.fromEntries(
  SUBSCRIPTION_PLANS.map((plan) => [plan.id, plan])
) as Record<SubscriptionPlanId, SubscriptionPlan>;

/* --------------------------------------------------------------- Framing */

export const HERO = {
  eyebrow: 'Marketplace → Subscriptions',
  /* Split so the accent can be a span rather than dangerous HTML in a string. */
  headingLead: 'TradingNew is the platform.',
  headingAccent: 'Voyager',
  headingTail: 'is the intelligence you upgrade.',
  body: 'The portal stays open. Your subscription decides how much Voyager does for you — how deep it analyses, how far it researches, and how much private context it keeps.',
  trust: 'Voyager supports research and decision-making. It does not execute trades.',
};

/** Ask → Analyze → Research → Private intelligence, one step per plan. */
export const PLAN_PROGRESSION: Array<{ step: string; plan: string; accent: PlanAccent }> = [
  { step: 'Ask', plan: 'Voyager Free', accent: 'neutral' },
  { step: 'Analyze', plan: 'Voyager Plus', accent: 'mint' },
  { step: 'Research', plan: 'Voyager Pro', accent: 'blue' },
  { step: 'Private intelligence', plan: 'Voyager Private', accent: 'violet' },
];

/** One quiet line per card. The handoff is a path, never an inclusion. */
export const TRADINGVIEW_CARD_LINE = 'Continue in TradingView — on every plan';

/**
 * The block that stops a reader taking TradingView for a fifth plan tier.
 *
 * Everything here is deliberately worded as a separate commercial choice.
 * "Included", "activated", "connected" and "provisioned" are wrong on this
 * screen, because none of them is true: TradingNew does not provision a
 * TradingView account.
 */
export const DIMENSIONS = {
  eyebrow: 'Two separate dimensions',
  heading: 'Voyager intelligence and TradingView charting are chosen independently',
  body: 'Your Voyager plan decides how much analysis, research and private context you get. A TradingView plan is picked separately and changes nothing about your Voyager tier. Any combination is valid — Plus with Premium charting, or Private with Essential.',
  voyagerChip: 'Voyager plan → intelligence',
  tradingViewChip: 'TradingView plan → charting',
  addTitle: 'Add TradingView',
  addSubtitle: 'Professional charting, selected separately',
  addBody:
    'Every Voyager plan, including Free, can continue a professional workflow in TradingView. If you want more from TradingView itself — layouts, indicators per chart, deeper intraday history — add a TradingView plan to your Voyager subscription.',
  addCta: 'Add a TradingView plan',
};

export const MARKETPLACE_NOTE = {
  title: 'Marketplace purchases are separate',
  body: 'Experts, events, courses and other paid Marketplace services are bought independently of your Voyager plan.',
  link: 'Browse Marketplace',
};

/* ------------------------------------------------------- TradingView drawer */

export type TradingViewOption = {
  id: string;
  name: string;
  /** A provisional add-on price, or `€0` for the option that adds nothing. */
  price: string;
  description: string;
};

/** Default selection is "none" — the drawer must not pre-sell an add-on. */
export const TRADINGVIEW_DEFAULT = 'none';

export const TRADINGVIEW_OPTIONS: TradingViewOption[] = [
  {
    id: 'none',
    name: 'No TradingView plan',
    price: '€0',
    description:
      "Voyager still hands professional workflows over to TradingView's own public level.",
  },
  {
    id: 'essential',
    name: 'TradingView Essential',
    price: '+€XX',
    description: 'More saved layouts and charts per tab.',
  },
  {
    id: 'plus',
    name: 'TradingView Plus',
    price: '+€XX',
    description: 'More indicators per chart and a larger alert capacity.',
  },
  {
    id: 'premium',
    name: 'TradingView Premium',
    price: '+€XX',
    description: 'Deeper intraday history and second-based intervals.',
  },
  {
    id: 'ultimate',
    name: 'TradingView Ultimate',
    price: '+€XX',
    description: 'The highest limits, for professional charting workloads.',
  },
];

export const TRADINGVIEW_DRAWER = {
  eyebrow: 'Professional charting, selected separately',
  heading: 'Add a TradingView plan to your Voyager subscription',
  body: 'Any TradingView plan pairs with any Voyager plan. Changing one never changes the other.',
  planRowNote: 'Stays exactly as it is, whatever you pick below',
  chooseLabel: 'Choose a TradingView plan',
  disclaimer:
    "Continuing a professional workflow in TradingView works on every Voyager plan, using TradingView's own public level — no add-on required. A paid TradingView plan is an independent commercial choice. Selecting one here is a design state: TradingView accounts are not provisioned from TradingNew today, and add-on pricing is provisional.",
  dismiss: 'Not now',
};

/* --------------------------------------------------------- Private explainer */

export const PRIVATE_DIALOG = {
  eyebrow: 'Voyager Private',
  heading: 'A private research environment, not just more prompts',
  body: 'Private keeps your own documents, notes and theses as working context, so Voyager picks up research where you left it — across sessions.',
  consent:
    'You decide what is stored. Nothing is remembered automatically — no holdings, no personal data — and you can review or delete any saved context at any time.',
  primaryCta: 'Set up Voyager Private',
  dismiss: 'Back to plans',
};

export const PRIVATE_CAPABILITIES: Array<{ title: string; body: string }> = [
  {
    title: 'Private knowledge vault',
    body: 'Your uploaded documents become persistent context you control.',
  },
  {
    title: 'Research memory',
    body: 'Saved theses and artifacts stay available across sessions.',
  },
  {
    title: 'Highest capacity',
    body: 'Longer multi-step research jobs and the largest usage limits.',
  },
  {
    title: 'Trusted sources',
    body: 'Configure which sources Voyager should lean on, where supported.',
  },
];

/* ------------------------------------------------------------ Inside Voyager
 *
 * Two moments that must never share a surface: a *capability boundary* (the
 * plan does not include this) and a *used-up allowance* (the plan includes it,
 * today's capacity is spent). Collapsing them into one "upgrade" screen is how
 * a product teaches people that hitting a limit means they bought the wrong
 * thing.
 *
 * Both are rendered as a preview of a Voyager surface rather than a live one —
 * the figures are placeholders and the page says so.
 */

export const INSIDE_VOYAGER = {
  heading: 'Inside Voyager',
  body: 'Two different moments. A capability boundary is not the same thing as a used-up allowance — and neither one throws the request away.',
  previewNote: 'Preview of a Voyager surface — figures below are placeholder data.',
};

export const CAPABILITY_BOUNDARY = {
  badge: 'Capability boundary · Free plan',
  question:
    'Compare Nvidia and AMD over three years — performance, drawdown, and what the recent data-centre news means for each.',
  answerLead: 'Here is the three-year comparison on your current plan.',
  /* Deliberately unreadable as data: zeroed digits, and labelled below. */
  table: {
    corner: '3-year',
    columns: ['NVDA', 'AMD'],
    rows: [
      { label: 'Total return', values: ['+000%', '+00%'], tone: 'up' as const },
      { label: 'Max drawdown', values: ['−00%', '−00%'], tone: 'flat' as const },
    ],
    note: 'Illustrative figures — placeholder data for design review.',
  },
  gateEyebrow: 'Needs Voyager Pro',
  gateBody:
    "The second half of your question — researching the data-centre news behind the gap — is Deep Research. It runs across multiple sources and keeps market data, external facts and Voyager's inference apart.",
  gatePoints: [
    { text: 'Minimum plan for this capability:', emphasis: 'Voyager Pro' },
    { text: 'Your question stays in this conversation and re-runs after upgrade' },
  ],
  upgradeCta: 'Upgrade to Pro',
  compareCta: 'Compare plans',
  dismissCta: 'Not now',
};

export const USAGE_LIMIT = {
  badge: 'Allowance reached · Plus plan',
  heading: "You have used today's Voyager allowance",
  body: "Nothing has gone wrong. Your plan's daily capacity is used up and refills on its own.",
  meterLabel: 'Voyager Plus · daily allowance',
  meterState: 'used up',
  /* Omitted entirely when the reset time is not known — a made-up clock is
     worse than no clock. */
  resetsAt: 'Resets in about 6 hours, at 09:00 your time',
  stillWorksLabel: 'Still available now',
  stillWorks: [
    'Every chart, comparison and answer from today stays open',
    'The whole TradingNew portal works as usual',
  ],
  /*
   * Shown only because Pro raises the specific capacity that was hit. When the
   * next plan does not raise it, this block is replaced by "Compare plans" and
   * "Wait for reset" with no upsell at all.
   */
  nextPlanTitle: 'Voyager Pro raises this specific capacity',
  nextPlanBody:
    'More daily capacity, larger research runs and longer agent workflows. Shown here only because it changes the limit you just hit.',
  compareCta: 'Compare plans',
  waitCta: 'Wait for reset',
};

/* ------------------------------------------------------------------ Compare */

export const COMPARE = {
  heading: 'Compare Voyager capabilities',
  body: 'Grouped by what Voyager actually does, not by technical quotas.',
  showLabel: 'Show full comparison',
  hideLabel: 'Hide full comparison',
};
