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
   * The two outcome events, appended for the Superchart section to emit.
   *
   * `superchart_study_toggled` above fires as the toggle is pressed, so it
   * records intent. These record what the engine did with it — whether the
   * study rendered, on which pane, and why a capability did not happen. A
   * fulfilment rate built on the toggle would be a rate of clicks.
   *
   * Declared here before they have callers, on purpose: the Superchart worker
   * cannot write a type-safe `track()` call against a union member that does
   * not exist, and Metrics does not add emitters to another section's
   * components. `check:analytics` will report both as declared-and-unemitted
   * until that branch lands, which is the expected sequencing rather than a
   * regression — see `docs/admin-metrics/supercharts-instrumentation-request.md`.
   *
   * There is deliberately no `handoff` outcome: Supercharts has no TradingView
   * handoff, and an outcome nothing can emit would leave a permanent zero that
   * reads as a product decision.
   */
  | { name: 'superchart_study_applied'; study: string; placement: 'overlay' | 'pane'; paneCount: number }
  | { name: 'superchart_capability_completed'; capability: string; outcome: 'fulfilled' | 'no_data' | 'unsupported' | 'failure'; hasVolume: boolean; paneCount: number }
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
  | { name: 'registration_completed_from_plan'; steps: number }
  | { name: 'plan_resumed'; surface: string; completed: number; ofSteps: number }
  /*
   * "Find my next step" — the product router that replaced the plan funnel
   * above. Where somebody stops and where they end up; never what they said
   * about themselves.
   *
   * The three step events carry no payload on purpose. "I already invest" and
   * "improve what I already have" are facts about a person's money, and this
   * file's existing rule is that those do not travel — the funnel questions
   * (how many reach step two, how many finish) are all answerable by counting
   * the events themselves. The destination key is a product area rather than a
   * fact about the reader, so it is the one thing that does travel.
   */
  | { name: 'next_step_opened' }
  | { name: 'next_step_level_selected' }
  | { name: 'next_step_intent_selected' }
  | { name: 'next_step_clarification_selected' }
  | { name: 'next_step_recommendation_shown'; destination: string }
  | { name: 'next_step_destination_clicked'; destination: string; external: boolean }
  | { name: 'next_step_restarted' }
  /*
   * Voyager. The source page and whether a question came with it — never the
   * question, which is the person's, and never the subject, which is a position
   * they may hold.
   */
  | { name: 'voyager_opened'; source: string; hasQuestion: boolean }
  /*
   * The save funnel. Three events because they are three different outcomes and
   * the interesting one is the middle: how often somebody wants to keep a
   * conversation and is stopped by not having an account.
   *
   * None of them carry the chat. Titles are the person's own words about their
   * money, which is exactly what does not go to analytics.
   */
  | { name: 'voyager_save_clicked'; authenticated: boolean }
  | { name: 'voyager_auth_required_for_save' }
  | { name: 'voyager_chat_saved' }
  | { name: 'voyager_new_chat'; chatCount: number }
  /*
   * The chat funnel, per Journey B. Shapes and counts only: the question, the
   * answer and the subject stay out of here, because what somebody asks about
   * their money is the thing this product promises not to sell.
   */
  | { name: 'voyager_question_sent'; contextKind: string; mode: string; turns: number }
  | { name: 'voyager_tool_executed'; tool: string }
  | { name: 'voyager_limit_hit'; authenticated: boolean }
  | { name: 'voyager_auth_gate_shown'; askedInDialog: number }
  | { name: 'voyager_restored_after_auth'; turns: number }
  | { name: 'voyager_action_clicked'; action: string; authenticated: boolean }
  /*
   * What an action actually did. `voyager_action_clicked` above records the
   * press; these two record the outcome, which is a different fact and until
   * now an unrecorded one — the chat reported every confirmed action as a
   * success without asking a server, so there was nothing to count.
   *
   * The action id and the failure code only. Not the instrument, which is a
   * position somebody may hold, and not the title, which is their own words
   * about their money.
   */
  | { name: 'voyager_action_confirmed'; action: string; execution: 'mutate' | 'prepare' }
  | { name: 'voyager_action_failed'; action: string; code: string }
  /*
   * The expert-services funnel. Counts and ids only — a brief holds what
   * somebody is trying to do with their money, and none of that goes here.
   */
  | { name: 'voyager_message_sent'; turns: number }
  | { name: 'expert_brief_saved'; services: string }
  /* The id of a public marketplace profile and the tier we ranked it at. Which
     expert somebody picked is not private; what they wanted from them is. */
  | { name: 'expert_selected'; expertId: string; tier: string };

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
