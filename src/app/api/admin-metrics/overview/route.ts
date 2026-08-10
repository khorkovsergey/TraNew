import { NextResponse, type NextRequest } from 'next/server';
import { authorizeMetrics } from '@/lib/admin-metrics/access';
import { overview } from '@/lib/admin-metrics/overview';
import { rangeFrom } from '@/lib/admin-metrics/range';
import { recordServerEvent } from '@/lib/analytics/server';

/**
 * The overview endpoint.
 *
 * It authorizes for itself. The page having rendered is not evidence of
 * anything here — an endpoint that trusted the shell would be readable by
 * anybody who guessed its path, which is the failure the whole access design
 * exists to prevent.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await authorizeMetrics();
  if (!auth.authorized) {
    return NextResponse.json({ error: 'not authorized' }, { status: 401 });
  }

  const range = rangeFrom(request.nextUrl.searchParams.get('range'));
  if (!range) {
    return NextResponse.json({ error: 'unknown range' }, { status: 400 });
  }

  try {
    return NextResponse.json({ range: range.key, ...(await overview(range.since)) });
  } catch (error) {
    /*
     * The failure is recorded as an operational event and answered as a bare
     * 500 — a dashboard error must not describe the database to whoever asked.
     * In development it also prints, because the alternative is a silent 500
     * and a `dashboard_query_failure` row that says a query failed without
     * saying which.
     */
    if (process.env.NODE_ENV !== 'production') console.error('[admin-metrics] overview', error, (error as { cause?: unknown }).cause);

    void recordServerEvent({
      name: 'dashboard_query_failure',
      properties: { endpoint: 'overview', code: 'query_failed' },
    });
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }
}
