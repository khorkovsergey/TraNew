import type { SubscriptionPlanId } from './subscriptions';

/**
 * The comparison matrix — 52 rows across nine groups.
 *
 * Lifted from the design handoff rather than retyped, so the shipped table and
 * the reference cannot drift apart on a value nobody would notice.
 *
 * Values are a tuple in plan order rather than an object keyed by plan id. A
 * row with a missing key would render as a blank cell that reads as "no" — a
 * tuple of the wrong length is a type error instead.
 *
 * A cell is one of three things and never anything else: a literal string,
 * `true` for included, or `null` for not available. `null` renders as a dash,
 * never a padlock — a plan not having something is a fact, not a wall.
 *
 * Import-free beyond a type, so the harness compiles it alone.
 */

export type ComparisonValue = string | true | null;

/** Five values, in the order of `PLAN_ORDER`. */
export type ComparisonValues = [
  ComparisonValue,
  ComparisonValue,
  ComparisonValue,
  ComparisonValue,
  ComparisonValue,
];

export type ComparisonFeature = {
  id: string;
  label: string;
  /** Shown under the name where the label alone is not enough. */
  description?: string;
  values: ComparisonValues;
};

export type ComparisonCategory = {
  id: string;
  label: string;
  /** Voyager AI and Private intelligence open on arrival; the rest are folded. */
  openByDefault?: boolean;
  rows: ComparisonFeature[];
};

export const COMPARISON_CATEGORIES: ComparisonCategory[] = [
  {
    id: 'voyager',
    openByDefault: true,
    label: 'Voyager AI',
    rows: [
      { id: 'ai_level', label: 'AI level', values: ['Lite', 'Analyst', 'Research', 'Advanced', 'Private Intelligence'] },
      { id: 'ai_usage', label: 'AI usage', values: ['Limited', 'Extended', 'High', 'Very high', 'Unlimited under fair use'], description: 'Fair use covers normal individual usage.' },
      { id: 'contextual_chart_explanation', label: 'Contextual chart explanation', values: [true, true, true, true, true] },
      { id: 'symbol_and_market_page_questions', label: 'Symbol and market-page questions', values: [true, true, true, true, true] },
      { id: 'asset_comparison', label: 'Asset comparison', values: ['Basic', 'Up to 5 assets', 'Advanced', 'Cross-market', 'Private-context analysis'] },
      { id: 'watchlist_summaries', label: 'Watchlist summaries', values: [null, true, true, true, true] },
      { id: 'structured_research_reports', label: 'Structured research reports', values: [null, null, true, 'Advanced', 'Autonomous'] },
      { id: 'deep_research', label: 'Deep Research', values: [null, null, 'Single asset', 'Multi-asset and cross-market', 'Autonomous and unlimited under fair use'] },
      { id: 'pine_script_assistance', label: 'Pine Script assistance', values: ['Explain', 'Explain and debug', 'Create indicators', 'Create advanced strategies', 'Personalized development'] },
      { id: 'portfolio_analysis', label: 'Portfolio analysis', values: [null, null, 'Basic', 'Advanced', 'Full private wealth context'] },
      { id: 'context_retention', label: 'Context retention', values: ['Current conversation', 'Up to 7 days', 'Up to 30 days', 'Up to 90 days', 'Active subscription period'] },
      { id: 'ai_alerts', label: 'AI alerts', values: [null, null, 'Basic', 'Advanced', 'Proactive private intelligence'] },
    ],
  },
  {
    id: 'charts',
    label: 'Charts and analysis',
    rows: [
      { id: 'charts_per_tab', label: 'Charts per tab', values: ['2', '4', '8', '16', '16'] },
      { id: 'indicators_per_chart', label: 'Indicators per chart', values: ['5', '10', '25', '50', '50'] },
      { id: 'historical_bars', label: 'Historical bars', values: ['10,000', '10,000', '20,000', '40,000', '40,000'] },
      { id: 'parallel_chart_connections', label: 'Parallel chart connections', values: ['10', '20', '50', '200', '200'] },
      { id: 'second_based_intervals', label: 'Second-based intervals', values: [null, null, true, true, true] },
      { id: 'tick_based_intervals', label: 'Tick-based intervals', values: [null, null, null, true, true] },
      { id: 'advanced_volume_tools', label: 'Advanced volume tools', values: [null, null, true, true, true] },
    ],
  },
  {
    id: 'alerts',
    label: 'Alerts and monitoring',
    rows: [
      { id: 'price_alerts', label: 'Price alerts', values: ['20', '100', '400', '1,000', '1,000'] },
      { id: 'technical_alerts', label: 'Technical alerts', values: ['20', '100', '400', '1,000', '1,000'] },
      { id: 'watchlist_alerts', label: 'Watchlist alerts', values: [null, null, '2', '15', '15'] },
      { id: 'multi_condition_alerts', label: 'Multi-condition alerts', values: [null, true, true, true, true] },
    ],
  },
  {
    id: 'data',
    label: 'Data and exports',
    rows: [
      { id: 'chart_data_export', label: 'Chart data export', values: [null, true, true, true, true] },
      { id: 'custom_formulas', label: 'Custom formulas', values: [null, true, true, true, true] },
      { id: 'professional_market_data', label: 'Professional market data', values: [null, null, null, 'Available separately', 'Available separately'] },
      { id: 'ad_free_experience', label: 'Ad-free experience', values: [true, true, true, true, true] },
    ],
  },
  {
    id: 'pine',
    label: 'Pine Script and strategies',
    rows: [
      { id: 'explain_existing_scripts', label: 'Explain existing scripts', values: [true, true, true, true, true] },
      { id: 'debug_scripts', label: 'Debug scripts', values: [null, true, true, true, true] },
      { id: 'create_indicators', label: 'Create indicators', values: [null, null, true, true, true] },
      { id: 'advanced_strategies', label: 'Advanced strategies', values: [null, null, null, true, true] },
      { id: 'personalized_development', label: 'Personalized development', values: [null, null, null, null, true] },
    ],
  },
  {
    id: 'portfolio',
    label: 'Portfolio and Wealth',
    rows: [
      { id: 'portfolio_analysis_depth', label: 'Portfolio analysis depth', values: [null, null, 'Basic', 'Advanced', 'Full private context'] },
      { id: 'portfolio_stress_testing', label: 'Portfolio stress testing', values: [null, null, null, true, true] },
      { id: 'macroeconomic_scenario_analysis', label: 'Macroeconomic scenario analysis', values: [null, null, null, true, true] },
      { id: 'wealth_hub_context', label: 'Wealth Hub context', values: [null, null, null, null, 'Full'] },
    ],
  },
  {
    id: 'memory',
    label: 'Memory and personalization',
    rows: [
      { id: 'working_context_window', label: 'Working context window', values: ['Current conversation', '7 days', '30 days', '90 days', 'Active subscription'] },
      { id: 'daily_and_weekly_briefings', label: 'Daily and weekly briefings', values: [null, null, null, true, true] },
      { id: 'cross_session_personalization', label: 'Cross-session personalization', values: [null, null, 'Partial', 'Extended', 'Full private context'] },
    ],
  },
  {
    id: 'private',
    openByDefault: true,
    label: 'Private intelligence',
    rows: [
      { id: 'persistent_private_context', label: 'Persistent private context', values: [null, null, null, null, true] },
      { id: 'private_financial_vault', label: 'Private Financial Vault', values: [null, null, null, null, true], description: 'Approved documents used as private Voyager context.' },
      { id: 'personal_knowledge_graph', label: 'Personal Knowledge Graph', values: [null, null, null, null, true] },
      { id: 'obsidian_style_connected_notes', label: 'Obsidian-style connected notes', values: [null, null, null, null, true] },
      { id: 'portfolio_digital_twin', label: 'Portfolio Digital Twin', values: [null, null, null, null, true] },
      { id: 'autonomous_deep_research', label: 'Autonomous Deep Research', values: [null, null, null, 'Advanced workflows', 'Full autonomous research'] },
      { id: 'proactive_personal_intelligence', label: 'Proactive personal intelligence', values: [null, null, null, null, true] },
      { id: 'full_wealth_hub_context', label: 'Full Wealth Hub context', values: [null, null, null, null, true] },
      { id: 'advanced_memory_controls', label: 'Advanced memory controls', values: [null, null, null, null, true] },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    rows: [
      { id: 'support_level', label: 'Support level', values: ['Standard', 'Standard', 'Standard', 'Priority', 'Private priority'] },
    ],
  },
];

/** Rows where every plan says the same thing, for "show differences only". */
export function isSameEverywhere(row: ComparisonFeature): boolean {
  const [first] = row.values;
  return row.values.every((value) => value === first);
}

/** What a screen reader hears in place of a tick or a dash. */
export function cellLabel(
  value: ComparisonValue,
  planName: string
): string {
  if (value === true) return `Included in ${planName}`;
  if (value === null) return `Not included in ${planName}`;
  return `${value} in ${planName}`;
}

export type { SubscriptionPlanId };
