import 'server-only';
import { and, gte, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { MARKETPLACE_MIN_SAMPLE } from '../dictionary';
import { notStaffEvent, staffAnalyticsKeys } from '../internalTraffic';
import {
  count as countMetric,
  notMeasurable,
  rate,
  type MetricProvenance,
  type MetricValue,
} from '@/lib/analytics/states';
import {
  countRequests,
  executedRequests,
  latency,
  quotaIntegrity,
  summariseTools,
  type LatencySummary,
  type QuotaIntegrity,
  type ToolSummary,
  type VoyagerRequestRow,
  type VoyagerToolRow,
} from './voyagerMetrics';

/**
 * Voyager operational observability.
 *
 * Reads the two server events the `voyager` section emits and turns them into
 * the questions this product actually has of its AI: did a model answer, or did
 * the scripted layer stand in; was somebody charged for it; how long did it
 * take; did the tools work.
 *
 * ## Before the emitters land
 *
 * The contract is declared here and the emitters belong to another section —
 * see `docs/admin-metrics/voyager-instrumentation-request.md`. Until that
 * branch merges, **every metric returns `not_measurable` naming the missing
 * emitter**, and never zero. A dashboard reporting "0 Voyager requests" during
 * a demo would be asserting that nobody uses the product's headline feature,
 * which is a much worse error than admitting the wiring is not finished.
 *
 * The switch is automatic: the moment a first row arrives the same queries
 * produce real numbers, and the sample thresholds take over from there.
 *
 * ## Customer usage, and the one query that is not
 *
 * The windowed read excludes events attributed to staff, so an administrator
 * demonstrating the assistant does not appear as customer demand — per event
 * rather than per session, because a Voyager request is a whole interaction on
 * its own and the server emits it with the asking user's key.
 *
 * The "has the emitter ever run" probe is deliberately **not** filtered. It
 * asks whether the instrumentation exists, not whether anybody used it, and a
 * staff request is perfectly good evidence that the wiring works. Filtering it
 * would put the dashboard back into `not_measurable` the moment the only
 * requests on record were ours — reporting a missing emitter that is in fact
 * running.
 *
 * A signed-out Voyager question carries no key and is counted. That is the
 * documented limit of attribution, not an oversight.
 */

const REQUEST_EVENT = 'voyager_request_completed';
const TOOL_EVENT = 'voyager_tool_completed';

export type VoyagerReport = {
  /** True while the Voyager section has not yet shipped the emitters. */
  awaitingEmitter: boolean;
  headline: Record<string, MetricValue>;
  quota: Record<string, MetricValue>;
  integrity: QuotaIntegrity & { healthy: boolean };
  latency: { all: LatencySummary; realAnswer: LatencySummary; simulated: LatencySummary };
  tools: ToolSummary;
  capability: Record<string, MetricValue>;
  counts: ReturnType<typeof countRequests>;
  sources: string[];
  freshestAt: string | null;
  queriedAt: string;
};

export async function voyagerReport(since: Date): Promise<VoyagerReport> {
  const queriedAt = new Date();

  const at = (metricId: string): MetricProvenance => ({
    metricId,
    source: `product_telemetry_event · ${REQUEST_EVENT}`,
    sourceType: 'telemetry',
    queriedAt: queriedAt.toISOString(),
  });

  const staffKeys = await staffAnalyticsKeys();

  const rows = await db
    .select({
      eventName: schema.productTelemetryEvent.eventName,
      properties: schema.productTelemetryEvent.properties,
      receivedAt: schema.productTelemetryEvent.receivedAt,
    })
    .from(schema.productTelemetryEvent)
    .where(
      and(
        gte(schema.productTelemetryEvent.occurredAt, since),
        inArray(schema.productTelemetryEvent.eventName, [REQUEST_EVENT, TOOL_EVENT]),
        notStaffEvent(staffKeys)
      )
    )
    .orderBy(schema.productTelemetryEvent.occurredAt);

  /*
   * Has the emitter ever run, at any time? Not just inside this window, and not
   * only for customers — see the header: this is an instrumentation question.
   */
  const [ever] = await db
    .select({ seen: sql<number>`count(*)::int` })
    .from(schema.productTelemetryEvent)
    .where(inArray(schema.productTelemetryEvent.eventName, [REQUEST_EVENT, TOOL_EVENT]));

  const awaitingEmitter = (ever?.seen ?? 0) === 0;

  const requests: VoyagerRequestRow[] = rows
    .filter((row) => row.eventName === REQUEST_EVENT)
    .map((row) => readRequest((row.properties ?? {}) as Record<string, unknown>));

  const toolRows: VoyagerToolRow[] = rows
    .filter((row) => row.eventName === TOOL_EVENT)
    .map((row) => readTool((row.properties ?? {}) as Record<string, unknown>));

  const counts = countRequests(requests);
  const executed = executedRequests(requests);
  const integrity = quotaIntegrity(requests);

  const freshest = rows.length ? rows[rows.length - 1].receivedAt : null;

  /*
   * The one construction used everywhere below. Before the emitter exists there
   * is no population to be small — there is no mechanism — and those are
   * different claims with different fixes.
   */
  const pending = (metricId: string) =>
    notMeasurable(
      'the Voyager section has not yet shipped the server emitter, so no request has ever been recorded — this is not an absence of usage',
      `the \`${REQUEST_EVENT}\` emitter — see docs/admin-metrics/voyager-instrumentation-request.md`,
      at(metricId)
    );

  const num = (value: number, metricId: string): MetricValue =>
    awaitingEmitter ? pending(metricId) : countMetric(value, at(metricId), 'instrumented_going_forward');

  const share = (numerator: number, denominator: number, metricId: string): MetricValue =>
    awaitingEmitter
      ? pending(metricId)
      : rate(numerator, denominator, at(metricId), {
          threshold: MARKETPLACE_MIN_SAMPLE,
          state: 'instrumented_going_forward',
        });

  return {
    awaitingEmitter,

    headline: {
      serverRequests: num(counts.requests, 'voyager_requests'),
      realAnswers: num(counts.realAnswers, 'voyager_real_answers'),
      simulatedFallbacks: num(counts.simulatedFallbacks, 'voyager_simulated_fallbacks'),
      quotaRefusals: num(counts.quotaRefusals, 'voyager_quota_refusals'),
      serverFailures: num(counts.serverFailures, 'voyager_server_failures'),

      /*
       * Over executed requests, not over all of them. A refusal never reached
       * the model, so including it would make the real-answer rate fall as more
       * people hit their daily limit — which says nothing about whether the AI
       * is working.
       */
      realAnswerRate: share(counts.realAnswers, counts.executed, 'voyager_real_answer_rate'),
      simulatedFallbackRate: share(counts.simulatedFallbacks, counts.executed, 'voyager_fallback_rate'),

      /* Over every request, because a refusal is a thing that happened to one. */
      quotaRefusalRate: share(counts.quotaRefusals, counts.requests, 'voyager_refusal_rate'),

      /*
       * The operational question worth asking of a fallback: was the model
       * simply absent, or was it configured and still did not answer? The
       * server knows the first; it does not know why the second happened, and
       * this does not guess.
       */
      fallbacksDespiteConfiguredModel: num(counts.fallbacksWithModel, 'voyager_fallback_with_model'),
    },

    quota: {
      charged: num(counts.charged, 'voyager_charged'),
      released: num(counts.released, 'voyager_released'),
      refusedAndReleased: num(counts.refusedReleased, 'voyager_refused_released'),
      unmetered: num(counts.unmetered, 'voyager_unmetered'),
    },

    integrity: { ...integrity, healthy: integrity.violations === 0 },

    latency: {
      all: latency(executed, MARKETPLACE_MIN_SAMPLE),
      realAnswer: latency(
        executed.filter((row) => row.outcome === 'real_answer'),
        MARKETPLACE_MIN_SAMPLE
      ),
      simulated: latency(
        executed.filter((row) => row.outcome === 'simulated_fallback'),
        MARKETPLACE_MIN_SAMPLE
      ),
    },

    tools: summariseTools(toolRows, MARKETPLACE_MIN_SAMPLE),

    /*
     * A mix, not a fulfilment rate. Not every question asks for a chart, so
     * "chart answers ÷ all questions" says how often Voyager draws, not how
     * often it succeeds at drawing. The denominator that would make it a
     * fulfilment rate — questions that wanted a chart — is not observable.
     */
    capability: {
      answersWithChart: num(counts.withChart, 'voyager_answers_with_chart'),
      answersWithStudy: num(counts.withStudy, 'voyager_answers_with_study'),
      answersWithActions: num(counts.withActions, 'voyager_answers_with_actions'),
      toolAssistedAnswers: num(counts.toolAssisted, 'voyager_tool_assisted'),
      chartShareOfExecuted: share(counts.withChart, counts.executed, 'voyager_chart_mix'),
    },

    counts,
    sources: [`product_telemetry_event · ${REQUEST_EVENT}`, `product_telemetry_event · ${TOOL_EVENT}`],
    freshestAt: freshest ? new Date(freshest).toISOString() : null,
    queriedAt: queriedAt.toISOString(),
  };
}

/* --------------------------------------------------------------- Readers */

/**
 * Rows are read defensively.
 *
 * Ingest validates every property against the registry before it is stored, so
 * these should always be well formed — but a query that assumed so would throw
 * on the first row written by an older schema version, and a dashboard that
 * cannot render is worse than one rendering a conservative default.
 */
function readRequest(properties: Record<string, unknown>): VoyagerRequestRow {
  return {
    outcome: (properties.outcome as VoyagerRequestRow['outcome']) ?? 'server_failure',
    quotaDisposition: (properties.quotaDisposition as VoyagerRequestRow['quotaDisposition']) ?? 'released',
    modelConfigured: properties.modelConfigured === true,
    durationMs: Number(properties.durationMs ?? 0) || 0,
    screen: String(properties.screen ?? 'unknown'),
    tier: String(properties.tier ?? 'unknown'),
    sourceCount: Number(properties.sourceCount ?? 0) || 0,
    toolSteps: Number(properties.toolSteps ?? 0) || 0,
    hasChart: properties.hasChart === true,
    hasStudy: properties.hasStudy === true,
    actionCount: Number(properties.actionCount ?? 0) || 0,
  };
}

function readTool(properties: Record<string, unknown>): VoyagerToolRow {
  return {
    tool: String(properties.tool ?? 'unknown'),
    outcome: properties.outcome === 'failure' ? 'failure' : 'success',
    code: String(properties.code ?? ''),
    durationMs: Number(properties.durationMs ?? 0) || 0,
  };
}
