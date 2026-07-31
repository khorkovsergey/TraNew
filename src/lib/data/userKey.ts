import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { createDataKey, decryptField, encryptField, unwrapDataKey } from '@/lib/crypto';

/**
 * The per-user data key, fetched or created on first use.
 *
 * Each person's sensitive fields are encrypted under their own key, which is
 * itself sealed with the service master key. Two consequences worth stating:
 * rotating one person's key touches only their rows, and a leaked ciphertext for
 * one user is not a leaked ciphertext for everyone.
 *
 * Cached per request so a page rendering a dozen encrypted fields unseals once
 * rather than a dozen times.
 */
const load = cache(async (userId: string): Promise<Buffer> => {
  const [row] = await db
    .select({ dataKeyEnc: schema.user.dataKeyEnc })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  if (row?.dataKeyEnc) return unwrapDataKey(row.dataKeyEnc);

  // First encrypted write for this person: mint a key and store it sealed.
  const { key, sealed } = createDataKey();
  await db.update(schema.user).set({ dataKeyEnc: sealed }).where(eq(schema.user.id, userId));
  return key;
});

export async function userKey(userId: string): Promise<Buffer> {
  return load(userId);
}

/** Encrypts a value, or returns null for an absent one — null is not ciphertext. */
export async function seal(userId: string, value: string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  return encryptField(await userKey(userId), value);
}

/**
 * Decrypts a stored value.
 *
 * A field that cannot be decrypted returns null rather than throwing: one corrupt
 * row should not take down a whole page, and the caller renders a "data
 * unavailable" state that a person can act on.
 */
export async function unseal(userId: string, payload: string | null | undefined) {
  if (!payload) return null;
  try {
    return decryptField(await userKey(userId), payload);
  } catch {
    return null;
  }
}
