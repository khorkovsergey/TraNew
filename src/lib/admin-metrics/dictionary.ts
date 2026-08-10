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
    formula: `cohort members with ≥1 eligible session on a UTC day in [1, ${horizon}] ÷ mature cohort members`,
    numerator: `Signed-in people who came back at least once within ${horizon} day(s) of their first day.`,
    denominator: `Signed-in people whose first day is at least ${horizon} days ago and falls after telemetry began.`,
    eligiblePopulation:
      'Authenticated users only, grouped by the HMAC-derived user key. Anonymous visitors are not measured.',
    exclusions: [
      ...COMMON_EXCLUSIONS,
      'cohorts younger than the window, which have not had the chance to return',
      'cohorts formed before telemetry existed, which cannot be shown to have churned over a period nobody was watching',
    ],
    grain: 'user' as const,
    sourceEvents: CONTINUATION_SOURCES,
    timeSemantics:
      'UTC calendar days from received_at, the server clock — the one place occurred_at must not be used, because retention compares one client\'s days against another\'s. Windows are cumulative, so D1 ≤ D7 ≤ D30 always.',
    minimumSample: MARKETPLACE_MIN_SAMPLE,
    limitations: [
      NO_HISTORY,
      `Cumulative window, not an anniversary. Asking whether somebody appeared exactly ${horizon} days later measures how weekly their habits are, not whether they came back.`,
      'A secondary "returned and did something" figure is reported beside it and is never conflated with it.',
    ],
    owner: 'portal',
  })),
  {
    id: 'retention_anonymous',
    label: 'Anonymous D1/D7/D30 return',
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

export const DICTIONARY_BY_ID: ReadonlyMap<string, MetricDefinition> = new Map(
  METRIC_DICTIONARY.map((entry) => [entry.id, entry])
);
