import * as calc from '../calculations';
import { enforceOutput } from '../policy';
import type {
  AgentFinding,
  AgentStance,
  CalculationResult,
  EvidenceItem,
  FinancialFact,
  UserInvestmentContext,
  ValidatedClaim,
} from '../types';

/**
 * The specialist agents.
 *
 * Each one reads calculations and evidence that already exist and produces a
 * reading of them. None of them computes anything: the numbers were settled
 * before any agent ran, which is why two agents cannot disagree about what the
 * margin *is* — only about what it means.
 *
 * They are deterministic in this slice. That is a deliberate first step rather
 * than a placeholder: it makes the pipeline, the evidence contract and the
 * validator testable without a model in the loop, and the model layer plugs in
 * at `interpret()` without any of the surrounding structure changing. A version
 * that started with the model would have no way to tell an engine bug from a
 * bad generation.
 */

export type AgentInput = {
  facts: FinancialFact[];
  calculations: CalculationResult[];
  evidence: EvidenceItem[];
  series: Array<{ date: string; close: number }>;
  benchmark: Array<{ date: string; close: number }>;
  user: UserInvestmentContext | null;
  asOf: string;
};

function find(calcs: CalculationResult[], type: string): CalculationResult | undefined {
  return calcs.find((entry) => entry.calculationType === type);
}

function value(calcs: CalculationResult[], type: string): number | null {
  return find(calcs, type)?.result ?? null;
}

function idsFor(calcs: CalculationResult[], ...types: string[]): string[] {
  return calcs.filter((entry) => types.includes(entry.calculationType)).map((entry) => entry.calculationId);
}

function evidenceFor(calcs: CalculationResult[], ...types: string[]): string[] {
  return [
    ...new Set(
      calcs.filter((entry) => types.includes(entry.calculationType)).flatMap((entry) => entry.evidenceIds)
    ),
  ];
}

/** Every agent's prose goes through the output policy before it leaves. */
function clean(lines: string[]): string[] {
  return lines
    .map((line) => enforceOutput(line).text)
    .filter((line) => line.length > 0);
}

/* ------------------------------------------------------------ Fundamental */

export function fundamentalAgent(input: AgentInput): AgentFinding {
  const { calculations } = input;

  const revenueGrowth = value(calculations, 'growth');
  const operatingMargin = value(calculations, 'operating_margin');
  const priorMargin = value(calculations, 'operating_margin_prior');
  const fcf = value(calculations, 'free_cash_flow');
  const returnOnCapital = value(calculations, 'roic');

  const keyFindings: string[] = [];
  const risks: string[] = [];
  const unknowns: string[] = [];

  if (revenueGrowth !== null) {
    keyFindings.push(`Revenue grew ${revenueGrowth.toFixed(1)}% in the latest full year.`);
  } else {
    unknowns.push('Revenue growth could not be computed from the filings available.');
  }

  if (operatingMargin !== null) {
    keyFindings.push(`Operating margin is ${operatingMargin.toFixed(1)}%.`);

    if (priorMargin !== null) {
      const move = operatingMargin - priorMargin;
      // A margin falling while revenue rises is the pattern worth naming: it
      // means growth is being bought rather than earned.
      if (move < -0.5 && revenueGrowth !== null && revenueGrowth > 0) {
        risks.push(
          `Margin fell ${Math.abs(move).toFixed(1)} points while revenue rose, so the growth cost more than it did last year.`
        );
      } else if (move > 0.5) {
        keyFindings.push(`Margin improved ${move.toFixed(1)} points year on year.`);
      }
    }
  }

  if (fcf !== null) {
    keyFindings.push(`Free cash flow was ${fcf.toFixed(0)}m after capital expenditure.`);
  }

  if (returnOnCapital !== null) {
    keyFindings.push(`Return on invested capital is ${returnOnCapital.toFixed(1)}%.`);
    if (returnOnCapital < 8) {
      risks.push('Return on capital is below what most estimates put the cost of capital at.');
    }
  } else {
    unknowns.push('Return on capital could not be computed.');
  }

  let stance: AgentStance = 'balanced';
  if (revenueGrowth !== null && returnOnCapital !== null) {
    if (revenueGrowth > 8 && returnOnCapital > 12) stance = 'moderately_positive';
    else if (revenueGrowth < 2 || returnOnCapital < 6) stance = 'moderately_negative';
  } else {
    stance = 'insufficient_data';
  }

  return {
    agentName: 'Fundamental Analyst',
    stance,
    summary: clean([
      revenueGrowth !== null && operatingMargin !== null
        ? `The business grew ${revenueGrowth.toFixed(1)}% at a ${operatingMargin.toFixed(1)}% operating margin.`
        : 'The filings available do not support a description of growth and margin together.',
    ])[0],
    keyFindings: clean(keyFindings),
    risks: clean(risks),
    unknowns,
    assumptions: find(calculations, 'roic')?.assumptions ?? [],
    evidenceIds: evidenceFor(calculations, 'growth', 'operating_margin', 'free_cash_flow', 'roic'),
    calculationIds: idsFor(calculations, 'growth', 'operating_margin', 'free_cash_flow', 'roic'),
    confidence: revenueGrowth !== null && returnOnCapital !== null ? 0.75 : 0.35,
  };
}

/* -------------------------------------------------------------- Valuation */

export function valuationAgent(input: AgentInput): AgentFinding {
  const { calculations } = input;

  const pe = value(calculations, 'pe');
  const evEbit = value(calculations, 'ev_ebit');
  const dcfValue = value(calculations, 'dcf_per_share');
  const price = calc.factValue(input.facts, 'price');

  const keyFindings: string[] = [];
  const risks: string[] = [];
  const unknowns: string[] = [];
  const assumptions = find(calculations, 'dcf_per_share')?.assumptions ?? [];

  if (pe !== null) keyFindings.push(`The shares trade at ${pe.toFixed(1)} times trailing earnings.`);
  else unknowns.push('A price-to-earnings multiple could not be produced.');

  if (evEbit !== null) keyFindings.push(`Enterprise value is ${evEbit.toFixed(1)} times operating income.`);

  let stance: AgentStance = 'balanced';

  if (dcfValue !== null && price !== null) {
    const gap = (dcfValue / price - 1) * 100;
    keyFindings.push(
      `A discounted cash-flow model on the assumptions listed gives ${dcfValue.toFixed(2)} against a price of ${price.toFixed(2)}, a difference of ${gap.toFixed(0)}%.`
    );

    // The gap is a property of the assumptions, so a wide one is a reason to
    // doubt the assumptions before it is a reason to act.
    if (Math.abs(gap) > 40) {
      risks.push(
        'The model and the market differ by more than 40%, which usually means an assumption in the model is doing most of the work.'
      );
    }

    if (gap > 15) stance = 'moderately_positive';
    else if (gap < -15) stance = 'moderately_negative';
  } else {
    unknowns.push('No discounted cash-flow value could be produced from the data available.');
    if (pe === null) stance = 'insufficient_data';
  }

  const warned = calculations.filter(
    (entry) => ['pe', 'ev_ebit', 'dcf_per_share'].includes(entry.calculationType) && entry.warnings.length
  );
  for (const entry of warned) risks.push(entry.warnings[0]);

  return {
    agentName: 'Valuation Analyst',
    stance,
    summary: clean([
      pe !== null
        ? `Valuation rests on a ${pe.toFixed(1)}x earnings multiple and a model whose assumptions are listed in full.`
        : 'Valuation could not be described from the figures available.',
    ])[0],
    keyFindings: clean(keyFindings),
    risks: clean(risks),
    unknowns,
    assumptions,
    evidenceIds: evidenceFor(calculations, 'pe', 'ev_ebit', 'dcf_per_share', 'market_cap'),
    calculationIds: idsFor(calculations, 'pe', 'ev_ebit', 'dcf_per_share', 'market_cap'),
    confidence: dcfValue !== null && pe !== null ? 0.6 : 0.3,
  };
}

/* -------------------------------------------------------------- Technical */

export function technicalAgent(input: AgentInput): AgentFinding {
  const { calculations } = input;

  const trend = value(calculations, 'trend_20_vs_60');
  const volatility = value(calculations, 'historical_volatility');
  const drawdown = value(calculations, 'max_drawdown');
  const levels = calculations.filter((entry) => entry.calculationType === 'support_candidate');

  const keyFindings: string[] = [];
  const risks: string[] = [];
  const unknowns: string[] = [];

  if (trend !== null) {
    const direction = trend > 2 ? 'above' : trend < -2 ? 'below' : 'in line with';
    keyFindings.push(
      `Recent closes sit ${direction} the preceding stretch, by ${Math.abs(trend).toFixed(1)}%.`
    );
  } else {
    unknowns.push('The price history is too short to describe a trend.');
  }

  if (volatility !== null) {
    keyFindings.push(`Annualised volatility over the window is ${volatility.toFixed(0)}%.`);
    if (volatility > 45) risks.push('Volatility is high enough that position size matters more than entry.');
  }

  if (drawdown !== null) {
    keyFindings.push(`The largest fall within the window was ${Math.abs(drawdown).toFixed(0)}%.`);
  }

  if (levels.length) {
    keyFindings.push(
      `${levels.length} price level${levels.length === 1 ? '' : 's'} where the series turned more than once: ${levels
        .map((entry) => entry.result?.toFixed(2))
        .join(', ')}.`
    );
    risks.push('These are places price turned before, which is a description of the past and not a floor.');
  }

  const stance: AgentStance =
    trend === null ? 'insufficient_data' : trend > 4 ? 'moderately_positive' : trend < -4 ? 'moderately_negative' : 'balanced';

  return {
    agentName: 'Technical Analyst',
    stance,
    summary: clean([
      trend !== null
        ? 'Price behaviour is described from the closes in the window, with the method for every level stated.'
        : 'There is not enough price history to describe.',
    ])[0],
    keyFindings: clean(keyFindings),
    risks: clean(risks),
    unknowns,
    assumptions: levels[0]?.assumptions ?? [],
    evidenceIds: evidenceFor(calculations, 'trend_20_vs_60', 'historical_volatility', 'max_drawdown'),
    calculationIds: idsFor(
      calculations,
      'trend_20_vs_60',
      'historical_volatility',
      'max_drawdown',
      'support_candidate'
    ),
    confidence: trend !== null && volatility !== null ? 0.55 : 0.25,
  };
}

/* -------------------------------------------------------------- Bull/Bear */

/**
 * The two cases are built from the same findings, not from separate data.
 *
 * A debate where each side has its own facts is theatre. Here both read the
 * calculations that already exist, and the disagreement is about which of them
 * dominates — which is the disagreement a reader can actually adjudicate.
 */
export function bullAgent(findings: AgentFinding[], input: AgentInput): AgentFinding {
  const positives = findings.flatMap((finding) => finding.keyFindings);
  const calculations = input.calculations;

  const growthRate = value(calculations, 'growth');
  const returnOnCapital = value(calculations, 'roic');
  const dcfValue = value(calculations, 'dcf_per_share');
  const price = calc.factValue(input.facts, 'price');

  const case_: string[] = [];

  if (growthRate !== null && growthRate > 5) {
    case_.push(`Revenue is compounding at ${growthRate.toFixed(1)}% without the margin collapsing.`);
  }
  if (returnOnCapital !== null && returnOnCapital > 12) {
    case_.push(`Capital put into the business earns ${returnOnCapital.toFixed(1)}%, which is above most estimates of its cost.`);
  }
  if (dcfValue !== null && price !== null && dcfValue > price) {
    case_.push('On the stated assumptions the discounted value sits above the price.');
  }

  if (!case_.length) {
    case_.push('The data available does not support a positive case beyond the absence of obvious distress.');
  }

  return {
    agentName: 'Bull Case',
    stance: case_.length >= 2 ? 'moderately_positive' : 'balanced',
    summary: clean(['The strongest positive reading the evidence actually supports.'])[0],
    keyFindings: clean(case_),
    risks: [],
    unknowns: [],
    assumptions: ['Built only from findings the specialists already evidenced.'],
    evidenceIds: [...new Set(findings.flatMap((finding) => finding.evidenceIds))],
    calculationIds: [...new Set(findings.flatMap((finding) => finding.calculationIds))],
    confidence: positives.length >= 4 ? 0.6 : 0.35,
  };
}

export function bearAgent(findings: AgentFinding[], input: AgentInput): AgentFinding {
  const calculations = input.calculations;
  const inheritedRisks = findings.flatMap((finding) => finding.risks);

  const margin = value(calculations, 'operating_margin');
  const priorMargin = value(calculations, 'operating_margin_prior');
  const pe = value(calculations, 'pe');
  const debt = calc.factValue(input.facts, 'total_debt');
  const equity = calc.factValue(input.facts, 'total_equity');

  const case_: string[] = [...inheritedRisks];

  if (margin !== null && priorMargin !== null && margin < priorMargin) {
    case_.push(
      `Operating margin is lower than last year (${margin.toFixed(1)}% against ${priorMargin.toFixed(1)}%).`
    );
  }
  if (pe !== null && pe > 25) {
    case_.push(`At ${pe.toFixed(1)}x earnings, a good deal of continued execution is already in the price.`);
  }
  if (debt !== null && equity !== null && equity > 0 && debt / equity > 0.5) {
    case_.push(`Debt is ${(debt / equity).toFixed(2)}x equity, which narrows the room for a bad year.`);
  }

  if (!case_.length) {
    case_.push('No specific weakness surfaced in the data available, which is not the same as none existing.');
  }

  return {
    agentName: 'Bear Case',
    stance: case_.length >= 3 ? 'moderately_negative' : 'balanced',
    summary: clean(['Where this could go wrong, from the same figures.'])[0],
    keyFindings: clean(case_),
    risks: clean(case_),
    unknowns: ['Nothing here covers competitive or regulatory change, which the data set does not describe.'],
    assumptions: ['Built only from findings the specialists already evidenced.'],
    evidenceIds: [...new Set(findings.flatMap((finding) => finding.evidenceIds))],
    calculationIds: [...new Set(findings.flatMap((finding) => finding.calculationIds))],
    confidence: case_.length >= 3 ? 0.6 : 0.35,
  };
}

/* ------------------------------------------------------------------- Risk */

export function riskAgent(findings: AgentFinding[], input: AgentInput): AgentFinding {
  const { calculations } = input;

  const volatility = value(calculations, 'historical_volatility');
  const drawdown = value(calculations, 'max_drawdown');
  const betaValue = value(calculations, 'beta');

  const risks: string[] = [];
  const unknowns: string[] = [];

  if (volatility !== null) risks.push(`Annualised volatility of ${volatility.toFixed(0)}%.`);
  if (drawdown !== null) risks.push(`A ${Math.abs(drawdown).toFixed(0)}% fall occurred inside the window examined.`);
  if (betaValue !== null) {
    risks.push(`Beta to the benchmark is ${betaValue.toFixed(2)} over the common window.`);
  } else {
    unknowns.push('Beta could not be estimated from the overlapping history available.');
  }

  const missing = findings.flatMap((finding) => finding.unknowns);
  if (missing.length) {
    risks.push(`${missing.length} input(s) the analysis wanted were not available.`);
  }

  // The engine has no portfolio unless the person shared one, and it says so
  // rather than producing a suitability opinion about a person it cannot see.
  if (!input.user || input.user.dataCompleteness < 0.3) {
    unknowns.push(
      'No portfolio context was shared, so nothing here says whether this suits a particular holding.'
    );
  }

  return {
    agentName: 'Risk Analyst',
    stance: 'balanced',
    summary: clean(['What could go wrong, and what the analysis could not see.'])[0],
    keyFindings: clean(risks),
    risks: clean(risks),
    unknowns,
    assumptions: [],
    evidenceIds: evidenceFor(calculations, 'historical_volatility', 'max_drawdown', 'beta'),
    calculationIds: idsFor(calculations, 'historical_volatility', 'max_drawdown', 'beta'),
    confidence: volatility !== null && betaValue !== null ? 0.6 : 0.3,
  };
}

/* -------------------------------------------------------- Claim extraction */

/**
 * Turns findings into claims the validator can check.
 *
 * A line containing a number is a numeric claim and must point at a
 * calculation; a line without one is interpretive and needs a source. Splitting
 * on that is what lets an unsupported number be caught while an unsupported
 * opinion is merely marked.
 */
export function extractClaims(findings: AgentFinding[]): Array<
  Omit<ValidatedClaim, 'supportStatus' | 'conflicts' | 'freshnessDays'>
> {
  const claims: Array<Omit<ValidatedClaim, 'supportStatus' | 'conflicts' | 'freshnessDays'>> = [];
  let index = 0;

  for (const finding of findings) {
    for (const text of [...finding.keyFindings, finding.summary].filter(Boolean)) {
      index += 1;
      const numeric = /\d/.test(text);

      claims.push({
        claimId: `claim_${index}`,
        claimText: text,
        claimType: numeric ? 'numeric' : 'interpretive',
        agentName: finding.agentName,
        evidenceIds: finding.evidenceIds,
        calculationIds: numeric ? finding.calculationIds : [],
      });
    }
  }

  return claims;
}
