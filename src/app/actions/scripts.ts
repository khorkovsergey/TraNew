'use server';

import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import * as schema from '@/db/schema';
import {
  parseDocument,
  SCRIPT_SCHEMA_VERSION,
  type ScriptDocument,
} from '@/lib/superchart/scripts/document';
import { getSession } from '@/lib/session';

/**
 * Saving and loading Script Lab documents.
 *
 * The session is read here; the client sends what to save and never whose it
 * is. Every read and write is scoped by the session's user id, so a document id
 * from somewhere else resolves to nothing rather than to somebody else's work.
 *
 * Documents are validated in both directions. A script is text a person wrote
 * and may paste anywhere, so it is stored as written — and it is never
 * executed, here or anywhere else in this phase.
 */

export type SaveScriptResult =
  | { status: 'saved'; document: ScriptDocument }
  | { status: 'sign_in_required' }
  | { status: 'invalid'; reason: string };

export async function saveScriptAction(input: { document: unknown }): Promise<SaveScriptResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  const document = parseDocument(input.document);
  if (!document) {
    return {
      status: 'invalid',
      reason: 'That script could not be read. Nothing was saved and what is on screen is unchanged.',
    };
  }

  const now = new Date();

  await db
    .insert(schema.chartScript)
    .values({
      id: randomUUID(),
      userId: session.user.id,
      name: document.name,
      document: JSON.stringify(document),
      schemaVersion: SCRIPT_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    })
    // Saving over a name replaces it, rather than leaving two documents a
    // person cannot tell apart.
    .onConflictDoUpdate({
      target: [schema.chartScript.userId, schema.chartScript.name],
      set: {
        document: JSON.stringify(document),
        schemaVersion: SCRIPT_SCHEMA_VERSION,
        updatedAt: now,
      },
    });

  return { status: 'saved', document };
}

export type ListScriptsResult =
  | { status: 'ok'; documents: ScriptDocument[] }
  | { status: 'sign_in_required' };

export async function listScriptsAction(): Promise<ListScriptsResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  const rows = await db
    .select()
    .from(schema.chartScript)
    .where(eq(schema.chartScript.userId, session.user.id))
    .orderBy(desc(schema.chartScript.updatedAt))
    .limit(30);

  const documents: ScriptDocument[] = [];

  for (const row of rows) {
    let raw: unknown;
    try {
      raw = JSON.parse(row.document);
    } catch {
      // One unreadable row should not cost somebody the rest of their scripts.
      continue;
    }

    const document = parseDocument(raw);
    if (document) documents.push(document);
  }

  return { status: 'ok', documents };
}

export async function deleteScriptAction(
  name: string
): Promise<{ status: 'ok' | 'sign_in_required' }> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  await db
    .delete(schema.chartScript)
    .where(and(eq(schema.chartScript.userId, session.user.id), eq(schema.chartScript.name, name)));

  return { status: 'ok' };
}
