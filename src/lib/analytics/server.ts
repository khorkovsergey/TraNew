import 'server-only';
import { randomUUID } from 'node:crypto';
import { db, schema } from '@/db';
import { EVENT_BY_NAME } from './registry';
import { pseudonymousUserKey, visitorKeyForSession } from './serverIdentity';

/**
 * Writing telemetry, and the server-side tracker.
 *
 * Two jobs in one file because they share the one rule that matters: a
 * telemetry write is best-effort and may never propagate a failure into the
 * thing it is describing. `track()` in `lib/events/analytics.ts` has swallowed
 * its errors since it was written; this keeps that property on the server,
 * where the temptation to `await` and to let a rejection escape is much
 * stronger because everything around it is already asynchronous.
 *
 * If the database is unreachable, the portal loses telemetry. It does not lose
 * a registration, an answer or a booking.
 */

export type TelemetryRow = {
  schemaVersion: number;
  occurredAt: Date;
  eventName: string;
  eventKind: 'client' | 'server' | 'operational';
  surface: string | null;
  routeTemplate: string | null;
  sessionId: string;
  visitorKeyHash: string | null;
  userKeyHash: string | null;
  authState: 'anonymous' | 'registered';
  entitlement: string | null;
  acquisitionSource: string | null;
  deviceClass: string | null;
  featureState: string;
  properties: Record<string, string | number | boolean>;
};

/**
 * Inserts a batch.
 *
 * `receivedAt` and the other application-side defaults are left to Drizzle
 * rather than supplied here — the orchestrator applied them as `$defaultFn`
 * rather than as database defaults, matching the rest of this schema, so the
 * normal Drizzle path is the one that fills them and a raw SQL insert would
 * have to do it by hand. This is the normal path.
 *
 * Returns how many rows were written, or `null` if the write failed. A caller
 * that ignores the return value is behaving correctly; the ingest route uses it
 * only to answer honestly.
 */
export async function persistEvents(rows: TelemetryRow[]): Promise<number | null> {
  if (rows.length === 0) return 0;

  try {
    await db.insert(schema.productTelemetryEvent).values(
      rows.map((row) => ({
        id: randomUUID(),
        schemaVersion: row.schemaVersion,
        occurredAt: row.occurredAt,
        eventName: row.eventName,
        eventKind: row.eventKind,
        surface: row.surface,
        routeTemplate: row.routeTemplate,
        sessionId: row.sessionId,
        visitorKeyHash: row.visitorKeyHash,
        userKeyHash: row.userKeyHash,
        authState: row.authState,
        entitlement: row.entitlement,
        acquisitionSource: row.acquisitionSource,
        deviceClass: row.deviceClass,
        featureState: row.featureState,
        properties: row.properties,
      }))
    );

    return rows.length;
  } catch {
    /*
     * Deliberately silent, and deliberately not rethrown. The ingest route
     * answers 202 either way: a browser cannot do anything useful with the news
     * that a metrics table is down, and a 500 here would make the client retry
     * a write that is not coming back.
     */
    return null;
  }
}

/* ------------------------------------------------------------ Server events */

export type ServerEventInput = {
  name: string;
  properties?: Record<string, string | number | boolean>;
  /** The session the event belongs to, when there is one to attribute it to. */
  sessionId?: string | null;
  /** The application user id. Hashed here; never stored raw, never logged. */
  userId?: string | null;
  entitlement?: string | null;
  surface?: string | null;
  routeTemplate?: string | null;
  occurredAt?: Date;
};

/**
 * Records something only the server can know.
 *
 * This exists because a browser cannot observe whether a request was accepted,
 * whether an answer came from a model or from the scripted fallback, whether a
 * quota charge was kept or given back, or why a provider failed — and a click
 * event that pretends to know is worse than no event, because it looks like
 * data.
 *
 * The helper is complete and tested now, and almost nothing calls it yet. That
 * is the ownership boundary rather than an omission: the call sites that matter
 * are inside `src/app/api/voyager/route.ts` and `src/lib/voyager/`, which
 * belong to the Voyager section. `docs/admin-metrics/current-state.md` §9e is
 * the request for them. Until those land, the Observatory reports the
 * corresponding metrics as `not_measurable` rather than inferring them from
 * clicks.
 *
 * Never awaited by product code. Never throws.
 */
export function trackServerEvent(input: ServerEventInput): void {
  void recordServerEvent(input);
}

/** The awaitable form, for the verification suite and for tests. */
export async function recordServerEvent(input: ServerEventInput): Promise<number | null> {
  try {
    const definition = EVENT_BY_NAME.get(input.name);

    // An unregistered server event is a programming error, not a runtime one.
    // Dropping it keeps the table describable: every row matches a declared
    // shape, which is the property the whole registry exists to guarantee.
    if (!definition) return null;
    if (definition.kind === 'client') return null;

    const sessionId = input.sessionId ?? `s_${'0'.repeat(32)}`;

    return await persistEvents([
      {
        schemaVersion: definition.schemaVersion,
        occurredAt: input.occurredAt ?? new Date(),
        eventName: definition.name,
        eventKind: definition.kind,
        surface: input.surface ?? definition.surface,
        routeTemplate: input.routeTemplate ?? null,
        sessionId,
        visitorKeyHash: input.sessionId ? visitorKeyForSession(input.sessionId) : null,
        userKeyHash: input.userId ? pseudonymousUserKey(input.userId) : null,
        authState: input.userId ? 'registered' : 'anonymous',
        entitlement: input.entitlement ?? null,
        acquisitionSource: null,
        deviceClass: null,
        featureState: 'live',
        properties: input.properties ?? {},
      },
    ]);
  } catch {
    return null;
  }
}
