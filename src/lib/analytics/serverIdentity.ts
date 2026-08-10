import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The server half of analytics identity: the part that holds the secret.
 *
 * Split from `identity.ts` so the rules stay checkable by the unit harness and
 * the secret stays on the server. Nothing in this file may be imported by a
 * client component, and `server-only` makes that a build error rather than a
 * convention.
 *
 * The whole reason these are HMACs rather than the application ids: a telemetry
 * table is queried casually, exported, and read by more people than a user
 * table ever is. `product_telemetry_event` has no foreign key to `user` on
 * purpose, and a raw id in a column would have quietly restored the join that
 * the missing foreign key was there to prevent.
 */

/**
 * Reads the analytics secret.
 *
 * A missing secret is a hard failure in production, never a fallback to a
 * development constant. A predictable key is worse than no key at all: it would
 * mean every deployment produced the same pseudonym for the same user id, which
 * is a rainbow table over a user base, and it would do so silently.
 */
function analyticsSecret(): string {
  const secret = process.env.ANALYTICS_HMAC_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ANALYTICS_HMAC_SECRET is not set. Telemetry identity cannot be derived.');
    }
    return 'insecure-development-analytics-secret';
  }

  return secret;
}

function digest(namespace: string, value: string): string {
  return createHmac('sha256', analyticsSecret()).update(`${namespace}:${value}`).digest('hex').slice(0, 32);
}

/**
 * The analytics key for a signed-in person.
 *
 * Namespaced so the same input cannot collide with a visitor key, and truncated
 * to 128 bits, which is far past the point where a collision matters for
 * counting and keeps the column narrow enough to index cheaply.
 */
export function pseudonymousUserKey(userId: string): string {
  return `u_${digest('analytics-user', userId)}`;
}

/**
 * The analytics key for a session.
 *
 * Session-scoped by construction: the input is the session id, which lives in
 * `sessionStorage` and dies with the tab. Hashing it does not extend its life —
 * it only means the browser's own token is not what ends up in the table.
 */
export function visitorKeyForSession(sessionId: string): string {
  return `v_${digest('analytics-visitor', sessionId)}`;
}

/**
 * Constant-time comparison for the dashboard access secret.
 *
 * `timingSafeEqual` throws on a length mismatch, which would itself leak the
 * length, so both sides are hashed to a fixed width first and the comparison is
 * always over 32 bytes.
 */
export function secretMatches(supplied: string, expected: string): boolean {
  if (!expected) return false;

  const a = createHmac('sha256', 'metrics-access-compare').update(supplied).digest();
  const b = createHmac('sha256', 'metrics-access-compare').update(expected).digest();

  return timingSafeEqual(a, b);
}

/**
 * The opaque token stored in the authorization cookie.
 *
 * Derived from the secret rather than being the secret, so a stolen cookie
 * cannot be replayed as a fragment to mint fresh ones, and the raw secret is
 * never written anywhere the browser can read it. The expiry is inside the
 * signed material, so an expired token cannot be edited into a valid one.
 */
export function mintAccessToken(expiresAtMs: number): string {
  const secret = process.env.METRICS_ACCESS_SECRET ?? '';
  const signature = createHmac('sha256', secret).update(`metrics-access:${expiresAtMs}`).digest('hex').slice(0, 32);
  return `${expiresAtMs}.${signature}`;
}

export function accessTokenValid(token: string | undefined, now: number): boolean {
  if (!token) return false;

  const secret = process.env.METRICS_ACCESS_SECRET;
  if (!secret) return false;

  const [rawExpiry, signature] = token.split('.');
  const expiresAt = Number(rawExpiry);

  if (!Number.isFinite(expiresAt) || !signature) return false;
  if (expiresAt <= now) return false;

  return secretMatches(signature, mintAccessToken(expiresAt).split('.')[1]);
}
