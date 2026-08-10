/**
 * The production transport, behind the abstraction that was written for it.
 *
 * `lib/events/analytics.ts` has always ended with `setAnalyticsSink`, exported
 * and never called, and a header explaining why: "when a real destination is
 * added, one function changes and nothing that emits an event has to be found
 * again." This is that function being called. No component changes, no feature
 * code learns about HTTP, and `track()` stays the product-facing API.
 *
 * Everything here is bounded and everything here swallows its own errors. The
 * inherited rule is that analytics must never be able to fail a registration,
 * so there is no code path from a failed send back into product code.
 *
 * ## Session, and what is not stored
 *
 * The session lives in `sessionStorage`, which is exactly the lifetime the
 * Phase 0 audit concluded was permissible: it dies with the tab, it is not
 * shared across tabs, and it cannot be used to recognise somebody tomorrow.
 * There is no `localStorage` write and no cookie set here. That is a decision,
 * not an oversight — see `identity.ts`.
 */

import type { AnalyticsEvent, AnalyticsSink } from '@/lib/events/analytics';
import { advanceSession, bucketAcquisition, deviceClass, type SessionState } from './identity';
import { TelemetryQueue, type QueuedEvent } from './queue';
import { routeTemplateFor } from './surfaces';

const SESSION_KEY = 'tn.telemetry.session';
const INGEST_PATH = '/api/admin-metrics/ingest';

function mintSessionId(): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Math.random()}${Date.now()}`;
  return `s_${uuid.replace(/[^0-9a-f]/gi, '').toLowerCase().slice(0, 32).padEnd(32, '0')}`;
}

function readSession(): SessionState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionState;
    return typeof parsed?.id === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function writeSession(session: SessionState): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* Private browsing, a full quota, a blocked storage API — none of it is
       worth an error in product code. The session simply restarts. */
  }
}

/**
 * The referrer, reduced to a bucket before anything leaves the page.
 *
 * `document.referrer` is a full URL and can carry a query string, which can
 * carry whatever somebody searched for to arrive here. Only the hostname is
 * read, only the bucket is sent, and the hostname itself never enters the
 * queue.
 */
function acquisitionBucket(): string {
  try {
    if (!document.referrer) return 'direct';
    const host = new URL(document.referrer).hostname;
    return bucketAcquisition(host, location.hostname);
  } catch {
    return 'unknown';
  }
}

export class HttpAnalyticsSink implements AnalyticsSink {
  private readonly queue = new TelemetryQueue();
  private session: SessionState;
  private readonly acquisition: string;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sending = false;

  constructor() {
    const { session } = advanceSession(readSession(), Date.now(), mintSessionId);
    this.session = session;
    writeSession(session);
    this.acquisition = acquisitionBucket();

    /*
     * `pagehide` rather than `beforeunload`: it fires on mobile tab switches
     * and on back/forward cache entry, which `beforeunload` does not, and those
     * are the cases where a session ends without anybody closing anything.
     */
    addEventListener('pagehide', () => void this.flush(true), { capture: true });
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.flush(true);
    });
  }

  /** The one method the product-facing seam calls. Never throws, never awaits. */
  track(event: AnalyticsEvent): void {
    try {
      this.enqueue(event.name, propertiesOf(event));
    } catch {
      /* Measuring something must never break the thing being measured. */
    }
  }

  /** For the global backbone, which is this section's own and not in the product union. */
  enqueue(name: string, properties: Record<string, string | number | boolean>): void {
    const now = Date.now();
    const { session, started } = advanceSession(this.session, now, mintSessionId);
    this.session = session;
    if (started) writeSession(session);

    this.queue.add({ name, occurredAt: new Date(now).toISOString(), properties });

    if (this.queue.shouldFlush(now)) void this.flush(false);
    else this.arm();
  }

  /**
   * One timer, armed for exactly as long as the queue says it is not yet due.
   *
   * The wait is asked of the queue rather than guessed at. An earlier version
   * armed a fixed two seconds and then re-asked `shouldFlush` on firing, which
   * refused because the ten-second interval had not elapsed — and since the
   * timer had already cleared itself, nothing rearmed it. A page that emitted a
   * session start and a page view sent the first and held the second until the
   * next event came along, which on a page nobody interacts with is never.
   */
  private arm(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush(false, true);
    }, this.queue.msUntilDue(Date.now()));
  }

  private async flush(hiding: boolean, due = false): Promise<void> {
    if (this.sending && !hiding) return;
    if (!due && !this.queue.shouldFlush(Date.now(), hiding)) return;
    if (this.queue.size === 0) return;

    const batch = this.queue.take(Date.now());
    if (batch.length === 0) return;

    const body = JSON.stringify(this.envelope(batch));

    /*
     * On the way out, `sendBeacon` is the only thing that reliably survives the
     * page going away — a `fetch` issued during unload is cancelled often
     * enough that the last events of a session would be missing more often than
     * not. It cannot report failure, which is an acceptable trade for the one
     * moment where a retry could not happen anyway.
     */
    if (hiding && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        navigator.sendBeacon(INGEST_PATH, new Blob([body], { type: 'application/json' }));
        this.queue.succeeded();
        return;
      } catch {
        /* Fall through to fetch. */
      }
    }

    this.sending = true;
    try {
      const response = await fetch(INGEST_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'same-origin',
      });

      if (response.ok) {
        this.queue.succeeded();
      } else if (response.status >= 500) {
        // A 4xx is this client's fault and will fail identically next time;
        // only a server-side failure is worth another attempt.
        if (this.queue.requeue(batch)) {
          setTimeout(() => void this.flush(false, true), this.queue.retryDelayMs());
        }
      }
    } catch {
      if (this.queue.requeue(batch)) {
        setTimeout(() => void this.flush(false, true), this.queue.retryDelayMs());
      }
    } finally {
      this.sending = false;
    }
  }

  private envelope(events: QueuedEvent[]) {
    return {
      sessionId: this.session.id,
      sessionStartedAt: new Date(this.session.startedAt).toISOString(),
      device: deviceClass(typeof innerWidth === 'number' ? innerWidth : 0),
      acquisition: this.acquisition,
      route: routeTemplateFor(location.pathname),
      dropped: this.queue.dropped,
      events,
    };
  }
}

/**
 * The payload of a typed product event, minus its name.
 *
 * The union's members are flat objects whose only shared key is `name`, so this
 * is a subtraction rather than a mapping. Values that are not primitives are
 * dropped instead of serialised: nothing in the union has one today, and if
 * something grows one it will fail the registry check on the server rather than
 * arriving as JSON nobody declared.
 */
function propertiesOf(event: AnalyticsEvent): Record<string, string | number | boolean> {
  const properties: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(event as Record<string, unknown>)) {
    if (key === 'name') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      properties[key] = value;
    }
  }

  return properties;
}
