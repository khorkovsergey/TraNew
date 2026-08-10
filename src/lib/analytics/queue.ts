/**
 * The client-side send queue, as rules.
 *
 * Import-free and browser-free: no `window`, no `fetch`, no timers. The
 * transport in `sink.ts` supplies those. What lives here is every decision the
 * queue makes — when to flush, what to drop, how long to wait before retrying —
 * because those are the decisions that can lose data or wedge a page, and both
 * failures are silent by nature.
 *
 * The governing constraint is stated in `lib/events/analytics.ts` and inherited
 * whole: **analytics must never be able to fail the thing it is measuring.**
 * Everything below is bounded. The queue has a ceiling, the retry has a
 * ceiling, and when either is reached the queue drops events rather than
 * growing — a person filling in a registration form is not going to lose it
 * because a metrics endpoint is down.
 */

export type QueuedEvent = {
  name: string;
  occurredAt: string;
  properties: Record<string, string | number | boolean>;
};

export const QUEUE_LIMITS = {
  /** Flush once this many are waiting. */
  batchSize: 20,
  /** Flush after this long, even if the batch is not full. */
  flushIntervalMs: 10_000,
  /**
   * The ceiling. Beyond this the oldest events are dropped.
   *
   * Dropping the oldest rather than refusing the newest is deliberate: if the
   * endpoint has been unreachable for a while, the recent events describe what
   * the person is doing now, and those are the ones worth keeping.
   */
  maxQueued: 200,
  maxAttempts: 3,
  baseRetryMs: 1_000,
} as const;

export type DropReason = 'queue_full';

export class TelemetryQueue {
  private pending: QueuedEvent[] = [];
  private attempts = 0;

  /*
   * Seeded at construction rather than at zero. From zero, `now - lastFlushAt`
   * is already past the interval on the very first event, so the first thing a
   * page ever emits is flushed alone — a batch of one, followed by a full
   * interval of waiting for everything else.
   */
  private lastFlushAt = Date.now();

  /** Counted rather than logged, and reported through ingest health. */
  public dropped = 0;

  constructor(private readonly limits = QUEUE_LIMITS) {}

  get size(): number {
    return this.pending.length;
  }

  add(event: QueuedEvent): DropReason | null {
    this.pending.push(event);

    if (this.pending.length > this.limits.maxQueued) {
      const overflow = this.pending.length - this.limits.maxQueued;
      this.pending.splice(0, overflow);
      this.dropped += overflow;
      return 'queue_full';
    }

    return null;
  }

  /**
   * Whether to send now.
   *
   * `hiding` is the page-hide case, and it ignores both thresholds: a tab being
   * closed is the last chance to send anything at all, and waiting for a full
   * batch there is how the final and most interesting events of a session are
   * the ones that never arrive.
   */
  shouldFlush(now: number, hiding = false): boolean {
    if (this.pending.length === 0) return false;
    if (hiding) return true;
    if (this.pending.length >= this.limits.batchSize) return true;
    return now - this.lastFlushAt >= this.limits.flushIntervalMs;
  }

  /**
   * How long until this queue is due, so a caller can arm one timer that will
   * actually be allowed to send when it fires.
   *
   * This exists because of a bug worth remembering: the transport armed a short
   * timer and then asked `shouldFlush` when it fired, which said no because the
   * interval had not elapsed — so the timer cleared itself and the queued
   * events sat there until something else happened to enqueue. A page that
   * emitted a session start and one page view sent the first and kept the
   * second indefinitely.
   */
  msUntilDue(now: number): number {
    return Math.max(0, this.limits.flushIntervalMs - (now - this.lastFlushAt));
  }

  /** Removes and returns a batch. The caller owns it from here. */
  take(now: number): QueuedEvent[] {
    const batch = this.pending.splice(0, this.limits.batchSize);
    this.lastFlushAt = now;
    return batch;
  }

  /**
   * Puts a failed batch back, if it is worth another attempt.
   *
   * Returns whether it was requeued. A batch that has exhausted its attempts is
   * discarded and counted — the alternative is a queue that never empties and a
   * page that keeps retrying an endpoint that is not coming back.
   */
  requeue(batch: QueuedEvent[]): boolean {
    this.attempts += 1;

    if (this.attempts >= this.limits.maxAttempts) {
      this.attempts = 0;
      this.dropped += batch.length;
      return false;
    }

    this.pending.unshift(...batch);

    if (this.pending.length > this.limits.maxQueued) {
      const overflow = this.pending.length - this.limits.maxQueued;
      this.pending.splice(0, overflow);
      this.dropped += overflow;
    }

    return true;
  }

  succeeded(): void {
    this.attempts = 0;
  }

  /** Exponential, and bounded by `maxAttempts` above rather than by time. */
  retryDelayMs(): number {
    return this.limits.baseRetryMs * 2 ** this.attempts;
  }
}
