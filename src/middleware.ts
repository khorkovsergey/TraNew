import { getSessionCookie } from 'better-auth/cookies';
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const handleI18n = createMiddleware(routing);

/** Everything under these prefixes requires a signed-in user. */
const PRIVATE_PREFIXES = ['/account'];

/** Signed-in users have no reason to see these. */
const AUTH_ONLY_PREFIXES = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password'];

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

/**
 * Route protection sits in front of the i18n rewrite.
 *
 * This is an optimistic gate: it only checks that a session cookie is present, which
 * is cheap and runs on every request. It does not prove the session is valid — that
 * check belongs on the server, and every private page calls `requireUser()` for it.
 * Treating this as the authority would let a revoked or forged cookie through.
 */
export default function middleware(request: NextRequest) {
  const path = stripLocale(request.nextUrl.pathname);
  // The prefix must match `advanced.cookiePrefix` in the auth config, otherwise this
  // looks for a cookie that is never set and every signed-in user is bounced.
  const hasSessionCookie = Boolean(getSessionCookie(request, { cookiePrefix: 'tn' }));

  if (PRIVATE_PREFIXES.some((prefix) => path.startsWith(prefix)) && !hasSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = `/${routing.defaultLocale}/sign-in`;
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }

  if (AUTH_ONLY_PREFIXES.some((prefix) => path.startsWith(prefix)) && hasSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = `/${routing.defaultLocale}/account`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return handleI18n(request);
}

export const config = {
  // Skip API routes, Next internals and anything with a file extension.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
