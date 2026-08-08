import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db, isDatabaseConfigured, schema } from '@/db';
import { findProduct } from '@/content/chartMarket';

/**
 * Who owns which script.
 *
 * Entitlement is a row in `purchase`, read on the server on every request that
 * could reveal source code. There is no client-side copy of it and no cookie
 * that says "owned": the only question that matters — may this person read this
 * script — is answered where the answer cannot be edited.
 *
 * No payment provider is connected, so nothing here writes `paid`. A demo
 * purchase is recorded as `demo`, which entitles exactly the same access and
 * says on every screen what it is. The alternative — writing `paid` and putting
 * a disclaimer next to the button — leaves a database full of sales that never
 * happened, and the disclaimer is not in the database.
 */

export const PURCHASE_KIND = 'script';

/** The statuses that grant access. `demo` is here for as long as there is no provider. */
const ENTITLED = new Set(['paid', 'demo']);

export type ScriptPurchase = {
  productId: string;
  title: string;
  amountCents: number;
  /** True when nothing was charged, because no provider is connected. */
  demo: boolean;
  purchasedAt: Date;
};

export async function listScriptPurchases(userId: string): Promise<ScriptPurchase[]> {
  // The catalogue is public and has to render with no database behind it. With
  // none there is also no session, so "owns nothing" is the true answer rather
  // than a fallback.
  if (!isDatabaseConfigured()) return [];

  const rows = await db
    .select()
    .from(schema.purchase)
    .where(and(eq(schema.purchase.userId, userId), eq(schema.purchase.kind, PURCHASE_KIND)));

  return rows
    .filter((row) => ENTITLED.has(row.status) && row.externalRef !== null)
    .map((row) => ({
      productId: row.externalRef as string,
      title: row.title,
      amountCents: row.amountCents,
      demo: row.status === 'demo',
      purchasedAt: row.purchasedAt,
    }))
    .sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
}

export async function ownedScriptIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const purchases = await listScriptPurchases(userId);
  return new Set(purchases.map((purchase) => purchase.productId));
}

export async function ownsScript(userId: string | null, productId: string): Promise<boolean> {
  if (!userId) return false;
  const owned = await ownedScriptIds(userId);
  return owned.has(productId);
}

export type GrantResult = 'granted' | 'already_owned' | 'unknown_product';

/**
 * Grants access to a script.
 *
 * The price is read from the catalogue rather than taken from the caller: an
 * amount that arrives from a browser is a number somebody can choose, and the
 * one place it must not be chosen is the record of what was bought.
 */
export async function grantScript(userId: string, productId: string): Promise<GrantResult> {
  const product = findProduct(productId);
  if (!product) return 'unknown_product';

  if (await ownsScript(userId, productId)) return 'already_owned';

  await db.insert(schema.purchase).values({
    id: randomUUID(),
    userId,
    kind: PURCHASE_KIND,
    title: product.title,
    amountCents: product.amountCents,
    currency: 'EUR',
    status: 'demo',
    externalRef: product.id,
  });

  return 'granted';
}
