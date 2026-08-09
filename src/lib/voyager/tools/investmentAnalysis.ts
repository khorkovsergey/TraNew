import 'server-only';
import { analyze } from '@/lib/investment/graph';
import { summarise, type InvestmentSummary } from '@/lib/investment/summary';
import { argTicker, toolFailure, type VoyagerToolResult } from './types';
import type { VoyagerScreen } from '../screens';

/**
 * The existing assessment engine, as a tool.
 *
 * It was reachable only through a list of English phrases — "worth holding",
 * "is it overvalued" — checked against the question before the model ran. So
 * "стоит ли держать Теслу" got a chat answer and "is this worth holding" got a
 * sourced assessment with computed figures, for no reason a person could see.
 *
 * Nothing about the engine changes. It still computes every figure, cites every
 * claim and refuses the ones it cannot support; what changes is that the
 * planner decides when it is the right answer, which it can do in any language.
 *
 * The screen gate stays where it was: an assessment is about an instrument, and
 * on a screen that is not about one there is nothing to assess.
 */

export const INVESTMENT_SCREENS: VoyagerScreen[] = ['symbol', 'chart', 'ideas'];

export async function runInvestmentAnalysis(
  input: { symbol?: unknown },
  context: { screen: VoyagerScreen; subject: string; question: string }
): Promise<VoyagerToolResult<InvestmentSummary>> {
  if (!INVESTMENT_SCREENS.includes(context.screen)) {
    return toolFailure(
      'unsupported',
      'An assessment is about one instrument, and this page is not about one.',
      false
    );
  }

  const symbol = argTicker(input.symbol) ?? argTicker(context.subject);
  if (!symbol) {
    return toolFailure(
      'bad_arguments',
      'I need to know which instrument to assess.',
      true
    );
  }

  try {
    const assessment = await analyze({
      runId: `voyager_${Date.now().toString(36)}`,
      mode: 'standard',
      asOf: new Date().toISOString().slice(0, 10),
      pageContext: {
        pageType: context.screen,
        pageUrl: null,
        locale: 'en',
        country: null,
        selectedMarket: null,
        selectedInstrument: symbol,
        visibleModules: [],
        userQuestion: context.question,
      },
      chartContext: null,
      // No portfolio: this request has no consent to share one, so the
      // assessment says what it cannot judge rather than guessing at it.
      user: null,
    });

    const summary = summarise(assessment);

    return {
      ok: true,
      data: summary,
      /*
       * The stance and the evidence count, not the assessment.
       *
       * The full object is rendered by the card; what the planner needs is
       * enough to write a sentence around it. Feeding it the whole structure
       * invites it to restate figures it did not compute.
       */
      summary:
        `${summary.instrumentName}: evidence leans ${summary.stance.replace(/_/g, ' ')} over ` +
        `${summary.horizon.replace(/_/g, ' ')}, confidence ${summary.confidenceLabel}, ` +
        `${summary.evidence.length} dated sources, as of ${summary.analysisAsOf}.`,
    };
  } catch (error) {
    // Surfaced to the planner as a value so the answer can carry on without the
    // assessment and say that it did. An exception here used to take the whole
    // reply down to the scripted layer.
    console.error('[voyager] investment analysis failed', error);
    return toolFailure(
      'unavailable',
      'The assessment engine could not complete a run just now.',
      true
    );
  }
}
