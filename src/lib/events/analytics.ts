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
  | { name: 'event_card_viewed'; eventId: string; position: number; section: string }
  | { name: 'event_viewed'; eventId: string; sourceType: string }
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
  | { name: 'event_reported'; eventId: string; reason: string };

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
