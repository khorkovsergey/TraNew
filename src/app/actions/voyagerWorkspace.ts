'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import * as schema from '@/db/schema';
import {
  parseLibrary,
  serializeLibrary,
  WORKSPACE_SCHEMA_VERSION,
  type SavedWorkspace,
} from '@/lib/voyager/workspace/record';
import { getSession } from '@/lib/session';

/**
 * The workspace library, for people with an account.
 *
 * The session is read here; the client sends the library and never whose it is.
 * Everything is keyed by the session user, so a request cannot reach somebody
 * else's work.
 *
 * The library is validated in both directions. What came back from a browser is
 * untrusted whoever it belongs to, and what is written is validated too, so a
 * bug on the client cannot store a shape that later fails to open.
 */

export type SaveResult =
  | { status: 'saved'; count: number }
  | { status: 'sign_in_required' }
  | { status: 'invalid' };

export async function saveLibraryAction(input: { library: unknown }): Promise<SaveResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  const workspaces = parseLibrary(input.library);
  if (!workspaces) return { status: 'invalid' };

  const stored = serializeLibrary(workspaces);
  const now = new Date();

  await db
    .insert(schema.voyagerWorkspace)
    .values({
      userId: session.user.id,
      library: JSON.stringify(stored),
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.voyagerWorkspace.userId,
      set: {
        library: JSON.stringify(stored),
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
        updatedAt: now,
      },
    });

  return { status: 'saved', count: stored.workspaces.length };
}

export type LoadResult =
  | { status: 'ok'; workspaces: SavedWorkspace[] }
  | { status: 'sign_in_required' };

export async function loadLibraryAction(): Promise<LoadResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  const [row] = await db
    .select()
    .from(schema.voyagerWorkspace)
    .where(eq(schema.voyagerWorkspace.userId, session.user.id))
    .limit(1);

  if (!row) return { status: 'ok', workspaces: [] };

  try {
    return { status: 'ok', workspaces: parseLibrary(JSON.parse(row.library)) ?? [] };
  } catch {
    // An unreadable row means an empty library rather than an error: the person
    // can still work, and the next save replaces it.
    return { status: 'ok', workspaces: [] };
  }
}
