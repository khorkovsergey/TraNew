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

/**
 * Whether a KPI's inputs are instrumented well enough to believe it.
 *
 * The question a coverage table has to answer is not "which events exist" but
 * "can I trust this number", and the two are different: a metric whose required
 * event has never been emitted shows a confident zero unless something says
 * otherwise. This is that something.
 */
export type KpiReadiness = {
  metricId: string;
  label: string;
  requires: string[];
  observed: string[];
  /** Declared, reachable, and still never seen. */
  awaiting: string[];
  /** Declared but behind a flag that is off — silence here is correct. */
  unexposed: string[];
  /** Not in the registry at all. The metric cannot be computed. */
  missing: string[];
  verdict: 'trustworthy' | 'partial' | 'awaiting_data' | 'not_instrumented';
};

/**
 * What each product family is measurable *from*.
 *
 * The distinction Phase 3 turns on, made inspectable: a durable table with rows
 * does not prove the behavioural funnel is instrumented, and a telemetry event
 * does not prove the business outcome happened. Both are reported
 * independently, so a family with a full registration table and no funnel
 * events reads as exactly that rather than as "measured".
 */
export type FamilyCoverage = {
  family: string;
  /** Declared behavioural events for this family, and how many have arrived. */
  telemetryEvents: number;
  telemetryObserved: number;
  /** The durable tables read, if any. */
  durableSources: string[];
  verdict:
    | 'behaviour_and_facts'
    | 'facts_only'
    | 'behaviour_only'
    | 'awaiting_data'
    | 'not_instrumented';
  note: string;
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
  kpis: KpiReadiness[];
  families: FamilyCoverage[];
  /** True until the first row ever lands. Every "unused" is meaningless before then. */
  collectingSince: string | null;
  queriedAt: string;
};

/**
 * Which surfaces and which tables belong to each product family.
 *
 * The durable side is written down rather than derived, because there is
 * nothing to derive it from: a table does not know which product it serves.
 * The behavioural side comes from the registry's own `surface` field, so
 * adding an event to a family is a registry edit and not two.
 */
const FAMILY_SOURCES: ReadonlyArray<{ family: string; surfaces: string[]; durable: string[] }> = [
  { family: 'start', surfaces: ['start'], durable: [] },
  { family: 'events', surfaces: ['events'], durable: ['event_registration', 'event'] },
  { family: 'academy', surfaces: ['academy'], durable: ['academy_progress'] },
  { family: 'experts', surfaces: ['experts'], durable: ['expert_booking'] },
  { family: 'saves', surfaces: [], durable: ['saved_object', 'collection', 'collection_item'] },
  { family: 'wealth', surfaces: ['wealth'], durable: ['wealth_asset', 'wealth_liability', 'wealth_goal', 'consent'] },
  { family: 'commerce', surfaces: ['subscriptions'], durable: ['purchase', 'subscription', 'user'] },
  { family: 'accounts', surfaces: [], durable: ['user'] },
];

/**
 * What each Phase 2 KPI actually needs on the wire.
 *
 * Only the events without which the metric is wrong, not every event it might
 * incidentally read. PMCR needs a page view to have a denominator and an
 * engagement checkpoint to apply the eligibility floor; it does not need any
 * *particular* meaningful event, because a portal where nobody continues is a
 * finding rather than a measurement failure — which is why the meaningful
 * events are not listed as required.
 */
const KPI_INPUTS: ReadonlyArray<{ metricId: string; label: string; requires: string[] }> = [
  {
    metricId: 'pmcr',
    label: 'Portal Meaningful Continuation Rate',
    requires: ['portal_page_viewed', 'portal_engagement_checkpoint'],
  },
  {
    metricId: 'ttfa_median',
    label: 'Time to first meaningful action',
    requires: ['portal_session_started', 'portal_page_viewed'],
  },
  {
    metricId: 'second_action_rate',
    label: 'Second meaningful action rate',
    requires: ['portal_page_viewed', 'portal_engagement_checkpoint'],
  },
  {
    metricId: 'retention_d7',
    label: 'Authenticated D7 return',
    requires: ['portal_page_viewed'],
  },
];

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

  const byEvent = new Map(rows.map((row) => [row.event, row]));

  return {
    rows,
    totals: {
      declared: rows.length,
      observed: rows.filter((row) => row.status === 'observed').length,
      unexposed: rows.filter((row) => row.status === 'unexposed').length,
      unused: rows.filter((row) => row.status === 'unused').length,
      legacy: rows.filter((row) => row.lifecycle === 'legacy').length,
    },
    kpis: KPI_INPUTS.map((kpi) => readinessOf(kpi, byEvent)),
    families: FAMILY_SOURCES.map((family) => familyCoverage(family, rows)),
    collectingSince: collectingSince ? new Date(collectingSince).toISOString() : null,
    queriedAt: new Date().toISOString(),
  };
}

function familyCoverage(
  family: { family: string; surfaces: string[]; durable: string[] },
  rows: readonly CoverageRow[]
): FamilyCoverage {
  const own = rows.filter(
    (row) => family.surfaces.includes(row.surface) && row.lifecycle === 'current'
  );
  const observed = own.filter((row) => row.status === 'observed').length;

  const hasFacts = family.durable.length > 0;
  const hasEvents = own.length > 0;

  const verdict: FamilyCoverage['verdict'] = !hasFacts && !hasEvents
    ? 'not_instrumented'
    : hasFacts && observed > 0
      ? 'behaviour_and_facts'
      : hasFacts
        ? 'facts_only'
        : observed > 0
          ? 'behaviour_only'
          : 'awaiting_data';

  const note =
    verdict === 'facts_only'
      ? 'Durable records exist and the behavioural funnel has produced nothing yet. The table is not evidence that the funnel is instrumented.'
      : verdict === 'behaviour_only'
        ? 'Behaviour is being collected and there is no durable table behind it. Events are not evidence that an outcome occurred.'
        : verdict === 'awaiting_data'
          ? 'Declared and reachable, and nothing has arrived. Telemetry began at the Phase 1 deployment.'
          : verdict === 'not_instrumented'
            ? 'Neither behavioural events nor a durable source. Nothing about this family is measurable.'
            : 'Behaviour and durable facts are both available, and they are reported separately.';

  return {
    family: family.family,
    telemetryEvents: own.length,
    telemetryObserved: observed,
    durableSources: family.durable,
    verdict,
    note,
  };
}

function readinessOf(
  kpi: { metricId: string; label: string; requires: string[] },
  byEvent: ReadonlyMap<string, CoverageRow>
): KpiReadiness {
  const observed: string[] = [];
  const awaiting: string[] = [];
  const unexposed: string[] = [];
  const missing: string[] = [];

  for (const event of kpi.requires) {
    const row = byEvent.get(event);
    if (!row) missing.push(event);
    else if (row.status === 'observed') observed.push(event);
    else if (row.status === 'unexposed') unexposed.push(event);
    else awaiting.push(event);
  }

  /*
   * The order matters. A missing declaration is a code problem and outranks
   * everything; an unexposed input means the metric is measuring something
   * unreachable; and "awaiting" is the ordinary state of a portal whose
   * telemetry started this week — not a defect, but not a number to act on
   * either.
   */
  const verdict: KpiReadiness['verdict'] = missing.length
    ? 'not_instrumented'
    : unexposed.length
      ? 'partial'
      : awaiting.length
        ? 'awaiting_data'
        : 'trustworthy';

  return { ...kpi, observed, awaiting, unexposed, missing, verdict };
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
