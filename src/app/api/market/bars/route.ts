import { NextResponse, type NextRequest } from 'next/server';
import { getBars } from '@/lib/market/client';

/**
 * Daily candles for one symbol.
 *
 * A route rather than a direct call because the provider key is server-side and
 * stays there — a chart component that fetched Twelve Data itself would put it
 * in the bundle.
 *
 * The symbol is validated against a shape rather than a list. A list would need
 * updating every time somebody asks about a company nobody thought of, and the
 * provider is the thing that decides whether a ticker exists — but an
 * unconstrained string reaches a URL we build, so it is bounded to what a
 * ticker can look like.
 */
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')?.toUpperCase() ?? '';

  if (!/^[A-Z0-9.:-]{1,12}$/.test(symbol)) {
    return NextResponse.json({ error: 'A valid symbol is required.' }, { status: 400 });
  }

  const bars = await getBars(symbol);
  if (!bars) {
    // Not an error: no key, an unknown ticker and a spent rate limit are all
    // "we cannot draw this", and the caller falls back to a labelled demo
    // series rather than showing an error where a chart should be.
    return NextResponse.json({ bars: null, delayed: true });
  }

  return NextResponse.json({ bars, delayed: true });
}
