import { NextResponse } from 'next/server';
import { authorizeMetrics } from '@/lib/admin-metrics/access';
import { METRIC_DICTIONARY_ALL } from '@/lib/admin-metrics/dictionary';

/**
 * The Metric Dictionary, served rather than restated.
 *
 * Authorized like everything else: the definitions describe what is measured
 * about people using this product, and that is not public.
 *
 * It has no date range, because a definition is not a measurement.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await authorizeMetrics();
  if (!auth.authorized) return NextResponse.json({ error: 'not authorized' }, { status: 401 });

  return NextResponse.json({ metrics: METRIC_DICTIONARY_ALL });
}
