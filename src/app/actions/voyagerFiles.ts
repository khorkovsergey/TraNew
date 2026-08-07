'use server';

import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { seal } from '@/lib/data/userKey';
import { getSession } from '@/lib/session';
import { checkFile, MAX_FILE_BYTES, type FileMode } from '@/lib/voyager/settings';

/**
 * Personal context files, for people with an account.
 *
 * The session is read here; the client sends a document and never says whose it
 * is. Everything is keyed by the session user, so a request cannot reach
 * somebody else's material — which matters more here than almost anywhere else
 * in the product, because these are private notes.
 *
 * The body is sealed with the owner's data key before it is written, so a
 * database dump is not a stack of everybody's investment theses.
 */

/** What the list shows. Never the body — a listing does not need to decrypt. */
export type StoredFile = {
  id: string;
  name: string;
  kind: string;
  bytes: number;
  mode: FileMode;
  at: string;
};

export type UploadResult =
  | { status: 'stored'; files: StoredFile[] }
  | { status: 'sign_in_required' }
  | { status: 'rejected'; because: string };

export async function listVoyagerFiles(): Promise<StoredFile[]> {
  const session = await getSession();
  if (!session?.user) return [];

  const rows = await db
    .select({
      id: schema.voyagerFile.id,
      name: schema.voyagerFile.name,
      kind: schema.voyagerFile.kind,
      bytes: schema.voyagerFile.bytes,
      mode: schema.voyagerFile.mode,
      createdAt: schema.voyagerFile.createdAt,
    })
    .from(schema.voyagerFile)
    .where(eq(schema.voyagerFile.userId, session.user.id))
    .orderBy(desc(schema.voyagerFile.createdAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    bytes: row.bytes,
    mode: row.mode as FileMode,
    at: row.createdAt.toISOString(),
  }));
}

export async function uploadVoyagerFile(name: string, body: string): Promise<UploadResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  /*
   * Measured in bytes, not characters.
   *
   * A limit checked against `body.length` is a limit on code points, and a file
   * of accented text or Cyrillic would pass it while being twice the size on
   * the way in. The browser checked the file it read; this checks what arrived.
   */
  const bytes = Buffer.byteLength(body, 'utf8');
  if (bytes > MAX_FILE_BYTES) {
    return { status: 'rejected', because: 'That file is over 2 MB once decoded.' };
  }

  const clean = name.trim().slice(0, 120);
  const verdict = checkFile(clean, bytes);
  if (!verdict.ok) {
    return {
      status: 'rejected',
      because:
        verdict.reason === 'type'
          ? 'Voyager can read .txt, .md and .csv.'
          : verdict.reason === 'empty'
            ? 'That file is empty.'
            : 'That file is too large.',
    };
  }

  const kind = clean.slice(clean.lastIndexOf('.') + 1).toLowerCase();
  const bodyEnc = await seal(session.user.id, body);
  if (!bodyEnc) return { status: 'rejected', because: 'That file could not be stored.' };

  /*
   * Same name replaces rather than duplicates. Somebody re-uploading their
   * watchlist means the newer one, and two rows called Watchlist.csv is a
   * question nobody wants to be asked later.
   */
  await db
    .insert(schema.voyagerFile)
    .values({
      id: `vf_${session.user.id.slice(0, 8)}_${clean}`,
      userId: session.user.id,
      name: clean,
      kind,
      bytes,
      bodyEnc,
      mode: 'referenced' satisfies FileMode,
    })
    .onConflictDoUpdate({
      target: [schema.voyagerFile.userId, schema.voyagerFile.name],
      set: { bodyEnc, bytes, kind, createdAt: new Date() },
    });

  return { status: 'stored', files: await listVoyagerFiles() };
}

export async function setVoyagerFileMode(id: string, mode: FileMode): Promise<StoredFile[]> {
  const session = await getSession();
  if (!session?.user) return [];

  await db
    .update(schema.voyagerFile)
    .set({ mode })
    // Both conditions: the id alone would let a guessed id reach another
    // account's document.
    .where(and(eq(schema.voyagerFile.id, id), eq(schema.voyagerFile.userId, session.user.id)));

  return listVoyagerFiles();
}

export async function deleteVoyagerFile(id: string): Promise<StoredFile[]> {
  const session = await getSession();
  if (!session?.user) return [];

  await db
    .delete(schema.voyagerFile)
    .where(and(eq(schema.voyagerFile.id, id), eq(schema.voyagerFile.userId, session.user.id)));

  return listVoyagerFiles();
}
