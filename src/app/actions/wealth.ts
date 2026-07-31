'use server';

import { revalidatePath } from 'next/cache';
import {
  addAsset,
  deleteAsset,
  revalueAsset,
  type AssetCategory,
} from '@/lib/data/wealth';
import { getSession } from '@/lib/session';

/**
 * Server actions for the wealth record.
 *
 * Every one reads the session on the server and never trusts a user id from the
 * form. For this aggregate that is not a formality: a client that could name the
 * owner could write into someone else's finances.
 *
 * Values arrive as strings from the form and are parsed here. A value that does
 * not parse is rejected rather than stored as zero — a wrong number in a net-worth
 * record is worse than a missing one.
 */

export type WealthResult =
  | { status: 'ok'; id?: string }
  | { status: 'sign_in_required' }
  | { status: 'invalid'; message: string };

const CATEGORIES: AssetCategory[] = [
  'property',
  'business',
  'securities',
  'cash',
  'deposit',
  'crypto',
  'other',
];

function parseAmount(raw: string): number | null {
  // Tolerates "€415,000" and "415 000" — people paste what they see.
  const cleaned = raw.replace(/[^\d.,-]/g, '').replace(/\s/g, '').replace(/,/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function addAssetAction(input: {
  category: string;
  name: string;
  value: string;
  currency: string;
  country?: string;
  details?: string;
}): Promise<WealthResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  const name = input.name.trim();
  if (!name) return { status: 'invalid', message: 'Give the asset a name you will recognise.' };

  const value = parseAmount(input.value);
  if (value === null) {
    return { status: 'invalid', message: 'That value could not be read as a number.' };
  }

  const category = CATEGORIES.includes(input.category as AssetCategory)
    ? (input.category as AssetCategory)
    : 'other';

  const currency = input.currency.trim().toUpperCase() || 'EUR';
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { status: 'invalid', message: 'Use a three-letter currency code, such as EUR.' };
  }

  const id = await addAsset({
    userId: session.user.id,
    category,
    name,
    value,
    currency,
    country: input.country?.trim() || undefined,
    details: input.details?.trim() || undefined,
  });

  revalidatePath('/en/account/wealth');
  return { status: 'ok', id };
}

/** Records a new valuation. The previous figure is superseded, never overwritten. */
export async function revalueAssetAction(input: {
  assetId: string;
  value: string;
}): Promise<WealthResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  const value = parseAmount(input.value);
  if (value === null) {
    return { status: 'invalid', message: 'That value could not be read as a number.' };
  }

  const id = await revalueAsset({ userId: session.user.id, assetId: input.assetId, value });
  if (!id) return { status: 'invalid', message: 'That asset is no longer in your record.' };

  revalidatePath('/en/account/wealth');
  return { status: 'ok', id };
}

export async function deleteAssetAction(assetId: string): Promise<WealthResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  await deleteAsset(session.user.id, assetId);
  revalidatePath('/en/account/wealth');
  return { status: 'ok' };
}
