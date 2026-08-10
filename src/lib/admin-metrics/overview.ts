import 'server-only';
import { gte, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { MEANINGFUL_EVENT_NAMES } from '@/lib/analytics/registry';
import {
  count as countMetric,
  featureDisabled,
  notMeasurable,
  rate,
  sourceNotConnected,
  withFreshness,
  type MetricProvenance,
  type MetricValue,
} from '@/lib/analytics/states';

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

const FRESHNESS_BUDGET_SECONDS = 15 * 60;
const DEFAULT_THRESHOLD = 200;

export type Overview = {
  registeredUsers: MetricValue;
  newRegistrations: MetricValue;
  telemetryEvents: MetricValue;
  sessions: MetricValue;
  meaningfulContinuation: MetricValue;
  confirmedRevenue: MetricValue;
  alertAdoption: MetricValue;
  anonymousReturn: MetricValue;
  collectingSince: string | null;
  queriedAt: string;
};

export async function overview(since: Date): Promise<Overview> {
  const queriedAt = new Date();
  const at = (metricId: string, source: string): MetricProvenance => ({
    metricId,
    source,
    queriedAt: queriedAt.toISOString(),
  });

  const [users] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.user);

  const [signups] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.user)
    .where(gte(schema.user.createdAt, since));

  const [telemetry] = await db
    .select({
      total: sql<number>`count(*)::int`,
      sessions: sql<number>`count(distinct ${schema.productTelemetryEvent.sessionId})::int`,
      freshest: sql<Date | null>`max(${schema.productTelemetryEvent.receivedAt})`,
      earliest: sql<Date | null>`min(${schema.productTelemetryEvent.receivedAt})`,
    })
    .from(schema.productTelemetryEvent)
    .where(gte(schema.productTelemetryEvent.occurredAt, since));

  const [continuation] = await db
    .select({
      eligible: sql<number>`count(distinct ${schema.productTelemetryEvent.sessionId})::int`,
      /*
       * `inArray` rather than `= any(...)`: Drizzle renders a JavaScript array
       * inside a raw template as a row constructor — `any(($1, $2, …))` — which
       * is a tuple and not an array, and Postgres refuses it. The operator
       * renders `in ($1, $2, …)`, which is what was meant.
       */
      continued: sql<number>`(count(distinct ${schema.productTelemetryEvent.sessionId}) filter (where ${inArray(schema.productTelemetryEvent.eventName, [...MEANINGFUL_EVENT_NAMES])}))::int`,
    })
    .from(schema.productTelemetryEvent)
    .where(gte(schema.productTelemetryEvent.occurredAt, since));

  const freshest = telemetry?.freshest ? new Date(telemetry.freshest) : null;

  /*
   * Every telemetry-derived figure is `instrumented_going_forward`, not `live`,
   * for as long as the collection start is inside the window being asked about.
   * Before this section shipped, production analytics went into a sink that
   * printed nothing, so a comparison against last month is not a smaller number
   * — it is no number, and the card has to say which.
   */
  const collectingSince = telemetry?.earliest ? new Date(telemetry.earliest) : null;
  const partialWindow = !collectingSince || collectingSince > since;
  const telemetryState = partialWindow ? 'instrumented_going_forward' : 'live';

  return {
    registeredUsers: countMetric(users?.total ?? 0, at('registered_users', 'user')),

    newRegistrations: countMetric(signups?.total ?? 0, at('new_registrations', 'user')),

    telemetryEvents: withFreshness(
      countMetric(telemetry?.total ?? 0, at('telemetry_events', 'product_telemetry_event'), telemetryState),
      freshest,
      FRESHNESS_BUDGET_SECONDS,
      queriedAt
    ),

    sessions: withFreshness(
      countMetric(telemetry?.sessions ?? 0, at('sessions', 'product_telemetry_event'), telemetryState),
      freshest,
      FRESHNESS_BUDGET_SECONDS,
      queriedAt
    ),

    /*
     * PMCR, in its first form. The full definition adds the three-second
     * engagement floor and the eligible-surface filter; this is the numerator
     * and denominator against the same session set, which is the part the
     * pipeline has to prove it can compute at all.
     */
    meaningfulContinuation: rate(
      continuation?.continued ?? 0,
      continuation?.eligible ?? 0,
      at('pmcr', 'product_telemetry_event'),
      { threshold: DEFAULT_THRESHOLD, state: telemetryState }
    ),

    /*
     * Not a zero, and not a query. `purchase.status` distinguishes `demo` from
     * `paid` precisely so nothing counts an entitlement granted without money,
     * and no payment provider is connected to produce a `paid` row in the first
     * place. Returning 0 here would be the single most misleading number the
     * dashboard could show.
     */
    confirmedRevenue: sourceNotConnected('payment provider', at('confirmed_revenue', 'purchase')),

    alertAdoption: FEATURE_FLAGS.alertsEnabled
      ? countMetric(0, at('alert_adoption', 'alert'), 'instrumented_going_forward')
      : featureDisabled('Alerts', at('alert_adoption', 'alert')),

    anonymousReturn: notMeasurable(
      'the portal has no cross-session anonymous identity, and the only anonymous key that exists is a day-scoped HMAC of an IP address used to rate-limit Voyager',
      'a consent surface, a first-party analytics cookie with a stated lifetime, and a privacy review',
      at('anonymous_d7', '—')
    ),

    collectingSince: collectingSince ? collectingSince.toISOString() : null,
    queriedAt: queriedAt.toISOString(),
  };
}
