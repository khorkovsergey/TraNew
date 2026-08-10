/**
 * Sessions, and the four headline metrics computed from them.
 *
 * Pure: a list of telemetry points in, numbers out. No database, no clock, no
 * environment. Every rule below — eligibility, deduplication, ordering,
 * percentiles, thresholds — is checkable by the harness with fixtures, which is
 * the only way a metric formula can be trusted, because a formula that is only
 * ever tested against live data is tested against whatever happened to be there.
 *
 * ## Which timestamp orders a session, and why
 *
 * **`occurred_at` orders events; `received_at` dates cohorts.**
 *
 * `received_at` cannot order events inside a session. The transport batches, so
 * twenty events from one page arrive in a single request and are stamped within
 * a millisecond of each other — the ordering it gives is the order the queue
 * happened to flush, not the order things happened. Using it would make TTFA a
 * measurement of the batching interval.
 *
 * `occurred_at` is the client's clock and is not trusted absolutely; ingest
 * already refuses anything more than a minute in the future or six hours old.
 * But every duration here is a *difference between two stamps from the same
 * client*, so a client whose clock is an hour out still reports the interval
 * between its own events correctly. A constant offset cancels; that is the
 * whole reason this is safe.
 *
 * What `occurred_at` cannot do is compare across clients, so retention — which
 * dates cohorts against each other — uses `received_at` and the server clock.
 * That split is deliberate and is stated in the Metric Dictionary.
 *
 * Negative intervals are clamped to zero rather than dropped: they mean a clock
 * moved, not that an action preceded the session, and dropping the session
 * would quietly bias the population toward people with well-behaved computers.
 */

import { actionIdentity, isExternalContinuation, isMeaningful } from './meaningful';
import {
  ENGAGEMENT_THRESHOLD_SECONDS,
  surfaceExclusion,
  type ExclusionReason,
  type SurfaceEligibility,
} from './eligibility';
import {
  count as countMetric,
  rate,
  type MetricProvenance,
  type MetricValue,
  type NumericState,
} from '@/lib/analytics/states';

/* ------------------------------------------------------------- The inputs */

export type TelemetryPoint = {
  sessionId: string;
  eventName: string;
  /** Milliseconds. The client's clock — see the header. */
  occurredAt: number;
  surface: string | null;
  routeTemplate: string | null;
  featureState: string;
  authState: 'anonymous' | 'registered';
  userKeyHash: string | null;
  acquisitionSource: string | null;
  deviceClass: string | null;
  entitlement: string | null;
  properties: Record<string, unknown>;
};

export type MeaningfulAction = {
  identity: string;
  eventName: string;
  at: number;
  surface: string;
  external: boolean;
};

export type SessionFacts = {
  sessionId: string;
  startedAt: number;
  landingSurface: string;
  landingRoute: string | null;
  engagedSeconds: number;
  hadPageView: boolean;
  authState: 'anonymous' | 'registered';
  userKeyHash: string | null;
  acquisition: string;
  device: string;
  entitlement: string | null;
  actions: MeaningfulAction[];
  /** null when the session never produced one. Never zero as a stand-in. */
  firstActionAt: number | null;
  /** Milliseconds from session start. null when there was no action. */
  timeToFirstAction: number | null;
  internalActions: number;
  externalActions: number;
  /** null means eligible. A reason means it is out, and says why. */
  excludedBecause: ExclusionReason | null;
};

/* --------------------------------------------------------- The reduction */

export function sessionFactsFrom(
  points: readonly TelemetryPoint[],
  lookupSurface: (surface: string) => SurfaceEligibility | null
): SessionFacts[] {
  const bySession = new Map<string, TelemetryPoint[]>();

  for (const point of points) {
    const bucket = bySession.get(point.sessionId);
    if (bucket) bucket.push(point);
    else bySession.set(point.sessionId, [point]);
  }

  return [...bySession.values()].map((events) => reduceSession(events, lookupSurface));
}

function reduceSession(
  events: TelemetryPoint[],
  lookupSurface: (surface: string) => SurfaceEligibility | null
): SessionFacts {
  /*
   * Sorted here rather than trusted from the query. Events arrive in batches
   * and a batch can be flushed out of order after a retry, so ordering is a
   * property this function establishes rather than one it assumes.
   */
  const ordered = [...events].sort((a, b) => a.occurredAt - b.occurredAt);
  const first = ordered[0];

  const startedAt = first.occurredAt;
  const pageViews = ordered.filter((event) => event.eventName === 'portal_page_viewed');
  const landing = pageViews[0] ?? null;

  const engagedSeconds = ordered
    .filter((event) => event.eventName === 'portal_engagement_checkpoint')
    .reduce((best, event) => Math.max(best, Number(event.properties.seconds ?? 0) || 0), 0);

  const landingSurface = landing ? String(landing.properties.area ?? landing.surface ?? 'unknown') : 'unknown';

  const actions = collectActions(ordered);
  const firstActionAt = actions.length ? actions[0].at : null;

  const facts: SessionFacts = {
    sessionId: first.sessionId,
    startedAt,
    landingSurface,
    landingRoute: landing ? String(landing.properties.route ?? '') || null : null,
    engagedSeconds,
    hadPageView: pageViews.length > 0,
    /*
     * A session that signs in mid-way is a registered session: the interesting
     * question is whether the person who was here ended up with an account, and
     * `authState` on the earliest event would say no for every successful
     * registration there is.
     */
    authState: ordered.some((event) => event.authState === 'registered') ? 'registered' : 'anonymous',
    userKeyHash: ordered.find((event) => event.userKeyHash)?.userKeyHash ?? null,
    acquisition: first.acquisitionSource ?? 'unknown',
    device: first.deviceClass ?? 'unknown',
    entitlement: ordered.find((event) => event.entitlement)?.entitlement ?? null,
    actions,
    firstActionAt,
    // Clamped: a negative interval means a clock moved, not that an action
    // happened before the session it belongs to.
    timeToFirstAction: firstActionAt === null ? null : Math.max(0, firstActionAt - startedAt),
    internalActions: actions.filter((action) => !action.external).length,
    externalActions: actions.filter((action) => action.external).length,
    excludedBecause: null,
  };

  facts.excludedBecause = excludeReason(facts, lookupSurface);
  return facts;
}

/**
 * The meaningful actions of a session, deduplicated by identity.
 *
 * Two events with the same identity are one action, however many times a
 * component emitted them — a control clicked twice, a component that fires on
 * every render, a retried batch that was delivered twice. Only the first
 * occurrence is kept, because a duplicate arriving later must not move TTFA.
 */
function collectActions(ordered: readonly TelemetryPoint[]): MeaningfulAction[] {
  const seen = new Set<string>();
  const actions: MeaningfulAction[] = [];
  let ordinal = 0;

  for (const event of ordered) {
    if (!isMeaningful(event.eventName)) continue;

    ordinal += 1;
    const identity = actionIdentity(event.eventName, event.properties, ordinal);
    if (seen.has(identity)) continue;
    seen.add(identity);

    actions.push({
      identity,
      eventName: event.eventName,
      at: event.occurredAt,
      surface: event.surface ?? 'unknown',
      external: isExternalContinuation(event.eventName),
    });
  }

  return actions;
}

function excludeReason(
  facts: SessionFacts,
  lookupSurface: (surface: string) => SurfaceEligibility | null
): ExclusionReason | null {
  if (!facts.hadPageView) return 'no_page_view';

  const surfaceProblem = surfaceExclusion(facts.landingSurface, lookupSurface);
  if (surfaceProblem) return surfaceProblem;

  /*
   * The engagement floor, last. A session that fails it is a bounce, and the
   * agreed definition removes bounces from the denominator rather than counting
   * them as failures to continue — no product change can improve a visit that
   * ended before it started.
   *
   * A session that produced a meaningful action passes regardless: acting is
   * stronger evidence of engagement than a timer, and a fast click that beat
   * the three-second checkpoint would otherwise be excluded for succeeding too
   * quickly.
   */
  if (facts.engagedSeconds < ENGAGEMENT_THRESHOLD_SECONDS && facts.actions.length === 0) {
    return 'below_engagement_threshold';
  }

  return null;
}

export function eligibleOnly(facts: readonly SessionFacts[]): SessionFacts[] {
  return facts.filter((session) => session.excludedBecause === null);
}

export function exclusionBreakdown(facts: readonly SessionFacts[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const session of facts) {
    if (!session.excludedBecause) continue;
    counts[session.excludedBecause] = (counts[session.excludedBecause] ?? 0) + 1;
  }
  return counts;
}

/* ------------------------------------------------------------------ PMCR */

export type ContinuationBreakdown = {
  overall: MetricValue;
  internal: MetricValue;
  external: MetricValue;
  eligibleSessions: number;
  continuedSessions: number;
};

/**
 * Portal Meaningful Continuation Rate.
 *
 *   eligible sessions with ≥1 meaningful action
 *   -------------------------------------------
 *   eligible sessions
 *
 * The decomposition is not a second metric. `internal` and `external` are the
 * same denominator with narrower numerators, so they can be read against the
 * headline without arithmetic — and a TradingView handoff stays visible as the
 * deliberate product boundary it is rather than disappearing into the total.
 */
export function continuationRate(
  facts: readonly SessionFacts[],
  provenance: (metricId: string) => MetricProvenance,
  options: { threshold: number; state: NumericState }
): ContinuationBreakdown {
  const eligible = eligibleOnly(facts);
  const denominator = eligible.length;

  const continued = eligible.filter((session) => session.actions.length > 0).length;
  const internal = eligible.filter((session) => session.internalActions > 0).length;
  const external = eligible.filter((session) => session.externalActions > 0).length;

  return {
    overall: rate(continued, denominator, provenance('pmcr'), options),
    internal: rate(internal, denominator, provenance('pmcr_internal'), options),
    external: rate(external, denominator, provenance('pmcr_external'), options),
    eligibleSessions: denominator,
    continuedSessions: continued,
  };
}

/* ------------------------------------------------------------------ TTFA */

export type TtfaResult = {
  median: MetricValue;
  p75: MetricValue;
  p90: MetricValue;
  /** Sessions that were eligible and never acted. Reported, never imputed. */
  withoutAction: MetricValue;
  sample: number;
};

/**
 * Time to First Meaningful Action, in seconds.
 *
 * Computed only over sessions that had one. A session with no action stays in
 * the PMCR denominator and gets **no** TTFA value — imputing one would mean the
 * metric could be improved by losing people, which is the specific way this
 * number goes wrong. How many were left out is returned beside it so the
 * omission is visible rather than implied.
 */
export function timeToFirstAction(
  facts: readonly SessionFacts[],
  provenance: (metricId: string) => MetricProvenance,
  options: { threshold: number; state: NumericState }
): TtfaResult {
  const eligible = eligibleOnly(facts);
  const durations = eligible
    .map((session) => session.timeToFirstAction)
    .filter((value): value is number => value !== null)
    .map((ms) => ms / 1000)
    .sort((a, b) => a - b);

  const at = (fraction: number, metricId: string): MetricValue => {
    if (durations.length < options.threshold) {
      return {
        state: 'insufficient_sample',
        sample: durations.length,
        threshold: options.threshold,
        ...provenance(metricId),
      };
    }
    return countMetric(percentile(durations, fraction), provenance(metricId), options.state);
  };

  return {
    median: at(0.5, 'ttfa_median'),
    p75: at(0.75, 'ttfa_p75'),
    p90: at(0.9, 'ttfa_p90'),
    withoutAction: countMetric(eligible.length - durations.length, provenance('ttfa_no_action'), options.state),
    sample: durations.length,
  };
}

/**
 * Nearest-rank percentile on a sorted ascending array.
 *
 * Chosen over interpolation because the values are durations from a modest
 * number of sessions: nearest-rank always returns a duration somebody actually
 * had, and an interpolated p90 between two observations is a number nobody
 * experienced. Stated here because a percentile method left unstated is a
 * percentile nobody can reproduce.
 */
export function percentile(sortedAscending: readonly number[], fraction: number): number {
  if (sortedAscending.length === 0) return 0;
  const rank = Math.ceil(fraction * sortedAscending.length);
  const index = Math.min(sortedAscending.length - 1, Math.max(0, rank - 1));
  return sortedAscending[index];
}

/* --------------------------------------------------- Second meaningful action */

export type SecondActionResult = {
  rate: MetricValue;
  numerator: number;
  denominator: number;
};

/**
 *   eligible sessions with ≥2 meaningful actions
 *   --------------------------------------------
 *   eligible sessions with ≥1 meaningful action
 *
 * The same taxonomy and the same deduplication as PMCR — there is deliberately
 * no second definition of "action" for this metric, because two definitions
 * would eventually disagree and the disagreement would look like a finding.
 */
export function secondActionRate(
  facts: readonly SessionFacts[],
  provenance: (metricId: string) => MetricProvenance,
  options: { threshold: number; state: NumericState }
): SecondActionResult {
  const eligible = eligibleOnly(facts);
  const acted = eligible.filter((session) => session.actions.length >= 1).length;
  const actedTwice = eligible.filter((session) => session.actions.length >= 2).length;

  return {
    rate: rate(actedTwice, acted, provenance('second_action_rate'), options),
    numerator: actedTwice,
    denominator: acted,
  };
}
