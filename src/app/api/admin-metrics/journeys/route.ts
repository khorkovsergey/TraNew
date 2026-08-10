import { NextResponse, type NextRequest } from 'next/server';
import { authorizeMetrics } from '@/lib/admin-metrics/access';
import { portalMetrics } from '@/lib/admin-metrics/portal';
import { rangeFrom } from '@/lib/admin-metrics/range';
import { recordServerEvent } from '@/lib/analytics/server';

/**
 * The journey layer — what explains PMCR rather than what PMCR is.
 *
 * Returns aggregate breakdowns only. There is no parameter here that can narrow
 * the answer to a session or a person, and there is no free-form group-by: the
 * breakdowns are the ones the code computes, so an unbounded dimension cannot be
 * asked for from the outside.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await authorizeMetrics();
  if (!auth.authorized) return NextResponse.json({ error: 'not authorized' }, { status: 401 });

  const range = rangeFrom(request.nextUrl.searchParams.get('range'));
  if (!range) return NextResponse.json({ error: 'unknown range' }, { status: 400 });

  try {
    const portal = await portalMetrics(range.since);

    return NextResponse.json({
      range: range.key,
      headline: {
        pmcr: portal.continuation.overall,
        internal: portal.continuation.internal,
        external: portal.continuation.external,
        eligibleSessions: portal.continuation.eligibleSessions,
        continuedSessions: portal.continuation.continuedSessions,
        secondActionRate: portal.secondAction.rate,
        secondActionNumerator: portal.secondAction.numerator,
        secondActionDenominator: portal.secondAction.denominator,
        ttfaMedian: portal.ttfa.median,
        ttfaP75: portal.ttfa.p75,
        ttfaP90: portal.ttfa.p90,
        ttfaSample: portal.ttfa.sample,
        sessionsWithoutAction: portal.ttfa.withoutAction,
      },
      journeys: portal.journeys,
      truncated: portal.truncated,
      collectingSince: portal.collectingSince,
      freshestAt: portal.freshestAt,
      queriedAt: portal.queriedAt,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('[admin-metrics] journeys', error);
    void recordServerEvent({
      name: 'dashboard_query_failure',
      properties: { endpoint: 'journeys', code: 'query_failed' },
    });
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }
}
