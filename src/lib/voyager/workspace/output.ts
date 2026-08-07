/**
 * Which tab a result belongs on.
 *
 * The Output panel is four views of one answer, not four places an answer might
 * be written to. Everything here is derived from the plan the contract already
 * validated — no second store, nothing the assistant has to remember to fill in.
 *
 * A tab that is present but empty is worse than an absent one: it reads as a
 * feature that failed rather than one this question did not need. So the tabs
 * are computed per answer, and Summary is the only one always there — an answer
 * with nothing on it is not an answer.
 *
 * No imports, on purpose: the unit harness compiles this file with bare `tsc`,
 * which cannot resolve the `@/` alias.
 */

export type OutputTab = 'summary' | 'chart' | 'pine' | 'sources';

export const TAB_LABEL: Record<OutputTab, string> = {
  summary: 'Summary',
  chart: 'Chart',
  pine: 'Pine Script',
  sources: 'Sources',
};

/** The order they appear in, which is the order the work happens in. */
export const TAB_ORDER: OutputTab[] = ['summary', 'chart', 'pine', 'sources'];

/**
 * Module kinds that belong somewhere other than Summary.
 *
 * Anything not listed is a summary module. A default of "show it" means a new
 * module kind appears somewhere rather than vanishing until this table is
 * updated — the failure that hides work is worse than the one that misfiles it.
 */
const CHART_KINDS = ['chart', 'heatmap'];
const PINE_KINDS = ['pine-editor'];

type MinimalModule = { kind: string };
type MinimalPlan = { modules: MinimalModule[]; sources: unknown[] };

export function tabOf(kind: string): OutputTab {
  if (CHART_KINDS.includes(kind)) return 'chart';
  if (PINE_KINDS.includes(kind)) return 'pine';
  return 'summary';
}

export function modulesFor<T extends MinimalModule>(plan: MinimalPlan, tab: OutputTab): T[] {
  if (tab === 'sources') return [];
  return (plan.modules as T[]).filter((module) => tabOf(module.kind) === tab);
}

/**
 * The tabs this particular answer has anything to put on.
 *
 * Summary is not automatic. A request for an indicator produces one module and
 * it is the code — a Summary tab there is an empty panel wearing a label, and
 * because it sorts first it is the one that opens. That is how "build me an
 * indicator" ends on a blank screen with the answer one click away.
 *
 * It stays as the fallback when nothing else has content, so there is always at
 * least one tab to be on.
 *
 * Sources appears whenever the plan declared any, which is most answers — a
 * claim about somebody's money with no stated source is what the trust labels
 * exist to prevent.
 */
export function tabsFor(plan: MinimalPlan | null): OutputTab[] {
  if (!plan) return ['summary'];

  const has = (tab: OutputTab) => plan.modules.some((module) => tabOf(module.kind) === tab);

  const tabs: OutputTab[] = [];
  if (has('summary')) tabs.push('summary');
  if (has('chart')) tabs.push('chart');
  if (has('pine')) tabs.push('pine');
  if (plan.sources.length > 0) tabs.push('sources');

  return tabs.length && tabs.some((tab) => tab !== 'sources') ? tabs : ['summary', ...tabs];
}

/**
 * Which tab to open on.
 *
 * The most specific thing the answer produced, because that is what was asked
 * for: somebody who said "build me an EMA crossover indicator" wants the code,
 * and opening on a summary of the code is an extra click on the way to it.
 *
 * Sources is never the opening tab. It is the evidence for an answer, not the
 * answer.
 */
export function openingTab(plan: MinimalPlan | null): OutputTab {
  const tabs = tabsFor(plan);
  if (tabs.includes('pine')) return 'pine';
  if (tabs.includes('chart')) return 'chart';
  return 'summary';
}

/**
 * Keeps a chosen tab valid when the answer changes.
 *
 * A follow-up question replaces the plan, and the tab somebody was reading may
 * have nothing on it any more. Staying put would show an empty panel; jumping
 * always would throw away a deliberate choice. So: keep it when it still holds
 * something, otherwise open where the new answer starts.
 */
export function keepOrOpen(plan: MinimalPlan | null, current: OutputTab): OutputTab {
  return tabsFor(plan).includes(current) ? current : openingTab(plan);
}

/**
 * What the Chart tab is allowed to claim.
 *
 * We cannot execute Pine Script. That engine belongs to TradingView and copying
 * it is out of bounds for this project — the brief agrees, and says not to fake
 * execution. So a chart shown next to generated code is a preview of what the
 * script is meant to produce, drawn from our own data, and it says so.
 *
 * This is a product limitation to state on screen, not a detail to leave out.
 */
export const CHART_PREVIEW_NOTICE =
  'No chart is drawn here yet. Voyager decides what to plot — the instrument, the interval and the levels below — and the drawing itself comes from the Supercharts engine, which this tab is not yet joined to. Voyager does not execute Pine either, so when the picture arrives it will show what a script is meant to produce rather than the result of running one.';
