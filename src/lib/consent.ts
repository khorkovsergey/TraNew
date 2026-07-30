import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { recordAccess } from './audit';
import { requestFingerprint } from './session';

/**
 * Consent records.
 *
 * Each kind is its own record — sharing context with Copilot and sharing it with a
 * human expert are different decisions and are never covered by one checkbox.
 * Records are versioned: if the wording of what is being agreed to changes, the old
 * grant stops counting and must be given again.
 */

export type ConsentKind =
  | 'copilot_context'
  | 'expert_sharing'
  | 'ai_processing'
  | 'marketplace_terms'
  | 'cancellation_policy';

/** Bump a version when the meaning of the consent changes, not for copy edits. */
export const CONSENT_VERSION: Record<ConsentKind, number> = {
  copilot_context: 1,
  expert_sharing: 1,
  ai_processing: 1,
  marketplace_terms: 1,
  cancellation_policy: 1,
};

export const CONSENT_TEXT: Record<ConsentKind, string> = {
  copilot_context:
    'Copilot may use the items I select from my Wealth Record to answer my questions. It may not use anything I have not selected.',
  expert_sharing:
    'I agree to share the items I selected with this expert, for this consultation only.',
  ai_processing: 'I agree that AI may process my brief to prepare this consultation.',
  marketplace_terms: 'I accept the Marketplace terms of service.',
  cancellation_policy: 'I have read the cancellation and refund policy.',
};

export type ConsentState = {
  kind: ConsentKind;
  granted: boolean;
  /** Which specific items were granted. Empty means "agreed, but shared nothing". */
  grants: string[];
  version: number;
  grantedAt: Date | null;
  /** True when an older version was granted and the wording has since changed. */
  stale: boolean;
};

export async function getConsent(
  userId: string,
  kind: ConsentKind,
  scope?: string
): Promise<ConsentState> {
  const rows = await db
    .select()
    .from(schema.consent)
    .where(
      and(
        eq(schema.consent.userId, userId),
        eq(schema.consent.kind, kind),
        isNull(schema.consent.revokedAt),
        scope ? eq(schema.consent.scope, scope) : isNull(schema.consent.scope)
      )
    )
    .orderBy(desc(schema.consent.grantedAt))
    .limit(1);

  const current = rows[0];
  if (!current) {
    return { kind, granted: false, grants: [], version: 0, grantedAt: null, stale: false };
  }

  return {
    kind,
    granted: true,
    grants: Array.isArray(current.grants) ? (current.grants as string[]) : [],
    version: current.version,
    grantedAt: current.grantedAt,
    stale: current.version < CONSENT_VERSION[kind],
  };
}

export async function grantConsent(options: {
  userId: string;
  kind: ConsentKind;
  grants: string[];
  scope?: string;
}) {
  const { ipAddress } = await requestFingerprint();

  // Superseding rather than updating keeps the history of what was agreed and when.
  await revokeConsent({ userId: options.userId, kind: options.kind, scope: options.scope });

  await db.insert(schema.consent).values({
    id: randomUUID(),
    userId: options.userId,
    kind: options.kind,
    scope: options.scope ?? null,
    grants: options.grants,
    version: CONSENT_VERSION[options.kind],
    ipAddress,
  });

  await recordAccess({
    userId: options.userId,
    action: 'update',
    resource: 'consent',
    resourceId: options.kind,
    context: { itemsGranted: options.grants.length, scope: options.scope ?? 'account' },
  });
}

export async function revokeConsent(options: {
  userId: string;
  kind: ConsentKind;
  scope?: string;
}) {
  await db
    .update(schema.consent)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.consent.userId, options.userId),
        eq(schema.consent.kind, options.kind),
        isNull(schema.consent.revokedAt),
        options.scope ? eq(schema.consent.scope, options.scope) : isNull(schema.consent.scope)
      )
    );
}

/**
 * The gate Copilot must pass before touching the wealth record. Returns only the
 * items explicitly granted, so an un-granted item cannot leak through a wide query.
 */
export async function copilotAllowedContext(userId: string): Promise<string[]> {
  const consent = await getConsent(userId, 'copilot_context');
  if (!consent.granted || consent.stale) return [];
  return consent.grants;
}
