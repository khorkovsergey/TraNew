/**
 * Product analytics.
 *
 * There is no analytics backend in this repository, so this is an interface with
 * a local implementation behind it. The point of writing it this way rather than
 * calling a vendor SDK from components: when a real destination is added, one
 * function changes and nothing that emits an event has to be found again.
 *
 * Two rules the local implementation already enforces, so they cannot be
 * forgotten later. Nothing identifying goes into a payload — no email, no name,
 * no free-text search string beyond its length. And every event is fire and
 * forget; analytics must never be able to fail a registration.
 */

export type AnalyticsEvent =
  | { name: 'events_discovery_viewed'; view: string; filterCount: number; resultCount: number }
  | { name: 'events_filter_applied'; filter: string; valueCount: number }
  | { name: 'events_search_performed'; queryLength: number; resultCount: number }
  | { name: 'events_view_mode_changed'; view: string }
  /*
   * `event_card_viewed` was declared here and never emitted. Counting card
   * impressions needs an IntersectionObserver per card and a definition of what
   * counts as seen; none of that is built, and a schema that promises
   * impression data nobody collects reads later as "the section is unused"
   * rather than "the section is uninstrumented". It comes back with the
   * observer.
   */
  | { name: 'event_viewed'; eventId: string }
  | { name: 'event_saved'; eventId: string; saved: boolean }
  | { name: 'event_shared'; eventId: string; channel: string }
  | { name: 'event_registration_started'; eventId: string }
  | { name: 'event_registration_completed'; eventId: string; waitlisted: boolean }
  | { name: 'event_registration_cancelled'; eventId: string }
  | { name: 'event_waitlist_joined'; eventId: string; position: number }
  | { name: 'event_external_link_clicked'; eventId: string; domain: string; trusted: boolean }
  | { name: 'event_calendar_action'; eventId: string; target: string }
  | { name: 'event_creation_started' }
  | { name: 'event_creation_step_completed'; step: number }
  | { name: 'event_creation_submitted'; eventId: string }
  | { name: 'event_reported'; eventId: string; reason: string }
  /*
   * Superchart. No symbol names and no script text: a ticker somebody looks at
   * is a position they may hold, and a script is their work. Shapes and counts
   * answer every question the product actually has of this data.
   */
  | { name: 'superchart_opened'; interval: string; dataStatus: string }
  | { name: 'superchart_study_toggled'; studyId: string; on: boolean }
  | { name: 'superchart_drawing_created'; tool: string }
  | { name: 'superchart_layout_saved'; destination: 'browser' | 'account' }
  | { name: 'superchart_voyager_asked'; mode: string; contextKb: number; chipsRemoved: number }
  | { name: 'superchart_plan_proposed'; steps: number; refusals: number }
  | { name: 'superchart_plan_applied'; steps: number; ofSteps: number }
  | { name: 'superchart_undo'; source: 'keyboard' | 'button' | 'toast' }
  | { name: 'superchart_script_generated'; studies: number }
  | { name: 'superchart_script_exported' }
  | { name: 'superchart_preview_run'; outcome: 'ok' | 'failed' | 'unavailable'; plots: number }
  /*
   * The starting-plan funnel. Counts and shapes only: which goal somebody chose
   * is a fact about their money, and the product's questions of this data —
   * where people stop, whether a personalised route gets further than a generic
   * one — are all answerable from step counts.
   */
  | { name: 'intent_selected'; intent: string }
  | { name: 'diagnostic_completed'; steps: number }
  | { name: 'plan_generated'; steps: number; risk: string }
  | { name: 'plan_step_started'; stepId: string; index: number }
  | { name: 'plan_step_completed'; stepId: string; ofSteps: number }
  | { name: 'save_prompt_viewed'; surface: string }
  /*
   * `registration_completed_from_plan` belongs here and is not declared yet.
   * Migrating a guest draft into an account on sign-up is not built — see the
   * journey notes — and an event that promises to measure a step nobody has
   * written reads later as "nobody registers from the plan" rather than "the
   * step does not exist". It arrives with the migration.
   */
  | { name: 'plan_resumed'; surface: string; completed: number; ofSteps: number };

export interface AnalyticsSink {
  track(event: AnalyticsEvent): void;
}

/**
 * The default sink. In development it prints; in production it is silent rather
 * than noisy, because a console full of analytics hides the errors that matter.
 * Swap this for a real transport in one place.
 */
class LocalSink implements AnalyticsSink {
  private readonly verbose: boolean;

  constructor(verbose: boolean) {
    this.verbose = verbose;
  }

  track(event: AnalyticsEvent): void {
    if (!this.verbose) return;
    console.debug('[analytics]', event.name, event);
  }
}

let sink: AnalyticsSink = new LocalSink(process.env.NODE_ENV === 'development');

/** Called once at start-up when a real destination exists. */
export function setAnalyticsSink(next: AnalyticsSink): void {
  sink = next;
}

export function track(event: AnalyticsEvent): void {
  try {
    sink.track(event);
  } catch {
    /* Measuring something must never break the thing being measured. */
  }
}
