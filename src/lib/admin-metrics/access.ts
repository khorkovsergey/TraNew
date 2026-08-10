import 'server-only';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/session';
import { accessTokenValid } from '@/lib/analytics/serverIdentity';

/**
 * Who may read the Observatory.
 *
 * Two paths, both settled on the server, and the route name is not one of them.
 * `/en/admin_admin_metrics` is unguessable-ish and that is worth something, but
 * obscurity is not access control and this file is what actually stops a
 * request.
 *
 * **The admin session is the primary path.** The repository already has a role
 * system — `user.role` is `user | moderator | admin`, and `lib/events/access.ts`
 * already treats `admin` as moderation authority — so a new admin product would
 * have been a second source of truth about who is trusted, which the brief
 * rules out explicitly. The role column is read directly rather than through
 * the Events section's helpers, because those belong to another section and
 * importing them would couple this dashboard to their evolution.
 *
 * **The fragment secret is the demo path**, and it exists for one reason: the
 * dashboard has to be openable from a link by somebody who does not have an
 * account on this deployment. It is disabled outright when the secret is unset,
 * rather than falling back to something weaker.
 */

export const ACCESS_COOKIE = 'tn_metrics_access';

/** Short enough that a leaked cookie expires before it is useful. */
export const ACCESS_TTL_MS = 8 * 60 * 60 * 1000;

export type Authorization =
  | { authorized: true; via: 'admin_session'; userId: string }
  | { authorized: true; via: 'access_token' }
  | { authorized: false };

/**
 * The single gate. Every page render and every metrics endpoint calls it —
 * an endpoint that trusted the page to have checked would be readable by
 * anyone who guessed its path.
 */
export async function authorizeMetrics(): Promise<Authorization> {
  const session = await getSession();
  const user = session?.user as { id?: string; role?: unknown } | undefined;

  if (user?.id && user.role === 'admin') {
    return { authorized: true, via: 'admin_session', userId: user.id };
  }

  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;

  if (accessTokenValid(token, Date.now())) {
    return { authorized: true, via: 'access_token' };
  }

  return { authorized: false };
}

/** Whether the direct-link path exists at all on this deployment. */
export function directLinkEnabled(): boolean {
  return Boolean(process.env.METRICS_ACCESS_SECRET);
}
