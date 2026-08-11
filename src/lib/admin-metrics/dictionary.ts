/**
 * The Metric Dictionary, machine-readable.
 *
 * Import-free apart from the modules that already hold the constants, so the
 * dictionary cannot state a threshold the code does not use — the numbers below
 * are the same values the queries read, not copies of them.
 *
 * The rule this exists to keep: **no formula lives in JSX.** A definition
 * written into a component is a definition that drifts from the query the first
 * time somebody edits one and not the other, and the reader has no way to know
 * which of the two the number came from. The UI reads these entries; it does
 * not restate them.
 *
 * The test a card must survive is one question — *where did this number come
 * from?* — answered with a source, a formula, an eligible population, an
 * exclusion list and a limitation. An entry that cannot answer it should not
 * have a card.
 */

import type { SourceType } from '@/lib/analytics/states';
import { ENGAGEMENT_THRESHOLD_SECONDS, EXCLUSION_REASONS } from './eligibility';
import { MIN_BREAKDOWN_COHORT } from './journeys';
import { RETENTION_HORIZONS } from './retention';

/** The default minimum before a rate is shown at all. */
export const DEFAULT_MIN_SAMPLE = 200;
/** Marketplace volumes are smaller by nature; the brief set this separately. */
export const MARKETPLACE_MIN_SAMPLE = 50;

export type MetricDefinition = {
  id: string;
  label: string;
  /**
   * Behaviour, business fact, or neither.
   *
   * Required rather than optional, because the mistake it prevents is the
   * central one of this phase: reading a durable count as behavioural evidence,
   * or a funnel event as proof that an outcome happened.
   */
  sourceType: SourceType;
  formula: string;
  numerator: string;
  denominator: string;
  eligiblePopulation: string;
  exclusions: readonly string[];
  grain: 'session' | 'user' | 'event' | 'day';
  sourceEvents: readonly string[];
  /** Which timestamp orders the calculation, and why it is that one. */
  timeSemantics: string;
  minimumSample: number;
  limitations: readonly string[];
  owner: string;
};

/**
 * The limitation every telemetry-derived metric carries and will carry for a
 * while yet. Written once so it cannot be stated three different ways.
 */
const NO_HISTORY =
  'Production analytics was a no-op until the Phase 1 deployment, so there is no history before it. A window reaching further back is not a smaller number — it is no number, and the state says which.';

const SESSION_ELIGIBILITY =
  `Portal sessions with a page view, on a live landing surface the catalogue marks as eligible, with at least ${ENGAGEMENT_THRESHOLD_SECONDS} seconds of visible engagement — or a meaningful action, which is stronger evidence of engagement than a timer.`;

const COMMON_EXCLUSIONS = EXCLUSION_REASONS;

/**
 * Said in full because "first day" is exactly the ambiguity that made the first
 * implementation wrong: it dated cohorts from the earliest telemetry row of any
 * kind.
 */
const RETENTION_POPULATION =
  'Authenticated users only, grouped by the HMAC-derived user key. The cohort starts on the user\'s FIRST ELIGIBLE PORTAL DAY — a UTC day on which they viewed a page on a real customer surface. Not their first telemetry row, not their first server or operational event, not an Observatory visit, and not sign-in plumbing. A user who has never had an eligible portal day is not in the population at all: they have not started a cohort, so they can be neither retained nor lost from one. Anonymous visitors are not measured.';

const RETENTION_VS_PMCR =
  'Retention-day eligibility is deliberately not PMCR eligibility, in one direction only. It keeps `account` and `wealth`, because somebody returning to look at their own account has plainly returned even though that is not a landing whose continuation means anything; and it drops the three-second engagement floor, because a person who came back, acted immediately and left has still come back. It keeps every exclusion that matters — the Observatory, auth plumbing, and the backbone bucket are not customer visits under either rule.';

const CONTINUATION_SOURCES = [
  'portal_session_started',
  'portal_page_viewed',
  'portal_engagement_checkpoint',
  'portal_meaningful_action',
  'portal_external_continuation',
];

const INTRA_SESSION_TIME =
  'Ordered by occurred_at, the client clock. received_at cannot order events within a session because the transport batches — twenty events from one page arrive in one request stamped within a millisecond of each other. Every duration is a difference between two stamps from the same client, so a client whose clock is wrong still reports its own intervals correctly. Negative intervals are clamped to zero.';

export const METRIC_DICTIONARY: readonly MetricDefinition[] = [
  {
    id: 'pmcr',
    label: 'Portal Meaningful Continuation Rate',
    sourceType: 'derived',
    formula: 'eligible sessions with ≥1 meaningful action ÷ eligible sessions',
    numerator: 'Eligible sessions containing at least one meaningful action, deduplicated by action identity.',
    denominator: 'Eligible portal sessions.',
    eligiblePopulation: SESSION_ELIGIBILITY,
    exclusions: COMMON_EXCLUSIONS,
    grain: 'session',
    sourceEvents: CONTINUATION_SOURCES,
    timeSemantics: INTRA_SESSION_TIME,
    minimumSample: DEFAULT_MIN_SAMPLE,
    limitations: [
      NO_HISTORY,
      'A page view is never meaningful, a click is not an action, and a failed action is not a success. The rate is allowed to be low.',
      'Feature-local actions can only count where the owning section already emits an event for them. Uninstrumented value is invisible here, not absent from the product.',
    ],
    owner: 'portal',
  },
  {
    id: 'pmcr_internal',
    label: 'Internal continuation',
    sourceType: 'derived',
    formula: 'eligible sessions with ≥1 in-portal meaningful action ÷ eligible sessions',
    numerator: 'Eligible sessions whose meaningful actions kept the person in the portal.',
    denominator: 'Eligible portal sessions — the same denominator as PMCR.',
    eligiblePopulation: SESSION_ELIGIBILITY,
    exclusions: COMMON_EXCLUSIONS,
    grain: 'session',
    sourceEvents: CONTINUATION_SOURCES,
    timeSemantics: INTRA_SESSION_TIME,
    minimumSample: DEFAULT_MIN_SAMPLE,
    limitations: [NO_HISTORY, 'Shares its denominator with PMCR so the two can be read against each other without arithmetic.'],
    owner: 'portal',
  },
  {
    id: 'pmcr_external',
    label: 'External continuation',
    sourceType: 'derived',
    formula: 'eligible sessions with ≥1 external continuation ÷ eligible sessions',
    numerator: 'Eligible sessions that continued to a destination outside the portal.',
    denominator: 'Eligible portal sessions.',
    eligiblePopulation: SESSION_ELIGIBILITY,
    exclusions: COMMON_EXCLUSIONS,
    grain: 'session',
    sourceEvents: ['portal_external_continuation', 'event_external_link_clicked'],
    timeSemantics: INTRA_SESSION_TIME,
    minimumSample: DEFAULT_MIN_SAMPLE,
    limitations: [
      NO_HISTORY,
      'A handoff is a product boundary the portal chose to have, not a failure — but it is shown separately because a session that left is not a session that stayed.',
    ],
    owner: 'portal',
  },
  {
    id: 'ttfa_median',
    label: 'Time to first meaningful action (median)',
    sourceType: 'derived',
    formula: 'median over eligible sessions that acted of (first meaningful action − session start), in seconds',
    numerator: '—',
    denominator: '—',
    eligiblePopulation: `${SESSION_ELIGIBILITY} Only sessions that produced an action contribute a value.`,
    exclusions: [...COMMON_EXCLUSIONS, 'sessions with no meaningful action (counted separately, never imputed)'],
    grain: 'session',
    sourceEvents: CONTINUATION_SOURCES,
    timeSemantics: `${INTRA_SESSION_TIME} Percentiles are nearest-rank, so every reported value is a duration somebody actually had.`,
    minimumSample: DEFAULT_MIN_SAMPLE,
    limitations: [
      NO_HISTORY,
      'Sessions with no action stay in the PMCR denominator and receive no TTFA value. Imputing one would let the metric improve by losing people.',
    ],
    owner: 'portal',
  },
  {
    id: 'second_action_rate',
    label: 'Second meaningful action rate',
    sourceType: 'derived',
    formula: 'eligible sessions with ≥2 meaningful actions ÷ eligible sessions with ≥1',
    numerator: 'Eligible sessions with at least two distinct meaningful actions.',
    denominator: 'Eligible sessions with at least one.',
    eligiblePopulation: SESSION_ELIGIBILITY,
    exclusions: [...COMMON_EXCLUSIONS, 'repeats of the same action, which are one action'],
    grain: 'session',
    sourceEvents: CONTINUATION_SOURCES,
    timeSemantics: INTRA_SESSION_TIME,
    minimumSample: DEFAULT_MIN_SAMPLE,
    limitations: [
      NO_HISTORY,
      'Uses the same taxonomy and the same deduplication as PMCR. A second definition would eventually disagree, and the disagreement would look like a finding.',
    ],
    owner: 'portal',
  },
  ...RETENTION_HORIZONS.map((horizon) => ({
    id: `retention_d${horizon}`,
    label: `Authenticated D${horizon} return`,
    sourceType: 'derived' as const,
    formula: `cohort members with ≥1 eligible portal day in [1, ${horizon}] days after their first eligible portal day ÷ mature cohort members`,
    numerator: `Signed-in people who had another eligible portal day within ${horizon} day(s) of their first one.`,
    denominator: `Signed-in people whose first eligible portal day is at least ${horizon} days ago and falls after telemetry began.`,
    eligiblePopulation: RETENTION_POPULATION,
    exclusions: [
      ...COMMON_EXCLUSIONS,
      'days with only server or operational telemetry, which are not visits',
      'users who have never had an eligible portal day, who have not started a cohort at all',
      'cohorts younger than the window, which have not had the chance to return',
      'cohorts formed before telemetry existed, which cannot be shown to have churned over a period nobody was watching',
    ],
    grain: 'user' as const,
    sourceEvents: ['portal_page_viewed'],
    timeSemantics:
      'UTC calendar days from received_at, the server clock — the one place occurred_at must not be used, because retention compares one client\'s days against another\'s. Windows are cumulative, so D1 ≤ D7 ≤ D30 always.',
    minimumSample: MARKETPLACE_MIN_SAMPLE,
    limitations: [
      NO_HISTORY,
      `Cumulative window, not an anniversary. Asking whether somebody appeared exactly ${horizon} days later measures how weekly their habits are, not whether they came back.`,
      'A secondary "returned and did something" figure is reported beside it and never conflated with it. A meaningful action on a day with no portal visit counts as neither: the person was not there.',
      RETENTION_VS_PMCR,
    ],
    owner: 'portal',
  })),
  {
    id: 'retention_anonymous',
    label: 'Anonymous D1/D7/D30 return',
    sourceType: 'source_not_connected',
    formula: '—',
    numerator: '—',
    denominator: '—',
    eligiblePopulation: 'None. There is no population this can be computed over.',
    exclusions: [],
    grain: 'user',
    sourceEvents: [],
    timeSemantics: '—',
    minimumSample: 0,
    limitations: [
      'Not measurable. The portal has no cross-session anonymous identity; its only anonymous key is a day-scoped HMAC of an IP address that exists to rate-limit Voyager, and reusing it would turn a rate limiter into a behavioural history.',
      'Enabling it would require a consent surface, a first-party analytics cookie with a stated lifetime, and a privacy review. That is a product decision, not an implementation detail.',
    ],
    owner: 'portal',
  },
  {
    id: 'journey_breakdown',
    label: 'Journey breakdowns',
    sourceType: 'derived',
    formula: 'continuation rate within each category',
    numerator: 'Eligible sessions in the category that continued.',
    denominator: 'Eligible sessions in the category.',
    eligiblePopulation: SESSION_ELIGIBILITY,
    exclusions: COMMON_EXCLUSIONS,
    grain: 'session',
    sourceEvents: CONTINUATION_SOURCES,
    timeSemantics: INTRA_SESSION_TIME,
    minimumSample: MIN_BREAKDOWN_COHORT,
    limitations: [
      NO_HISTORY,
      `Categories below ${MIN_BREAKDOWN_COHORT} sessions report a count and withhold the rate. Sliced far enough, a breakdown describes one person, and the threshold is where that is stopped.`,
      'Aggregate only. Nothing here can return a session or a person.',
    ],
    owner: 'portal',
  },
];

/* ------------------------------------------- Phase 3 — the product families */

/**
 * Only the family metrics that are genuinely *derived* get an entry here.
 *
 * A durable count needs no formula: "rows in `event_registration` with status
 * `registered`" is its own definition, and its source, source type and caveats
 * travel with it in the provenance and the family's `limitations`. Writing sixty
 * near-identical entries would bury the four that state something a reader
 * could get wrong.
 */
const DURABLE_NOT_HISTORY =
  'A current-state table, not a transition log. The distribution says where things are now, and reading it as a conversion funnel would attribute drop-off to stages nobody was observed leaving.';

const FAMILY_METRICS: readonly MetricDefinition[] = [
  {
    id: 'start_funnel',
    label: 'Find my next step — funnel',
    sourceType: 'telemetry',
    formula: 'sessions reaching each stage, where every earlier stage happened in the same session and no later',
    numerator: 'Sessions that reached the stage in order.',
    denominator: 'Sessions that reached the previous stage.',
    eligiblePopulation: 'Sessions that emitted `next_step_opened`.',
    exclusions: ['the seven retired plan-funnel events, which have no emitter and whose screen is now a redirect'],
    grain: 'session',
    sourceEvents: [
      'next_step_opened',
      'next_step_level_selected',
      'next_step_intent_selected',
      'next_step_recommendation_shown',
      'next_step_destination_clicked',
    ],
    timeSemantics: INTRA_SESSION_TIME,
    minimumSample: MIN_BREAKDOWN_COHORT,
    limitations: [
      NO_HISTORY,
      'Sequential within a session. Dividing one event total by another would assume an order the events do not carry, and a restarted session emits `next_step_opened` twice.',
      '`next_step_clarification_selected` is optional and is never a denominator: not every route asks, so treating it as mandatory would report every unambiguous path as a drop-off.',
      'Behavioural only. There is no durable "next step" record, so nothing here is a business outcome.',
    ],
    owner: 'start',
  },
  {
    id: 'events_attendance_rate',
    label: 'Event attendance rate',
    sourceType: 'durable_fact',
    formula: 'attended ÷ (registered + attended + no_show)',
    numerator: 'Registration rows marked attended.',
    denominator: 'Registration rows that took a seat — registered, attended or no-show. Cancellations and waitlist are not seats.',
    eligiblePopulation: 'Rows in `event_registration`.',
    exclusions: ['cancelled registrations', 'waitlisted registrations, which never held a seat'],
    grain: 'event',
    sourceEvents: [],
    timeSemantics: 'Current state. `event_registration.status` is overwritten as a registration moves.',
    minimumSample: MARKETPLACE_MIN_SAMPLE,
    limitations: [
      'Attendance and no-show only exist where an organiser marked them, so this describes the events that were marked rather than all events.',
      'A durable registration and an `event_registration_completed` event are different evidence about the same flow and are never added.',
      DURABLE_NOT_HISTORY,
    ],
    owner: 'events',
  },
  {
    id: 'academy_completion_rate',
    label: 'Academy completion rate',
    sourceType: 'durable_fact',
    formula: 'learners with `completed` ÷ learners with an `academy_progress` row',
    numerator: 'Users whose progress row is marked completed.',
    denominator: 'Users with a progress row, which is the documented definition of having started.',
    eligiblePopulation: 'Rows in `academy_progress`, one per user.',
    exclusions: [],
    grain: 'user',
    sourceEvents: [],
    timeSemantics: 'Current state. One row per user, overwritten in place.',
    minimumSample: MARKETPLACE_MIN_SAMPLE,
    limitations: [
      'How many of today\'s learners have finished, not how many of a cohort did. It is not a cohort completion rate and must not be read as one.',
      DURABLE_NOT_HISTORY,
      'Diagnostic answers are never read; only the length of `lessons_done` is used.',
    ],
    owner: 'academy',
  },
  {
    id: 'experts_pipeline',
    label: 'Expert booking pipeline',
    sourceType: 'durable_fact',
    formula: 'count of bookings in each current status',
    numerator: '—',
    denominator: '—',
    eligiblePopulation: 'Rows in `expert_booking`.',
    exclusions: [],
    grain: 'user',
    sourceEvents: [],
    timeSemantics: 'Current state. `status` is overwritten as a booking moves; there is no transition history.',
    minimumSample: MARKETPLACE_MIN_SAMPLE,
    limitations: [
      'No conversion rate is published. Dividing completed by draft would compare finished bookings against unstarted ones and would move whenever somebody opens a new draft.',
      'A booking is not money. Only a linked purchase could be, and see confirmed revenue for why even that is not.',
      'The brief, summary and shared financial context are encrypted and never selected.',
    ],
    owner: 'experts',
  },
  {
    id: 'confirmed_revenue',
    label: 'Confirmed revenue',
    sourceType: 'source_not_connected',
    formula: '—',
    numerator: '—',
    denominator: '—',
    eligiblePopulation: 'None. No provider-confirmed transaction exists to aggregate.',
    exclusions: ['`demo` purchases, which are entitlements granted without money'],
    grain: 'user',
    sourceEvents: [],
    timeSemantics: '—',
    minimumSample: 0,
    limitations: [
      'A `paid` row is an application record, not a provider-confirmed transaction. `externalRef` is the reconciliation hook and nothing populates it.',
      'The sum of paid rows is reported separately as a recorded gross amount, under that name, and is not revenue.',
      'Connecting this needs a payment provider and a reconciliation path — a product decision, not an implementation detail.',
    ],
    owner: 'commerce',
  },
  {
    id: 'wealth_adoption',
    label: 'Wealth Hub adoption',
    sourceType: 'durable_fact',
    formula: 'distinct users with at least one current record, per record type',
    numerator: 'Users with a current asset, liability or goal.',
    denominator: '—',
    eligiblePopulation: 'Rows in the Wealth tables, excluding superseded assets.',
    exclusions: ['superseded asset revisions, which would count one revised holding several times'],
    grain: 'user',
    sourceEvents: [],
    timeSemantics: 'Current state, with asset versions resolved by `supersededAt is null`.',
    minimumSample: MARKETPLACE_MIN_SAMPLE,
    limitations: [
      'Adoption only. No monetary column is selected anywhere in this family, so no portfolio value, net worth or liability total exists to report.',
      'Country and currency are readable in the clear and are still not used: with a small cohort they narrow a person down.',
      'When the feature flag is off, adoption reports feature-disabled rather than zero.',
    ],
    owner: 'wealth',
  },
];

export const METRIC_DICTIONARY_ALL: readonly MetricDefinition[] = [
  ...METRIC_DICTIONARY,
  ...FAMILY_METRICS,
];

export const DICTIONARY_BY_ID: ReadonlyMap<string, MetricDefinition> = new Map(
  METRIC_DICTIONARY_ALL.map((entry) => [entry.id, entry])
);
