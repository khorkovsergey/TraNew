/**
 * Where a request stops being ours.
 *
 * Voyager is a light research and visualisation layer on purpose. It draws a
 * few chart types honestly and refuses the rest, and the refusal is not an
 * error state — a Renko chart with a session volume profile and a strategy
 * backtest is a reasonable thing to want and a reasonable thing for this
 * product not to do. Handing it to TradingView is the feature.
 *
 * Two rules the shape of this file enforces.
 *
 * **What needs a handoff is written down here, in code, not in a prompt.** A
 * capability list that lives only in system-prompt prose cannot be validated,
 * cannot be tested, and drifts the moment either side changes. Every feature
 * below says where it can be done and why, and the unit suite walks the whole
 * table.
 *
 * **The model never writes a destination.** It picks a feature and a symbol;
 * the URL is assembled here from an allowlisted host and validated parts. A
 * model that could emit its own external link could send somebody anywhere,
 * and "anywhere" wearing a TradingView label is worse than a dead button.
 *
 * The third rule is about honesty rather than safety: **only what the URL
 * genuinely carries is claimed as carried.** TradingView's chart URL takes a
 * symbol and an interval. It does not take a date range, a study list, a
 * drawing, or Pine source. So those are reported as things to set once you
 * arrive, rather than described as transferred.
 *
 * Import-free beyond the engine switch, so the unit harness compiles it alone.
 */

import {
  ENGINE_DRAWS_SEPARATE_PANES,
  MAX_SECONDARY_PANES,
  PANE_STUDY_NOTE,
} from '../chart/engine';

export const TRADINGVIEW_CHART_URL = 'https://www.tradingview.com/chart/';
export const TRADINGVIEW_PINE_URL = 'https://www.tradingview.com/pine-editor/';

/** Everything a chart request can ask for that this table has an opinion about. */
export type ChartFeature =
  /* Drawn here, on the price pane. */
  | 'line'
  | 'area'
  | 'candles'
  | 'comparison'
  | 'normalized_performance'
  | 'drawdown'
  | 'moving_average'
  | 'bollinger_bands'
  /* Drawn here, each in a pane of its own beneath the price. */
  | 'rsi'
  | 'macd'
  | 'volume_pane'
  | 'multi_pane_layout'
  /* Professional chart types and workflows this product does not do. */
  | 'renko'
  | 'kagi'
  | 'point_and_figure'
  | 'range_bars'
  | 'tpo_profile'
  | 'session_volume_profile'
  | 'complex_drawings'
  | 'large_indicator_stack'
  | 'bar_replay'
  | 'strategy_backtest'
  | 'pine_execution';

export type FeatureSupport = {
  /** Where the person can actually get this. */
  where: 'voyager' | 'tradingview';
  /** Said to the person when it is not here. Never "not yet" — see below. */
  reason?: string;
};

/**
 * The whole capability table.
 *
 * `reason` is written as a permanent property of this product rather than as a
 * roadmap. "Not yet supported" invites somebody to wait for something nobody
 * has promised; "this chart has one pane" tells them what to do now.
 */
/**
 * A capability that needs a pane of its own, placed by what the engine can do.
 *
 * The one line that decides this is `ENGINE_DRAWS_SEPARATE_PANES`, and it now
 * reads `true`: the `supercharts` section shipped a pane manager with secondary
 * scales, so these are drawn here and are out of this table. Setting it back
 * moves all four the other way together — no planner change, no handoff change,
 * no answer-contract change. Which was always the point: neither a limitation
 * of today's renderer nor an ability of today's renderer should calcify into a
 * permanent statement about what this product is.
 *
 * The checks are not deleted now that they pass. A feature that stops being
 * drawable — a smaller surface, a reverted engine — has somewhere to be said.
 */
function paneStudy(name: string): FeatureSupport {
  return ENGINE_DRAWS_SEPARATE_PANES
    ? { where: 'voyager' }
    : { where: 'tradingview', reason: `${name} ${PANE_STUDY_NOTE}.` };
}

export const CHART_FEATURES: Record<ChartFeature, FeatureSupport> = {
  line: { where: 'voyager' },
  area: { where: 'voyager' },
  candles: { where: 'voyager' },
  comparison: { where: 'voyager' },
  normalized_performance: { where: 'voyager' },
  drawdown: { where: 'voyager' },
  moving_average: { where: 'voyager' },
  bollinger_bands: { where: 'voyager' },

  /*
   * Computed by the study registry, and now drawn by the chart.
   *
   * An oscillator needs its own strip of canvas and its own vertical scale, and
   * the engine has both: RSI on a fixed 0–100 pane with its 30 and 70 guides,
   * MACD on a symmetric one with the histogram either side of zero, volume on a
   * zero-based one. The price scale is computed from the price alone, so none
   * of them distorts the chart above.
   */
  rsi: paneStudy('RSI'),
  macd: paneStudy('MACD'),
  volume_pane: paneStudy('A separate volume pane'),
  multi_pane_layout: paneStudy('A chart with panes beneath the price'),

  renko: { where: 'tradingview', reason: 'Renko is not one of the chart types here.' },
  kagi: { where: 'tradingview', reason: 'Kagi is not one of the chart types here.' },
  point_and_figure: {
    where: 'tradingview',
    reason: 'Point & Figure is not one of the chart types here.',
  },
  range_bars: { where: 'tradingview', reason: 'Range bars are not one of the chart types here.' },
  tpo_profile: { where: 'tradingview', reason: 'TPO profiles are not built here.' },
  session_volume_profile: {
    where: 'tradingview',
    reason: 'Session volume profile is not built here.',
  },
  complex_drawings: {
    where: 'tradingview',
    reason: 'Drawing tools live on the professional chart, not in an answer.',
  },
  large_indicator_stack: {
    where: 'tradingview',
    /* True of this surface's size rather than of its abilities: the panes work,
       and four of them under a chart the height of a chat message leaves each
       one too short to read. */
    reason: `A chart in an answer holds the price and ${MAX_SECONDARY_PANES} panes beneath it; a stack deeper than that belongs on a full-size chart.`,
  },
  bar_replay: { where: 'tradingview', reason: 'Bar replay is not something this surface does.' },
  strategy_backtest: {
    where: 'tradingview',
    reason:
      'Backtesting runs a strategy over history, which needs TradingView’s engine — this platform does not reimplement it.',
  },
  pine_execution: {
    where: 'tradingview',
    reason:
      'Running Pine needs TradingView’s own engine. Voyager writes and explains Pine; it cannot execute it, here or anywhere.',
  },
};

export const CHART_FEATURE_IDS = Object.keys(CHART_FEATURES) as ChartFeature[];

export function isChartFeature(value: unknown): value is ChartFeature {
  return typeof value === 'string' && (CHART_FEATURE_IDS as string[]).includes(value);
}

export function needsHandoff(feature: ChartFeature): boolean {
  return CHART_FEATURES[feature].where === 'tradingview';
}

/**
 * The features in a request that this product draws itself.
 *
 * Used to stop a handoff that has no reason to happen. Somebody asking for RSI
 * used to be sent to TradingView because the chart could not draw it; now that
 * it can, sending them anyway is the same defect wearing the opposite face —
 * an answer that gives away work the product does, and a person who leaves for
 * something that was already on the page.
 */
export function nativeFeatures(features: ChartFeature[]): ChartFeature[] {
  return features.filter((feature) => !needsHandoff(feature));
}

/**
 * Whether a chart handoff is the wrong answer to this request.
 *
 * True only when features were named and every one of them is drawn here. An
 * empty list is not a mistake — "open Tesla on TradingView" names nothing and
 * is a perfectly good reason to leave — so it goes through.
 */
export function handoffIsUnnecessary(features: ChartFeature[]): boolean {
  return features.length > 0 && features.every((feature) => !needsHandoff(feature));
}

/* --------------------------------------------------------- The destination */

export type HandoffKind = 'chart' | 'pine';

export type TradingViewHandoff = {
  kind: HandoffKind;
  url: string;
  /** State the URL genuinely encodes. */
  carried: { label: string; value: string }[];
  /** Asked for, and not encodable — so it has to be set on arrival. */
  manual: string[];
  /** Why the request is leaving, in the person's terms. */
  because: string[];
};

/** TradingView's interval codes for the intervals this product has. */
const INTERVAL_CODE: Record<string, string> = { '1D': 'D', '1W': 'W', '1M': 'M' };

/**
 * A symbol TradingView will accept, or null.
 *
 * Deliberately strict, and the strictness is the security property: this string
 * ends up in a URL that somebody will click. Letters, digits and the few
 * separators real symbols use, optionally prefixed by an exchange.
 */
export function tradingViewSymbol(symbol: string, exchange?: string): string | null {
  const ticker = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.\-]{0,15}$/.test(ticker)) return null;

  const venue = (exchange ?? '').trim().toUpperCase();
  if (!venue) return ticker;
  if (!/^[A-Z]{2,12}$/.test(venue)) return ticker;

  return `${venue}:${ticker}`;
}

/**
 * The chart handoff.
 *
 * `carried` and `manual` are computed from what the URL can hold, not from what
 * was asked for — so an answer cannot claim it took the studies along. It
 * takes the instrument and the timeframe, and says so.
 */
export function chartHandoff(input: {
  symbol: string;
  exchange?: string;
  interval?: string;
  /** What made this a TradingView request. */
  features?: ChartFeature[];
  /** Anything else asked for that the URL cannot encode. */
  alsoAsked?: string[];
}): TradingViewHandoff | null {
  const symbol = tradingViewSymbol(input.symbol, input.exchange);
  if (!symbol) return null;

  const url = new URL(TRADINGVIEW_CHART_URL);
  url.searchParams.set('symbol', symbol);

  const carried = [{ label: 'Symbol', value: symbol }];

  const code = INTERVAL_CODE[input.interval ?? ''];
  if (code) {
    url.searchParams.set('interval', code);
    carried.push({ label: 'Timeframe', value: input.interval as string });
  }

  const features = (input.features ?? []).filter(needsHandoff);

  /*
   * Everything the chart URL has no field for. Listed rather than dropped: the
   * difference between "your RSI came with you" and "add RSI when you get
   * there" is the difference between a handoff and a disappointment.
   */
  const manual = [
    ...features.map((feature) => featureLabel(feature)),
    ...(input.alsoAsked ?? []),
    'The exact date range — the chart opens on TradingView’s default window.',
  ];

  return {
    kind: 'chart',
    url: url.toString(),
    carried,
    manual,
    because: features.map((feature) => CHART_FEATURES[feature].reason ?? featureLabel(feature)),
  };
}

/**
 * The Pine handoff.
 *
 * The editor's URL takes nothing — there is no field for a script, and there is
 * no version of this that arrives with the code already in it. So the code
 * stays here, on screen, with a copy button, and the handoff says plainly that
 * pasting is the step.
 */
export function pineHandoff(input: { hasCode: boolean }): TradingViewHandoff {
  return {
    kind: 'pine',
    url: TRADINGVIEW_PINE_URL,
    carried: [],
    manual: input.hasCode
      ? ['The script itself — copy it from here and paste it into the editor.']
      : ['The script — write or paste it in the editor.'],
    because: [CHART_FEATURES.pine_execution.reason as string],
  };
}

function featureLabel(feature: ChartFeature): string {
  return feature.replace(/_/g, ' ');
}
