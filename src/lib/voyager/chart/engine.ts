/**
 * What the shared chart engine can paint, as one switch.
 *
 * Supercharts' canvas draws the price pane and the studies that share its
 * scale. A study that needs its own strip of canvas and its own vertical scale
 * — RSI, MACD, a separate volume pane — is drawn by nothing in this product
 * today: the engine skips anything whose pane is not `main`, and Supercharts'
 * own workspace hands it the same list Voyager does.
 *
 * That is a registered dependency on the `supercharts` section, not a decision
 * about Voyager, and this constant exists so it does not calcify into one.
 * Two places would otherwise encode the same fact — which studies a chart may
 * promise, and which requests have to leave for TradingView — and they would
 * drift the moment one of them was updated.
 *
 * **When a pane manager and secondary scales land, flip this to `true`.** RSI
 * and MACD return to the chart, the handoff table stops sending them away, and
 * the planner, the handoff builder and the answer contract do not change at
 * all: they all read this.
 *
 * Import-free, so the unit harness compiles it alone.
 */

export const ENGINE_DRAWS_SEPARATE_PANES = false;

/**
 * The studies that need a pane of their own.
 *
 * Named here rather than inferred from the registry twice. `placement` in
 * `lib/studies/registry.ts` is the source of truth for *what a study is*; this
 * is the source of truth for *whether this product can currently draw one*.
 */
export const PANE_STUDY_NOTE =
  'needs its own pane and its own scale, which the charts here do not have';
