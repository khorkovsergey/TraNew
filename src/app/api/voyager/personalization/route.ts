import { NextResponse, type NextRequest } from 'next/server';
import { grantConsent, revokeConsent } from '@/lib/consent';
import { getSession } from '@/lib/session';

/**
 * The Allow / Use-without-personalization answer from the widget.
 *
 * It writes a real consent record rather than a widget flag, so the decision
 * survives a reload, appears in the account's permissions screen, and can be
 * revoked there. "Use without personalization" writes an explicit revoke — a
 * declined question and a never-asked question should not look the same.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  let granted: boolean;
  try {
    granted = Boolean(((await request.json()) as { granted?: unknown }).granted);
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  if (granted) {
    await grantConsent({
      userId: session.user.id,
      kind: 'ai_processing',
      // Named individually so the permissions screen can list what was agreed to,
      // rather than showing one opaque "personalization: on".
      grants: ['goals', 'watchlist', 'activity'],
    });
  } else {
    await revokeConsent({ userId: session.user.id, kind: 'ai_processing' });
  }

  return NextResponse.json({ personalization: granted });
}
