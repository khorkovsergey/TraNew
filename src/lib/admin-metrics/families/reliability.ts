import 'server-only';
import { and, gte, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { marketDataStatus } from '@/lib/market/client';
import {
  count as countMetric,
  notMeasurable,
  rate as rateMetric,
  sourceNotConnected,
  type MetricProvenance,
  type MetricValue,
} from '@/lib/analytics/states';
import { MARKETPLACE_MIN_SAMPLE } from '../dictionary';
import { staffAnalyticsKeys, staffSessionIds } from '../internalTraffic';
import { SOURCE_CADENCE, sourceIsStale } from '../freshness';
import { summariseVitals, worstSurfaces, type VitalSample, type VitalSummary } from '../webVitals';
import { summariseSupercharts, type SuperchartEvent, type SuperchartsSummary } from './supercharts';

/**
 * Reliability, market data health and Supercharts.
 *
 * Three things the Observatory could not answer before: is the portal usable,
 * can the product get the financial data it claims to show, and is the charting
 * capability being used.
 *
 * The three have different provenance and the payload keeps them apart. Web
 * Vitals and runtime failures are this section's own telemetry and arrive
 * today. Market provider outcomes need the Markets section's emitter and
 * report `not_measurable` until it lands — but the **configuration** state is
 * knowable right now, from the market client's own status function, without
 * this dashboard ever becoming a second customer of the provider.
 *
 * ## Where internal traffic is excluded here, and where it is not
 *
 * **Supercharts is excluded**, by session: it is a customer-usage question, and
 * an administrator opening a chart to check a deploy is not adoption.
 *
 * **Web Vitals, runtime failures and their page-view denominator are not.**
 * They ask whether the portal works, and it either rendered slowly or it did
 * not — a crash on a staff machine is the same defect as a crash on anybody
 * else's, and dropping those samples would make the product look healthier the
 * more of it we used ourselves. The two are kept in one query and separated in
 * memory rather than filtered apart in SQL, so the failure rate and its
 * denominator can never come from different populations.
 *
 * **Market data is not excludable at all.** `market_data_request_completed` is
 * an operational server event with no session and no user attribution by
 * design, and nothing here pretends otherwise.
 */

const VITAL_EVENT = 'web_vital_measured';
const FAILURE_EVENT = 'client_runtime_failure';
const MARKET_EVENT = 'market_data_request_completed';

const SUPERCHART_EVENTS = [
  'superchart_opened',
  'superchart_study_toggled',
  'superchart_study_applied',
  'superchart_drawing_created',
  'superchart_layout_saved',
  'superchart_script_generated',
  'superchart_script_exported',
  'superchart_preview_run',
  'superchart_capability_completed',
];

export type ReliabilityReport = {
  vitals: VitalSummary[];
  worstLcpSurfaces: Array<{ area: string; sample: number; p75: number | null }>;
  failures: {
    total: MetricValue;
    byClass: Array<{ key: string; count: number }>;
    byArea: Array<{ key: string; count: number }>;
    /** Per thousand eligible page views, defined rather than implied. */
    perThousandPageViews: MetricValue;
  };
  market: {
    /** Known now, from configuration rather than from a provider call. */
    quotesConfigured: boolean;
    macroConfigured: boolean;
    awaitingEmitter: boolean;
    requests: MetricValue;
    successes: MetricValue;
    noData: MetricValue;
    providerErrors: MetricValue;
    notConfigured: MetricValue;
    freshness: Array<{ key: string; count: number }>;
    withVolume: MetricValue;
    delayedPolicy: string;
  };
  supercharts: SuperchartsSummary & { awaitingCapabilityEmitter: boolean };
  sources: Array<{ source: string; lastSeen: string | null; stale: boolean; why: string }>;
  queriedAt: string;
};

export async function reliabilityReport(since: Date): Promise<ReliabilityReport> {
  const queriedAt = new Date();

  const at = (metricId: string, source: string): MetricProvenance => ({
    metricId,
    source,
    sourceType: 'telemetry',
    queriedAt: queriedAt.toISOString(),
  });

  const staffKeys = await staffAnalyticsKeys();

  const rows = await db
    .select({
      eventName: schema.productTelemetryEvent.eventName,
      sessionId: schema.productTelemetryEvent.sessionId,
      /* Read to classify the session, never returned. */
      userKeyHash: schema.productTelemetryEvent.userKeyHash,
      properties: schema.productTelemetryEvent.properties,
      receivedAt: schema.productTelemetryEvent.receivedAt,
    })
    .from(schema.productTelemetryEvent)
    .where(
      and(
        gte(schema.productTelemetryEvent.occurredAt, since),
        inArray(schema.productTelemetryEvent.eventName, [
          VITAL_EVENT,
          FAILURE_EVENT,
          MARKET_EVENT,
          'portal_page_viewed',
          ...SUPERCHART_EVENTS,
        ])
      )
    );

  /* Has each emitter ever run at all? Not just inside this window. */
  const everSeen = await db
    .select({
      eventName: schema.productTelemetryEvent.eventName,
      lastSeen: sql<Date | null>`max(${schema.productTelemetryEvent.receivedAt})`,
    })
    .from(schema.productTelemetryEvent)
    .where(inArray(schema.productTelemetryEvent.eventName, [VITAL_EVENT, MARKET_EVENT, 'superchart_capability_completed', 'portal_page_viewed', 'voyager_request_completed']))
    .groupBy(schema.productTelemetryEvent.eventName);

  const seen = new Map(everSeen.map((row) => [row.eventName, row.lastSeen]));

  /* Every session in this window that was ever attributed to a staff account. */
  const internalSessions = staffSessionIds(rows, staffKeys);

  const vitalSamples: VitalSample[] = rows
    .filter((row) => row.eventName === VITAL_EVENT)
    .map((row) => {
      const properties = (row.properties ?? {}) as Record<string, unknown>;
      return {
        metric: String(properties.metric ?? ''),
        value: Number(properties.value ?? 0) || 0,
        rating: String(properties.rating ?? ''),
        area: String(properties.area ?? 'unknown'),
      };
    });

  const failureRows = rows.filter((row) => row.eventName === FAILURE_EVENT);
  const pageViews = rows.filter((row) => row.eventName === 'portal_page_viewed').length;
  const marketRows = rows.filter((row) => row.eventName === MARKET_EVENT);
  const marketAwaiting = !seen.get(MARKET_EVENT);

  const status = marketDataStatus();

  const marketPending = (metricId: string) =>
    notMeasurable(
      'the Markets section has not yet shipped the emitter, so no market-data resolution has ever been recorded — this is not an absence of failures',
      `the \`${MARKET_EVENT}\` emitter — see docs/admin-metrics/market-data-instrumentation-request.md`,
      at(metricId, MARKET_EVENT)
    );

  const marketCount = (predicate: (properties: Record<string, unknown>) => boolean, metricId: string) =>
    marketAwaiting
      ? marketPending(metricId)
      : countMetric(
          marketRows.filter((row) => predicate((row.properties ?? {}) as Record<string, unknown>)).length,
          at(metricId, MARKET_EVENT),
          'instrumented_going_forward'
        );

  return {
    vitals: summariseVitals(vitalSamples, MARKETPLACE_MIN_SAMPLE),
    worstLcpSurfaces: worstSurfaces(vitalSamples, 'lcp', MARKETPLACE_MIN_SAMPLE),

    failures: {
      total: countMetric(failureRows.length, at('client_failures', FAILURE_EVENT), 'instrumented_going_forward'),
      byClass: tally(failureRows, 'class'),
      byArea: tally(failureRows, 'area'),
      /*
       * Per thousand page views, and named that way. "Error rate" would invite
       * a reader to treat it as a share of sessions that failed, which it is
       * not — one page can throw several times and a session can span many
       * pages. The denominator is stated in the label rather than assumed.
       */
      perThousandPageViews: rateMetric(
        failureRows.length * 1000,
        pageViews,
        at('client_failure_rate', FAILURE_EVENT),
        { threshold: MARKETPLACE_MIN_SAMPLE, state: 'instrumented_going_forward' }
      ),
    },

    market: {
      quotesConfigured: status.quotes,
      macroConfigured: status.macro,
      awaitingEmitter: marketAwaiting,
      requests: marketAwaiting
        ? marketPending('market_requests')
        : countMetric(marketRows.length, at('market_requests', MARKET_EVENT), 'instrumented_going_forward'),
      successes: marketCount((p) => p.outcome === 'success', 'market_successes'),
      noData: marketCount((p) => p.outcome === 'no_data', 'market_no_data'),
      providerErrors: marketCount((p) => p.outcome === 'provider_error', 'market_provider_errors'),
      /*
       * Configuration is knowable without the emitter, so when a key is absent
       * the honest state is `source_not_connected` rather than "awaiting".
       */
      notConfigured:
        !status.quotes && !status.macro
          ? sourceNotConnected('no market provider key is configured', {
              metricId: 'market_not_configured',
              source: 'runtime configuration',
              sourceType: 'source_not_connected',
              queriedAt: queriedAt.toISOString(),
            })
          : marketCount((p) => p.outcome === 'not_configured', 'market_not_configured'),
      freshness: tally(marketRows, 'freshnessBucket'),
      withVolume: marketCount((p) => p.hasVolume === true, 'market_with_volume'),
      delayedPolicy:
        'The free tier is delayed by policy — the market client sets `delayed: true` on every quote and series. A delayed price is the product working as designed, not a fault. Counts here are client resolutions, not upstream requests: the Next data cache is transparent at that layer, so a success may have been served from cache.',
    },

    supercharts: {
      ...summariseSupercharts(
        rows
          .filter(
            (row) => SUPERCHART_EVENTS.includes(row.eventName) && !internalSessions.has(row.sessionId)
          )
          .map(
            (row): SuperchartEvent => ({
              sessionId: row.sessionId,
              eventName: row.eventName,
              properties: (row.properties ?? {}) as Record<string, unknown>,
            })
          )
      ),
      awaitingCapabilityEmitter: !seen.get('superchart_capability_completed'),
    },

    sources: SOURCE_CADENCE.map((cadence) => {
      const lastSeen = lastSeenFor(cadence.source, seen);
      return {
        source: cadence.source,
        lastSeen: lastSeen ? lastSeen.toISOString() : null,
        stale: sourceIsStale(cadence, lastSeen, queriedAt),
        why: cadence.why,
      };
    }),

    queriedAt: queriedAt.toISOString(),
  };
}

function tally(
  rows: Array<{ properties: unknown }>,
  key: string
): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const properties = (row.properties ?? {}) as Record<string, unknown>;
    const value = String(properties[key] ?? 'unknown');
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([bucket, count]) => ({ key: bucket, count }))
    .sort((a, b) => b.count - a.count);
}

function lastSeenFor(source: string, seen: ReadonlyMap<string, Date | null>): Date | null {
  const event =
    source === 'portal telemetry'
      ? 'portal_page_viewed'
      : source === 'web vitals'
        ? VITAL_EVENT
        : source === 'market data requests'
          ? MARKET_EVENT
          : 'voyager_request_completed';

  const value = seen.get(event);
  return value ? new Date(value) : null;
}
