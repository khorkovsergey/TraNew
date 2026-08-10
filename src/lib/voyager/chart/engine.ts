/**
 * What the shared chart engine can paint, as one switch.
 *
 * Supercharts' canvas now has a pane manager. A study that needs its own strip
 * of canvas and its own vertical scale — RSI, MACD, a volume histogram — gets
 * one: `collectPaneRequests` turns the study list into pane requests,
 * `buildPaneLayout` tiles them under the price, and each pane carries a scale of
 * its own while sharing the time axis. The price pane's scale is computed from
 * the price alone, so switching three oscillators on no longer moves it.
 *
 * That was a registered dependency on the `supercharts` section rather than a
 * decision about Voyager, and this constant exists so neither state calcifies
 * into one. Two places would otherwise encode the same fact — which studies a
 * chart may promise, and which requests have to leave for TradingView — and
 * they would drift the moment one of them was updated.
 *
 * **It is still a switch, and it still runs both ways.** Setting it back to
 * `false` returns RSI, MACD and the volume pane to the handoff table and takes
 * them out of the chart, without the planner, the handoff builder or the answer
 * contract changing at all: they all read this. A renderer that regressed, or a
 * surface too small for a second scale, is one line rather than an
 * architecture.
 *
 * Import-free, so the unit harness compiles it alone.
 */

export const ENGINE_DRAWS_SEPARATE_PANES = true;

/**
 * The studies that need a pane of their own.
 *
 * Kept for the `false` branch: it is what a person is told when this product
 * cannot draw one. Named here rather than inferred from the registry twice —
 * `placement` in `lib/studies/registry.ts` is the source of truth for *what a
 * study is*, and this file is the source of truth for *whether this product can
 * currently draw one*.
 */
export const PANE_STUDY_NOTE =
  'needs its own pane and its own scale, which the charts here do not have';

/**
 * How many panes may sit under the price on a chart inside an answer.
 *
 * The engine itself has no limit — `buildPaneLayout` scales the secondaries down
 * together past 60% of the plot rather than dropping any. That is right for the
 * full workspace, where the chart is the page. It is wrong here: a chart in a
 * chat message is a few hundred pixels tall, and the fourth pane makes every
 * pane too short to read rather than making the chart wrong.
 *
 * So this is a Voyager limit about a Voyager surface, honestly reported, and it
 * is what `large_indicator_stack` means in the handoff table.
 */
export const MAX_SECONDARY_PANES = 3;
