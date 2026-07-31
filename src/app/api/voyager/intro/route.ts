import { NextResponse } from 'next/server';
import { setPreference } from '@/lib/data/profile';
import { getSession } from '@/lib/session';

/**
 * Records that the Voyager introduction has been watched.
 *
 * A no-op for anonymous visitors — there is nowhere to record it, and localStorage
 * on their side already carries the answer. Returning 200 rather than 401 keeps the
 * client's fire-and-forget call from logging an error for something that is not
 * one.
 */
export async function POST() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ stored: false });

  await setPreference(session.user.id, 'voyager.intro_seen', true);
  return NextResponse.json({ stored: true });
}
