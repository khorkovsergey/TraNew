/**
 * Analytics identity, as rules rather than as storage.
 *
 * Import-free, and randomness is injected rather than taken, so every branch is
 * checkable by the unit harness.
 *
 * ## What this deliberately does not do
 *
 * There is no persistent anonymous visitor identifier here, and adding one is
 * not an implementation detail. The Phase 0 audit found that the product has
 * exactly one anonymous key — an HMAC of an IP address in
 * `lib/voyager/usage.ts`, scoped to a single day, whose own comment says that
 * not keeping a record of who visited from where is the point of it — and that
 * `lib/consent.ts` has five consent kinds, none of which covers analytics.
 *
 * So an anonymous visitor is identified for the length of a session and no
 * longer. The cost is real and is stated on the dashboard rather than hidden:
 * anonymous D1/D7/D30 is `not_measurable`, and what it would take to change
 * that — a consent surface, a first-party cookie with a stated lifetime, a
 * privacy review — is written in the metric dictionary. A wrong retention
 * number obtained by rotating IP addresses would have been worse than no
 * number, because somebody would have believed it.
 *
 * The Voyager quota subject must never be reused here. It exists to rate-limit,
 * it is derived from an address, and turning a rate limiter into a behavioural
 * history is exactly the repurposing its author ruled out.
 */

/* ---------------------------------------------------------------- Session */

/**
 * How long a session survives without activity.
 *
 * Thirty minutes is the conventional boundary and it is chosen for that reason:
 * a definition somebody already recognises is worth more than a marginally
 * better one nobody can compare against.
 */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

/** Sessions are also cut at this length, so a left-open tab is not one visit for a week. */
export const SESSION_MAX_MS = 12 * 60 * 60 * 1000;

export type SessionState = {
  id: string;
  startedAt: number;
  lastSeenAt: number;
};

export function sessionExpired(session: SessionState, now: number): boolean {
  if (now - session.lastSeenAt >= SESSION_IDLE_MS) return true;
  if (now - session.startedAt >= SESSION_MAX_MS) return true;
  return false;
}

/**
 * Continues a session or starts a new one.
 *
 * `mintId` is a parameter so the harness can assert the boundary without
 * pretending to know what a random id looks like.
 */
export function advanceSession(
  previous: SessionState | null,
  now: number,
  mintId: () => string
): { session: SessionState; started: boolean } {
  if (previous && !sessionExpired(previous, now)) {
    return { session: { ...previous, lastSeenAt: now }, started: false };
  }

  return { session: { id: mintId(), startedAt: now, lastSeenAt: now }, started: true };
}

/* ------------------------------------------------------------ Acquisition */

export const ACQUISITION_BUCKETS = [
  'direct',
  'organic',
  'referral',
  'social',
  'ai',
  'partner',
  'internal',
  'unknown',
] as const;

export type AcquisitionBucket = (typeof ACQUISITION_BUCKETS)[number];

const SEARCH_HOSTS = ['google.', 'bing.', 'duckduckgo.', 'yandex.', 'baidu.', 'ecosia.', 'brave.'];
const SOCIAL_HOSTS = ['facebook.', 'instagram.', 'x.com', 'twitter.', 'linkedin.', 'reddit.', 't.co', 'youtube.', 'tiktok.'];
const AI_HOSTS = ['chatgpt.', 'openai.', 'claude.', 'anthropic.', 'perplexity.', 'copilot.', 'gemini.'];

/**
 * Buckets a referrer by host, and only by host.
 *
 * The caller passes a hostname it has already extracted, never a URL: a full
 * referrer carries a query string, and a query string carries whatever somebody
 * searched for. The bucket is what travels; the host does not.
 *
 * AI referrals get their own bucket because "did the assistants start sending
 * people here" is a question this product will actually ask, and it is
 * unanswerable once it has been folded into `referral`.
 */
export function bucketAcquisition(referrerHost: string | null, ownHost: string): AcquisitionBucket {
  if (referrerHost === null) return 'direct';
  if (!referrerHost) return 'unknown';

  const host = referrerHost.toLowerCase();
  if (host === ownHost.toLowerCase() || host.endsWith(`.${ownHost.toLowerCase()}`)) return 'internal';

  if (AI_HOSTS.some((candidate) => host.includes(candidate))) return 'ai';
  if (SEARCH_HOSTS.some((candidate) => host.includes(candidate))) return 'organic';
  if (SOCIAL_HOSTS.some((candidate) => host.includes(candidate))) return 'social';

  return 'referral';
}

/* ------------------------------------------------------------ Device class */

export const DEVICE_CLASSES = ['mobile', 'tablet', 'desktop', 'unknown'] as const;
export type DeviceClass = (typeof DEVICE_CLASSES)[number];

/**
 * A coarse bucket from the viewport, never from the user-agent string.
 *
 * The UA string is a fingerprint and the telemetry rules exclude it; the
 * viewport answers the only question the dashboard asks of it, which is whether
 * a funnel behaves differently on a small screen.
 */
export function deviceClass(viewportWidth: number): DeviceClass {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return 'unknown';
  if (viewportWidth < 640) return 'mobile';
  if (viewportWidth < 1024) return 'tablet';
  return 'desktop';
}

/* ------------------------------------------------------------------ Bots */

/**
 * Whether a session is excluded from every rate's denominator.
 *
 * Kept as a list of substrings rather than anything cleverer because the
 * consequence of a miss is small and the consequence of a false positive is a
 * person deleted from the funnel. The check runs server-side on the UA header,
 * which is read and thrown away — the header itself is never stored.
 */
const BOT_MARKERS = [
  'bot', 'crawler', 'spider', 'crawl', 'slurp', 'headless', 'phantom',
  'lighthouse', 'pingdom', 'uptime', 'monitor', 'curl', 'wget', 'python-requests',
];

export function looksAutomated(userAgent: string | null): boolean {
  if (!userAgent) return true;
  const ua = userAgent.toLowerCase();
  return BOT_MARKERS.some((marker) => ua.includes(marker));
}

/* -------------------------------------------------------------- User keys */

/**
 * The shape a pseudonymous key must have, wherever it was minted.
 *
 * The HMAC itself lives in `serverIdentity.ts`, which imports `node:crypto` and
 * reads the secret; this is the part a test can check. A key that fails this is
 * a raw application id that escaped into the analytics path, which is the one
 * mistake this whole layer exists to prevent.
 */
export const USER_KEY_PATTERN = /^u_[0-9a-f]{32}$/;
export const SESSION_ID_PATTERN = /^s_[0-9a-f]{32}$/;

/**
 * The visitor key is an HMAC of the session id, so what is stored is the
 * server's value rather than the token a browser chose for itself. It is still
 * session-scoped — hashing does not make it last longer — and it exists so a
 * query can group by visitor without the client's own string in the table.
 */
export const VISITOR_KEY_PATTERN = /^v_[0-9a-f]{32}$/;

export function isPseudonymousUserKey(value: string): boolean {
  return USER_KEY_PATTERN.test(value);
}

export function isWellFormedSessionId(value: string): boolean {
  return SESSION_ID_PATTERN.test(value);
}
