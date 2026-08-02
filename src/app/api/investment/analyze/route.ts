import { NextResponse } from 'next/server';
import { analyze, MODE_BUDGETS } from '@/lib/investment/graph';
import { getSession } from '@/lib/session';
import type { AnalysisMode, RunEvent } from '@/lib/investment/types';

/**
 * POST /api/investment/analyze
 *
 * Runs the investment pipeline and returns a structured assessment, or streams
 * progress if asked to.
 *
 * The session is read here and never sent by the client. Portfolio context in
 * particular is only ever assembled server-side from an account that consented
 * to it — a request that simply claimed a risk tolerance would be a request to
 * have the engine reason about a person it has not met.
 */

export const runtime = 'nodejs';

const MODES: AnalysisMode[] = ['quick', 'standard', 'deep'];

function isMode(value: unknown): value is AnalysisMode {
  return typeof value === 'string' && MODES.includes(value as AnalysisMode);
}

export async function POST(request: Request) {
  const session = await getSession().catch(() => null);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const mode = isMode(body.mode) ? body.mode : 'standard';
  const question = typeof body.query === 'string' ? body.query.slice(0, 500) : '';
  const stream = body.stream === true;

  /*
   * Historical analysis is allowed, future-dated analysis is not.
   *
   * `asOf` decides what the point-in-time guard admits, so a caller passing a
   * date in the future would be asking the engine to see filings that do not
   * exist yet. Clamping is the only safe reading of that request.
   */
  const now = new Date().toISOString().slice(0, 10);
  const requestedAsOf = typeof body.as_of === 'string' ? body.as_of.slice(0, 10) : now;
  const asOf = requestedAsOf > now ? now : requestedAsOf;

  const page = (body.page_context ?? {}) as Record<string, unknown>;
  const chart = (body.chart_context ?? null) as Record<string, unknown> | null;

  const runId = `run_${Date.now().toString(36)}`;

  const input = {
    runId,
    mode,
    asOf,
    pageContext: {
      pageType: typeof page.page_type === 'string' ? page.page_type : 'unknown',
      pageUrl: null,
      locale: typeof body.locale === 'string' ? body.locale : 'en',
      country: null,
      selectedMarket: null,
      selectedInstrument:
        typeof page.selected_instrument === 'string' ? page.selected_instrument : null,
      visibleModules: [],
      userQuestion: question,
    },
    chartContext: chart
      ? {
          symbol: typeof chart.symbol === 'string' ? chart.symbol : '',
          exchange: null,
          timeframe: typeof chart.timeframe === 'string' ? chart.timeframe : '1D',
          visibleFrom: typeof chart.visible_from === 'string' ? chart.visible_from : null,
          visibleTo: typeof chart.visible_to === 'string' ? chart.visible_to : null,
          lastVisibleCandle: null,
          chartType: null,
          indicators: [],
          comparisonSymbols: [],
          currency: null,
        }
      : null,
    // Present only when there is a session and the caller asked for it; absent
    // means the assessment says `requires_user_context` rather than guessing.
    user:
      session?.user && body.user_context_permission === true
        ? {
            userId: session.user.id,
            knowledgeLevel: null,
            investmentHorizon: null,
            riskTolerance: null,
            baseCurrency: null,
            countryOfResidence: null,
            existingExposure: null,
            sectorExposure: null,
            declaredGoals: [],
            dataCompleteness: 0.1,
            consentFlags: { analysis: true },
          }
        : null,
  };

  if (!stream) {
    const assessment = await analyze(input);
    return NextResponse.json({ assessment });
  }

  const encoder = new TextEncoder();

  const body_ = new ReadableStream({
    async start(controller) {
      const send = (event: RunEvent | { type: 'assessment'; data: unknown }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const assessment = await analyze({ ...input, onEvent: send });
        send({ type: 'assessment', data: assessment });
      } catch (error) {
        // The person sees that it failed; the reason goes to the server log.
        console.error('[investment] run failed', error);
        send({ type: 'run_failed', runId, at: new Date().toISOString() } as RunEvent);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body_, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    },
  });
}

/** GET returns what the modes cost, so a caller can choose before running one. */
export async function GET() {
  return NextResponse.json({
    modes: Object.entries(MODE_BUDGETS).map(([id, budget]) => ({
      id,
      agents: budget.agents,
      maxLlmCalls: budget.maxLlmCalls,
      timeoutMs: budget.timeoutMs,
    })),
  });
}
