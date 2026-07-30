import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { auth } from './auth';

/**
 * Server-side session access. Everything private reads the session here, never from
 * a client flag: middleware can only see that a cookie exists, so it is a fast gate,
 * not the authority.
 */

/** Deduplicated per request, so several components can ask without extra queries. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export type PlanId = 'free' | 'premium' | 'ai_private';

export const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  premium: 1,
  ai_private: 2,
};

export const PLAN_LABEL: Record<PlanId, string> = {
  free: 'Free plan',
  premium: 'Premium',
  ai_private: 'AI Private',
};

export type AuthedUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  plan: PlanId;
};

function normalise(user: { plan?: unknown }): PlanId {
  const plan = typeof user.plan === 'string' ? user.plan : 'free';
  return plan in PLAN_RANK ? (plan as PlanId) : 'free';
}

/**
 * Returns the signed-in user or sends an anonymous visitor to sign-in. Use this in
 * every private page — the middleware gate is optimistic and can be out of date.
 */
export async function requireUser(returnTo?: string): Promise<AuthedUser> {
  const session = await getSession();

  if (!session?.user) {
    redirect({
      href: { pathname: '/sign-in', query: returnTo ? { next: returnTo } : undefined },
      locale: 'en',
    });
  }

  const user = session!.user;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    plan: normalise(user as { plan?: unknown }),
  };
}

/** Entitlement check. Server-side only — a client-side check is a suggestion. */
export async function requirePlan(minimum: PlanId): Promise<AuthedUser> {
  const user = await requireUser();

  if (PLAN_RANK[user.plan] < PLAN_RANK[minimum]) {
    redirect({ href: { pathname: '/account/settings', query: { upgrade: minimum } }, locale: 'en' });
  }

  return user;
}

export function hasPlan(user: { plan: PlanId }, minimum: PlanId): boolean {
  return PLAN_RANK[user.plan] >= PLAN_RANK[minimum];
}

/** Client and user-agent details for the audit log and device list. */
export async function requestFingerprint() {
  const headerList = await headers();
  return {
    ipAddress:
      headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headerList.get('x-real-ip') ??
      null,
    userAgent: headerList.get('user-agent'),
  };
}
