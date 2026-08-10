import { NextResponse, type NextRequest } from 'next/server';
import { authorizeMetrics } from '@/lib/admin-metrics/access';
import { instrumentationCoverage } from '@/lib/admin-metrics/coverage';
import { rangeFrom } from '@/lib/admin-metrics/range';
import { recordServerEvent } from '@/lib/analytics/server';

/** Instrumentation coverage. Authorizes for itself, like every endpoint here. */

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
    return NextResponse.json({ range: range.key, ...(await instrumentationCoverage(range.since)) });
  } catch {
    void recordServerEvent({
      name: 'dashboard_query_failure',
      properties: { endpoint: 'coverage', code: 'query_failed' },
    });
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }
}
