import { NextResponse, type NextRequest } from 'next/server';
import { authorizeMetrics } from '@/lib/admin-metrics/access';
import { reliabilityReport } from '@/lib/admin-metrics/families/reliability';
import { rangeFrom } from '@/lib/admin-metrics/range';
import { recordServerEvent } from '@/lib/analytics/server';

/**
 * Reliability, market data health and Supercharts.
 *
 * One endpoint because the three answer one question together — can somebody
 * use this product, can it get the data it promises, and is the charting
 * capability being exercised — and splitting them would make the page issue
 * three round trips to render one section.
 *
 * Aggregates only. No URL, no error text, no symbol.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await authorizeMetrics();
  if (!auth.authorized) return NextResponse.json({ error: 'not authorized' }, { status: 401 });

  const range = rangeFrom(request.nextUrl.searchParams.get('range'));
  if (!range) return NextResponse.json({ error: 'unknown range' }, { status: 400 });

  try {
    return NextResponse.json({ range: range.key, ...(await reliabilityReport(range.since)) });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[admin-metrics] reliability', error);
    void recordServerEvent({
      name: 'dashboard_query_failure',
      properties: { endpoint: 'reliability', code: 'query_failed' },
    });
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }
}
