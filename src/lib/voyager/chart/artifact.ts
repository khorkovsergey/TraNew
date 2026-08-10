/**
 * The chart already on screen, as something a follow-up can work on.
 *
 * The defect this ends: every question started from nothing. "Show NVDA for the
 * last three months" fetched a series and drew it; "show it as candles" fetched
 * the same series again, because the server kept no memory of the first answer
 * and the only way to have bars to draw was to ask the provider for them. The
 * provider's cache hid the cost, which is worse rather than better — the call
 * was still made, still counted against a free-tier allowance shared by the
 * whole portal, and would still have been made if the cache had been cold.
 *
 * So this module answers one question: **can the change somebody asked for be
 * made out of the data already held?** It is deliberately the pure half —
 * no fetching, no storage, no clock of its own — so that the rule can be tested
 * exhaustively without a network or a browser. `lib/voyager/artifacts.ts` holds
 * the bounded store, and the tool in the registry is what the planner calls.
 *
 * Three rules shape it.
 *
 * **Reuse is refused rather than approximated.** An artifact covering three
 * months cannot answer a question about a year, and the honest result is a
 * failure that tells the planner to fetch. A chart that quietly showed three
 * months under the heading of a year would be the worst outcome available.
 *
 * **What is held is what was drawn.** The artifact is built from the same
 * clamped specification and the same series the person saw, so an edit starts
 * from the picture rather than from a description of it.
 *
 * **Nothing here trusts a number from a browser.** This module only ever sees
 * bars the server fetched itself; see `artifacts.ts` for how a follow-up names
 * one without being able to supply one.
 *
 * Import-free beyond the pure range and metric helpers, so the unit harness
 * compiles it alone.
 */

import { isoOf, trimToRange, type Bar, type DateRange, type Interval } from '../tools/range';
import { normalise } from '../tools/metrics';
import {
  clampChartSpec,
  CHART_KINDS,
  isVoyagerStudyId,
  type ChartKind,
  type VoyagerChartSpec,
  type VoyagerStudySpec,
} from './spec';

/* ------------------------------------------------------------------ Bounds */

/**
 * How long a held series may be reused.
 *
 * An hour, because that is what the market client's own cache already does with
 * a daily series: fetching again inside that window returns the same bars from
 * the same cache entry. Reuse therefore never shows anybody something staler
 * than a fresh call would have, which is the only argument for a number here
 * that is not simply a guess.
 *
 * It bounds redrawing, and nothing else. A question about the current price
 * goes to the quote tool and never touches this — a day-old close is not a
 * price now, and no amount of convenience makes it one.
 */
export const ARTIFACT_TTL_MS = 60 * 60 * 1000;

/** A comparison of more than this is a screener; the chart tools cap it too. */
export const MAX_ARTIFACT_SERIES = 5;

/**
 * The most bars one series may carry into the next question.
 *
 * Five years of daily bars is about 1,260, so this reaches the longest period
 * anybody asks for in a chat message and stops well short of the provider's
 * 5,000-bar page. The cap exists because an artifact store is memory somebody
 * else is paying for, and "as much as was fetched" is not a bound.
 */
export const MAX_ARTIFACT_BARS = 1500;

/* ------------------------------------------------------------------- Shape */

export type ArtifactSeries = {
  assetId: string;
  symbol: string;
  label: string;
  bars: Bar[];
};

export type ChartArtifact = {
  id: string;
  /** Epoch milliseconds, supplied by the caller so this module has no clock. */
  createdAt: number;
  /** One instrument, or several rebased against each other. */
  mode: 'single' | 'comparison';
  kind: ChartKind;
  interval: Interval;
  /** The period that was asked for, which is not the period there are bars for. */
  requested: DateRange;
  series: ArtifactSeries[];
  studies: VoyagerStudySpec[];
  provider: string;
  delayed: boolean;
  derivedFromDaily: boolean;
  hasVolume: boolean;
};

/** The dates this artifact genuinely holds, read off the bars every time. */
export function artifactCoverage(artifact: ChartArtifact): {
  firstObservation: string | null;
  lastObservation: string | null;
  bars: number;
} {
  /*
   * The widest window any series covers, not the narrowest.
   *
   * A comparison is aligned to shared dates before it is stored, so in practice
   * every series has the same span; taking the extremes rather than the first
   * series' means a future caller cannot be surprised by an unaligned one.
   */
  let first: string | null = null;
  let last: string | null = null;
  let bars = 0;

  for (const series of artifact.series) {
    bars = Math.max(bars, series.bars.length);
    if (series.bars.length === 0) continue;

    const start = isoOf(series.bars[0].time);
    const end = isoOf(series.bars[series.bars.length - 1].time);
    if (first === null || start < first) first = start;
    if (last === null || end > last) last = end;
  }

  return { firstObservation: first, lastObservation: last, bars };
}

/**
 * The artifact for a chart that was just drawn.
 *
 * Built from the clamped specification and the series the renderer was handed,
 * rather than from the tool result they came from — so what can be reused is by
 * construction what was on screen, including the studies that survived
 * clamping and excluding the ones that did not.
 */
export function artifactFor(input: {
  id: string;
  createdAt: number;
  spec: VoyagerChartSpec;
  series: { assetId: string; bars: Bar[] }[];
}): ChartArtifact | null {
  const bySpec = new Map(input.spec.series.map((entry) => [entry.assetId, entry]));

  const series: ArtifactSeries[] = input.series
    .slice(0, MAX_ARTIFACT_SERIES)
    .map((entry) => {
      const described = bySpec.get(entry.assetId);
      return {
        assetId: entry.assetId,
        symbol: described?.symbol ?? entry.assetId,
        label: described?.label ?? described?.symbol ?? entry.assetId,
        /* The most recent bars when there are too many: an artifact is for
           following up on what is on screen, and the recent end is the end
           every follow-up is about. */
        bars: entry.bars.slice(-MAX_ARTIFACT_BARS),
      };
    })
    .filter((entry) => entry.bars.length >= 2);

  if (series.length === 0) return null;

  return {
    id: input.id,
    createdAt: input.createdAt,
    mode: input.spec.kind === 'performance' ? 'comparison' : 'single',
    kind: input.spec.kind,
    interval: input.spec.interval,
    requested: input.spec.range,
    series,
    studies: input.spec.studies,
    provider: input.spec.sourceMeta.provider,
    delayed: input.spec.sourceMeta.delayed,
    derivedFromDaily: input.spec.sourceMeta.derivedFromDaily,
    hasVolume: input.spec.sourceMeta.hasVolume,
  };
}

/**
 * The artifact in one line, for the planner.
 *
 * Bounded on purpose: the model needs to know what is on screen and what can be
 * done to it without fetching, not to receive a price series it would then be
 * tempted to do arithmetic on. Every number here is a date or a count.
 */
export function describeArtifact(artifact: ChartArtifact): string {
  const coverage = artifactCoverage(artifact);
  const names = artifact.series.map((entry) => entry.symbol).join(', ');
  const studies = artifact.studies.length
    ? artifact.studies.map((study) => study.id).join(', ')
    : 'no studies';

  return (
    `${names} · ${artifact.kind} · ${artifact.interval} · ` +
    `${coverage.firstObservation ?? '?'} to ${coverage.lastObservation ?? '?'} ` +
    `(${coverage.bars} bars held) · ${studies} · ` +
    `${artifact.provider}${artifact.delayed ? ', delayed' : ''}` +
    `${artifact.hasVolume ? '' : ' · no volume in this data'}`
  );
}

/** Whether this artifact is young enough to redraw from. */
export function artifactIsFresh(artifact: ChartArtifact, now: number): boolean {
  return now - artifact.createdAt < ARTIFACT_TTL_MS;
}

/* -------------------------------------------------------------- The edit */

export type ArtifactEdit = {
  kind?: ChartKind;
  addStudies?: VoyagerStudySpec[];
  removeStudies?: string[];
  /** A window inside what is already held. Wider than that is a fetch. */
  range?: DateRange;
  removeSymbols?: string[];
};

export type EditRefusal = {
  ok: false;
  /** Matches the tool error vocabulary, so the caller passes it straight on. */
  code: 'bad_arguments' | 'no_data' | 'not_found';
  message: string;
};

export type EditResult =
  | {
      ok: true;
      spec: VoyagerChartSpec;
      series: { assetId: string; bars: Bar[]; normalized?: (number | null)[] }[];
      /** What changed, for the chip under the answer. */
      changes: string[];
      /** The instruments redrawn from held data rather than fetched. */
      reused: string[];
      summary: string;
    }
  | EditRefusal;

function normaliseSymbol(value: string): string {
  return value.trim().toUpperCase();
}

/** Whether the edit asks for anything at all. */
function isEmptyEdit(edit: ArtifactEdit): boolean {
  return (
    edit.kind === undefined &&
    !edit.addStudies?.length &&
    !edit.removeStudies?.length &&
    !edit.range &&
    !edit.removeSymbols?.length
  );
}

/**
 * The change, applied to what is held — or a reason it cannot be.
 *
 * The refusals are the valuable half. Each one names what the artifact actually
 * covers, so the planner's next move is a fetch with the right arguments rather
 * than a guess; and none of them is recoverable by trying the same edit again.
 */
export function planChartEdit(artifact: ChartArtifact, edit: ArtifactEdit): EditResult {
  if (isEmptyEdit(edit)) {
    return {
      ok: false,
      code: 'bad_arguments',
      message: 'Say what to change about the chart — the type, a study, the period, or an instrument to drop.',
    };
  }

  /*
   * A chart type this cannot draw is refused rather than ignored.
   *
   * Ignoring it would be worse than it sounds: the edit would silently become
   * whatever else was in it, and the chip would report a change that did not
   * happen. Renko arrives here only if something upstream let it through, and
   * the honest answer is that this is not a chart type — which is what sends
   * the request to the handoff table where it belongs.
   */
  if (edit.kind !== undefined && !CHART_KINDS.includes(edit.kind)) {
    return {
      ok: false,
      code: 'not_found',
      message: `${edit.kind} is not one of the chart types here. The professional chart draws it.`,
    };
  }

  const coverage = artifactCoverage(artifact);
  const changes: string[] = [];

  /* ----------------------------------------------------------- Instruments */

  let series = artifact.series;

  if (edit.removeSymbols?.length) {
    const dropping = new Set(edit.removeSymbols.map(normaliseSymbol));
    const held = new Set(series.map((entry) => normaliseSymbol(entry.symbol)));

    for (const symbol of dropping) {
      if (!held.has(symbol)) {
        return {
          ok: false,
          code: 'not_found',
          message: `${symbol} is not on this chart. It shows ${[...held].join(', ')}.`,
        };
      }
    }

    series = series.filter((entry) => !dropping.has(normaliseSymbol(entry.symbol)));

    if (series.length === 0) {
      return {
        ok: false,
        code: 'bad_arguments',
        message: 'That would leave the chart with nothing on it.',
      };
    }

    changes.push(...[...dropping].map((symbol) => `-${symbol}`));
  }

  /* ---------------------------------------------------------------- Period */

  let requested = artifact.requested;

  if (edit.range) {
    const { start, end } = edit.range;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
      return { ok: false, code: 'bad_arguments', message: 'I need a period as two YYYY-MM-DD dates, the earlier one first.' };
    }

    /*
     * Reaching further back than the held bars is the case that must fetch.
     * Nothing about the data on hand can answer it, and narrowing silently to
     * what is held would put a person's question above a chart that does not
     * answer it.
     */
    if (coverage.firstObservation === null || start < coverage.firstObservation) {
      return {
        ok: false,
        code: 'no_data',
        message:
          `This chart holds ${coverage.firstObservation ?? 'nothing'} to ${coverage.lastObservation ?? 'nothing'}. ` +
          `A period starting ${start} needs history I do not have — fetch it instead of editing.`,
      };
    }

    /*
     * An end past the last bar is not a refusal. The last observation is the
     * most recent trading day the provider has, so there is nothing newer to
     * fetch — asking for "up to today" on a Sunday is the ordinary case.
     */
    series = series
      .map((entry) => ({ ...entry, bars: trimToRange(entry.bars, { start, end }) }))
      .filter((entry) => entry.bars.length >= 2);

    if (series.length === 0) {
      return {
        ok: false,
        code: 'no_data',
        message: `There are fewer than two ${artifact.interval} bars between ${start} and ${end} in what I have.`,
      };
    }

    requested = { start, end };
    changes.push(`${start}..${end}`);
  }

  /* --------------------------------------------------------------- Studies */

  let studies = artifact.studies;

  if (edit.removeStudies?.length) {
    const dropping = new Set(edit.removeStudies.map((id) => id.trim().toLowerCase()));
    studies = studies.filter((study) => !dropping.has(study.id));
    changes.push(...[...dropping].map((id) => `-${id}`));
  }

  if (edit.addStudies?.length) {
    for (const study of edit.addStudies) {
      if (!isVoyagerStudyId(study.id)) {
        return {
          ok: false,
          code: 'not_found',
          message: `${study.id} is not a study this chart draws.`,
        };
      }
      studies = [...studies.filter((existing) => existing.id !== study.id), study];
      changes.push(`+${study.id}`);
    }
  }

  /* ------------------------------------------------------------------ Kind */

  /*
   * A comparison of one instrument is not a comparison. Dropping the last of
   * the others leaves a rebased line starting at 100, which is a chart of
   * nothing — so it goes back to being a price chart of what remains.
   */
  const asked: ChartKind = edit.kind ?? artifact.kind;
  const kind: ChartKind = series.length === 1 && asked === 'performance' ? 'line' : asked;

  if (kind !== artifact.kind) changes.push(kind);

  /* ------------------------------------------------------------ The result */

  const trimmedCoverage = artifactCoverage({ ...artifact, series });

  const spec = clampChartSpec({
    kind,
    series: series.map((entry) => ({
      assetId: entry.assetId,
      symbol: entry.symbol,
      label: entry.label,
      field: series.length > 1 ? 'normalized' : 'close',
    })),
    range: requested,
    interval: artifact.interval,
    studies,
    sourceMeta: {
      provider: artifact.provider,
      firstObservation: trimmedCoverage.firstObservation,
      lastObservation: trimmedCoverage.lastObservation,
      delayed: artifact.delayed,
      derivedFromDaily: artifact.derivedFromDaily,
      hasVolume: artifact.hasVolume,
    },
  });

  if (!spec) {
    return { ok: false, code: 'bad_arguments', message: 'That leaves nothing this chart can draw.' };
  }

  const reused = series.map((entry) => entry.symbol);

  return {
    ok: true,
    spec,
    series: series.map((entry) => ({
      assetId: entry.assetId,
      bars: entry.bars,
      /* Recomputed from the bars that survived the trim, so the rebased lines
         start at 100 on the first day actually shown rather than on a day the
         edit removed. */
      ...(spec.kind === 'performance' ? { normalized: normalise(entry.bars) } : {}),
    })),
    changes: changes.length ? changes : [kind],
    reused,
    summary:
      `Redrawn from the data already fetched — no market request. ` +
      `${reused.join(', ')} · ${spec.kind} · ${spec.interval} · ` +
      `${trimmedCoverage.firstObservation ?? '?'} to ${trimmedCoverage.lastObservation ?? '?'} · ` +
      `${spec.studies.length ? spec.studies.map((study) => study.id).join(', ') : 'no studies'}` +
      (spec.refused.length ? `. Not drawn: ${spec.refused.map((entry) => entry.reason).join(' ')}` : '.'),
  };
}

/* --------------------------------------------------- Reuse for comparisons */

/**
 * Which of the instruments asked for are already held, and which are not.
 *
 * Adding Microsoft to a comparison of NVDA and AMD should fetch Microsoft. It
 * used to fetch all three, because the comparison tool takes a list and knows
 * nothing about what came before it — which is three provider requests where
 * one was needed, against an allowance the whole portal shares.
 *
 * Matching is by resolved symbol rather than by what somebody typed, and the
 * interval has to agree: a weekly artifact cannot supply a daily comparison,
 * and folding one into the other here would invent bars.
 */
export function reusableSeries(
  artifact: ChartArtifact,
  wanted: { symbol: string }[],
  interval: Interval
): Map<string, ArtifactSeries> {
  const reusable = new Map<string, ArtifactSeries>();
  if (artifact.interval !== interval) return reusable;

  const held = new Map(artifact.series.map((entry) => [normaliseSymbol(entry.symbol), entry]));

  for (const item of wanted) {
    const match = held.get(normaliseSymbol(item.symbol));
    if (match) reusable.set(normaliseSymbol(item.symbol), match);
  }

  return reusable;
}

/**
 * Which instruments a comparison will fetch, and which it will redraw.
 *
 * The decision, separated from the doing, because the decision is the claim
 * worth testing: adding one instrument to a comparison of two must produce
 * exactly one fetch. A test that watched the provider instead would pass on a
 * warm cache while three requests were still being planned — the cache makes a
 * repeat cheap, and cheap is not the same as absent.
 *
 * Every condition that could make reuse wrong is here. The interval has to be
 * the artifact's, because a weekly series cannot stand in for a daily one; and
 * the held bars have to reach the start of the period being asked about, or the
 * comparison would run over two different windows and call it one.
 */
export function planComparisonReuse(input: {
  artifact: ChartArtifact;
  wanted: { query: string; symbol: string }[];
  interval: Interval;
  range: DateRange;
}): { reuse: { query: string; symbol: string }[]; fetch: { query: string; symbol: string }[] } {
  const coverage = artifactCoverage(input.artifact);
  const reachesBackFarEnough =
    coverage.firstObservation !== null && coverage.firstObservation <= input.range.start;

  if (!reachesBackFarEnough) {
    return { reuse: [], fetch: input.wanted };
  }

  const held = reusableSeries(input.artifact, input.wanted, input.interval);

  const reuse: { query: string; symbol: string }[] = [];
  const fetch: { query: string; symbol: string }[] = [];

  for (const item of input.wanted) {
    if (held.has(normaliseSymbol(item.symbol))) reuse.push(item);
    else fetch.push(item);
  }

  return { reuse, fetch };
}
