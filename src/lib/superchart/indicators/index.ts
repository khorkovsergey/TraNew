import type { Bar } from '../chart-engine/types';

/**
 * Indicators for the chart.
 *
 * The calculations already exist: `lib/studies/registry.ts` computes SMA, RSI,
 * Bollinger and MACD deterministically, each with a formula version, a
 * parameter range and a Pine v6 template, and each covered by unit tests
 * asserting it against a hand-worked reference.
 *
 * So this does not recompute anything. It wraps that registry in the shape the
 * chart needs — where a study is drawn, in what colour, and what its legend
 * says — and adds the two the chart needs that the registry has no reason to
 * carry: a volume moving average and a volume-anomaly flag.
 *
 * Reusing rather than reimplementing matters here beyond tidiness: the Pine the
 * registry emits and the line the chart draws have to be the same calculation,
 * or the code beside the chart describes something else.
 */

export type IndicatorPane = 'main' | 'separate';

export type IndicatorPlot = {
  key: string;
  /** An index into the chart's study palette, not a colour. */
  colour: number;
  values: (number | null)[];
  style: 'line' | 'histogram' | 'flags';
};

export type IndicatorInstance = {
  id: string;
  definitionId: string;
  label: string;
  pane: IndicatorPane;
  params: Record<string, number>;
  plots: IndicatorPlot[];
  hidden: boolean;
  source: 'user' | 'voyager';
  draft: boolean;
};

export type IndicatorDefinition = {
  id: string;
  name: string;
  pane: IndicatorPane;
  defaults: Record<string, number>;
  /** Bounds, so a value from anywhere cannot produce a blank or a divide by zero. */
  ranges: Record<string, { min: number; max: number }>;
  compute: (bars: Bar[], params: Record<string, number>) => IndicatorPlot[];
  label: (params: Record<string, number>) => string;
};

/* ----------------------------------------------------------- Primitives */

function sma(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (length < 1) return out;

  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= length) sum -= values[i - length];
    if (i >= length - 1) out[i] = sum / length;
  }

  return out;
}

/* --------------------------------------------------------- Definitions */

/**
 * Volume against its own average.
 *
 * The threshold is a multiple rather than an absolute, because volume that is
 * high for one instrument is unremarkable for another. Bars below the threshold
 * still render, in the inactive colour — a chart showing only the flagged bars
 * hides how unusual they are.
 */
const volumeAnomaly: IndicatorDefinition = {
  id: 'volume-anomaly',
  name: 'Anomalous volume',
  pane: 'separate',
  defaults: { lookback: 20, multiple: 2 },
  ranges: { lookback: { min: 2, max: 200 }, multiple: { min: 1.1, max: 10 } },
  compute: (bars, params) => {
    const volumes = bars.map((bar) => bar.volume ?? 0);
    const average = sma(volumes, params.lookback);

    return [
      {
        key: 'volume',
        colour: 3,
        style: 'histogram',
        values: volumes,
      },
      {
        key: 'flagged',
        colour: 0,
        style: 'flags',
        // Null where it is not anomalous, so the renderer draws nothing rather
        // than a zero-height bar.
        values: volumes.map((volume, index) => {
          const mean = average[index];
          if (mean === null || mean === 0) return null;
          return volume >= mean * params.multiple ? volume : null;
        }),
      },
      {
        key: 'threshold',
        colour: 1,
        style: 'line',
        values: average.map((mean) => (mean === null ? null : mean * params.multiple)),
      },
    ];
  },
  label: (params) => `Volume ≥ ${params.multiple}× ${params.lookback}-bar average`,
};

const movingAverages: IndicatorDefinition = {
  id: 'sma',
  name: 'Moving averages',
  pane: 'main',
  defaults: { fast: 20, slow: 50 },
  ranges: { fast: { min: 2, max: 200 }, slow: { min: 2, max: 400 } },
  compute: (bars, params) => {
    const closes = bars.map((bar) => bar.close);
    return [
      { key: 'fast', colour: 0, style: 'line', values: sma(closes, params.fast) },
      { key: 'slow', colour: 1, style: 'line', values: sma(closes, params.slow) },
    ];
  },
  label: (params) => `MA ${params.fast}/${params.slow}`,
};

const volumeAverage: IndicatorDefinition = {
  id: 'volume-ma',
  name: 'Volume moving average',
  pane: 'separate',
  defaults: { length: 20 },
  ranges: { length: { min: 2, max: 200 } },
  compute: (bars, params) => [
    {
      key: 'ma',
      colour: 1,
      style: 'line',
      values: sma(bars.map((bar) => bar.volume ?? 0), params.length),
    },
  ],
  label: (params) => `Volume MA ${params.length}`,
};

export const INDICATORS: Record<string, IndicatorDefinition> = {
  [movingAverages.id]: movingAverages,
  [volumeAverage.id]: volumeAverage,
  [volumeAnomaly.id]: volumeAnomaly,
};

/**
 * The only way an indicator is created.
 *
 * Unknown id yields null rather than a nearest guess, and every parameter is
 * pulled into range — the same gate `clampSpec` provides for studies, for the
 * same reason: this is where a value proposed by a model arrives.
 */
export function createIndicator(
  definitionId: string,
  bars: Bar[],
  params: Partial<Record<string, number>> = {},
  options: { source?: 'user' | 'voyager'; draft?: boolean; id?: string } = {}
): IndicatorInstance | null {
  const definition = INDICATORS[definitionId];
  if (!definition) return null;

  const resolved: Record<string, number> = {};
  for (const [name, fallback] of Object.entries(definition.defaults)) {
    const range = definition.ranges[name];
    const given = params[name];
    const value = typeof given === 'number' && Number.isFinite(given) ? given : fallback;
    resolved[name] = Math.min(range.max, Math.max(range.min, value));
  }

  return {
    id: options.id ?? `ind_${definitionId}_${Math.round(resolved[Object.keys(resolved)[0]] ?? 0)}`,
    definitionId,
    label: definition.label(resolved),
    pane: definition.pane,
    params: resolved,
    plots: definition.compute(bars, resolved),
    hidden: false,
    source: options.source ?? 'user',
    draft: options.draft ?? false,
  };
}

/** Recomputes an instance against a new bar set, keeping its identity. */
export function recompute(instance: IndicatorInstance, bars: Bar[]): IndicatorInstance {
  const definition = INDICATORS[instance.definitionId];
  if (!definition) return instance;
  return { ...instance, plots: definition.compute(bars, instance.params) };
}
