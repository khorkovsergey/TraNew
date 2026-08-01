import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db, isDatabaseConfigured, schema } from '@/db';
import { getSession } from '@/lib/session';
import type { Actor, Role } from './access';

/**
 * Who is asking, resolved on the server.
 *
 * Role and organizer membership are read from the database, never from the
 * session payload — a claim carried in a cookie is a claim the holder can try to
 * influence, and this one decides who may approve events and read attendee lists.
 */

const ROLES: Role[] = ['user', 'moderator', 'admin'];

export const currentActor = cache(async (): Promise<Actor | null> => {
  const session = await getSession();
  if (!session?.user) return null;

  const actor: Actor = { id: session.user.id, role: 'user', organizerIds: [] };
  if (!isDatabaseConfigured()) return actor;

  try {
    const [row] = await db
      .select({ role: schema.user.role })
      .from(schema.user)
      .where(eq(schema.user.id, session.user.id))
      .limit(1);

    if (row && ROLES.includes(row.role as Role)) actor.role = row.role as Role;

    const owned = await db
      .select({ id: schema.organizer.id })
      .from(schema.organizer)
      .where(eq(schema.organizer.userId, session.user.id));

    actor.organizerIds = owned.map((organizer) => organizer.id);
  } catch {
    // An unreachable database must not promote anyone; the plain user actor is
    // the safe answer, and every capability check below it will refuse.
  }

  return actor;
});

/** For pages that are meaningless without a signed-in person. */
export async function requireActor(): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) throw new Error('Not signed in.');
  return actor;
}
