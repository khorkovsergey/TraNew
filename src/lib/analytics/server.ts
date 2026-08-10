import 'server-only';
import { randomUUID } from 'node:crypto';
import { db, schema } from '@/db';
import { pseudonymousUserKey, visitorKeyForSession } from './serverIdentity';
import { conformsToRegistry, SERVER_KINDS, validateEvent } from './validate';

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
  /*
   * The last line, and the one that makes the privacy contract a property of
   * the table rather than of every caller. Both entry points validate before
   * reaching here, so this should never drop anything — which is the point: a
   * row assembled by hand somewhere else, by somebody who did not know about
   * the validator, still cannot put an undeclared field in the database.
   */
  const conforming = rows.filter((row) => conformsToRegistry(row.eventName, row.properties));

  if (conforming.length !== rows.length && process.env.NODE_ENV !== 'production') {
    console.warn(
      `[analytics] dropped ${rows.length - conforming.length} row(s) that did not match the registry`
    );
  }

  if (conforming.length === 0) return 0;

  try {
    await db.insert(schema.productTelemetryEvent).values(
      conforming.map((row) => ({
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

    return conforming.length;
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
    const now = new Date();

    /*
     * The same validator the browser's events go through, with the only
     * difference named explicitly: which kinds are acceptable from this
     * direction.
     *
     * This used to check the event name and its kind and then pass
     * `input.properties` through unread — so a call site could have written
     * `{ prompt: '…' }` straight into the table. The registry's inability to
     * *declare* free text was no protection, because nothing was consulting the
     * registry. A separate server-side schema would have drifted into the same
     * hole; this cannot, because there is only one contract and both entry
     * points are the same call.
     */
    const result = validateEvent(
      {
        name: input.name,
        occurredAt: (input.occurredAt ?? now).toISOString(),
        properties: input.properties ?? {},
      },
      now,
      SERVER_KINDS
    );

    if (!result.ok) {
      /*
       * Dropped, never thrown, and never reported as telemetry — an event about
       * a rejected event would recurse the first time the reporting event was
       * itself malformed. In development it prints, because a rejection here is
       * a programming error at a call site and silence would hide it until
       * somebody noticed a metric that never moved.
       */
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[analytics] server event refused: ${input.name} — ${result.reason} (${result.detail})`);
      }
      return null;
    }

    const sessionId = input.sessionId ?? `s_${'0'.repeat(32)}`;

    return await persistEvents([
      {
        schemaVersion: result.definition.schemaVersion,
        occurredAt: result.occurredAt,
        eventName: result.definition.name,
        eventKind: result.definition.kind,
        surface: input.surface ?? result.definition.surface,
        routeTemplate: input.routeTemplate ?? null,
        sessionId,
        visitorKeyHash: input.sessionId ? visitorKeyForSession(input.sessionId) : null,
        userKeyHash: input.userId ? pseudonymousUserKey(input.userId) : null,
        authState: input.userId ? 'registered' : 'anonymous',
        entitlement: input.entitlement ?? null,
        acquisitionSource: null,
        deviceClass: null,
        featureState: 'live',
        // The validator's output, not the caller's input: anything undeclared
        // was rejected above rather than trimmed, so these are exactly the
        // properties the registry names.
        properties: result.properties,
      },
    ]);
  } catch {
    return null;
  }
}
