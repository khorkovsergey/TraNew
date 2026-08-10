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
 * What is renderable is decided by the engine rather than by optimism, and it
 * is asked in the engine's own vocabulary. `INDICATORS` is the table Supercharts
 * renders from: it says which pane a study wants, how that pane scales, and how
 * its plots are drawn. Reading placement from there rather than restating it
 * here is what makes "the chart draws RSI" a fact about the renderer instead of
 * a claim in a second file — and it is why the volume pane, which the study
 * registry has no row for at all, can be offered without Voyager inventing one.
 *
 * A study this surface cannot draw is refused here with a reason, rather than
 * claimed and quietly dropped.
 */

/* Relative, not aliased: the unit harness compiles this file with bare `tsc`,
   which has no idea what `@/` means. */
import type { StudyParams } from '../../studies/registry';
import { INDICATORS } from '../../superchart/indicators';
import {
  ENGINE_DRAWS_SEPARATE_PANES,
  MAX_SECONDARY_PANES,
  PANE_STUDY_NOTE,
} from './engine';

export const CHART_SPEC_VERSION = 1 as const;

/**
 * The studies Voyager offers, in the chart engine's vocabulary.
 *
 * A subset of `INDICATORS` rather than all of it, because this is an offer and
 * not a catalogue: every id here has to be worth a sentence in an answer and a
 * row in the schema the model chooses from. `volume` is on the list and has no
 * row in `lib/studies/registry.ts` — volume is a property of a bar, not a
 * calculation over closes — which is exactly why the placement question is
 * asked of the renderer's table and not of that one.
 *
 * The unit suite asserts every id is real, so a typo here is a failing test
 * rather than a study that silently never appears.
 */
export const VOYAGER_STUDY_IDS = ['sma', 'bbands', 'rsi', 'macd', 'volume'] as const;

export type VoyagerStudyId = (typeof VOYAGER_STUDY_IDS)[number];

export type VoyagerStudySpec = { id: VoyagerStudyId; params: StudyParams };

export function isVoyagerStudyId(value: unknown): value is VoyagerStudyId {
  return typeof value === 'string' && (VOYAGER_STUDY_IDS as readonly string[]).includes(value);
}

/** True when the study wants a strip of canvas and a scale of its own. */
export function needsOwnPane(id: VoyagerStudyId): boolean {
  return INDICATORS[id]?.pane === 'separate';
}

/**
 * Which pane a study lands in, by the renderer's own answer.
 *
 * Studies naming the same pane share one rectangle and one scale, so volume and
 * a volume average cost one pane between them rather than two. Counting
 * distinct ids is therefore the only correct way to ask how tall the chart is
 * about to get.
 */
export function paneIdOf(id: VoyagerStudyId): string {
  return INDICATORS[id]?.paneSpec?.id ?? 'main';
}

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
  /**
   * Whether the bars actually carry a traded volume.
   *
   * The provider behind this portal returns it for some instruments and not for
   * others, and a volume pane drawn from an absent field is a row of empty
   * canvas under a real company's name. So the question is asked of the data
   * before the pane is promised, and a `false` here refuses the study out loud
   * instead of drawing nothing.
   */
  hasVolume: boolean;
};

export type VoyagerChartSpec = {
  version: typeof CHART_SPEC_VERSION;
  kind: ChartKind;
  series: ChartSeries[];
  range: { start: string; end: string };
  interval: ChartInterval;
  /** Studies that will actually be drawn — on the price pane or under it. */
  studies: VoyagerStudySpec[];
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
 * The studies this surface can draw, derived from the renderer rather than
 * listed here.
 *
 * An overlay shares the price pane and the price scale, and was always
 * drawable. A study that wants its own pane is drawable exactly when the engine
 * has a pane manager — so `ENGINE_DRAWS_SEPARATE_PANES` decides that half, in
 * one place, and moving it moves this set and the handoff table together
 * without either being edited.
 */
export const RENDERABLE_STUDIES: VoyagerStudyId[] = VOYAGER_STUDY_IDS.filter(
  (id) => !needsOwnPane(id) || ENGINE_DRAWS_SEPARATE_PANES
);

export function isRenderableStudy(id: string): id is VoyagerStudyId {
  return (RENDERABLE_STUDIES as string[]).includes(id);
}

/** The study's name as the chart legend writes it — "RSI 14", "Volume". */
function studyLabel(spec: VoyagerStudySpec): string {
  return INDICATORS[spec.id].label(spec.params);
}

function refusalFor(id: string): string {
  if (!isVoyagerStudyId(id)) return `${id} is not a study this platform computes.`;
  return `${INDICATORS[id].name} ${PANE_STUDY_NOTE}. It is available on the professional chart.`;
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

  const range = value.range as { start?: unknown; end?: unknown } | undefined;
  const meta = (value.sourceMeta ?? {}) as Record<string, unknown>;
  const hasVolume = meta.hasVolume === true;

  const refused: VoyagerChartSpec['refused'] = [];
  const seenStudies = new Set<string>();
  const studies: VoyagerStudySpec[] = [];
  /* Panes, not studies: volume and a volume average would share one. */
  const panes = new Set<string>();

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
        reason: `${INDICATORS[id].name} is drawn on a price chart of one instrument, not on this one.`,
      });
      continue;
    }

    /*
     * Volume is the one study whose data can be missing while the price is
     * fine, because it is a field on the bar rather than something computed
     * from the closes. Refused with what is actually true — the provider did
     * not send it — rather than with a statement about this chart's abilities.
     */
    if (paneIdOf(id) === 'volume' && !hasVolume) {
      refused.push({
        study: id,
        reason:
          'The data provider returned these prices without a traded volume, so there is no volume to draw.',
      });
      continue;
    }

    /*
     * The height limit, counted in panes rather than in studies: a fourth strip
     * under a chart this tall leaves every one of them too short to read. Said
     * out loud, because a study somebody asked for and cannot see is the
     * failure this whole file exists to prevent.
     */
    const pane = paneIdOf(id);
    if (pane !== 'main' && !panes.has(pane) && panes.size >= MAX_SECONDARY_PANES) {
      refused.push({
        study: id,
        reason: `A chart in an answer holds the price and ${MAX_SECONDARY_PANES} panes beneath it. The professional chart takes as many as you like.`,
      });
      continue;
    }

    const clamped = clampStudyParams(id, (entry as { params?: unknown }).params);
    if (!clamped) continue;

    if (pane !== 'main') panes.add(pane);
    studies.push(clamped);
  }

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
      hasVolume,
    },
    refused,
  };
}

/**
 * A study's numbers, pulled into the renderer's own ranges.
 *
 * Read from `INDICATORS` rather than from the study registry, because that is
 * the definition whose `compute` will run: clamping against one table and
 * drawing with another is how a caption ends up describing an RSI 14 that was
 * computed over 20 bars.
 */
function clampStudyParams(id: VoyagerStudyId, raw: unknown): VoyagerStudySpec | null {
  const definition = INDICATORS[id];
  if (!definition) return null;

  const supplied = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const params: StudyParams = {};

  for (const [name, fallback] of Object.entries(definition.defaults)) {
    const range = definition.ranges[name];
    const value = supplied[name];
    const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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

  /*
   * Overlays and panes are said differently because they are different things
   * on screen, and a caption that flattens them invites "where is the RSI?"
   * about a line drawn across the candles. Both lists come from `spec.studies`,
   * which is what the engine is handed — so a pane named here is a pane drawn.
   */
  const overlays = spec.studies.filter((study) => paneIdOf(study.id) === 'main');
  const below = spec.studies.filter((study) => paneIdOf(study.id) !== 'main');

  if (overlays.length) parts.push(`with ${overlays.map(studyLabel).join(' and ')}`);

  if (below.length) {
    const paneCount = new Set(below.map((study) => paneIdOf(study.id))).size;
    parts.push(
      `${below.map(studyLabel).join(' and ')} in ${paneCount === 1 ? 'a pane' : `${paneCount} panes`} below the price`
    );
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
  | { kind: 'add_study'; study: VoyagerStudySpec }
  | { kind: 'remove_study'; study: string };

/**
 * "Now show it as candles", applied to the chart already on screen.
 *
 * The point of an artifact: a follow-up modifies the specification rather than
 * starting again, so nobody is asked which instrument they meant for the second
 * time in two sentences. The result goes back through `clampChartSpec`, so an
 * edit cannot smuggle in something the original could not have contained —
 * asking for a volume pane on data with no volume in it, or for a fourth pane,
 * is refused the same way whether it arrives first or third.
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
