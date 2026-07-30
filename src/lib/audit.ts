import 'server-only';
import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requestFingerprint } from './session';

/**
 * Access log for financial data.
 *
 * Every read and every change of the wealth record is recorded. The log stores what
 * was touched and by whom — never the values themselves, so the audit trail does not
 * become a second, unencrypted copy of the data it is meant to protect.
 */

export type AuditAction = 'read' | 'create' | 'update' | 'delete' | 'export' | 'share';

export type AuditResource =
  | 'wealth_overview'
  | 'wealth_asset'
  | 'wealth_liability'
  | 'wealth_goal'
  | 'consent'
  | 'session';

/** Who performed it — a person, Copilot acting on their behalf, or an expert snapshot. */
export type AuditActor = 'user' | 'copilot' | 'expert_snapshot' | 'system';

export async function recordAccess(options: {
  userId: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  actor?: AuditActor;
  context?: Record<string, string | number | boolean>;
}) {
  const { ipAddress, userAgent } = await requestFingerprint();

  await db.insert(schema.dataAccessLog).values({
    id: randomUUID(),
    userId: options.userId,
    action: options.action,
    resource: options.resource,
    resourceId: options.resourceId ?? null,
    actor: options.actor ?? 'user',
    ipAddress,
    userAgent,
    context: options.context ?? null,
  });
}

export async function listAccessLog(userId: string, limit = 100) {
  return db
    .select()
    .from(schema.dataAccessLog)
    .where(eq(schema.dataAccessLog.userId, userId))
    .orderBy(desc(schema.dataAccessLog.createdAt))
    .limit(limit);
}
