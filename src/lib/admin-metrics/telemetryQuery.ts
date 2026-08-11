import 'server-only';
import { and, gte, inArray, notInArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { featureStateFor, SURFACE_BY_KEY } from '@/lib/analytics/surfaces';
import { MEANINGFUL_EVENTS } from './meaningful';
import { sessionFactsFrom, type SessionFacts, type TelemetryPoint } from './sessions';
import { NON_CUSTOMER_AREAS, type SurfaceEligibility } from './eligibility';
import type { UserDay } from './retention';

/**
 * The two reads Phase 2 needs from `product_telemetry_event`.
 *
 * The split is deliberate. Session metrics need per-event ordering inside a
 * session, so they fetch a **narrow projection** — the backbone plus the
 * meaningful events, and only the columns the reduction reads — and reduce in
 * one tested place. Retention needs no ordering at all, so it is a plain
 * group-by that never leaves the database.
 *
 * Neither is `select *`. The projection names its columns because the row width
 * is what makes the difference between a query that scales for a while and one
 * that does not, and because `properties` is the only wide column here.
 */

/**
 * The ceiling on a session-metric read.
 *
 * Chosen so it is far above any plausible window for this portal today and far
 * below anything that would trouble a Node process. When it is hit the caller
 * is **told** rather than handed a quietly shortened answer: a truncated
 * denominator is a wrong denominator, and a metric computed from one is worse
 * than no metric. Raising it is not the fix — a window that reaches this needs
 * the aggregation pushed into SQL, which is a real piece of work and is in the
 * backlog rather than pretended at here.
 */
export const MAX_PROJECTION_ROWS = 200_000;

/** The events a session metric reads. Everything else is irrelevant to it. */
const SESSION_EVENTS: readonly string[] = [
  'portal_session_started',
  'portal_page_viewed',
  'portal_engagement_checkpoint',
  'portal_navigation_completed',
  ...MEANINGFUL_EVENTS,
];

export function surfaceLookup(): (surface: string) => SurfaceEligibility | null {
  const flags = {
    superchartEnabled: FEATURE_FLAGS.superchartEnabled,
    wealthHubEnabled: FEATURE_FLAGS.wealthHubEnabled,
    alertsEnabled: FEATURE_FLAGS.alertsEnabled,
  };

  return (surface: string) => {
    const definition = SURFACE_BY_KEY.get(surface);
    if (!definition) return null;
    return { pmcrEligible: definition.pmcrEligible, featureState: featureStateFor(surface, flags) };
  };
}

export type SessionRead = {
  facts: SessionFacts[];
  rows: number;
  /** True when the cap was reached, so the caller must not report a rate. */
  truncated: boolean;
  freshest: Date | null;
  collectingSince: Date | null;
};

export async function readSessions(since: Date): Promise<SessionRead> {
  const rows = await db
    .select({
      sessionId: schema.productTelemetryEvent.sessionId,
      eventName: schema.productTelemetryEvent.eventName,
      occurredAt: schema.productTelemetryEvent.occurredAt,
      surface: schema.productTelemetryEvent.surface,
      routeTemplate: schema.productTelemetryEvent.routeTemplate,
      featureState: schema.productTelemetryEvent.featureState,
      authState: schema.productTelemetryEvent.authState,
      userKeyHash: schema.productTelemetryEvent.userKeyHash,
      acquisitionSource: schema.productTelemetryEvent.acquisitionSource,
      deviceClass: schema.productTelemetryEvent.deviceClass,
      entitlement: schema.productTelemetryEvent.entitlement,
      properties: schema.productTelemetryEvent.properties,
    })
    .from(schema.productTelemetryEvent)
    .where(
      and(
        gte(schema.productTelemetryEvent.occurredAt, since),
        inArray(schema.productTelemetryEvent.eventName, [...SESSION_EVENTS])
      )
    )
    /*
     * Ordered by the indexed column so the read is a range scan rather than a
     * sort of the whole window. The reduction sorts each session again anyway —
     * a retried batch can arrive out of order — so this is for the query plan,
     * not for correctness.
     */
    .orderBy(schema.productTelemetryEvent.occurredAt)
    .limit(MAX_PROJECTION_ROWS + 1);

  const truncated = rows.length > MAX_PROJECTION_ROWS;

  const [bounds] = await db
    .select({
      freshest: sql<Date | null>`max(${schema.productTelemetryEvent.receivedAt})`,
      collectingSince: sql<Date | null>`min(${schema.productTelemetryEvent.receivedAt})`,
    })
    .from(schema.productTelemetryEvent);

  const points: TelemetryPoint[] = rows.slice(0, MAX_PROJECTION_ROWS).map((row) => ({
    sessionId: row.sessionId,
    eventName: row.eventName,
    occurredAt: new Date(row.occurredAt).getTime(),
    surface: row.surface,
    routeTemplate: row.routeTemplate,
    featureState: row.featureState,
    authState: row.authState === 'registered' ? 'registered' : 'anonymous',
    userKeyHash: row.userKeyHash,
    acquisitionSource: row.acquisitionSource,
    deviceClass: row.deviceClass,
    entitlement: row.entitlement,
    properties: (row.properties ?? {}) as Record<string, unknown>,
  }));

  return {
    facts: sessionFactsFrom(points, surfaceLookup()),
    rows: points.length,
    truncated,
    freshest: bounds?.freshest ? new Date(bounds.freshest) : null,
    collectingSince: bounds?.collectingSince ? new Date(bounds.collectingSince) : null,
  };
}

/**
 * The behavioural events a product-family funnel needs.
 *
 * A separate, narrower read than `readSessions`, because most of these are not
 * meaningful actions and so are not in the session projection: a level
 * selection is a funnel step, not value. Only the four columns a funnel reads
 * are selected, and the caller names the events, so an unbounded fetch is not
 * expressible here.
 */
export async function readFunnelEvents(
  since: Date,
  eventNames: readonly string[]
): Promise<Array<{ sessionId: string; eventName: string; occurredAt: number; properties: Record<string, unknown> }>> {
  if (eventNames.length === 0) return [];

  const rows = await db
    .select({
      sessionId: schema.productTelemetryEvent.sessionId,
      eventName: schema.productTelemetryEvent.eventName,
      occurredAt: schema.productTelemetryEvent.occurredAt,
      properties: schema.productTelemetryEvent.properties,
    })
    .from(schema.productTelemetryEvent)
    .where(
      and(
        gte(schema.productTelemetryEvent.occurredAt, since),
        inArray(schema.productTelemetryEvent.eventName, [...eventNames])
      )
    )
    .orderBy(schema.productTelemetryEvent.occurredAt)
    .limit(MAX_PROJECTION_ROWS);

  return rows.map((row) => ({
    sessionId: row.sessionId,
    eventName: row.eventName,
    occurredAt: new Date(row.occurredAt).getTime(),
    properties: (row.properties ?? {}) as Record<string, unknown>,
  }));
}

/**
 * One row per authenticated user per UTC day.
 *
 * Grouped in the database and never materialised as events: retention needs no
 * ordering, so there is nothing to bring into memory. The day comes from
 * `received_at` because cohorts compare one person's days against another's and
 * only the server clock is comparable across clients.
 *
 * ## Where the area comes from, and the bug that made it matter
 *
 * The predicate reads `properties ->> 'area'`, **not the `surface` column**.
 *
 * This is not a stylistic choice. Ingest sets `surface` from the event's own
 * registry entry, and `portal_page_viewed` is registered under `portal` because
 * it is a backbone event — so *every* page view row in the table has
 * `surface = 'portal'`, whatever page it described. The earlier predicate
 * excluded the Observatory by testing `surface <> 'observatory'`, which is a
 * condition no page view has ever met, so it excluded nothing: a person who
 * only ever opened the Observatory counted as a returning customer. The real
 * page is in `properties.area`, which is where the client puts it.
 *
 * ## What counts as a return day
 *
 * A page view on a real customer surface — see `isCustomerPortalArea`. This is
 * intentionally not PMCR eligibility: it keeps `account` and `wealth`, because
 * somebody coming back to look at their own account has returned, and it drops
 * the engagement floor, because a person who returned and acted immediately has
 * also returned. It keeps every exclusion that matters, and **no volume of
 * server or operational telemetry can create a return day** — only a page view
 * can.
 */
export async function readUserDays(since: Date): Promise<UserDay[]> {
  const area = sql`coalesce(${schema.productTelemetryEvent.properties} ->> 'area', '')`;

  const rows = await db
    .select({
      userKeyHash: schema.productTelemetryEvent.userKeyHash,
      day: sql<string>`to_char(${schema.productTelemetryEvent.receivedAt}, 'YYYY-MM-DD')`,
      eligible: sql<boolean>`bool_or(${schema.productTelemetryEvent.eventName} = 'portal_page_viewed' and ${notInArray(area, [...NON_CUSTOMER_AREAS])})`,
      meaningful: sql<boolean>`bool_or(${inArray(schema.productTelemetryEvent.eventName, [...MEANINGFUL_EVENTS])})`,
    })
    .from(schema.productTelemetryEvent)
    .where(
      and(
        gte(schema.productTelemetryEvent.receivedAt, since),
        sql`${schema.productTelemetryEvent.userKeyHash} is not null`
      )
    )
    .groupBy(schema.productTelemetryEvent.userKeyHash, sql`2`);

  return rows
    .filter((row): row is typeof row & { userKeyHash: string } => Boolean(row.userKeyHash))
    .map((row) => ({
      userKeyHash: row.userKeyHash,
      day: row.day,
      eligible: Boolean(row.eligible),
      meaningful: Boolean(row.meaningful),
    }));
}
