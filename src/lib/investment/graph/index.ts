import * as agents from '../agents';
import * as calc from '../calculations';
import { computeConfidence, measureFreshness, validateClaim, admissible } from '../evidence';
import { DEMO_EVIDENCE, DEMO_FACTS, DEMO_INSTRUMENT, demoBenchmark, demoSeries } from '../data/fixtures';
import { applyPointInTime, truncateSeries } from '../data/pointInTime';
import { enforceOutput } from '../policy';
import {
  DISCLAIMER,
  type AgentFinding,
  type AgentStance,
  type AnalysisMode,
  type ChartActionPlan,
  type InvestmentAssessment,
  type ModeBudget,
  type PageContext,
  type ChartContext,
  type RunEvent,
  type UserInvestmentContext,
} from '../types';

/**
 * The analysis pipeline.
 *
 * A plain sequenced graph rather than a framework: the stages are fixed, the
 * fan-out is one level, and the state is a single object passed forward. A
 * graph library would add a dependency and a vocabulary without changing what
 * runs, and this way each stage is an ordinary function that can be tested on
 * its own.
 *
 * Ordering is the load-bearing part. Data is filtered to the cutoff before any
 * calculation runs, every calculation completes before any agent reads one, and
 * the validator runs after every agent and before the committee — so the
 * committee never sees a claim nobody checked.
 */

export const MODE_BUDGETS: Record<AnalysisMode, ModeBudget> = {
  quick: {
    maxLlmCalls: 2,
    maxToolCalls: 4,
    maxTokens: 8_000,
    timeoutMs: 20_000,
    agents: ['fundamental', 'risk'],
  },
  standard: {
    maxLlmCalls: 8,
    maxToolCalls: 12,
    maxTokens: 40_000,
    timeoutMs: 60_000,
    agents: ['fundamental', 'valuation', 'technical', 'bull', 'bear', 'risk'],
  },
  deep: {
    maxLlmCalls: 20,
    maxToolCalls: 30,
    maxTokens: 120_000,
    timeoutMs: 180_000,
    agents: ['fundamental', 'valuation', 'technical', 'bull', 'bear', 'risk'],
  },
};

export type AnalyzeInput = {
  runId: string;
  mode: AnalysisMode;
  pageContext: PageContext;
  chartContext: ChartContext | null;
  user: UserInvestmentContext | null;
  /** Historical analysis: nothing published after this may be seen. */
  asOf: string;
  onEvent?: (event: RunEvent) => void;
};

function emit(input: AnalyzeInput, type: RunEvent['type'], detail?: string, data?: RunEvent['data']) {
  input.onEvent?.({ type, runId: input.runId, at: new Date().toISOString(), detail, data });
}

/* ------------------------------------------------------- Calculation stage */

/**
 * Everything numeric, once, before any agent runs.
 *
 * Two years are computed rather than one so the agents can say whether a margin
 * moved — a level on its own supports far less than a change does.
 */
function runCalculations(
  facts: typeof DEMO_FACTS,
  series: Array<{ date: string; close: number }>,
  benchmark: Array<{ date: string; close: number }>,
  asOf: string
) {
  calc.resetCalculationIds();
  const out = [];

  const periods = [...new Set(facts.filter((f) => f.periodType === 'annual').map((f) => f.period))].sort();
  const latest = periods[periods.length - 1];
  const prior = periods[periods.length - 2];

  const revenue = (period?: string) => calc.factValue(facts, 'revenue', period);
  const operating = (period?: string) => calc.factValue(facts, 'operating_income', period);

  const ev = (...metrics: string[]) => calc.factEvidence(facts, ...metrics);

  out.push(calc.growth(revenue(latest), revenue(prior), asOf, ev('revenue')));
  out.push(
    calc.margin(operating(latest), revenue(latest), 'operating', asOf, ev('operating_income', 'revenue'))
  );

  // The prior year's margin, named distinctly so an agent can compare them
  // without re-deriving anything.
  const priorMargin = calc.margin(
    operating(prior),
    revenue(prior),
    'operating',
    asOf,
    ev('operating_income', 'revenue')
  );
  out.push({ ...priorMargin, calculationType: 'operating_margin_prior' });

  out.push(
    calc.margin(
      calc.factValue(facts, 'gross_profit', latest),
      revenue(latest),
      'gross',
      asOf,
      ev('gross_profit', 'revenue')
    )
  );

  const fcf = calc.freeCashFlow(
    calc.factValue(facts, 'operating_cash_flow', latest),
    calc.factValue(facts, 'capex', latest),
    asOf,
    ev('operating_cash_flow', 'capex')
  );
  out.push(fcf);

  out.push(
    calc.roic(
      operating(latest),
      0.21,
      calc.factValue(facts, 'total_debt', latest),
      calc.factValue(facts, 'total_equity', latest),
      calc.factValue(facts, 'cash', latest),
      asOf,
      ev('operating_income', 'total_debt', 'total_equity', 'cash')
    )
  );

  const price = calc.factValue(facts, 'price');
  const shares = calc.factValue(facts, 'shares_outstanding', latest);
  const cap = calc.marketCap(price, shares, asOf, ev('price', 'shares_outstanding'));
  out.push(cap);

  const enterprise = calc.enterpriseValue(
    cap.result,
    calc.factValue(facts, 'total_debt', latest),
    calc.factValue(facts, 'cash', latest),
    asOf,
    ev('total_debt', 'cash')
  );
  out.push(enterprise);

  const netIncome = calc.factValue(facts, 'net_income', latest);
  out.push(calc.multiple(cap.result, netIncome, 'pe', asOf, ev('net_income', 'price')));
  out.push(calc.multiple(enterprise.result, operating(latest), 'ev_ebit', asOf, ev('operating_income')));

  if (fcf.result !== null && shares !== null) {
    out.push(
      calc.dcf(
        {
          baseFreeCashFlow: fcf.result,
          growthRates: [0.08, 0.07, 0.06, 0.05, 0.04],
          terminalGrowth: 0.025,
          discountRate: 0.09,
          netDebt:
            (calc.factValue(facts, 'total_debt', latest) ?? 0) - (calc.factValue(facts, 'cash', latest) ?? 0),
          sharesOutstanding: shares,
        },
        asOf,
        ev('operating_cash_flow', 'capex', 'total_debt', 'cash', 'shares_outstanding')
      )
    );
  }

  const closes = series.map((point) => point.close);
  out.push(calc.historicalVolatility(closes, asOf, ev('price')));
  out.push(calc.maxDrawdown(closes, asOf, ev('price')));
  out.push(calc.trendClassification(closes, asOf, ev('price')));
  out.push(calc.beta(closes, benchmark.map((point) => point.close), asOf, ev('price')));
  out.push(...calc.supportCandidates(closes, asOf, ev('price')));

  return out;
}

/* ------------------------------------------------------------- Chart plan */

function buildChartPlan(
  symbol: string,
  timeframe: string,
  calculations: ReturnType<typeof runCalculations>
): ChartActionPlan {
  const levels = calculations.filter(
    (entry) => entry.calculationType === 'support_candidate' && entry.result !== null
  );

  return {
    symbol,
    timeframe,
    actions: [
      ...levels.map((entry) => ({
        type: 'horizontal_level' as const,
        price: entry.result as number,
        // The label carries the method, so nothing on the chart reads as a
        // promise about where price will stop.
        label: 'Algorithmic level candidate',
        method: 'swing-low cluster within 2%',
        confidence: Math.min(0.4 + (Number(entry.inputs.touches) || 0) * 0.1, 0.8),
      })),
      {
        type: 'indicator' as const,
        indicator: 'SMA',
        parameters: { fast: 50, slow: 200 },
        reason: 'Long-run trend context for the levels above',
      },
    ],
    pinescriptRequired: levels.length > 0,
  };
}

/* -------------------------------------------------------------- Committee */

/**
 * The committee weighs; it does not average.
 *
 * Averaging stances would let three agreeable readings outvote one properly
 * evidenced objection. Instead a stance only carries weight in proportion to
 * the evidence behind it, and an unsupported claim removes weight from the
 * agent that made it.
 */
function committee(
  findings: AgentFinding[],
  confidence: number,
  unsupported: number
): { stance: AgentStance; reasoning: string[] } {
  const reasoning: string[] = [];

  const weighted = findings
    .filter((finding) => finding.stance !== 'insufficient_data')
    .map((finding) => {
      const direction = finding.stance.includes('positive')
        ? 1
        : finding.stance.includes('negative')
          ? -1
          : 0;
      const strength = finding.stance.startsWith('strongly') ? 2 : 1;
      return { finding, score: direction * strength * finding.confidence };
    });

  if (!weighted.length) {
    return {
      stance: 'insufficient_data',
      reasoning: ['No specialist could reach a reading from the data available.'],
    };
  }

  const total = weighted.reduce((sum, entry) => sum + entry.score, 0);
  const magnitude = weighted.reduce((sum, entry) => sum + Math.abs(entry.score), 0);
  const net = magnitude ? total / magnitude : 0;

  const positives = weighted.filter((entry) => entry.score > 0).map((entry) => entry.finding.agentName);
  const negatives = weighted.filter((entry) => entry.score < 0).map((entry) => entry.finding.agentName);

  if (positives.length) reasoning.push(`Positive weight came from: ${positives.join(', ')}.`);
  if (negatives.length) reasoning.push(`Negative weight came from: ${negatives.join(', ')}.`);

  if (positives.length && negatives.length) {
    reasoning.push('The specialists disagree, so the assessment sits closer to the middle than either side.');
  }

  let stance: AgentStance;
  if (confidence < 40) {
    stance = 'insufficient_data';
    reasoning.push(
      `Confidence of ${confidence} is too low to state a direction: the evidence does not support one.`
    );
  } else if (net > 0.5) stance = 'moderately_positive';
  else if (net < -0.5) stance = 'moderately_negative';
  else stance = 'balanced';

  if (unsupported > 0) {
    reasoning.push(`${unsupported} statement(s) were dropped for lacking evidence and carried no weight.`);
  }

  return { stance, reasoning };
}

/* ------------------------------------------------------------------- Run */

export async function analyze(input: AnalyzeInput): Promise<InvestmentAssessment> {
  emit(input, 'run_started', `mode=${input.mode}`);

  const budget = MODE_BUDGETS[input.mode];

  emit(input, 'context_resolved', input.pageContext.pageType);

  // One instrument in this slice — the fixture. A real resolver replaces this
  // and everything downstream is unchanged, because everything downstream
  // depends on InstrumentIdentity rather than on a ticker.
  const instrument = DEMO_INSTRUMENT;
  emit(input, 'instrument_resolved', `${instrument.exchange}:${instrument.symbol}`, {
    currency: instrument.currency,
    confidence: instrument.resolutionConfidence,
  });

  emit(input, 'data_plan_created', 'filings, prices, benchmark, news');
  emit(input, 'data_fetch_started');

  const guarded = applyPointInTime(DEMO_EVIDENCE, DEMO_FACTS, input.asOf);
  const series = truncateSeries(demoSeries(), input.asOf);
  const benchmark = truncateSeries(demoBenchmark(), input.asOf);

  emit(input, 'data_fetch_completed', `${guarded.evidence.length} sources`, {
    excluded: guarded.excluded.length,
    facts: guarded.facts.length,
  });

  const calculations = runCalculations(guarded.facts, series, benchmark, input.asOf);
  emit(input, 'calculations_completed', `${calculations.length} calculations`);

  const agentInput: agents.AgentInput = {
    facts: guarded.facts,
    calculations,
    evidence: guarded.evidence,
    series,
    benchmark,
    user: input.user,
    asOf: input.asOf,
  };

  const findings: AgentFinding[] = [];

  const specialists: Array<[string, () => AgentFinding]> = [
    ['fundamental', () => agents.fundamentalAgent(agentInput)],
    ['valuation', () => agents.valuationAgent(agentInput)],
    ['technical', () => agents.technicalAgent(agentInput)],
  ];

  for (const [name, run] of specialists) {
    if (!budget.agents.includes(name)) continue;
    emit(input, 'agent_started', name);
    findings.push(run());
    emit(input, 'agent_completed', name);
  }

  if (budget.agents.includes('bull') && budget.agents.includes('bear')) {
    emit(input, 'agent_started', 'bull');
    findings.push(agents.bullAgent(findings, agentInput));
    emit(input, 'agent_started', 'bear');
    findings.push(agents.bearAgent(findings, agentInput));
    emit(input, 'debate_completed');
  }

  if (budget.agents.includes('risk')) {
    emit(input, 'agent_started', 'risk');
    findings.push(agents.riskAgent(findings, agentInput));
    emit(input, 'agent_completed', 'risk');
  }

  const rawClaims = agents.extractClaims(findings);
  const claims = rawClaims.map((claim) =>
    validateClaim(claim, guarded.evidence, calculations, input.asOf)
  );
  emit(input, 'validation_completed', `${admissible(claims).length}/${claims.length} claims stand`);

  const freshness = measureFreshness(guarded.evidence, claims, input.asOf);

  const confidence = computeConfidence({
    facts: guarded.facts.length,
    expectedFacts: DEMO_FACTS.length,
    freshness,
    calculations,
    findings,
    claims,
  });

  const verdict = committee(findings, confidence.overall, freshness.unsupportedClaimCount);

  const bull = findings.find((finding) => finding.agentName === 'Bull Case');
  const bear = findings.find((finding) => finding.agentName === 'Bear Case');

  const limitations = [
    ...guarded.warnings,
    ...(guarded.excluded.length
      ? [`${guarded.excluded.length} source(s) were excluded as published after ${input.asOf}.`]
      : []),
    ...(input.user ? [] : ['No portfolio context was shared, so portfolio fit is not assessed.']),
    'Data in this build comes from frozen fixtures for a fictional company and is not market data.',
  ];

  const assessment: InvestmentAssessment = {
    runId: input.runId,
    instrument,
    analysisAsOf: input.asOf,
    mode: input.mode,

    stance: verdict.stance,
    confidence: { ...confidence, explanation: [...confidence.explanation, ...verdict.reasoning] },
    horizon: '12_to_24_months',

    businessQuality: describeQuality(calculations),
    valuationStatus: describeValuation(calculations),
    technicalState: describeTechnical(calculations),
    macroState: 'not_assessed',
    riskLevel: describeRisk(calculations),
    portfolioFit: input.user ? 'assessed_against_shared_context' : 'requires_user_context',

    bullCase: bull?.keyFindings ?? [],
    bearCase: bear?.keyFindings ?? [],
    baseCase: admissible(claims)
      .filter((claim) => claim.claimType === 'numeric')
      .slice(0, 5)
      .map((claim) => claim.claimText),
    catalysts: [],
    invalidationConditions: buildInvalidations(calculations),
    unknowns: [...new Set(findings.flatMap((finding) => finding.unknowns))],
    whatAppearsPricedIn: describePricedIn(calculations),
    whatToMonitor: ['The next annual filing, and whether the margin move repeats.'],

    findings,
    claims,
    calculations,
    evidence: guarded.evidence,
    dataFreshness: freshness,

    chartActions: buildChartPlan(
      `${instrument.exchange}:${instrument.symbol}`,
      input.chartContext?.timeframe ?? '1D',
      calculations
    ),
    skillVersions: { 'fundamental-analysis': '1.0.0', 'valuation-summary': '1.0.0', 'technical-analysis': '1.0.0' },
    modelVersions: { interpretation: 'deterministic-v1' },
    limitations,
    disclaimer: DISCLAIMER,
  };

  emit(input, 'assessment_completed', verdict.stance, { confidence: confidence.overall });

  return assessment;
}

/* ------------------------------------------------------------ Descriptions */

function describeQuality(calculations: ReturnType<typeof runCalculations>): string {
  const roicValue = calculations.find((entry) => entry.calculationType === 'roic')?.result;
  if (roicValue === null || roicValue === undefined) return 'not_assessed';
  return roicValue > 15 ? 'high' : roicValue > 8 ? 'moderate' : 'low';
}

function describeValuation(calculations: ReturnType<typeof runCalculations>): string {
  const pe = calculations.find((entry) => entry.calculationType === 'pe')?.result;
  if (pe === null || pe === undefined) return 'not_assessed';
  return pe > 30 ? 'expensive' : pe > 18 ? 'full' : 'moderate';
}

function describeTechnical(calculations: ReturnType<typeof runCalculations>): string {
  const trend = calculations.find((entry) => entry.calculationType === 'trend_20_vs_60')?.result;
  if (trend === null || trend === undefined) return 'not_assessed';
  return trend > 4 ? 'improving' : trend < -4 ? 'weakening' : 'neutral';
}

function describeRisk(calculations: ReturnType<typeof runCalculations>): string {
  const volatility = calculations.find(
    (entry) => entry.calculationType === 'historical_volatility'
  )?.result;
  if (volatility === null || volatility === undefined) return 'not_assessed';
  return volatility > 45 ? 'elevated' : volatility > 25 ? 'moderate' : 'contained';
}

function describePricedIn(calculations: ReturnType<typeof runCalculations>): string[] {
  const pe = calculations.find((entry) => entry.calculationType === 'pe')?.result;
  if (pe === null || pe === undefined) return [];

  return [
    enforceOutput(
      `At ${pe.toFixed(1)} times earnings the price already reflects the growth continuing rather than stalling.`
    ).text,
  ];
}

function buildInvalidations(calculations: ReturnType<typeof runCalculations>): string[] {
  const out: string[] = [];
  const margin = calculations.find((entry) => entry.calculationType === 'operating_margin')?.result;
  const level = calculations.find(
    (entry) => entry.calculationType === 'support_candidate' && entry.result !== null
  )?.result;

  if (margin !== null && margin !== undefined) {
    out.push(`Operating margin falling below ${(margin - 3).toFixed(1)}% would undo the quality reading.`);
  }
  if (level !== null && level !== undefined) {
    out.push(`Closing below ${level.toFixed(2)} would remove the level the technical reading rests on.`);
  }

  return out;
}
