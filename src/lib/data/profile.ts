import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { recordActivity } from './activity';
import { seal, unseal } from './userKey';

/* ----------------------------------------------------------------- Profile */

export type Profile = {
  displayName: string | null;
  timezone: string | null;
  baseCurrency: string;
  experience: 'beginner' | 'standard' | 'pro';
  goals: string | null;
};

const DEFAULTS: Profile = {
  displayName: null,
  timezone: null,
  baseCurrency: 'EUR',
  experience: 'beginner',
  goals: null,
};

export async function getProfile(userId: string): Promise<Profile> {
  const [row] = await db
    .select()
    .from(schema.profile)
    .where(eq(schema.profile.userId, userId))
    .limit(1);

  if (!row) return DEFAULTS;

  return {
    displayName: row.displayName,
    timezone: row.timezone,
    baseCurrency: row.baseCurrency,
    experience: row.experience as Profile['experience'],
    goals: await unseal(userId, row.goalsEnc),
  };
}

export async function updateProfile(userId: string, patch: Partial<Profile>): Promise<void> {
  const values = {
    displayName: patch.displayName,
    timezone: patch.timezone,
    baseCurrency: patch.baseCurrency,
    experience: patch.experience,
    goalsEnc: patch.goals !== undefined ? await seal(userId, patch.goals) : undefined,
    updatedAt: new Date(),
  };

  // Only the keys actually provided are written, so a partial update from one
  // settings section cannot blank fields owned by another.
  const set = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  );

  await db
    .insert(schema.profile)
    .values({
      id: randomUUID(),
      userId,
      displayName: patch.displayName ?? null,
      timezone: patch.timezone ?? null,
      baseCurrency: patch.baseCurrency ?? DEFAULTS.baseCurrency,
      experience: patch.experience ?? DEFAULTS.experience,
      goalsEnc: patch.goals !== undefined ? await seal(userId, patch.goals) : null,
    })
    .onConflictDoUpdate({ target: schema.profile.userId, set });
}

/* ------------------------------------------------------------- Preferences */

export type PreferenceValue = string | number | boolean | string[];

export async function getPreferences(userId: string): Promise<Record<string, PreferenceValue>> {
  const rows = await db
    .select()
    .from(schema.preference)
    .where(eq(schema.preference.userId, userId));

  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function setPreference(
  userId: string,
  key: string,
  value: PreferenceValue
): Promise<void> {
  await db
    .insert(schema.preference)
    .values({ id: randomUUID(), userId, key, value })
    .onConflictDoUpdate({
      target: [schema.preference.userId, schema.preference.key],
      set: { value, updatedAt: new Date() },
    });
}

/* --------------------------------------------------------- Voyager memory */

export type MemoryKind = 'goal' | 'preference' | 'holding' | 'constraint' | 'fact';

export type MemoryEntry = {
  id: string;
  kind: MemoryKind;
  content: string;
  sourceEvent: string | null;
  createdAt: Date;
};

/** Only what Voyager currently believes — forgotten rows stay for the audit trail. */
export async function listMemory(userId: string): Promise<MemoryEntry[]> {
  const rows = await db
    .select()
    .from(schema.voyagerMemory)
    .where(
      and(eq(schema.voyagerMemory.userId, userId), isNull(schema.voyagerMemory.forgottenAt))
    )
    .orderBy(desc(schema.voyagerMemory.createdAt));

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      kind: row.kind as MemoryKind,
      content: (await unseal(userId, row.contentEnc)) ?? 'Unreadable entry',
      sourceEvent: row.sourceEvent,
      createdAt: row.createdAt,
    }))
  );
}

export async function remember(options: {
  userId: string;
  kind: MemoryKind;
  content: string;
  sourceEvent?: string;
}): Promise<string> {
  const id = randomUUID();

  await db.insert(schema.voyagerMemory).values({
    id,
    userId: options.userId,
    kind: options.kind,
    contentEnc: (await seal(options.userId, options.content))!,
    sourceEvent: options.sourceEvent ?? null,
  });

  return id;
}

/**
 * Forgetting is a soft delete.
 *
 * The entry stops being used immediately, but the fact that it existed and was
 * removed stays — that history is what lets someone check the assistant actually
 * dropped what they told it to drop.
 */
export async function forget(userId: string, memoryId: string): Promise<void> {
  await db
    .update(schema.voyagerMemory)
    .set({ forgottenAt: new Date() })
    .where(
      and(eq(schema.voyagerMemory.id, memoryId), eq(schema.voyagerMemory.userId, userId))
    );

  await recordActivity({
    userId,
    type: 'asked',
    title: 'Removed something Voyager remembered',
    kind: 'memory',
    ref: memoryId,
  });
}
