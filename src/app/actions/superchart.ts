'use server';

import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import * as schema from '@/db/schema';
import {
  LAYOUT_SCHEMA_VERSION,
  parseLayout,
  type ChartLayout,
} from '@/lib/superchart/layouts/schema';
import { getSession } from '@/lib/session';

/**
 * Saving and loading a chart layout.
 *
 * The session is read here; the client sends what to save and never whose it
 * is. Every read and every write is scoped by the session's user id, so a
 * layout id from somewhere else resolves to nothing rather than to somebody
 * else's workspace.
 *
 * Layouts are validated on the way in as well as on the way out. A layout that
 * left this application, sat in a browser and came back is untrusted input,
 * whoever it belongs to.
 */

export type LayoutResult =
  | { status: 'saved'; layout: ChartLayout }
  | { status: 'sign_in_required' }
  | { status: 'invalid'; reason: string };

/** A name long enough to be useful and short enough to render. */
const MAX_NAME = 60;

export async function saveLayoutAction(input: {
  name: unknown;
  layout: unknown;
}): Promise<LayoutResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  const name =
    typeof input.name === 'string' && input.name.trim()
      ? input.name.trim().slice(0, MAX_NAME)
      : 'My layout';

  const parsed = parseLayout(input.layout);
  if (!parsed) {
    return {
      status: 'invalid',
      reason: 'That layout could not be read. Nothing was saved and what is on screen is unchanged.',
    };
  }

  const layout: ChartLayout = { ...parsed, name };
  const now = new Date();

  await db
    .insert(schema.chartLayout)
    .values({
      id: randomUUID(),
      userId: session.user.id,
      name,
      state: JSON.stringify(layout),
      schemaVersion: LAYOUT_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    })
    // Saving over a name replaces it, rather than leaving two entries a person
    // cannot tell apart.
    .onConflictDoUpdate({
      target: [schema.chartLayout.userId, schema.chartLayout.name],
      set: { state: JSON.stringify(layout), schemaVersion: LAYOUT_SCHEMA_VERSION, updatedAt: now },
    });

  return { status: 'saved', layout };
}

export type LoadResult =
  | { status: 'ok'; layouts: Array<{ name: string; layout: ChartLayout }> }
  | { status: 'sign_in_required' };

export async function listLayoutsAction(): Promise<LoadResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  const rows = await db
    .select()
    .from(schema.chartLayout)
    .where(eq(schema.chartLayout.userId, session.user.id))
    .orderBy(desc(schema.chartLayout.updatedAt))
    .limit(20);

  const layouts: Array<{ name: string; layout: ChartLayout }> = [];

  for (const row of rows) {
    let raw: unknown;
    try {
      raw = JSON.parse(row.state);
    } catch {
      // A row that will not parse is skipped rather than failing the list: one
      // corrupt layout should not cost someone the rest of theirs.
      continue;
    }

    const layout = parseLayout(raw);
    if (layout) layouts.push({ name: row.name, layout });
  }

  return { status: 'ok', layouts };
}

export async function deleteLayoutAction(name: string): Promise<{ status: 'ok' | 'sign_in_required' }> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  await db
    .delete(schema.chartLayout)
    .where(
      and(eq(schema.chartLayout.userId, session.user.id), eq(schema.chartLayout.name, name))
    );

  return { status: 'ok' };
}
