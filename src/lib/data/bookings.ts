import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { recordAccess } from '@/lib/audit';
import { recordActivity } from './activity';
import { seal, unseal } from './userKey';

/**
 * Expert bookings and purchases.
 *
 * A booking used to live in sessionStorage, which meant a held slot vanished when
 * the tab closed — the worst possible place for it, since a hold is a promise made
 * to two people.
 *
 * The intake brief is encrypted: it is someone describing their finances in their
 * own words. `sharedContext` records exactly which context blocks they approved,
 * so what an expert can see is a stored fact rather than a UI state that was true
 * at the time.
 */

export type BookingStatus =
  | 'draft'
  | 'slot_held'
  | 'payment_pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'no_show'
  | 'disputed';

export type Booking = {
  id: string;
  expertRef: string;
  packageRef: string | null;
  status: BookingStatus;
  brief: string | null;
  sharedContext: string[];
  slotAt: Date | null;
  holdExpiresAt: Date | null;
  rating: number | null;
  summary: string | null;
  createdAt: Date;
};

async function toBooking(
  userId: string,
  row: typeof schema.expertBooking.$inferSelect
): Promise<Booking> {
  return {
    id: row.id,
    expertRef: row.expertRef,
    packageRef: row.packageRef,
    status: row.status as BookingStatus,
    brief: await unseal(userId, row.briefEnc),
    sharedContext: row.sharedContext ?? [],
    slotAt: row.slotAt,
    holdExpiresAt: row.holdExpiresAt,
    rating: row.rating,
    summary: await unseal(userId, row.summaryEnc),
    createdAt: row.createdAt,
  };
}

export async function listBookings(userId: string): Promise<Booking[]> {
  const rows = await db
    .select()
    .from(schema.expertBooking)
    .where(eq(schema.expertBooking.userId, userId))
    .orderBy(desc(schema.expertBooking.createdAt));

  return Promise.all(rows.map((row) => toBooking(userId, row)));
}

export async function getBooking(userId: string, bookingId: string): Promise<Booking | null> {
  const [row] = await db
    .select()
    .from(schema.expertBooking)
    .where(and(eq(schema.expertBooking.id, bookingId), eq(schema.expertBooking.userId, userId)))
    .limit(1);

  return row ? toBooking(userId, row) : null;
}

/** Starts a draft. Nothing is held and nothing is shared until later steps. */
export async function startBooking(options: {
  userId: string;
  expertRef: string;
  brief?: string;
}): Promise<string> {
  const id = randomUUID();

  await db.insert(schema.expertBooking).values({
    id,
    userId: options.userId,
    expertRef: options.expertRef,
    status: 'draft',
    briefEnc: await seal(options.userId, options.brief),
    sharedContext: [],
  });

  return id;
}

export async function updateBrief(
  userId: string,
  bookingId: string,
  brief: string
): Promise<void> {
  await db
    .update(schema.expertBooking)
    .set({ briefEnc: await seal(userId, brief), updatedAt: new Date() })
    .where(and(eq(schema.expertBooking.id, bookingId), eq(schema.expertBooking.userId, userId)));
}

/**
 * Records which context blocks the person approved sharing.
 *
 * Logged as a share of financial data, because that is what it is — the person
 * should be able to see later exactly what they let an expert read, and when.
 */
export async function setSharedContext(
  userId: string,
  bookingId: string,
  blocks: string[]
): Promise<void> {
  await db
    .update(schema.expertBooking)
    .set({ sharedContext: blocks, updatedAt: new Date() })
    .where(and(eq(schema.expertBooking.id, bookingId), eq(schema.expertBooking.userId, userId)));

  await recordAccess({
    userId,
    action: 'share',
    resource: 'wealth_overview',
    resourceId: bookingId,
    actor: 'expert_snapshot',
    context: { blocks: blocks.join(',') || 'none' },
  });
}

/** Holds a slot for a bounded time — an unpaid hold must expire, not linger. */
export async function holdSlot(options: {
  userId: string;
  bookingId: string;
  slotAt: Date;
  packageRef?: string;
  holdMinutes?: number;
}): Promise<void> {
  const expires = new Date(Date.now() + (options.holdMinutes ?? 15) * 60_000);

  await db
    .update(schema.expertBooking)
    .set({
      status: 'slot_held',
      slotAt: options.slotAt,
      packageRef: options.packageRef ?? null,
      holdExpiresAt: expires,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.expertBooking.id, options.bookingId),
        eq(schema.expertBooking.userId, options.userId)
      )
    );
}

export async function setBookingStatus(
  userId: string,
  bookingId: string,
  status: BookingStatus
): Promise<void> {
  await db
    .update(schema.expertBooking)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(schema.expertBooking.id, bookingId), eq(schema.expertBooking.userId, userId)));

  await recordActivity({
    userId,
    type: 'booking',
    title: `Consultation ${status.replace('_', ' ')}`,
    kind: 'booking',
    ref: bookingId,
  });
}

/* --------------------------------------------------------------- Purchases */

export type Purchase = {
  id: string;
  kind: 'subscription' | 'consultation' | 'report' | 'course';
  title: string;
  amountCents: number;
  currency: string;
  status: 'paid' | 'pending' | 'refunded' | 'failed';
  invoiceUrl: string | null;
  purchasedAt: Date;
};

export async function listPurchases(userId: string): Promise<Purchase[]> {
  const rows = await db
    .select()
    .from(schema.purchase)
    .where(eq(schema.purchase.userId, userId))
    .orderBy(desc(schema.purchase.purchasedAt));

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as Purchase['kind'],
    title: row.title,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status as Purchase['status'],
    invoiceUrl: row.invoiceUrl,
    purchasedAt: row.purchasedAt,
  }));
}

export async function recordPurchase(options: {
  userId: string;
  kind: Purchase['kind'];
  title: string;
  amountCents: number;
  currency?: string;
  status?: Purchase['status'];
  externalRef?: string;
}): Promise<string> {
  const id = randomUUID();

  await db.insert(schema.purchase).values({
    id,
    userId: options.userId,
    kind: options.kind,
    title: options.title,
    amountCents: options.amountCents,
    currency: options.currency ?? 'EUR',
    status: options.status ?? 'paid',
    externalRef: options.externalRef ?? null,
  });

  await recordActivity({
    userId: options.userId,
    type: 'purchase',
    title: options.title,
    kind: options.kind,
    ref: id,
  });

  return id;
}
