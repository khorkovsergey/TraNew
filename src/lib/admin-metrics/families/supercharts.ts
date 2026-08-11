/**
 * Supercharts, from the events that already exist plus the ones that do not.
 *
 * Import-free, so the classification below is checkable with fixtures.
 *
 * ## Two audit findings that shape everything here
 *
 * **`superchart_study_toggled` is intent, not outcome.** It fires at the top of
 * `toggleIndicator`, before the engine has done anything. So it answers "did
 * somebody ask for RSI", never "did RSI render", and a fulfilment rate built on
 * it would be a rate of clicks.
 *
 * **Supercharts has no TradingView handoff.** The old brief describes one and
 * the current section contains none — the handoff that exists belongs to
 * Voyager. So no handoff metric is built here and the capability enum has no
 * `handoff` value: declaring an outcome nothing can emit would put a permanent
 * zero on the dashboard that reads as a product decision rather than as an
 * absence.
 *
 * What *can* be classified today, with no new emitter: whether a study is an
 * overlay or its own pane. The canonical indicator registry already says, and
 * the study id travels on the existing event.
 */

/**
 * Placement, from the canonical registry in `lib/superchart/indicators`.
 *
 * Copied deliberately rather than imported: this module is compiled alone by
 * the verification harness, and the indicator registry pulls in the whole chart
 * engine. A test asserts the two agree, so a divergence fails rather than
 * drifts.
 */
export const STUDY_PLACEMENT: Readonly<Record<string, 'overlay' | 'pane'>> = {
  sma: 'overlay',
  ema: 'overlay',
  rsi: 'pane',
  macd: 'pane',
  volume: 'pane',
  'volume-ma': 'pane',
  'volume-anomaly': 'pane',
};

/** The three the product added native panes for, and which the brief asked about. */
export const NATIVE_PANE_STUDIES = ['rsi', 'macd', 'volume'] as const;

export function placementOf(study: string): 'overlay' | 'pane' | 'unknown' {
  return STUDY_PLACEMENT[study] ?? 'unknown';
}

export type SuperchartEvent = {
  sessionId: string;
  eventName: string;
  properties: Record<string, unknown>;
};

export type SuperchartsSummary = {
  opens: number;
  sessionsWithStudy: number;
  sessionsWithPaneStudy: number;
  drawings: number;
  layoutsSaved: number;
  scriptsGenerated: number;
  scriptsExported: number;
  /** By id, so the mix is visible rather than a single "studies used" number. */
  studyMix: Array<{ study: string; placement: 'overlay' | 'pane' | 'unknown'; activations: number }>;
  overlayActivations: number;
  paneActivations: number;
  nativePaneMix: Array<{ study: string; activations: number }>;
  previewOutcomes: Array<{ outcome: string; count: number }>;
  /** Present only once the capability emitter lands. */
  capability: Array<{ outcome: string; count: number }>;
  sessionsSeen: number;
};

/**
 * Aggregates whatever Supercharts telemetry exists.
 *
 * Study activations count only `on: true`. A toggle-off is somebody removing a
 * study, and counting it as use would make a person who tried RSI and disliked
 * it look like two RSI users.
 */
export function summariseSupercharts(events: readonly SuperchartEvent[]): SuperchartsSummary {
  const sessions = new Set<string>();
  const withStudy = new Set<string>();
  const withPaneStudy = new Set<string>();
  const studies = new Map<string, number>();
  const previews = new Map<string, number>();
  const capability = new Map<string, number>();

  let opens = 0;
  let drawings = 0;
  let layoutsSaved = 0;
  let scriptsGenerated = 0;
  let scriptsExported = 0;
  let overlayActivations = 0;
  let paneActivations = 0;

  for (const event of events) {
    sessions.add(event.sessionId);

    switch (event.eventName) {
      case 'superchart_opened':
        opens += 1;
        break;

      case 'superchart_study_toggled': {
        if (event.properties.on !== true) break;

        const study = String(event.properties.studyId ?? 'unknown');
        studies.set(study, (studies.get(study) ?? 0) + 1);
        withStudy.add(event.sessionId);

        const placement = placementOf(study);
        if (placement === 'pane') {
          paneActivations += 1;
          withPaneStudy.add(event.sessionId);
        } else if (placement === 'overlay') {
          overlayActivations += 1;
        }
        break;
      }

      case 'superchart_study_applied': {
        /* The outcome event, once the Superchart section emits it. */
        const study = String(event.properties.study ?? 'unknown');
        studies.set(study, (studies.get(study) ?? 0) + 1);
        withStudy.add(event.sessionId);
        if (event.properties.placement === 'pane') {
          paneActivations += 1;
          withPaneStudy.add(event.sessionId);
        } else {
          overlayActivations += 1;
        }
        break;
      }

      case 'superchart_drawing_created':
        drawings += 1;
        break;
      case 'superchart_layout_saved':
        layoutsSaved += 1;
        break;
      case 'superchart_script_generated':
        scriptsGenerated += 1;
        break;
      case 'superchart_script_exported':
        scriptsExported += 1;
        break;

      case 'superchart_preview_run': {
        const outcome = String(event.properties.outcome ?? 'unknown');
        previews.set(outcome, (previews.get(outcome) ?? 0) + 1);
        break;
      }

      case 'superchart_capability_completed': {
        const outcome = String(event.properties.outcome ?? 'unknown');
        capability.set(outcome, (capability.get(outcome) ?? 0) + 1);
        break;
      }
    }
  }

  const studyMix = [...studies.entries()]
    .map(([study, activations]) => ({ study, placement: placementOf(study), activations }))
    .sort((a, b) => b.activations - a.activations);

  return {
    opens,
    sessionsWithStudy: withStudy.size,
    sessionsWithPaneStudy: withPaneStudy.size,
    drawings,
    layoutsSaved,
    scriptsGenerated,
    scriptsExported,
    studyMix,
    overlayActivations,
    paneActivations,
    nativePaneMix: NATIVE_PANE_STUDIES.map((study) => ({
      study,
      activations: studies.get(study) ?? 0,
    })),
    previewOutcomes: [...previews.entries()]
      .map(([outcome, count]) => ({ outcome, count }))
      .sort((a, b) => b.count - a.count),
    capability: [...capability.entries()]
      .map(([outcome, count]) => ({ outcome, count }))
      .sort((a, b) => b.count - a.count),
    sessionsSeen: sessions.size,
  };
}
