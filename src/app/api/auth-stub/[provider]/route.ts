import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { auth } from '@/lib/auth';
import { isStubOAuthEnabled, isStubProvider, STUB_ACCOUNTS } from '@/lib/stubMode';

/**
 * Simulated social sign-in, used while no OAuth application exists.
 *
 * It performs a genuine server-side sign-in — the session it produces is an ordinary
 * database session behind the same httpOnly cookie — but only ever into a fixed demo
 * account per provider. It accepts no email, no identifier and no redirect target
 * from the request, so it cannot be pointed at somebody else's account or used as
 * an open redirect. Deleting this file and setting real credentials is the whole
 * migration path.
 */

/** Derived from the app secret so no password is written down anywhere. */
function demoPassword(email: string): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? 'insecure-development-secret';
  return createHmac('sha256', secret).update(`stub-oauth:${email}`).digest('base64');
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  if (!isStubOAuthEnabled()) {
    return NextResponse.json({ error: 'Stub sign-in is disabled.' }, { status: 404 });
  }

  const { provider } = await context.params;
  if (!isStubProvider(provider)) {
    return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 });
  }

  const { email, name } = STUB_ACCOUNTS[provider];
  const password = demoPassword(email);

  const existing = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);

  if (existing.length === 0) {
    await auth.api.signUpEmail({ body: { email, password, name } });
    // A social identity arrives already confirmed by its provider; the demo account
    // mirrors that so the flow does not stall on a verification email.
    await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.email, email));
  }

  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });

  // Hand back the session cookie, then send the browser into the account.
  const redirect = NextResponse.redirect(new URL('/en/account', request.url));
  for (const cookie of response.headers.getSetCookie()) {
    redirect.headers.append('set-cookie', cookie);
  }
  return redirect;
}
