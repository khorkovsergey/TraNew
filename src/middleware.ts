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
/**
 * The asset-class slugs that used to open the generic placeholder screen.
 *
 * They are real pages now, at their own URLs. A permanent redirect rather than a
 * quiet rewrite: these were linked from the menu for months, and the old
 * addresses should stop existing rather than keep working invisibly.
 *
 * Only these six. The other `/tool/*` slugs — screeners, heatmaps, calendars —
 * are still placeholders and are left alone; sending them here would promise a
 * page that does not exist.
 */
const CLASS_SLUGS = new Set(['stocks', 'etfs', 'bonds', 'cash', 'crypto', 'property']);

/**
 * The old Tools & Data placeholder.
 *
 * `/professional-tools` was a list of four links to screens that already had
 * their own homes. Tools & Data is a real section now, and this is where it
 * lives — permanent, for the same reason as the asset classes above: the
 * address was in the Marketplace menu for months and should resolve rather than
 * rot.
 */
const RETIRED = new Map([['/professional-tools', '/marketplace/tools']]);

export default function middleware(request: NextRequest) {
  const path = stripLocale(request.nextUrl.pathname);

  const moved = RETIRED.get(path.replace(/\/$/, '') || '/');
  if (moved) {
    const url = request.nextUrl.clone();
    url.pathname = `/${routing.defaultLocale}${moved}`;
    url.search = '';
    return NextResponse.redirect(url, 301);
  }

  const toolMatch = /^\/tool\/([a-z-]+)\/?$/.exec(path);
  if (toolMatch && CLASS_SLUGS.has(toolMatch[1])) {
    const url = request.nextUrl.clone();
    url.pathname = `/${routing.defaultLocale}/explore/${toolMatch[1]}`;
    url.search = '';
    return NextResponse.redirect(url, 301);
  }
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
  /*
   * Skip API routes, Next internals, anything with a file extension, and /dev.
   * The /dev pages are deliberately outside the localised tree — sending them
   * through the i18n rewrite would redirect them to a locale path that has no
   * route, which is how the preview mailbox first came back as a 307.
   */
  matcher: '/((?!api|dev|_next|_vercel|.*\\..*).*)',
};
