import { NextResponse, type NextRequest } from 'next/server';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { getSession } from '@/lib/session';
import { looksAutomated, isWellFormedSessionId } from '@/lib/analytics/identity';
import { persistEvents, recordServerEvent, type TelemetryRow } from '@/lib/analytics/server';
import { pseudonymousUserKey, visitorKeyForSession } from '@/lib/analytics/serverIdentity';
import { featureStateFor, surfaceForRoute, SURFACE_BY_KEY } from '@/lib/analytics/surfaces';
import { LIMITS, validateBatch } from '@/lib/analytics/validate';

/**
 * Telemetry ingest.
 *
 * The rule the whole route is built around: **the browser is asked what
 * happened, never who it is.** Event name, timestamp and declared properties
 * come from the client and are validated against the registry. Auth state,
 * pseudonymous identity, entitlement, receipt time and feature state are
 * derived here, from the session, and any value the client sends for them is
 * ignored rather than merged — a widget that could name its own entitlement
 * could name `ai_private`, and every adoption rate keyed on entitlement would
 * be whatever the browser felt like claiming.
 *
 * It answers 202 to almost everything. A browser can do nothing useful with a
 * validation error, and a 500 would make the transport retry a write that is
 * not coming back. What the response does carry is a count, so the verification
 * suite can assert what was stored without reading the database from the
 * client.
 */

export const dynamic = 'force-dynamic';

/**
 * A crude per-session flood guard.
 *
 * In-memory and therefore per-instance, which makes it a nuisance filter rather
 * than a security control — the real protections are the allowlist, the schema
 * and the size caps above it, none of which depend on state. It is here so one
 * looping client cannot fill a table, and it is documented as what it is rather
 * than described as rate limiting.
 */
const WINDOW_MS = 60_000;
const MAX_EVENTS_PER_WINDOW = 600;
const seen = new Map<string, { count: number; resetAt: number }>();

function floodGuard(key: string, events: number, now: number): boolean {
  const entry = seen.get(key);

  if (!entry || now > entry.resetAt) {
    seen.set(key, { count: events, resetAt: now + WINDOW_MS });

    // Bounded, so a long-lived instance cannot accumulate a map of every
    // session it has ever answered.
    if (seen.size > 5_000) {
      for (const [candidate, value] of seen) {
        if (now > value.resetAt) seen.delete(candidate);
      }
    }

    return true;
  }

  entry.count += events;
  return entry.count <= MAX_EVENTS_PER_WINDOW;
}

const accepted = (stored: number, rejected: number) =>
  NextResponse.json({ stored, rejected }, { status: 202 });

export async function POST(request: NextRequest) {
  const now = new Date();

  /*
   * Length first, before the body is read into memory. `sendBeacon` cannot set
   * headers, so a missing content-length is normal and the parsed size is
   * checked as well — this is the cheap gate, not the only one.
   */
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (declaredLength > LIMITS.maxBytes) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return accepted(0, 0);
  }

  if (raw.length > LIMITS.maxBytes) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }

  let envelope: {
    sessionId?: unknown;
    device?: unknown;
    acquisition?: unknown;
    route?: unknown;
    events?: unknown;
  };

  try {
    envelope = JSON.parse(raw);
  } catch {
    return accepted(0, 0);
  }

  const sessionId = typeof envelope.sessionId === 'string' ? envelope.sessionId : '';
  if (!isWellFormedSessionId(sessionId)) {
    return accepted(0, 0);
  }

  const batch = validateBatch(envelope.events, now);

  // `reason` is what tells the two results apart: a whole-batch rejection has
  // one, a per-event result does not.
  if ('reason' in batch) {
    void recordServerEvent({
      name: 'telemetry_ingest_rejected',
      properties: { reason: batch.reason, eventName: 'batch' },
      sessionId,
    });
    return accepted(0, 1);
  }

  if (!floodGuard(sessionId, batch.accepted.length, now.getTime())) {
    return accepted(0, batch.accepted.length);
  }

  /*
   * Everything from here is the server's own account of the request. None of it
   * is read from the envelope, and the envelope is not consulted again.
   */
  const session = await getSession();
  const user = session?.user ?? null;

  /*
   * Automated traffic is dropped rather than stored and filtered later. Keeping
   * it would mean every rate in the dashboard depended on a `WHERE` clause
   * somebody could forget, and the header it is judged by is read here and
   * never written anywhere.
   */
  if (looksAutomated(request.headers.get('user-agent'))) {
    return accepted(0, batch.accepted.length);
  }

  const routeTemplate = typeof envelope.route === 'string' ? envelope.route : 'unknown';
  const envelopeSurface = surfaceForRoute(routeTemplate);

  const flags = {
    superchartEnabled: FEATURE_FLAGS.superchartEnabled,
    wealthHubEnabled: FEATURE_FLAGS.wealthHubEnabled,
    alertsEnabled: FEATURE_FLAGS.alertsEnabled,
  };

  const device = typeof envelope.device === 'string' ? envelope.device : null;
  const acquisition = typeof envelope.acquisition === 'string' ? envelope.acquisition : null;

  const rows: TelemetryRow[] = batch.accepted.map((event) => {
    /*
     * The event's own surface wins over the page it was sent from. A Voyager
     * question asked from a market page is Voyager telemetry; attributing it to
     * `markets` because that is where the widget was open would make every
     * surface look like it had a chat.
     */
    const surface = SURFACE_BY_KEY.has(event.definition.surface)
      ? event.definition.surface
      : envelopeSurface;

    return {
      schemaVersion: event.definition.schemaVersion,
      occurredAt: event.occurredAt,
      eventName: event.name,
      eventKind: event.definition.kind,
      surface,
      routeTemplate: routeTemplate === 'unknown' ? null : routeTemplate,
      sessionId,
      visitorKeyHash: visitorKeyForSession(sessionId),
      userKeyHash: user ? pseudonymousUserKey(user.id) : null,
      authState: user ? 'registered' : 'anonymous',
      entitlement: user ? ((user as { plan?: string }).plan ?? 'free') : null,
      acquisitionSource: acquisition,
      deviceClass: device,
      featureState: featureStateFor(surface, flags),
      properties: event.properties,
    };
  });

  const stored = await persistEvents(rows);

  for (const rejection of batch.rejected.slice(0, 5)) {
    void recordServerEvent({
      name: 'telemetry_ingest_rejected',
      properties: { reason: rejection.reason, eventName: rejection.name },
      sessionId,
    });
  }

  return accepted(stored ?? 0, batch.rejected.length);
}
