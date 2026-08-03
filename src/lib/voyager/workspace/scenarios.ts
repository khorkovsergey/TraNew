import type { VoyagerPlan } from './contract';

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

  if (/\bcompare\b|\bversus\b|\bvs\b/.test(q)) return 'compare';
  if (/\bchart\b|\brsi\b|\bsupport\b/.test(q)) return 'chart';
  if (/\bscreen|\bfind\b.*\bcompan/.test(q)) return 'screen';
  if (/\bportfolio\b|\brisk/.test(q)) return 'portfolio';
  if (/\bmonitor\b|\balert\b/.test(q)) return 'monitor';
  if (/\bpine\b|\bscript\b|\bindicator\b/.test(q)) return 'pine';
  return 'market';
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

const SCENARIOS: Record<string, unknown> = { market: MARKET };

/** The raw response for a question, or null where the scenario is not written yet. */
export function responseFor(question: string): unknown | null {
  return SCENARIOS[scenarioFor(question)] ?? null;
}

export type { VoyagerPlan };
