import type { SubscriptionPlanId } from './subscriptions';

/**
 * The capability matrix — nine groups, grouped by what Voyager does rather than
 * by technical quotas.
 *
 * Lifted from the approved handoff rather than retyped from memory, so the
 * shipped table and the reference cannot drift apart on a value nobody would
 * notice. The previous matrix compared platform limits — charts per tab,
 * alerts, historical bars — and is gone with the five-plan lineup it belonged
 * to; this screen sells intelligence, so the rows are intelligence.
 *
 * Values are a tuple in `PLAN_ORDER` rather than an object keyed by plan id. A
 * missing key would render as a blank cell that reads as "no"; a tuple of the
 * wrong length is a type error instead.
 *
 * A cell is one of three things and never anything else: a literal string,
 * `true` for included, or `null` for not available. `null` renders as a dash,
 * never a padlock — a plan not having something is a fact, not a wall.
 *
 * Import-free beyond a type, so the harness compiles it alone.
 */

export type ComparisonValue = string | true | null;

/** Four values, in the order of `PLAN_ORDER`: Free, Plus, Pro, Private. */
export type ComparisonValues = [
  ComparisonValue,
  ComparisonValue,
  ComparisonValue,
  ComparisonValue,
];

export type ComparisonRow = {
  id: string;
  label: string;
  /**
   * A `statement` is true of the whole product and has no per-plan value — the
   * trades line, and the one about Pine not being executed locally. It renders
   * as dashes like any empty row, but a screen reader must not hear "not
   * included in Free" for a sentence that was never a feature.
   */
  kind?: 'statement';
  values: ComparisonValues;
};

export type ComparisonGroup = {
  id: string;
  title: string;
  rows: ComparisonRow[];
};

export const COMPARISON_GROUPS: ComparisonGroup[] = [
  {
    id: 'core',
    title: 'Core AI & page context',
    rows: [
      { id: 'qa', label: 'Market and financial Q&A', values: [true, true, true, true] },
      {
        id: 'page_aware',
        label: 'Page-aware assistance across TradingNew',
        values: [true, true, true, true],
      },
      {
        id: 'portal_knowledge',
        label: 'Portal knowledge and navigation',
        values: [true, true, true, true],
      },
      {
        id: 'asset_resolution',
        label: 'Asset resolution and explanation',
        values: [true, true, true, true],
      },
      {
        id: 'conversation_context',
        label: 'Conversation context',
        values: ['Current chat', 'History', 'Extended', 'Cross-session'],
      },
      {
        id: 'usage_allowance',
        label: 'Usage allowance',
        values: ['Daily allowance', 'Standard', 'High', 'Highest'],
      },
    ],
  },
  {
    id: 'market_data',
    title: 'Market data',
    rows: [
      { id: 'quotes', label: 'Current quotes', values: [true, true, true, true] },
      {
        id: 'historical',
        label: 'Historical market data',
        values: ['Basic lookup', true, true, true],
      },
      {
        id: 'flexible_ranges',
        label: 'Flexible historical date ranges',
        values: [null, true, true, true],
      },
      { id: 'deterministic', label: 'Deterministic metrics', values: [null, true, true, true] },
    ],
  },
  {
    id: 'charts',
    title: 'Charts & studies',
    rows: [
      { id: 'line_area', label: 'Line and area charts', values: [true, true, true, true] },
      {
        id: 'candles',
        label: 'Candle, performance and drawdown charts',
        values: [null, true, true, true],
      },
      {
        id: 'studies',
        label: 'Moving averages, Bollinger Bands, RSI, MACD, volume',
        values: [null, true, true, true],
      },
      {
        id: 'follow_up_edits',
        label: 'Follow-up edits on a retained chart',
        values: [null, true, true, true],
      },
    ],
  },
  {
    id: 'comparison',
    title: 'Comparison & metrics',
    rows: [
      {
        id: 'normalized',
        label: 'Normalized multi-asset comparison',
        values: [null, true, true, true],
      },
      { id: 'assets_per_comparison', label: 'Assets per comparison', values: [null, '2–3', '2–5', '2–5'] },
      {
        id: 'metrics',
        label: 'Return, volatility, drawdown, correlation',
        values: [null, true, true, true],
      },
    ],
  },
  {
    id: 'research',
    title: 'Research',
    rows: [
      {
        id: 'web_research',
        label: 'Current-event / web research',
        values: [null, 'Standard', 'Large', 'Largest'],
      },
      { id: 'multi_source', label: 'Multi-source synthesis', values: [null, null, true, true] },
      {
        id: 'provenance',
        label: 'Data, external sources and inference kept apart',
        values: [null, null, true, true],
      },
    ],
  },
  {
    id: 'agent',
    title: 'Agent workflows',
    rows: [
      {
        id: 'bounded_tools',
        label: 'Bounded multi-step tool use',
        values: [null, 'Short runs', true, true],
      },
      {
        id: 'one_request',
        label: 'Data, metrics, charts and research in one request',
        values: [null, null, true, true],
      },
      { id: 'long_runs', label: 'Longer research runs', values: [null, null, null, true] },
    ],
  },
  {
    id: 'investment',
    title: 'Investment analysis',
    rows: [
      {
        id: 'structured',
        label: 'Structured, evidence-based assessment',
        values: [null, null, true, true],
      },
      { id: 'bull_bear', label: 'Risks and bull / bear framing', values: [null, null, true, true] },
      {
        id: 'fundamental',
        label: 'Grounded fundamental analysis where data exists',
        values: [null, null, true, true],
      },
      {
        id: 'no_execution',
        label: 'Voyager supports decisions — it never executes trades',
        kind: 'statement',
        values: [null, null, null, null],
      },
    ],
  },
  {
    id: 'pine',
    title: 'Pine & TradingView',
    rows: [
      {
        id: 'pine_generate',
        label: 'Generate and explain Pine Script',
        values: [null, null, true, true],
      },
      {
        id: 'pine_debug',
        label: 'Modify, review and debug supported Pine issues',
        values: [null, null, true, true],
      },
      {
        id: 'tv_continue',
        label: 'Continue a professional workflow in TradingView',
        values: [true, true, true, true],
      },
      {
        id: 'tv_addon',
        label: 'Add a paid TradingView plan, chosen separately',
        values: [true, true, true, true],
      },
      {
        id: 'pine_not_executed',
        label: 'Pine is not executed or backtested inside Voyager',
        kind: 'statement',
        values: [null, null, null, null],
      },
    ],
  },
  {
    id: 'private',
    title: 'Private intelligence',
    rows: [
      {
        id: 'persistent_context',
        label: 'Persistent private research context',
        values: [null, null, null, true],
      },
      {
        id: 'private_documents',
        label: 'User-controlled private knowledge and documents',
        values: [null, null, null, true],
      },
      {
        id: 'retained_artifacts',
        label: 'Retained research artifacts across sessions',
        values: [null, null, null, true],
      },
      {
        id: 'memory_controls',
        label: 'Review, disable and delete what is remembered',
        values: [null, null, null, true],
      },
    ],
  },
];

/** What a screen reader hears in place of a tick or a dash. */
export function cellLabel(row: ComparisonRow, index: number, planName: string): string {
  if (row.kind === 'statement') return 'Applies to every plan';

  const value = row.values[index];
  if (value === true) return `Included in ${planName}`;
  if (value === null) return `Not included in ${planName}`;
  return `${value} in ${planName}`;
}

export type { SubscriptionPlanId };
