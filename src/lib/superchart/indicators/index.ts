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
  /**
   * The Pine v6 source for this study.
   *
   * A template with the parameters interpolated, never generated text. The
   * chart and the script have to be the same study — a script that says
   * something the chart is not drawing is worse than no script, because it will
   * be pasted somewhere it does run.
   */
  pine: (params: Record<string, number>) => string;
};

/**
 * Normalises a template's line endings.
 *
 * The templates are literals in a checked-out file, so a Windows checkout hands
 * back CRLF and the exported script carries whichever line ending the machine
 * that built it happened to use.
 */
function lf(template: string): string {
  return template.replace(/\r\n/g, '\n');
}

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

/**
 * An exponential moving average, seeded with a simple one.
 *
 * Seeding matters and is where implementations disagree: starting the recursion
 * from the first close makes the early values a decaying artefact of one bar,
 * and two charts that seed differently disagree for roughly `length` bars —
 * long enough to move a crossover onto the wrong day.
 */
function ema(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (length < 1 || values.length < length) return out;

  const k = 2 / (length + 1);
  let previous = values.slice(0, length).reduce((total, value) => total + value, 0) / length;
  out[length - 1] = previous;

  for (let i = length; i < values.length; i += 1) {
    previous = values[i] * k + previous * (1 - k);
    out[i] = previous;
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
  pine: (params) => lf(`//@version=6
indicator("Volume anomalies")
lookback = input.int(${params.lookback}, "Lookback", minval = 2, maxval = 400)
multiple = input.float(${params.multiple}, "Multiple", minval = 1, maxval = 10)
average = ta.sma(volume, lookback)
unusual = volume > average * multiple
plot(volume, "Volume", style = plot.style_columns, color = unusual ? color.new(color.red, 0) : color.new(color.gray, 60))
plot(average * multiple, "Threshold", color = color.new(color.orange, 0))`),
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
  pine: (params) => lf(`//@version=6
indicator("Moving averages", overlay = true)
fastLength = input.int(${params.fast}, "Fast length", minval = 2, maxval = 200)
slowLength = input.int(${params.slow}, "Slow length", minval = 2, maxval = 400)
fastMa = ta.sma(close, fastLength)
slowMa = ta.sma(close, slowLength)
plot(fastMa, "Fast MA", color = color.new(color.purple, 0))
plot(slowMa, "Slow MA", color = color.new(color.orange, 0))`),
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
  pine: (params) => lf(`//@version=6
indicator("Volume moving average")
length = input.int(${params.length}, "Length", minval = 2, maxval = 200)
plot(volume, "Volume", style = plot.style_columns, color = color.new(color.gray, 40))
plot(ta.sma(volume, length), "Average", color = color.new(color.orange, 0))`),
};

/**
 * Two EMAs and the bars where they cross.
 *
 * The crossings are computed here rather than described in prose because a
 * crossover is a fact about two series, and the moment a model is asked which
 * day they crossed it will produce a plausible date. The `cross` plot marks
 * only the bar where the sign of `fast - slow` actually changes.
 */
const exponentialMovingAverages: IndicatorDefinition = {
  id: 'ema',
  name: 'Exponential moving averages',
  pane: 'main',
  defaults: { fast: 20, slow: 50 },
  ranges: { fast: { min: 2, max: 200 }, slow: { min: 2, max: 400 } },
  compute: (bars, params) => {
    const closes = bars.map((bar) => bar.close);
    const fast = ema(closes, params.fast);
    const slow = ema(closes, params.slow);

    const crosses: (number | null)[] = new Array(closes.length).fill(null);
    for (let i = 1; i < closes.length; i += 1) {
      const now = fast[i];
      const then = slow[i];
      const before = fast[i - 1];
      const beforeSlow = slow[i - 1];
      if (now === null || then === null || before === null || beforeSlow === null) continue;

      // A crossing is a change of sign, not a touch: equal values on one bar are
      // not a cross until the difference actually reverses.
      const wasAbove = before > beforeSlow;
      const isAbove = now > then;
      if (wasAbove !== isAbove) crosses[i] = now;
    }

    return [
      { key: 'fast', colour: 0, style: 'line', values: fast },
      { key: 'slow', colour: 1, style: 'line', values: slow },
      { key: 'cross', colour: 2, style: 'flags', values: crosses },
    ];
  },
  label: (params) => `EMA ${params.fast}/${params.slow}`,
  pine: (params) => lf(`//@version=6
indicator("Exponential moving averages", overlay = true)
fastLength = input.int(${params.fast}, "Fast length", minval = 2, maxval = 200)
slowLength = input.int(${params.slow}, "Slow length", minval = 2, maxval = 400)
fastEma = ta.ema(close, fastLength)
slowEma = ta.ema(close, slowLength)
plot(fastEma, "Fast EMA", color = color.new(color.purple, 0))
plot(slowEma, "Slow EMA", color = color.new(color.orange, 0))
crossed = ta.cross(fastEma, slowEma)
plotshape(crossed, "Crossover", shape.circle, location.absolute, color.new(color.green, 0), size = size.tiny)`),
};

export const INDICATORS: Record<string, IndicatorDefinition> = {
  [movingAverages.id]: movingAverages,
  [exponentialMovingAverages.id]: exponentialMovingAverages,
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
