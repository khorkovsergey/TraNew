import 'server-only';
import { and, gte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { customerAccounts } from './internalTraffic';
import {
  count as countMetric,
  featureDisabled,
  notMeasurable,
  sourceNotConnected,
  type MetricProvenance,
  type MetricValue,
  type SourceType,
} from '@/lib/analytics/states';
import { portalMetrics } from './portal';

/**
 * The overview query skeleton.
 *
 * Deliberately small, and deliberately covering one metric of each *class*
 * rather than many of one: a durable business fact, a telemetry-derived rate, a
 * missing external source, a flagged-off feature, and something that cannot be
 * known at all. Phase 1 is about proving the pipeline end to end, and the
 * pipeline is only proven if every state a card can be in has actually been
 * produced by a real query once.
 *
 * The rule every function here follows: **no query returns a bare number.**
 * There is no `value: number | null` anywhere, so there is no way for a card to
 * turn a missing source into a zero by forgetting a check — the compiler makes
 * it narrow the state first.
 */

export type Overview = {
  registeredUsers: MetricValue;
  newRegistrations: MetricValue;
  telemetryEvents: MetricValue;
  sessions: MetricValue;
  eligibleSessions: MetricValue;
  /** PMCR and its decomposition — the same denominator, narrower numerators. */
  meaningfulContinuation: MetricValue;
  internalContinuation: MetricValue;
  externalContinuation: MetricValue;
  ttfaMedian: MetricValue;
  ttfaP75: MetricValue;
  ttfaP90: MetricValue;
  sessionsWithoutAction: MetricValue;
  secondActionRate: MetricValue;
  confirmedRevenue: MetricValue;
  alertAdoption: MetricValue;
  anonymousReturn: MetricValue;
  collectingSince: string | null;
  queriedAt: string;
};

export async function overview(since: Date): Promise<Overview> {
  const queriedAt = new Date();
  const at = (metricId: string, source: string, sourceType: SourceType = 'durable_fact'): MetricProvenance => ({
    metricId,
    source,
    sourceType,
    queriedAt: queriedAt.toISOString(),
  });

  /*
   * Customers, not accounts. `customerAccounts()` is `role = 'user'`, and both
   * of these counted every row until it was applied — so an administrator was
   * presented on the headline card as a registered customer, and the first
   * staff account created inside a window appeared as a new registration. The
   * predicate is in the query rather than subtracted afterwards: a dashboard
   * that showed a real number and then adjusted it would be lying about a
   * different thing.
   */
  const [users] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.user)
    .where(customerAccounts());

  const [signups] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.user)
    .where(and(customerAccounts(), gte(schema.user.createdAt, since)));

  const [telemetry] = await db
    .select({
      total: sql<number>`count(*)::int`,
      earliest: sql<Date | null>`min(${schema.productTelemetryEvent.receivedAt})`,
    })
    .from(schema.productTelemetryEvent)
    .where(gte(schema.productTelemetryEvent.occurredAt, since));

  /*
   * The four Phase 2 headline metrics come from one place. `/overview` and
   * `/journeys` share it rather than each computing PMCR, because two
   * denominators derived separately eventually disagree and the disagreement
   * looks like a finding.
   */
  const portal = await portalMetrics(since);

  const collectingSince = telemetry?.earliest ? new Date(telemetry.earliest) : null;
  const partialWindow = !collectingSince || collectingSince > since;
  const telemetryState = partialWindow ? 'instrumented_going_forward' : 'live';

  return {
    registeredUsers: countMetric(users?.total ?? 0, at('registered_users', 'user')),

    newRegistrations: countMetric(signups?.total ?? 0, at('new_registrations', 'user')),

    telemetryEvents: countMetric(
      telemetry?.total ?? 0,
      at('telemetry_events', 'product_telemetry_event', 'telemetry'),
      telemetryState
    ),

    sessions: portal.sessionsSeen,
    eligibleSessions: portal.eligibleSessions,

    meaningfulContinuation: portal.continuation.overall,
    internalContinuation: portal.continuation.internal,
    externalContinuation: portal.continuation.external,

    ttfaMedian: portal.ttfa.median,
    ttfaP75: portal.ttfa.p75,
    ttfaP90: portal.ttfa.p90,
    sessionsWithoutAction: portal.ttfa.withoutAction,

    secondActionRate: portal.secondAction.rate,

    /*
     * Not a zero, and not a query. `purchase.status` distinguishes `demo` from
     * `paid` precisely so nothing counts an entitlement granted without money,
     * and no payment provider is connected to produce a `paid` row in the first
     * place. Returning 0 here would be the single most misleading number the
     * dashboard could show.
     */
    confirmedRevenue: sourceNotConnected('payment provider', at('confirmed_revenue', 'purchase', 'source_not_connected')),

    alertAdoption: FEATURE_FLAGS.alertsEnabled
      ? countMetric(0, at('alert_adoption', 'alert'), 'instrumented_going_forward')
      : featureDisabled('Alerts', at('alert_adoption', 'alert')),

    anonymousReturn: notMeasurable(
      'the portal has no cross-session anonymous identity, and the only anonymous key that exists is a day-scoped HMAC of an IP address used to rate-limit Voyager',
      'a consent surface, a first-party analytics cookie with a stated lifetime, and a privacy review',
      at('anonymous_d7', '—', 'source_not_connected')
    ),

    collectingSince: collectingSince ? collectingSince.toISOString() : null,
    queriedAt: queriedAt.toISOString(),
  };
}
