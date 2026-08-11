import { NextResponse, type NextRequest } from 'next/server';
import { authorizeMetrics } from '@/lib/admin-metrics/access';
import { voyagerReport } from '@/lib/admin-metrics/families/voyager';
import { rangeFrom } from '@/lib/admin-metrics/range';
import { recordServerEvent } from '@/lib/analytics/server';

/**
 * Voyager operational observability.
 *
 * Aggregates only. No request, no answer, no tool trace — the payload cannot
 * name a question because the telemetry behind it never carried one.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await authorizeMetrics();
  if (!auth.authorized) return NextResponse.json({ error: 'not authorized' }, { status: 401 });

  const range = rangeFrom(request.nextUrl.searchParams.get('range'));
  if (!range) return NextResponse.json({ error: 'unknown range' }, { status: 400 });

  try {
    return NextResponse.json({ range: range.key, ...(await voyagerReport(range.since)) });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[admin-metrics] voyager', error);
    void recordServerEvent({
      name: 'dashboard_query_failure',
      properties: { endpoint: 'voyager', code: 'query_failed' },
    });
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }
}
