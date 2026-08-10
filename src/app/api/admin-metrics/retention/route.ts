import { NextResponse, type NextRequest } from 'next/server';
import { authorizeMetrics } from '@/lib/admin-metrics/access';
import { MARKETPLACE_MIN_SAMPLE } from '@/lib/admin-metrics/dictionary';
import { rangeFrom } from '@/lib/admin-metrics/range';
import { cohortRetention, dayKey } from '@/lib/admin-metrics/retention';
import { readUserDays } from '@/lib/admin-metrics/telemetryQuery';
import { recordServerEvent } from '@/lib/analytics/server';
import { db, schema } from '@/db';
import { sql } from 'drizzle-orm';
import type { MetricProvenance } from '@/lib/analytics/states';

/**
 * Authenticated cohort retention.
 *
 * Signed-in people only, grouped by the HMAC-derived user key. Anonymous
 * retention is returned as `not_measurable` in the same payload rather than
 * omitted, so a reader sees that it was considered and why it is absent instead
 * of wondering whether somebody forgot it.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await authorizeMetrics();
  if (!auth.authorized) return NextResponse.json({ error: 'not authorized' }, { status: 401 });

  const range = rangeFrom(request.nextUrl.searchParams.get('range'));
  if (!range) return NextResponse.json({ error: 'unknown range' }, { status: 400 });

  try {
    const queriedAt = new Date();

    const [bounds] = await db
      .select({ earliest: sql<Date | null>`min(${schema.productTelemetryEvent.receivedAt})` })
      .from(schema.productTelemetryEvent);

    const telemetryStartedOn = bounds?.earliest ? dayKey(new Date(bounds.earliest)) : null;

    const provenance = (metricId: string): MetricProvenance => ({
      metricId,
      source: 'product_telemetry_event',
      queriedAt: queriedAt.toISOString(),
    });

    const report = cohortRetention(await readUserDays(range.since), {
      today: queriedAt,
      telemetryStartedOn,
      minimumCohort: MARKETPLACE_MIN_SAMPLE,
      provenance,
      /*
       * Always `instrumented_going_forward`, and it will stay that way for a
       * while. Retention needs history by definition, and the history began the
       * day Phase 1 deployed — a cohort cannot have churned over a period
       * nobody was watching.
       */
      state: 'instrumented_going_forward',
    });

    return NextResponse.json({ range: range.key, ...report, queriedAt: queriedAt.toISOString() });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[admin-metrics] retention', error);
    void recordServerEvent({
      name: 'dashboard_query_failure',
      properties: { endpoint: 'retention', code: 'query_failed' },
    });
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }
}
