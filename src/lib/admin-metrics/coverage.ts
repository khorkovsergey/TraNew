import 'server-only';
import { gte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { EVENT_REGISTRY, type EventDefinition } from '@/lib/analytics/registry';
import { featureStateFor } from '@/lib/analytics/surfaces';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

/**
 * Instrumentation coverage.
 *
 * The distinction this exists to make, and the one a naive version gets wrong:
 * **never received** has three completely different meanings, and reporting
 * them as one number is how a product decides to delete a feature nobody could
 * reach.
 *
 * - *uninstrumented* — the event is not declared, or nothing emits it. The
 *   product is not measuring something it does.
 * - *unexposed* — the event is declared and emitted, but the surface is behind
 *   a flag that is off, so the code path is unreachable. Silence is correct.
 * - *unused* — declared, emitted, reachable, and still nothing arrives. This is
 *   the only one that is a finding about users.
 *
 * A fourth state exists only because of this section's own history: everything
 * is `awaiting_first_event` on the day the sink is connected, because
 * production analytics was a no-op until then and there is no history to be
 * missing from.
 */

export type CoverageStatus =
  | 'observed'
  | 'awaiting_first_event'
  | 'unexposed'
  | 'unused'
  | 'legacy_silent'
  | 'legacy_still_emitting';

export type CoverageRow = {
  event: string;
  surface: string;
  kind: EventDefinition['kind'];
  lifecycle: EventDefinition['lifecycle'];
  featureState: string;
  count: number;
  lastSeen: string | null;
  status: CoverageStatus;
  note?: string;
};

export type CoverageReport = {
  rows: CoverageRow[];
  totals: {
    declared: number;
    observed: number;
    unexposed: number;
    unused: number;
    legacy: number;
  };
  /** True until the first row ever lands. Every "unused" is meaningless before then. */
  collectingSince: string | null;
  queriedAt: string;
};

export async function instrumentationCoverage(since: Date): Promise<CoverageReport> {
  const flags = {
    superchartEnabled: FEATURE_FLAGS.superchartEnabled,
    wealthHubEnabled: FEATURE_FLAGS.wealthHubEnabled,
    alertsEnabled: FEATURE_FLAGS.alertsEnabled,
  };

  const observed = await db
    .select({
      eventName: schema.productTelemetryEvent.eventName,
      count: sql<number>`count(*)::int`,
      lastSeen: sql<Date | null>`max(${schema.productTelemetryEvent.occurredAt})`,
    })
    .from(schema.productTelemetryEvent)
    .where(gte(schema.productTelemetryEvent.occurredAt, since))
    .groupBy(schema.productTelemetryEvent.eventName);

  const byName = new Map(observed.map((row) => [row.eventName, row]));

  /*
   * The first row ever received, not the first inside the window. It is what
   * separates "nothing arrived this week" from "nothing has ever arrived", and
   * only the first is a statement about the week.
   */
  const [earliest] = await db
    .select({ at: sql<Date | null>`min(${schema.productTelemetryEvent.receivedAt})` })
    .from(schema.productTelemetryEvent);

  const collectingSince = earliest?.at ?? null;

  const rows: CoverageRow[] = EVENT_REGISTRY.map((definition) => {
    const hit = byName.get(definition.name);
    const featureState = featureStateFor(definition.surface, flags);
    const count = hit?.count ?? 0;
    const lastSeen = hit?.lastSeen ? new Date(hit.lastSeen).toISOString() : null;

    return {
      event: definition.name,
      surface: definition.surface,
      kind: definition.kind,
      lifecycle: definition.lifecycle,
      featureState,
      count,
      lastSeen,
      status: statusFor(definition, count, featureState, collectingSince),
      note: definition.note,
    };
  });

  return {
    rows,
    totals: {
      declared: rows.length,
      observed: rows.filter((row) => row.status === 'observed').length,
      unexposed: rows.filter((row) => row.status === 'unexposed').length,
      unused: rows.filter((row) => row.status === 'unused').length,
      legacy: rows.filter((row) => row.lifecycle === 'legacy').length,
    },
    collectingSince: collectingSince ? new Date(collectingSince).toISOString() : null,
    queriedAt: new Date().toISOString(),
  };
}

function statusFor(
  definition: EventDefinition,
  count: number,
  featureState: string,
  collectingSince: Date | null
): CoverageStatus {
  if (definition.lifecycle === 'legacy') {
    /*
     * A legacy event arriving is a real finding: something still emits a member
     * of a funnel that was retired. The ingest layer refuses them, so this can
     * only be non-zero if one was written before it was reclassified.
     */
    return count > 0 ? 'legacy_still_emitting' : 'legacy_silent';
  }

  if (count > 0) return 'observed';

  // Nothing has ever been collected, so nothing can be called unused yet.
  if (!collectingSince) return 'awaiting_first_event';

  if (featureState !== 'live') return 'unexposed';

  return 'unused';
}
