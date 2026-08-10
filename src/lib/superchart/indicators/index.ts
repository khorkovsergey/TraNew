import type { Bar } from '../chart-engine/types';
import { MAIN_PANE, type PaneFormat, type PaneRequest, type PaneScalePolicy } from '../chart-engine/panes';
import { STUDIES, type StudyDefinition } from '../../studies/registry';

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
 * says — and adds the ones the chart needs that the registry has no reason to
 * carry: volume, a volume moving average and a volume-anomaly flag.
 *
 * Reusing rather than reimplementing matters here beyond tidiness: the Pine the
 * registry emits and the line the chart draws have to be the same calculation,
 * or the code beside the chart describes something else.
 *
 * This is also where a study says which pane it wants and how that pane scales.
 * The renderer reads `paneRequestFor` and nothing else — there is no branch
 * anywhere that names RSI, and adding the next oscillator is a row in the table
 * below rather than a change to the engine.
 */

export type IndicatorPane = 'main' | 'separate';

export type IndicatorPlot = {
  key: string;
  /** An index into the chart's study palette, not a colour. */
  colour: number;
  values: (number | null)[];
  style: 'line' | 'histogram' | 'flags';
};

/**
 * Where a study is drawn and how that strip of canvas scales.
 *
 * Optional on an instance so an ad-hoc one — the Pine preview builds its own —
 * still renders on the price pane without filling this in. `paneRequestFor`
 * resolves the defaults, and it is the only place that decides.
 */
export type IndicatorPaneSpec = {
  /** Which pane. Studies naming the same id share one rectangle and one scale. */
  id: string;
  title: string;
  scale: PaneScalePolicy;
  guides?: number[];
  weight?: number;
  format?: PaneFormat;
  precision?: number;
};

export type IndicatorInstance = {
  id: string;
  definitionId: string;
  label: string;
  pane: IndicatorPane;
  /** Present on separate-pane studies; absent means the price pane. */
  paneSpec?: IndicatorPaneSpec;
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
  /** Required when `pane` is 'separate'; a pane needs a scale to be one. */
  paneSpec?: IndicatorPaneSpec;
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

/* --------------------------------------------------------------- Panes */

/**
 * The panes the built-in studies ask for.
 *
 * Named constants rather than literals on each definition, because sharing is
 * the point: volume, its average and the anomaly flags all name `VOLUME_PANE`
 * and therefore land in one rectangle with one domain computed over all three.
 * Two studies that happened to write the same id inline would work by accident
 * and break by typo.
 */
const VOLUME_PANE: IndicatorPaneSpec = {
  id: 'volume',
  title: 'Volume',
  scale: { kind: 'zeroBased' },
  format: 'compact',
  precision: 0,
};

const RSI_PANE: IndicatorPaneSpec = {
  id: 'rsi',
  title: 'RSI',
  // Bounded by what the index is, not by what this window happens to contain: an
  // RSI that spent a month between 45 and 55 is a flat middle, and a pane fitted
  // to those two numbers would draw it as a mountain range.
  scale: { kind: 'fixed', min: 0, max: 100 },
  guides: [30, 70],
  precision: 0,
};

const MACD_PANE: IndicatorPaneSpec = {
  id: 'macd',
  title: 'MACD',
  // Symmetric so zero is the middle of the pane and the sign of the histogram is
  // legible without reading the axis.
  scale: { kind: 'symmetric' },
  precision: 2,
};

/* --------------------------------------------------------- Definitions */

/**
 * A chart indicator built from a study in `lib/studies/registry.ts`.
 *
 * The registry owns the calculation, the parameter ranges and the Pine; this
 * adds only what the chart knows about — which pane, which plot style, which
 * palette slot. Nothing is recomputed here, so the line on the chart and the
 * code Script Lab exports cannot drift apart.
 */
function fromStudy(
  study: StudyDefinition,
  options: {
    name: string;
    pane: IndicatorPane;
    paneSpec?: IndicatorPaneSpec;
    /** Plot style per series key; anything unlisted is a line. */
    styles?: Record<string, IndicatorPlot['style']>;
  }
): IndicatorDefinition {
  const defaults: Record<string, number> = {};
  const ranges: Record<string, { min: number; max: number }> = {};

  for (const [name, range] of Object.entries(study.params)) {
    defaults[name] = range.default;
    ranges[name] = { min: range.min, max: range.max };
  }

  return {
    id: study.id,
    name: options.name,
    pane: options.pane,
    paneSpec: options.paneSpec,
    defaults,
    ranges,
    compute: (bars, params) =>
      study.compute(
        bars.map((bar) => bar.close),
        params
      ).map((line) => ({
        key: line.key,
        colour: line.color,
        values: line.values,
        style: options.styles?.[line.key] ?? 'line',
      })),
    label: study.label,
    pine: study.pine,
  };
}

/**
 * Volume, as a study rather than as a fixture of the canvas.
 *
 * It used to be a strip the engine always drew, below the price and outside the
 * pane model — which is why it could not be turned off, could not be reordered,
 * and had no axis. Making it an ordinary consumer of the pane manager costs it
 * nothing: it is on by default, so a chart nobody has touched looks exactly as
 * it did.
 */
const volume: IndicatorDefinition = {
  id: 'volume',
  name: 'Volume',
  pane: 'separate',
  paneSpec: VOLUME_PANE,
  defaults: {},
  ranges: {},
  compute: (bars) => [
    {
      key: 'volume',
      colour: 3,
      style: 'histogram',
      // Null rather than zero where a bar carries no volume at all: the provider
      // behind this portal returns daily closes without it, and a row of
      // zero-height bars claims a quiet market rather than an absent field.
      values: bars.map((bar) => (typeof bar.volume === 'number' ? bar.volume : null)),
    },
  ],
  label: () => 'Volume',
  pine: () => lf(`//@version=6
indicator("Volume")
plot(volume, "Volume", style = plot.style_columns, color = close >= open ? color.new(color.green, 40) : color.new(color.red, 40))`),
};

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
  // The volume pane, not one of its own: a threshold drawn anywhere other than
  // over the bars it is a threshold for says nothing.
  paneSpec: VOLUME_PANE,
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
  paneSpec: VOLUME_PANE,
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

/**
 * The three the registry already computed and the chart could not draw.
 *
 * RSI and MACD were in `lib/studies` from the beginning, with tests against a
 * hand-worked reference and a Pine template each, and the chart skipped them
 * because it had nowhere to put a second vertical scale. Bollinger sits on the
 * price and only ever needed listing.
 */
const relativeStrength = fromStudy(STUDIES.rsi, {
  name: 'RSI',
  pane: 'separate',
  paneSpec: RSI_PANE,
});

const macd = fromStudy(STUDIES.macd, {
  name: 'MACD',
  pane: 'separate',
  paneSpec: MACD_PANE,
  styles: { hist: 'histogram' },
});

const bollinger = fromStudy(STUDIES.bbands, {
  name: 'Bollinger Bands',
  pane: 'main',
});

export const INDICATORS: Record<string, IndicatorDefinition> = {
  [movingAverages.id]: movingAverages,
  [exponentialMovingAverages.id]: exponentialMovingAverages,
  [bollinger.id]: bollinger,
  [volume.id]: volume,
  [volumeAverage.id]: volumeAverage,
  [volumeAnomaly.id]: volumeAnomaly,
  [relativeStrength.id]: relativeStrength,
  [macd.id]: macd,
};

/**
 * The pane a study instance renders into, or null for the price pane.
 *
 * The single place that decides. A renderer asking "is this RSI?" is the shape
 * this function exists to prevent — it asks "which pane, scaled how?", gets an
 * answer that came from the study's own row in the registry, and draws.
 */
export function paneRequestFor(instance: IndicatorInstance): IndicatorPaneSpec | null {
  if (instance.hidden) return null;

  const spec = instance.paneSpec ?? INDICATORS[instance.definitionId]?.paneSpec ?? null;
  if (!spec) return null;

  // A study marked `main` cannot be dragged onto its own scale by a stray spec,
  // and one marked `separate` with no spec stays on the price pane rather than
  // being given an invented domain.
  const pane = instance.pane ?? INDICATORS[instance.definitionId]?.pane;
  if (pane === 'main' || spec.id === MAIN_PANE) return null;

  return spec;
}

/**
 * The panes a list of studies needs, in the order they were added, each with
 * the series that decide its domain.
 *
 * Studies sharing a pane id are merged — one rectangle, one scale, every series
 * in it counted. This is the whole contract between the studies and the layout:
 * the engine calls it, hands the result to `buildPaneLayout`, and never learns
 * what any of them are.
 */
export function collectPaneRequests(
  instances: IndicatorInstance[]
): Array<PaneRequest & { series: Array<(number | null)[]> }> {
  const out: Array<PaneRequest & { series: Array<(number | null)[]> }> = [];
  const byId = new Map<string, PaneRequest & { series: Array<(number | null)[]> }>();

  for (const instance of instances) {
    const spec = paneRequestFor(instance);
    if (!spec) continue;

    let entry = byId.get(spec.id);
    if (!entry) {
      entry = {
        id: spec.id,
        title: spec.title,
        scale: spec.scale,
        guides: spec.guides ?? [],
        weight: spec.weight ?? 1,
        format: spec.format ?? 'plain',
        precision: spec.precision ?? 2,
        series: [],
      };
      byId.set(spec.id, entry);
      out.push(entry);
    }

    for (const plot of instance.plots) entry.series.push(plot.values);
  }

  return out;
}

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
    paneSpec: definition.paneSpec,
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
