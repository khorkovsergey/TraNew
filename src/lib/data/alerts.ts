import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { recordActivity } from './activity';

/**
 * Alerts.
 *
 * An alert starts as a draft. Voyager and the symbol pages can propose one, but
 * something that will interrupt a person later should not switch itself on
 * without them looking at it — the draft state is the confirmation step.
 */

export type AlertKind = 'price' | 'percent_move' | 'indicator_release' | 'news' | 'earnings';
export type AlertStatus = 'draft' | 'active' | 'paused' | 'triggered';

export type Alert = {
  id: string;
  kind: AlertKind;
  ref: string;
  label: string;
  condition: Record<string, string | number> | null;
  channels: string[];
  status: AlertStatus;
  lastTriggeredAt: Date | null;
  createdAt: Date;
};

function toAlert(row: typeof schema.alert.$inferSelect): Alert {
  return {
    id: row.id,
    kind: row.kind as AlertKind,
    ref: row.ref,
    label: row.label,
    condition: row.condition ?? null,
    channels: row.channels ?? ['in_app'],
    status: row.status as AlertStatus,
    lastTriggeredAt: row.lastTriggeredAt,
    createdAt: row.createdAt,
  };
}

export async function listAlerts(userId: string): Promise<Alert[]> {
  const rows = await db
    .select()
    .from(schema.alert)
    .where(eq(schema.alert.userId, userId))
    .orderBy(desc(schema.alert.createdAt));

  return rows.map(toAlert);
}

export async function draftAlert(options: {
  userId: string;
  kind: AlertKind;
  ref: string;
  label: string;
  condition?: Record<string, string | number>;
  savedObjectId?: string;
}): Promise<string> {
  const id = randomUUID();

  await db.insert(schema.alert).values({
    id,
    userId: options.userId,
    kind: options.kind,
    ref: options.ref,
    label: options.label,
    condition: options.condition ?? null,
    channels: ['in_app'],
    status: 'draft',
    savedObjectId: options.savedObjectId ?? null,
  });

  return id;
}

/** Turning a draft on is the person's act, so it is its own call and is logged. */
export async function activateAlert(userId: string, alertId: string): Promise<void> {
  const [row] = await db
    .update(schema.alert)
    .set({ status: 'active' })
    .where(and(eq(schema.alert.id, alertId), eq(schema.alert.userId, userId)))
    .returning({ label: schema.alert.label, ref: schema.alert.ref });

  if (row) {
    await recordActivity({
      userId,
      type: 'alert',
      title: `Alert active: ${row.label}`,
      kind: 'alert',
      ref: row.ref,
    });
  }
}

export async function setAlertStatus(
  userId: string,
  alertId: string,
  status: AlertStatus
): Promise<void> {
  await db
    .update(schema.alert)
    .set({ status })
    .where(and(eq(schema.alert.id, alertId), eq(schema.alert.userId, userId)));
}

export async function deleteAlert(userId: string, alertId: string): Promise<void> {
  await db
    .delete(schema.alert)
    .where(and(eq(schema.alert.id, alertId), eq(schema.alert.userId, userId)));
}
