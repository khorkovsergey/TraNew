import { INTERVAL_SECONDS, type Bar, type PaintedFrame } from '../chart-engine/types';
import { INDICATORS, paneRequestFor, type IndicatorInstance } from '../indicators';

/**
 * What actually happened, as opposed to what was asked for.
 *
 * `superchart_study_toggled` fires at the top of the toggle handler, before the
 * engine has done anything, and it stays exactly as it is — it is the intent
 * signal and it is honest about being one. This module is the other half:
 * pressing "Add RSI" and RSI appearing on the chart are two different facts, and
 * a fulfilment rate built on the first is a rate of clicks.
 *
 * Pure, and deliberately outside the component. Every decision here is a
 * function of the engine's last completed frame and the datafeed's answer, so
 * the rules can be asserted without a browser — which matters more than usual,
 * because the whole point of these events is that they are not allowed to lie
 * about success.
 *
 * It is also the only place a capability token is built. `study:rsi` is a
 * product capability; `study:rsi:TSLA` is a position somebody may hold. Both
 * builders below validate against a registry and fall back to a bounded token,
 * so no callsite is in a position to concatenate a symbol into telemetry even by
 * accident.
 */

export type CapabilityOutcome = 'fulfilled' | 'no_data' | 'unsupported' | 'failure';

export type StudyPlacement = 'overlay' | 'pane';

export type StudyReport = {
  /**
   * The id that was asked for, for the caller's own bookkeeping.
   *
   * Never emitted. It exists so a stale id from a saved layout can be tracked
   * as one attempt without the string itself travelling — `study` and
   * `capability` are the bounded values, and this is not one of them.
   */
  requested: string;
  /** The registry id, or `unknown` when the product has no such study. */
  study: string;
  capability: string;
  outcome: CapabilityOutcome;
  /**
   * Where the engine put it — read off the painted frame, not predicted from
   * the registry. Null unless the study was actually applied.
   */
  placement: StudyPlacement | null;
};

/* ------------------------------------------------------- Capability tokens */

/**
 * A study capability, from the registry or not at all.
 *
 * An id that is not in `INDICATORS` becomes `study:unknown` rather than
 * travelling: a stale saved layout can name a study this build has never heard
 * of, and passing that string through would put arbitrary stored text into
 * telemetry.
 */
export function studyCapability(studyId: string): string {
  return INDICATORS[studyId] ? `study:${studyId}` : 'study:unknown';
}

/** An interval capability, from the engine's own interval table. */
export function intervalCapability(interval: string): string {
  return interval in INTERVAL_SECONDS ? `interval:${interval}` : 'interval:other';
}

/**
 * Every token this product can emit.
 *
 * Derived rather than written down, so a study added to the registry is covered
 * and a token that is not a product capability cannot appear. The privacy test
 * asserts against this list.
 */
export function capabilityVocabulary(): string[] {
  return [
    ...Object.keys(INDICATORS).map((id) => `study:${id}`),
    'study:unknown',
    ...Object.keys(INTERVAL_SECONDS).map((interval) => `interval:${interval}`),
    'interval:other',
  ];
}

/* -------------------------------------------------------------- Studies */

/**
 * What became of each study on the chart.
 *
 * The frame is the evidence. `studyIds` are the studies that put at least one
 * value on the canvas in the last completed paint, and `paneIds` are the panes
 * that frame actually contains — so a study that asked for a pane, got one, and
 * drew into it is the only thing counted as applied.
 *
 * The caller must have data loaded. Before the first bars arrive every series is
 * null and every study would read as `no_data`, which would be a lie about a
 * chart that has not tried yet.
 */
export function studyReports(input: {
  /** Live study choices — drafts and previews excluded by the caller. */
  choices: Array<{ definitionId: string }>;
  /** The instances handed to the engine. */
  instances: IndicatorInstance[];
  /** The engine's last completed frame, or null if it has painted nothing. */
  frame: PaintedFrame | null;
}): StudyReport[] {
  const reports: StudyReport[] = [];

  for (const choice of input.choices) {
    const definition = INDICATORS[choice.definitionId];

    // A product boundary rather than a fault: this build has no such study, so
    // there is nothing that could have rendered.
    if (!definition) {
      reports.push({
        requested: choice.definitionId,
        study: 'unknown',
        capability: 'study:unknown',
        outcome: 'unsupported',
        placement: null,
      });
      continue;
    }

    const instance = input.instances.find(
      (candidate) => candidate.definitionId === choice.definitionId
    );
    // Nothing was asked of the engine — hidden, or filtered out by the caller.
    // Silence is right here: no attempt, no outcome.
    if (!instance) continue;

    const capability = studyCapability(choice.definitionId);

    if (!input.frame) {
      // Data exists and the engine has completed no frame containing it. That is
      // an execution failure, not a gap in the series.
      reports.push({
        requested: choice.definitionId,
        study: definition.id,
        capability,
        outcome: 'failure',
        placement: null,
      });
      continue;
    }

    const spec = paneRequestFor(instance);
    const drawn = input.frame.studyIds.includes(definition.id);
    // An overlay needs no pane of its own; a separate-pane study needs its pane
    // to be in the frame before anything drawn into it can have been seen.
    const paneReady = !spec || input.frame.paneIds.includes(spec.id);

    if (drawn && paneReady) {
      reports.push({
        requested: choice.definitionId,
        study: definition.id,
        capability,
        outcome: 'fulfilled',
        placement: spec ? 'pane' : 'overlay',
      });
      continue;
    }

    if (!drawn && paneReady) {
      /*
       * The engine was ready for it and the series had nothing to draw — an RSI
       * on a handful of bars, a volume study on a series the provider returns
       * without volume. The capability exists; the data does not.
       */
      reports.push({
        requested: choice.definitionId,
        study: definition.id,
        capability,
        outcome: 'no_data',
        placement: null,
      });
      continue;
    }

    // The pane the study asked for is not in the frame: the engine did not apply
    // it, whatever the state says.
    reports.push({
      requested: choice.definitionId,
      study: definition.id,
      capability,
      outcome: 'failure',
      placement: null,
    });
  }

  return reports;
}

/**
 * Which of these reports is news.
 *
 * A chart repaints constantly — panning, zooming, resizing, switching interval,
 * every keystroke in a panel — and each repaint recomputes every study. One
 * press of "Add RSI" must still be one completion event, so a report is emitted
 * only when it differs from the last outcome recorded for that study.
 *
 * A change is not suppressed, though, and that is the reason this keeps the
 * outcome rather than a flag: a volume study that read `no_data` on a series
 * without volume and then rendered against one that has it has genuinely
 * completed, and the second fact is worth as much as the first.
 *
 * `seen` is updated in place — it is the caller's cache, and studies that have
 * left the chart are forgotten so that adding one again counts as a new attempt.
 */
export function unreportedOutcomes(
  reports: StudyReport[],
  seen: Map<string, CapabilityOutcome>
): StudyReport[] {
  const fresh: StudyReport[] = [];
  const present = new Set<string>();

  for (const report of reports) {
    present.add(report.requested);
    if (seen.get(report.requested) === report.outcome) continue;
    seen.set(report.requested, report.outcome);
    fresh.push(report);
  }

  for (const key of [...seen.keys()]) {
    if (!present.has(key)) seen.delete(key);
  }

  return fresh;
}

/* ------------------------------------------------------------ Intervals */

/**
 * What became of a request for bars at an interval.
 *
 * The order of these tests is the substance of the event. An interval the
 * adapter declines returns an empty series, so asking "were there bars?" first
 * would file every product boundary as a provider gap — and somebody reading the
 * dashboard would go and build an interval that already exists and is refused on
 * purpose.
 *
 * `supportedIntervals` comes from the resolved symbol, which is where an adapter
 * declares what it can honour. The portal's provider has daily data only and
 * says so there; the demo adapter honours everything.
 */
export function intervalReport(input: {
  interval: string;
  /** What the adapter says it can serve, or null when the symbol is unresolved. */
  supportedIntervals: readonly string[] | null;
  /** How many bars came back. */
  bars: number;
  /** The request threw instead of answering. */
  threw?: boolean;
  /** A response the person has already superseded is not a decision. */
  superseded?: boolean;
}): { capability: string; outcome: CapabilityOutcome } | null {
  if (input.superseded) return null;

  const capability = intervalCapability(input.interval);

  // The product boundary, first and on its own terms.
  if (input.supportedIntervals && !input.supportedIntervals.includes(input.interval)) {
    return { capability, outcome: 'unsupported' };
  }

  if (input.threw) return { capability, outcome: 'failure' };

  // Supported, attempted, and the provider had nothing for this window.
  if (input.bars === 0) return { capability, outcome: 'no_data' };

  return { capability, outcome: 'fulfilled' };
}

/* --------------------------------------------------------------- Series */

/**
 * Whether the series carries volume at all.
 *
 * Not "is a volume study on the chart" — those are different facts and the
 * dashboard needs them apart. This one is a property of the data: the portal's
 * provider returns daily closes with no volume field, and that is the reason a
 * volume capability comes back `no_data` rather than anything being broken.
 */
export function seriesHasVolume(bars: Bar[]): boolean {
  return bars.some((bar) => typeof bar.volume === 'number');
}

/**
 * The pane count the events carry, clamped to what the contract accepts.
 *
 * A frame that has painted nothing yet is one pane, because the price pane
 * always exists — and the registry refuses a zero.
 */
export function paneCountOf(frame: PaintedFrame | null): number {
  return Math.max(1, Math.min(12, frame?.paneIds.length ?? 1));
}
