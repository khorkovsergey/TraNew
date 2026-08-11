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

  /* ------------------------------------------------------------ Intent
   *
   * From `superchart_study_toggled`, which fires as the toggle is pressed.
   * Somebody asked for a study. Whether the engine painted it is a different
   * event and a different set of numbers below.
   */
  studyRequests: number;
  sessionsRequestingStudy: number;
  requestedStudyMix: Array<{ study: string; placement: 'overlay' | 'pane' | 'unknown'; requests: number }>;

  /* ---------------------------------------------------------- Rendered
   *
   * From `superchart_study_applied` only. These are the product metrics: a
   * study that actually appeared, on the pane the engine actually used.
   */
  sessionsWithStudy: number;
  sessionsWithPaneStudy: number;
  studyMix: Array<{ study: string; placement: 'overlay' | 'pane' | 'unknown'; activations: number }>;
  overlayActivations: number;
  paneActivations: number;
  nativePaneMix: Array<{ study: string; activations: number }>;

  drawings: number;
  layoutsSaved: number;
  scriptsGenerated: number;
  scriptsExported: number;
  previewOutcomes: Array<{ outcome: string; count: number }>;
  capability: Array<{ outcome: string; count: number }>;
  sessionsSeen: number;
};

/**
 * Aggregates whatever Supercharts telemetry exists.
 *
 * **Intent and rendered are never added.** An earlier version wrote both the
 * toggle and the applied event into one set of counters, so a single study that
 * was requested and then painted arrived as two activations — six applied rows
 * became seven. That is not a rounding problem: it silently converted a click
 * into evidence that the engine had drawn something.
 *
 * Study activations count only `on: true`. A toggle-off is somebody removing a
 * study, and counting it as use would make a person who tried RSI and disliked
 * it look like two RSI users.
 *
 * Rendered placement comes from the applied event's own `placement`, which is
 * what the engine did, falling back to the catalogue only when the property is
 * absent. They should agree; where they do not, the engine is the truth.
 */
export function summariseSupercharts(events: readonly SuperchartEvent[]): SuperchartsSummary {
  const sessions = new Set<string>();

  /* Intent. */
  const requestedSessions = new Set<string>();
  const requested = new Map<string, number>();
  let studyRequests = 0;

  /* Rendered — a separate set of counters, deliberately. */
  const renderedSessions = new Set<string>();
  const renderedPaneSessions = new Set<string>();
  const rendered = new Map<string, number>();
  let overlayActivations = 0;
  let paneActivations = 0;

  const previews = new Map<string, number>();
  const capability = new Map<string, number>();

  let opens = 0;
  let drawings = 0;
  let layoutsSaved = 0;
  let scriptsGenerated = 0;
  let scriptsExported = 0;

  for (const event of events) {
    sessions.add(event.sessionId);

    switch (event.eventName) {
      case 'superchart_opened':
        opens += 1;
        break;

      case 'superchart_study_toggled': {
        if (event.properties.on !== true) break;

        const study = String(event.properties.studyId ?? 'unknown');
        studyRequests += 1;
        requested.set(study, (requested.get(study) ?? 0) + 1);
        requestedSessions.add(event.sessionId);
        break;
      }

      case 'superchart_study_applied': {
        const study = String(event.properties.study ?? 'unknown');
        rendered.set(study, (rendered.get(study) ?? 0) + 1);
        renderedSessions.add(event.sessionId);

        const placement = event.properties.placement === 'pane' || event.properties.placement === 'overlay'
          ? event.properties.placement
          : placementOf(study);

        if (placement === 'pane') {
          paneActivations += 1;
          renderedPaneSessions.add(event.sessionId);
        } else if (placement === 'overlay') {
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

  return {
    opens,

    studyRequests,
    sessionsRequestingStudy: requestedSessions.size,
    requestedStudyMix: [...requested.entries()]
      .map(([study, requests]) => ({ study, placement: placementOf(study), requests }))
      .sort((a, b) => b.requests - a.requests),

    sessionsWithStudy: renderedSessions.size,
    sessionsWithPaneStudy: renderedPaneSessions.size,
    studyMix: [...rendered.entries()]
      .map(([study, activations]) => ({ study, placement: placementOf(study), activations }))
      .sort((a, b) => b.activations - a.activations),
    overlayActivations,
    paneActivations,
    nativePaneMix: NATIVE_PANE_STUDIES.map((study) => ({
      study,
      activations: rendered.get(study) ?? 0,
    })),

    drawings,
    layoutsSaved,
    scriptsGenerated,
    scriptsExported,
    previewOutcomes: [...previews.entries()]
      .map(([outcome, count]) => ({ outcome, count }))
      .sort((a, b) => b.count - a.count),
    capability: [...capability.entries()]
      .map(([outcome, count]) => ({ outcome, count }))
      .sort((a, b) => b.count - a.count),
    sessionsSeen: sessions.size,
  };
}
