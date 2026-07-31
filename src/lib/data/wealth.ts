import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { recordAccess } from '@/lib/audit';
import { recordActivity } from './activity';
import { seal, unseal } from './userKey';

/**
 * The wealth record.
 *
 * Three things separate this from every other aggregate:
 *
 * - Names, values and free text are encrypted under the person's own key. Only
 *   the shape — category, currency, country, freshness — stays queryable, because
 *   the app has to be able to group and total without decrypting everything.
 * - Every read is written to the access log. Someone must be able to ask "who
 *   looked at my finances" and get a real answer.
 * - Corrections supersede rather than overwrite. A valuation that changed is part
 *   of the record's history; destroying it would make the record less trustworthy,
 *   not tidier.
 */

export type AssetCategory =
  | 'property'
  | 'business'
  | 'securities'
  | 'cash'
  | 'deposit'
  | 'crypto'
  | 'other';

/** How fresh the figure is — shown as a chip so a stale number never reads as live. */
export type DataStatus = 'live' | 'manual' | 'stale' | 'estimated';

export type WealthAsset = {
  id: string;
  category: AssetCategory;
  dataStatus: DataStatus;
  currency: string;
  country: string | null;
  name: string;
  value: number | null;
  details: string | null;
  source: string | null;
  valuedAt: Date | null;
  updatedAt: Date;
};

export type WealthLiability = {
  id: string;
  linkedAssetId: string | null;
  currency: string;
  name: string;
  balance: number | null;
  terms: string | null;
};

export type WealthGoal = {
  id: string;
  name: string;
  target: number | null;
  priority: string | null;
  dueAt: Date | null;
};

/** Encrypted numbers come back as strings; a bad parse is null, never 0. */
function toNumber(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function listAssets(userId: string): Promise<WealthAsset[]> {
  const rows = await db
    .select()
    .from(schema.wealthAsset)
    .where(and(eq(schema.wealthAsset.userId, userId), isNull(schema.wealthAsset.supersededAt)));

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      category: row.category as AssetCategory,
      dataStatus: row.dataStatus as DataStatus,
      currency: row.currency,
      country: row.country,
      name: (await unseal(userId, row.nameEnc)) ?? 'Unreadable entry',
      value: toNumber(await unseal(userId, row.valueEnc)),
      details: await unseal(userId, row.detailsEnc),
      source: row.source,
      valuedAt: row.valuedAt,
      updatedAt: row.updatedAt,
    }))
  );
}

export async function listLiabilities(userId: string): Promise<WealthLiability[]> {
  const rows = await db
    .select()
    .from(schema.wealthLiability)
    .where(eq(schema.wealthLiability.userId, userId));

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      linkedAssetId: row.linkedAssetId,
      currency: row.currency,
      name: (await unseal(userId, row.nameEnc)) ?? 'Unreadable entry',
      balance: toNumber(await unseal(userId, row.balanceEnc)),
      terms: await unseal(userId, row.termsEnc),
    }))
  );
}

export async function listGoals(userId: string): Promise<WealthGoal[]> {
  const rows = await db
    .select()
    .from(schema.wealthGoal)
    .where(eq(schema.wealthGoal.userId, userId));

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      name: (await unseal(userId, row.nameEnc)) ?? 'Unreadable entry',
      target: toNumber(await unseal(userId, row.targetEnc)),
      priority: row.priority,
      dueAt: row.dueAt,
    }))
  );
}

export type WealthRecord = {
  assets: WealthAsset[];
  liabilities: WealthLiability[];
  goals: WealthGoal[];
  /** True when nothing has been entered yet — the screens show onboarding, not zeros. */
  empty: boolean;
};

/** The whole record, with the read logged once rather than three times. */
export async function getWealthRecord(userId: string): Promise<WealthRecord> {
  const [assets, liabilities, goals] = await Promise.all([
    listAssets(userId),
    listLiabilities(userId),
    listGoals(userId),
  ]);

  await recordAccess({
    userId,
    action: 'read',
    resource: 'wealth_overview',
    context: { assets: assets.length, liabilities: liabilities.length, goals: goals.length },
  });

  return {
    assets,
    liabilities,
    goals,
    empty: assets.length === 0 && liabilities.length === 0 && goals.length === 0,
  };
}

export async function addAsset(options: {
  userId: string;
  category: AssetCategory;
  name: string;
  value: number;
  currency: string;
  country?: string;
  details?: string;
  dataStatus?: DataStatus;
  source?: string;
}): Promise<string> {
  const { userId } = options;
  const id = randomUUID();

  await db.insert(schema.wealthAsset).values({
    id,
    userId,
    category: options.category,
    // Anything the person typed is manual until a data source confirms it.
    dataStatus: options.dataStatus ?? 'manual',
    currency: options.currency,
    country: options.country ?? null,
    nameEnc: (await seal(userId, options.name))!,
    valueEnc: (await seal(userId, String(options.value)))!,
    detailsEnc: await seal(userId, options.details),
    source: options.source ?? 'manual entry',
    valuedAt: new Date(),
  });

  await recordAccess({
    userId,
    action: 'create',
    resource: 'wealth_asset',
    resourceId: id,
    context: { category: options.category, currency: options.currency },
  });
  await recordActivity({
    userId,
    type: 'wealth',
    title: 'Added an asset to the wealth record',
    kind: 'wealth_asset',
    ref: id,
  });

  return id;
}

/**
 * Records a new valuation by superseding the old row.
 *
 * The previous figure stays, marked superseded, so the record can show when a
 * value changed and what it was before. Overwriting would quietly erase the fact
 * that an estimate was ever different.
 */
export async function revalueAsset(options: {
  userId: string;
  assetId: string;
  value: number;
  source?: string;
}): Promise<string | null> {
  const { userId, assetId } = options;

  const [current] = await db
    .select()
    .from(schema.wealthAsset)
    .where(and(eq(schema.wealthAsset.id, assetId), eq(schema.wealthAsset.userId, userId)))
    .limit(1);

  if (!current) return null;

  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx
      .update(schema.wealthAsset)
      .set({ supersededAt: new Date() })
      .where(eq(schema.wealthAsset.id, assetId));

    await tx.insert(schema.wealthAsset).values({
      ...current,
      id,
      valueEnc: (await seal(userId, String(options.value)))!,
      dataStatus: 'manual',
      source: options.source ?? 'manual revaluation',
      valuedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      supersededAt: null,
    });
  });

  await recordAccess({
    userId,
    action: 'update',
    resource: 'wealth_asset',
    resourceId: id,
    context: { supersededId: assetId },
  });
  await recordActivity({
    userId,
    type: 'wealth',
    title: 'Updated a valuation',
    kind: 'wealth_asset',
    ref: id,
  });

  return id;
}

export async function addLiability(options: {
  userId: string;
  name: string;
  balance: number;
  currency: string;
  linkedAssetId?: string;
  terms?: string;
}): Promise<string> {
  const { userId } = options;
  const id = randomUUID();

  await db.insert(schema.wealthLiability).values({
    id,
    userId,
    linkedAssetId: options.linkedAssetId ?? null,
    currency: options.currency,
    nameEnc: (await seal(userId, options.name))!,
    balanceEnc: (await seal(userId, String(options.balance)))!,
    termsEnc: await seal(userId, options.terms),
  });

  await recordAccess({ userId, action: 'create', resource: 'wealth_liability', resourceId: id });
  return id;
}

export async function addGoal(options: {
  userId: string;
  name: string;
  target?: number;
  priority?: string;
  dueAt?: Date;
}): Promise<string> {
  const { userId } = options;
  const id = randomUUID();

  await db.insert(schema.wealthGoal).values({
    id,
    userId,
    nameEnc: (await seal(userId, options.name))!,
    targetEnc: await seal(userId, options.target !== undefined ? String(options.target) : null),
    priority: options.priority ?? null,
    dueAt: options.dueAt ?? null,
  });

  await recordAccess({ userId, action: 'create', resource: 'wealth_goal', resourceId: id });
  return id;
}

export async function deleteAsset(userId: string, assetId: string): Promise<void> {
  await db
    .delete(schema.wealthAsset)
    .where(and(eq(schema.wealthAsset.id, assetId), eq(schema.wealthAsset.userId, userId)));

  await recordAccess({ userId, action: 'delete', resource: 'wealth_asset', resourceId: assetId });
}

/**
 * Totals by currency, deliberately not converted.
 *
 * Summing across currencies needs an exchange rate, and a rate applied silently
 * would turn an estimate into what looks like a fact. The screens show the split
 * and name the rate when they convert.
 */
export function totalByCurrency(assets: WealthAsset[]): Record<string, number> {
  return assets.reduce<Record<string, number>>((totals, asset) => {
    if (asset.value === null) return totals;
    totals[asset.currency] = (totals[asset.currency] ?? 0) + asset.value;
    return totals;
  }, {});
}
