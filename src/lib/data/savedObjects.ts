import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import { recordActivity } from './activity';
import { seal, unseal } from './userKey';

/**
 * Saved objects — the seam that makes the sections one product.
 *
 * A symbol saved on the Explore page is the same row the Workspace lists, the
 * alert watches, and an expert brief attaches. Before this, each section kept its
 * own copy in its own storage, which is why nothing knew about anything else.
 */

export type SavedKind =
  | 'symbol'
  | 'country'
  | 'news'
  | 'research'
  | 'chart'
  | 'expert'
  | 'lesson'
  | 'screener'
  | 'idea';

export type SavedObject = {
  id: string;
  kind: SavedKind;
  ref: string;
  title: string;
  subtitle: string | null;
  note: string | null;
  createdAt: Date;
};

export async function listSaved(userId: string, kind?: SavedKind): Promise<SavedObject[]> {
  const rows = await db
    .select()
    .from(schema.savedObject)
    .where(
      kind
        ? and(eq(schema.savedObject.userId, userId), eq(schema.savedObject.kind, kind))
        : eq(schema.savedObject.userId, userId)
    )
    .orderBy(desc(schema.savedObject.createdAt));

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      kind: row.kind as SavedKind,
      ref: row.ref,
      title: row.title,
      subtitle: row.subtitle,
      note: await unseal(userId, row.noteEnc),
      createdAt: row.createdAt,
    }))
  );
}

export async function isSaved(userId: string, kind: SavedKind, ref: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.savedObject.id })
    .from(schema.savedObject)
    .where(
      and(
        eq(schema.savedObject.userId, userId),
        eq(schema.savedObject.kind, kind),
        eq(schema.savedObject.ref, ref)
      )
    )
    .limit(1);

  return Boolean(row);
}

/**
 * Saves, or updates what is already saved.
 *
 * Idempotent by (user, kind, ref): pressing save twice is not two rows, and a
 * second save refreshes the title rather than leaving a stale one behind.
 */
export async function save(options: {
  userId: string;
  kind: SavedKind;
  ref: string;
  title: string;
  subtitle?: string;
  note?: string;
}): Promise<string> {
  const { userId, kind, ref, title } = options;
  const id = randomUUID();

  const [row] = await db
    .insert(schema.savedObject)
    .values({
      id,
      userId,
      kind,
      ref,
      title,
      subtitle: options.subtitle ?? null,
      noteEnc: await seal(userId, options.note),
    })
    .onConflictDoUpdate({
      target: [schema.savedObject.userId, schema.savedObject.kind, schema.savedObject.ref],
      set: { title, subtitle: options.subtitle ?? null },
    })
    .returning({ id: schema.savedObject.id });

  await recordActivity({ userId, type: 'saved', title, kind, ref });
  return row?.id ?? id;
}

export async function unsave(userId: string, kind: SavedKind, ref: string): Promise<void> {
  await db
    .delete(schema.savedObject)
    .where(
      and(
        eq(schema.savedObject.userId, userId),
        eq(schema.savedObject.kind, kind),
        eq(schema.savedObject.ref, ref)
      )
    );
}

/** Toggles and reports the resulting state, so a button can call one function. */
export async function toggleSaved(options: {
  userId: string;
  kind: SavedKind;
  ref: string;
  title: string;
  subtitle?: string;
}): Promise<boolean> {
  if (await isSaved(options.userId, options.kind, options.ref)) {
    await unsave(options.userId, options.kind, options.ref);
    return false;
  }
  await save(options);
  return true;
}

/* ------------------------------------------------------------- Collections */

export type Collection = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  items: SavedObject[];
};

export async function listCollections(userId: string): Promise<Collection[]> {
  const collections = await db
    .select()
    .from(schema.collection)
    .where(eq(schema.collection.userId, userId))
    .orderBy(desc(schema.collection.createdAt));

  if (collections.length === 0) return [];

  // One query for every membership rather than one per collection.
  const links = await db
    .select()
    .from(schema.collectionItem)
    .where(
      inArray(
        schema.collectionItem.collectionId,
        collections.map((entry) => entry.id)
      )
    );

  const saved = await listSaved(userId);
  const byId = new Map(saved.map((entry) => [entry.id, entry]));

  return collections.map((entry) => ({
    id: entry.id,
    name: entry.name,
    description: entry.description,
    isPublic: entry.isPublic,
    items: links
      .filter((link) => link.collectionId === entry.id)
      .sort((a, b) => a.position - b.position)
      .map((link) => byId.get(link.savedObjectId))
      .filter((item): item is SavedObject => item !== undefined),
  }));
}

export async function createCollection(options: {
  userId: string;
  name: string;
  description?: string;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.collection).values({
    id,
    userId: options.userId,
    name: options.name,
    description: options.description ?? null,
  });
  return id;
}

export async function addToCollection(collectionId: string, savedObjectId: string): Promise<void> {
  await db
    .insert(schema.collectionItem)
    .values({ id: randomUUID(), collectionId, savedObjectId })
    // Already in the collection: nothing to do, and not an error worth surfacing.
    .onConflictDoNothing();
}

export async function removeFromCollection(
  collectionId: string,
  savedObjectId: string
): Promise<void> {
  await db
    .delete(schema.collectionItem)
    .where(
      and(
        eq(schema.collectionItem.collectionId, collectionId),
        eq(schema.collectionItem.savedObjectId, savedObjectId)
      )
    );
}
