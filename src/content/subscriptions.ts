/**
 * The five plans, and the single place their prices live.
 *
 * Prices are demo values and change often, so they are here and nowhere else —
 * a price typed into a card is a price that will disagree with the comparison
 * table by the end of the first edit.
 *
 * The annual saving is **computed** rather than stored. Storing it invites the
 * arithmetic to go stale silently: somebody edits a monthly price, the saving
 * line keeps its old number, and the page quietly lies about money.
 *
 * Import-free, so the harness compiles it alone.
 */

export type SubscriptionPlanId =
  | 'essential'
  | 'plus'
  | 'premium'
  | 'ultimate'
  | 'voyager_private';

/** The order the cards, the columns and the comparison tuples all follow. */
export const PLAN_ORDER: SubscriptionPlanId[] = [
  'essential',
  'plus',
  'premium',
  'ultimate',
  'voyager_private',
];

export type BillingPeriod = 'monthly' | 'annual';

export type SubscriptionPrice = {
  monthly: number;
  /** What a year works out at per month. Displayed with "billed annually". */
  annualMonthlyEquivalent: number;
  currency: 'EUR';
};

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: string;
  badge?: string;
  tagline: string;
  /** The verb this plan gives Voyager: Explain → Analyze → Create → Automate → Delegate. */
  progression: string;
  voyagerTier: string;
  voyagerDescription: string;
  pricing: SubscriptionPrice;
  aiHighlights: string[];
  platformHighlights: string[];
  /** The recommended mainstream plan. Emphasis, not exclusivity. */
  featured?: boolean;
  /** The private tier, which is a different kind of product rather than a bigger one. */
  privateTier?: boolean;
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'essential',
    name: 'Essential',
    tagline: 'Understand the market',
    progression: 'Explain',
    voyagerTier: 'Voyager AI Lite',
    voyagerDescription: 'Contextual AI explanations for charts, symbols and market pages.',
    pricing: { monthly: 15.95, annualMonthlyEquivalent: 12.95, currency: 'EUR' },
    aiHighlights: [
      'Explain the current chart',
      'Explain indicators and financial terms',
      'Answer questions about the current symbol',
      'Summarize important asset news',
      'Explain existing Pine Script',
      'Context retained during the current conversation',
    ],
    platformHighlights: [
      '2 charts per tab',
      '5 indicators per chart',
      '10,000 historical bars',
      '20 price alerts',
      '20 technical alerts',
      'Multiple watchlists',
      'Ad-free experience',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    tagline: 'Compare assets and discover ideas',
    progression: 'Analyze',
    voyagerTier: 'Voyager AI Analyst',
    voyagerDescription:
      'Compare markets, summarize watchlists and discover instruments using natural language.',
    pricing: { monthly: 35.95, annualMonthlyEquivalent: 29.95, currency: 'EUR' },
    aiHighlights: [
      'Everything in Essential',
      'Compare up to 5 instruments',
      'Create watchlist summaries',
      'Discover assets from natural-language criteria',
      'Compare valuation, momentum and risk',
      'Debug simple Pine Script errors',
      'Research context retained for up to 7 days',
    ],
    platformHighlights: [
      '4 charts per tab',
      '10 indicators per chart',
      '100 price alerts',
      '100 technical alerts',
      'Chart data export',
      'Custom formulas',
      'Multi-condition alerts',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    badge: 'Most popular',
    tagline: 'Build research and strategies',
    progression: 'Create',
    voyagerTier: 'Voyager AI Research',
    voyagerDescription:
      'Create structured research, investment theses and custom analytical tools.',
    pricing: { monthly: 71.95, annualMonthlyEquivalent: 59.95, currency: 'EUR' },
    featured: true,
    aiHighlights: [
      'Everything in Plus',
      'Structured asset research reports',
      'Fundamental, technical and news analysis',
      'Bull and bear investment cases',
      'Basic portfolio analysis',
      'Create and edit Pine Script indicators',
      'Research context retained for up to 30 days',
    ],
    platformHighlights: [
      '8 charts per tab',
      '25 indicators per chart',
      '20,000 historical bars',
      '400 price alerts',
      '400 technical alerts',
      '2 watchlist alerts',
      'Second-based intervals',
      'Advanced volume tools',
    ],
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    badge: 'Professional',
    tagline: 'Automate professional workflows',
    progression: 'Automate',
    voyagerTier: 'Voyager AI Advanced',
    voyagerDescription:
      'Run sophisticated cross-market analysis and advanced analytical workflows.',
    pricing: { monthly: 239.95, annualMonthlyEquivalent: 199.95, currency: 'EUR' },
    aiHighlights: [
      'Everything in Premium',
      'Cross-market analysis',
      'Multi-step analytical workflows',
      'Advanced Pine Script strategies',
      'Portfolio stress testing',
      'Macroeconomic scenario analysis',
      'Working context retained for up to 90 days',
    ],
    platformHighlights: [
      '16 charts per tab',
      '50 indicators per chart',
      '40,000 historical bars',
      '1,000 price alerts',
      '1,000 technical alerts',
      '15 watchlist alerts',
      'Tick-based intervals',
      'Priority support',
    ],
  },
  {
    id: 'voyager_private',
    name: 'Voyager Private',
    badge: 'Private AI',
    tagline: 'Your persistent private intelligence for markets, investing and wealth.',
    progression: 'Delegate',
    voyagerTier: 'Voyager Private Intelligence',
    voyagerDescription:
      'Delegate complex analysis to an AI that understands your approved financial context and remembers it throughout your active subscription.',
    pricing: { monthly: 399.95, annualMonthlyEquivalent: 299.95, currency: 'EUR' },
    privateTier: true,
    /*
     * The platform limits are Ultimate's, deliberately. Inflating chart counts
     * to make the top plan look bigger would be selling the wrong thing: what
     * this tier adds is private context, not more windows.
     */
    aiHighlights: [
      'Unlimited Voyager AI',
      'Persistent private context',
      'Autonomous Deep Research',
      'Private Financial Vault',
      'Personal Knowledge Graph',
      'Portfolio Digital Twin',
      'Proactive Private Intelligence',
    ],
    platformHighlights: [
      'Everything in Ultimate',
      'Full Wealth Hub context',
      'Personalized Pine Script assistance',
      'Private-context portfolio analysis',
      'Advanced privacy controls',
    ],
  },
];

export const PLANS_BY_ID: Record<SubscriptionPlanId, SubscriptionPlan> = Object.fromEntries(
  SUBSCRIPTION_PLANS.map((plan) => [plan.id, plan])
) as Record<SubscriptionPlanId, SubscriptionPlan>;

/* ------------------------------------------------------------------ Money */

/** What a plan costs per month on the chosen billing period. */
export function monthlyPrice(plan: SubscriptionPlan, period: BillingPeriod): number {
  return period === 'annual' ? plan.pricing.annualMonthlyEquivalent : plan.pricing.monthly;
}

/**
 * What paying annually saves over a year.
 *
 * Computed from the two prices rather than stored, so editing a price cannot
 * leave a saving line quietly claiming the old number.
 */
export function annualSaving(plan: SubscriptionPlan): number {
  return Math.round((plan.pricing.monthly - plan.pricing.annualMonthlyEquivalent) * 12);
}

/** Euros, always with two decimals — a price that drops a zero looks like a typo. */
export function formatPrice(value: number): string {
  return `€${value.toFixed(2)}`;
}

/** The headline saving on the toggle, from the plans rather than typed in. */
export function bestSavingPercent(): number {
  const percents = SUBSCRIPTION_PLANS.map(
    (plan) =>
      ((plan.pricing.monthly - plan.pricing.annualMonthlyEquivalent) / plan.pricing.monthly) * 100
  );

  // Rounded down: "save up to 20%" must never overstate what any plan gives.
  return Math.floor(Math.max(...percents));
}

/**
 * The seven capabilities that make the private tier a different product.
 *
 * Described here and built nowhere: this release presents them as plan
 * contents, and the block that shows them says so rather than linking to pages
 * that do not exist.
 */
export const PRIVATE_CAPABILITIES: Array<{ title: string; body: string }> = [
  {
    title: 'Unlimited Voyager AI',
    body: 'Run deep analysis and complex research without standard conversational limits, subject to a transparent fair-use policy.',
  },
  {
    title: 'Persistent private context',
    body: 'Voyager retains the approved context throughout the active subscription instead of starting from zero in every session.',
  },
  {
    title: 'Autonomous Deep Research',
    body: 'Voyager can structure complex research into multiple analytical stages and produce a sourced final report.',
  },
  {
    title: 'Private Financial Vault',
    body: 'Use approved reports, statements, spreadsheets and research documents as private Voyager context.',
  },
  {
    title: 'Personal Knowledge Graph',
    body: 'Turn approved goals, assets, research, notes and decisions into a connected visual data graph, with Obsidian-style linked notes.',
  },
  {
    title: 'Portfolio Digital Twin',
    body: 'Model how markets, currencies, rates and liquidity scenarios could affect your financial structure.',
  },
  {
    title: 'Proactive Private Intelligence',
    body: 'Surface important risks, contradictions, portfolio changes and outdated assumptions based on approved private context.',
  },
];

export const FAIR_USE_NOTE =
  'Unlimited for normal individual usage. Automated abuse and excessive machine-generated traffic may be restricted under the fair-use policy.';
