/**
 * What Voyager may put on a chart, and what it may then say about it.
 *
 * The defect this file exists to end: a structured chart module described "RSI
 * and three detected levels", and the rendering path passed a symbol and an
 * interval to a canvas that drew candles. The paragraph and the picture were
 * produced by different code from different inputs, so they disagreed, and the
 * paragraph was the more confident of the two.
 *
 * The fix is not more care. It is that **the caption is generated from the same
 * clamped specification the renderer receives**, after everything unrenderable
 * has been removed from it. `describeChart` cannot mention a study that
 * `clampChartSpec` dropped, because by then the spec does not contain one.
 *
 * What is renderable is decided by the engine rather than by optimism.
 * Supercharts' canvas draws the price pane and main-pane overlays; studies that
 * need their own strip of canvas and their own vertical scale — RSI, MACD — are
 * the pane manager's job, and there is no pane manager. Not in Voyager, and not
 * in Supercharts either: its workspace calls the same `setIndicators`, and the
 * engine skips anything whose pane is not `main`. So those studies are refused
 * here with a reason, rather than claimed and quietly dropped.
 *
 * Import-free beyond the study registry, so the unit harness compiles it.
 */

/* Relative, not aliased: the unit harness compiles this file with bare `tsc`,
   which has no idea what `@/` means. */
import { STUDIES, type StudyId, type StudySpec } from '../../studies/registry';

export const CHART_SPEC_VERSION = 1 as const;

export type ChartKind = 'line' | 'area' | 'candles' | 'performance' | 'drawdown';

export const CHART_KINDS: ChartKind[] = ['line', 'area', 'candles', 'performance', 'drawdown'];

export type ChartInterval = '1D' | '1W' | '1M';

export type ChartSeries = {
  /** Stable across follow-ups, so "remove Microsoft" can find it. */
  assetId: string;
  symbol: string;
  label: string;
  /** What the numbers are: a price, or a rebased index, or a fall from peak. */
  field: 'close' | 'normalized' | 'drawdown';
};

export type ChartSourceMeta = {
  provider: string;
  /** The dates there are actually bars for, which are trading days. */
  firstObservation: string | null;
  lastObservation: string | null;
  delayed: boolean;
  /** True when weekly or monthly bars were folded from daily ones. */
  derivedFromDaily: boolean;
};

export type VoyagerChartSpec = {
  version: typeof CHART_SPEC_VERSION;
  kind: ChartKind;
  series: ChartSeries[];
  range: { start: string; end: string };
  interval: ChartInterval;
  /** Overlay studies that will actually be drawn on the price pane. */
  studies: StudySpec[];
  normalization?: { enabled: boolean; base: number };
  sourceMeta: ChartSourceMeta;
  /**
   * Studies that were asked for and will not appear, with why.
   *
   * Carried on the spec rather than dropped silently: the answer needs to say
   * "RSI is not something this chart draws" out loud, and the only way to be
   * sure it does is to hand it the list.
   */
  refused: { study: string; reason: string }[];
};

/**
 * The studies this surface can draw, derived from the registry rather than
 * listed here.
 *
 * `placement: 'overlay'` means the study shares the price pane and the price
 * scale, which is exactly what the canvas engine paints. A study gaining or
 * losing a pane in the registry changes this set without anybody remembering to
 * update it.
 */
export const RENDERABLE_STUDIES: StudyId[] = (Object.keys(STUDIES) as StudyId[]).filter(
  (id) => STUDIES[id].placement === 'overlay'
);

export function isRenderableStudy(id: string): id is StudyId {
  return (RENDERABLE_STUDIES as string[]).includes(id);
}

function refusalFor(id: string): string {
  const study = STUDIES[id as StudyId];
  if (!study) return `${id} is not a study this platform computes.`;
  return (
    `${id.toUpperCase()} needs its own pane and its own scale, which this chart does not have. ` +
    `It is available on the full chart.`
  );
}

/* --------------------------------------------------------------- Clamping */

/**
 * The only way a chart specification enters the product.
 *
 * Everything that cannot be drawn is removed here and recorded in `refused`,
 * so that by the time either the renderer or the caption sees the spec, it
 * describes exactly one thing: what will be on screen.
 */
export function clampChartSpec(raw: unknown): VoyagerChartSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  const kind = CHART_KINDS.includes(value.kind as ChartKind) ? (value.kind as ChartKind) : null;
  if (!kind) return null;

  const series = (Array.isArray(value.series) ? value.series : [])
    .map((entry): ChartSeries | null => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const symbol = typeof item.symbol === 'string' ? item.symbol.slice(0, 16) : '';
      if (!symbol) return null;
      const field =
        item.field === 'normalized' || item.field === 'drawdown' ? item.field : 'close';
      return {
        assetId: typeof item.assetId === 'string' ? item.assetId.slice(0, 48) : symbol,
        symbol,
        label: typeof item.label === 'string' ? item.label.slice(0, 60) : symbol,
        field,
      };
    })
    .filter((entry): entry is ChartSeries => entry !== null)
    .slice(0, 5);

  if (series.length === 0) return null;

  /*
   * A candlestick is one instrument's open, high, low and close. Five of them
   * on one pane is five overlapping bodies and no readable chart, and the
   * engine draws only the series it was given bars for — so the kind is
   * corrected rather than the request half-honoured.
   */
  const resolvedKind: ChartKind =
    series.length > 1 && (kind === 'candles' || kind === 'line' || kind === 'area')
      ? 'performance'
      : kind;

  const refused: VoyagerChartSpec['refused'] = [];
  const seenStudies = new Set<string>();
  const studies: StudySpec[] = [];

  for (const entry of Array.isArray(value.studies) ? value.studies : []) {
    const id = (entry as { id?: unknown })?.id;
    if (typeof id !== 'string' || seenStudies.has(id)) continue;
    seenStudies.add(id);

    if (!isRenderableStudy(id)) {
      refused.push({ study: id, reason: refusalFor(id) });
      continue;
    }

    /*
     * A study on a comparison would be computed from one of the lines and
     * drawn across all of them. Refused rather than attached to whichever
     * series happens to be first.
     */
    if (resolvedKind === 'performance' || resolvedKind === 'drawdown') {
      refused.push({
        study: id,
        reason: `${id.toUpperCase()} is drawn on a price chart of one instrument, not on this one.`,
      });
      continue;
    }

    const clamped = clampStudyParams(id, (entry as { params?: unknown }).params);
    if (clamped) studies.push(clamped);
  }

  const range = value.range as { start?: unknown; end?: unknown } | undefined;
  const meta = (value.sourceMeta ?? {}) as Record<string, unknown>;

  return {
    version: CHART_SPEC_VERSION,
    kind: resolvedKind,
    series,
    range: {
      start: typeof range?.start === 'string' ? range.start : '',
      end: typeof range?.end === 'string' ? range.end : '',
    },
    interval:
      value.interval === '1W' || value.interval === '1M' ? value.interval : '1D',
    studies,
    ...(resolvedKind === 'performance'
      ? { normalization: { enabled: true, base: 100 } }
      : {}),
    sourceMeta: {
      provider: typeof meta.provider === 'string' ? meta.provider : 'unknown',
      firstObservation:
        typeof meta.firstObservation === 'string' ? meta.firstObservation : null,
      lastObservation: typeof meta.lastObservation === 'string' ? meta.lastObservation : null,
      delayed: meta.delayed !== false,
      derivedFromDaily: meta.derivedFromDaily === true,
    },
    refused,
  };
}

/** A study's numbers, pulled into the registry's own ranges. */
function clampStudyParams(id: StudyId, raw: unknown): StudySpec | null {
  const definition = STUDIES[id];
  if (!definition) return null;

  const supplied = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const params: Record<string, number> = {};

  for (const [name, range] of Object.entries(definition.params)) {
    const value = supplied[name];
    const numeric = typeof value === 'number' && Number.isFinite(value) ? value : range.default;
    params[name] = Math.min(range.max, Math.max(range.min, Math.round(numeric * 100) / 100));
  }

  return { id, params };
}

/* -------------------------------------------------------------- Describing */

/**
 * The chart in words, from the clamped spec.
 *
 * This is the caption under the picture *and* the sentence the answer is given
 * to work from. One function, one input, so the two cannot drift: a study that
 * is not in `spec.studies` cannot be named here, because there is nowhere for
 * the name to come from.
 */
export function describeChart(spec: VoyagerChartSpec): string {
  const names = spec.series.map((series) => series.symbol);

  const subject =
    spec.kind === 'performance'
      ? `${names.join(', ')} rebased to ${spec.normalization?.base ?? 100} at the first shared day`
      : spec.kind === 'drawdown'
        ? `${names[0]} drawn as its fall from each new peak`
        : `${names[0]} ${describeKind(spec.kind)}`;

  const parts = [subject, `${spec.interval} bars`];

  if (spec.sourceMeta.firstObservation && spec.sourceMeta.lastObservation) {
    parts.push(`${spec.sourceMeta.firstObservation} to ${spec.sourceMeta.lastObservation}`);
  }

  if (spec.studies.length) {
    parts.push(`with ${spec.studies.map((study) => STUDIES[study.id].label(study.params)).join(' and ')}`);
  }

  if (spec.sourceMeta.derivedFromDaily) parts.push('folded from daily data');
  parts.push(`${spec.sourceMeta.provider}${spec.sourceMeta.delayed ? ', delayed' : ''}`);

  return parts.join(' · ');
}

function describeKind(kind: ChartKind): string {
  if (kind === 'candles') return 'as candles';
  if (kind === 'area') return 'as an area';
  return 'as a line';
}

/**
 * What the answer must say out loud about what is missing.
 *
 * Empty when nothing was refused, which is the ordinary case. When it is not
 * empty, the chart is smaller than the request and somebody is owed that
 * sentence before they read the picture as the whole answer.
 */
export function refusalNotes(spec: VoyagerChartSpec): string[] {
  return spec.refused.map((entry) => entry.reason);
}

/* ------------------------------------------------------------- Follow-ups */

export type ChartEdit =
  | { kind: 'chart_kind'; value: ChartKind }
  | { kind: 'interval'; value: ChartInterval }
  | { kind: 'range'; start: string; end: string }
  | { kind: 'add_study'; study: StudySpec }
  | { kind: 'remove_study'; study: string };

/**
 * "Now show it as candles", applied to the chart already on screen.
 *
 * The point of an artifact: a follow-up modifies the specification rather than
 * starting again, so nobody is asked which instrument they meant for the second
 * time in two sentences. The result goes back through `clampChartSpec`, so an
 * edit cannot smuggle in something the original could not have contained —
 * asking for RSI on a chart that has no pane for it is refused the same way
 * whether it arrives first or third.
 */
export function applyChartEdit(spec: VoyagerChartSpec, edit: ChartEdit): VoyagerChartSpec {
  const next: Record<string, unknown> = { ...spec };

  if (edit.kind === 'chart_kind') next.kind = edit.value;
  if (edit.kind === 'interval') next.interval = edit.value;
  if (edit.kind === 'range') next.range = { start: edit.start, end: edit.end };

  if (edit.kind === 'add_study') {
    next.studies = [...spec.studies.filter((study) => study.id !== edit.study.id), edit.study];
  }

  if (edit.kind === 'remove_study') {
    next.studies = spec.studies.filter((study) => study.id !== edit.study);
    // The refusal goes with it: a study nobody is asking for any more is not
    // something the answer should still be apologising about.
    next.refused = spec.refused.filter((entry) => entry.study !== edit.study);
  }

  return clampChartSpec(next) ?? spec;
}
