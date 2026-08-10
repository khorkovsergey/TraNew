import { NextResponse, type NextRequest } from 'next/server';
import { mintAccessToken, secretMatches } from '@/lib/analytics/serverIdentity';
import { ACCESS_COOKIE, ACCESS_TTL_MS, directLinkEnabled } from '@/lib/admin-metrics/access';

/**
 * The fragment-secret exchange.
 *
 * The secret arrives in a POST body, having been read by the bootstrap from
 * `location.hash`. A URL fragment is never sent in an HTTP request, so it does
 * not appear in a proxy log, an access log or a `Referer` header — which is the
 * whole reason the fragment is used rather than a query string.
 *
 * What goes back is a derived token, not the secret. A cookie holding the
 * secret itself could be lifted and replayed as a fragment to mint new ones for
 * as long as the deployment lived; a token carries its own expiry inside the
 * signed material, so it cannot be edited into a longer life either.
 *
 * The response says as little as it can. There is one failure shape for a wrong
 * secret, a missing secret and a disabled path — telling the difference apart
 * would confirm to somebody probing that they had found the right endpoint and
 * merely the wrong key.
 */

export const dynamic = 'force-dynamic';

const denied = () => NextResponse.json({ error: 'not authorized' }, { status: 401 });

export async function POST(request: NextRequest) {
  if (!directLinkEnabled()) return denied();

  let body: { secret?: unknown };
  try {
    body = await request.json();
  } catch {
    return denied();
  }

  const supplied = typeof body.secret === 'string' ? body.secret : '';

  // Bounded before the comparison, so an enormous body cannot be used to make
  // the hashing itself the slow part.
  if (!supplied || supplied.length > 512) return denied();

  if (!secretMatches(supplied, process.env.METRICS_ACCESS_SECRET ?? '')) {
    return denied();
  }

  const expiresAt = Date.now() + ACCESS_TTL_MS;
  const response = NextResponse.json({ ok: true, expiresAt });

  response.cookies.set(ACCESS_COOKIE, mintAccessToken(expiresAt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: Math.floor(ACCESS_TTL_MS / 1000),
  });

  return response;
}

/** Signing out of the dashboard. Cheap to provide and awkward to lack. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
