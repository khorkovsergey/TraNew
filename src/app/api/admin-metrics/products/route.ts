import { NextResponse, type NextRequest } from 'next/server';
import { authorizeMetrics } from '@/lib/admin-metrics/access';
import { productFamilies } from '@/lib/admin-metrics/families';
import { rangeFrom } from '@/lib/admin-metrics/range';
import { recordServerEvent } from '@/lib/analytics/server';

/**
 * Product families — behaviour and durable facts, side by side and never
 * merged.
 *
 * Aggregates only. There is no parameter that narrows the answer to a person,
 * an event, a booking or a saved object, and no free-form grouping, so an
 * unbounded dimension cannot be asked for from outside.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await authorizeMetrics();
  if (!auth.authorized) return NextResponse.json({ error: 'not authorized' }, { status: 401 });

  const range = rangeFrom(request.nextUrl.searchParams.get('range'));
  if (!range) return NextResponse.json({ error: 'unknown range' }, { status: 400 });

  try {
    return NextResponse.json({ range: range.key, ...(await productFamilies(range.since)) });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[admin-metrics] products', error);
    void recordServerEvent({
      name: 'dashboard_query_failure',
      properties: { endpoint: 'products', code: 'query_failed' },
    });
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }
}
