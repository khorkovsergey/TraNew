import type { InvestmentAssessment } from './types';

/**
 * What travels to the browser.
 *
 * A full assessment carries every calculation, every claim and every source —
 * useful on the server, far more than a chat panel needs, and enough of a
 * payload to be worth trimming. This keeps what the interface actually renders:
 * the readings, the two cases, the disagreement, and enough of the evidence
 * that "show me the sources" is answerable without another request.
 *
 * Deliberately still carries the things that are easy to drop and expensive to
 * lose — the limitations, the data date and the confidence explanation. An
 * assessment whose caveats were trimmed for payload size is a different
 * document from the one the engine produced.
 */

export type EvidenceSummary = {
  id: string;
  name: string;
  tier: number;
  primary: boolean;
  dataAsOf: string;
  publishedAt: string | null;
  excerpt: string | null;
};

export type CalculationSummary = {
  id: string;
  type: string;
  result: number | null;
  unit: string;
  formulaVersion: string;
  assumptions: string[];
  warnings: string[];
};

export type InvestmentSummary = {
  runId: string;
  instrumentName: string;
  symbol: string;
  currency: string;
  analysisAsOf: string;

  stance: string;
  confidence: number;
  confidenceLabel: 'low' | 'medium' | 'high';
  confidenceExplanation: string[];
  horizon: string;

  businessQuality: string;
  valuationStatus: string;
  technicalState: string;
  riskLevel: string;
  portfolioFit: string;

  bullCase: string[];
  bearCase: string[];
  baseCase: string[];
  invalidationConditions: string[];
  whatAppearsPricedIn: string[];
  unknowns: string[];

  /** One line per specialist, for the "what did they disagree about" section. */
  debate: Array<{ agent: string; stance: string; summary: string }>;

  calculations: CalculationSummary[];
  evidence: EvidenceSummary[];
  claimCounts: Record<string, number>;

  dataFreshness: {
    newestEvidenceDays: number | null;
    primarySourceRatio: number;
    unsupportedClaimCount: number;
  };

  chartActions: InvestmentAssessment['chartActions'];
  limitations: string[];
  disclaimer: string;
};

export function summarise(assessment: InvestmentAssessment): InvestmentSummary {
  const claimCounts: Record<string, number> = {};
  for (const claim of assessment.claims) {
    claimCounts[claim.supportStatus] = (claimCounts[claim.supportStatus] ?? 0) + 1;
  }

  return {
    runId: assessment.runId,
    instrumentName: assessment.instrument.companyName,
    symbol: `${assessment.instrument.exchange}:${assessment.instrument.symbol}`,
    currency: assessment.instrument.currency,
    analysisAsOf: assessment.analysisAsOf,

    stance: assessment.stance,
    confidence: assessment.confidence.overall,
    confidenceLabel: assessment.confidence.label,
    confidenceExplanation: assessment.confidence.explanation,
    horizon: assessment.horizon,

    businessQuality: assessment.businessQuality,
    valuationStatus: assessment.valuationStatus,
    technicalState: assessment.technicalState,
    riskLevel: assessment.riskLevel,
    portfolioFit: assessment.portfolioFit,

    bullCase: assessment.bullCase,
    bearCase: assessment.bearCase,
    baseCase: assessment.baseCase,
    invalidationConditions: assessment.invalidationConditions,
    whatAppearsPricedIn: assessment.whatAppearsPricedIn,
    unknowns: assessment.unknowns,

    debate: assessment.findings.map((finding) => ({
      agent: finding.agentName,
      stance: finding.stance,
      summary: finding.summary,
    })),

    calculations: assessment.calculations.map((calc) => ({
      id: calc.calculationId,
      type: calc.calculationType,
      result: calc.result,
      unit: calc.unit,
      formulaVersion: calc.formulaVersion,
      assumptions: calc.assumptions,
      warnings: calc.warnings,
    })),

    evidence: assessment.evidence.map((item) => ({
      id: item.evidenceId,
      name: item.sourceName,
      tier: item.qualityTier,
      primary: item.primarySource,
      dataAsOf: item.dataAsOf,
      publishedAt: item.publishedAt,
      excerpt: item.excerpt,
    })),

    claimCounts,

    dataFreshness: {
      newestEvidenceDays: assessment.dataFreshness.newestEvidenceDays,
      primarySourceRatio: assessment.dataFreshness.primarySourceRatio,
      unsupportedClaimCount: assessment.dataFreshness.unsupportedClaimCount,
    },

    chartActions: assessment.chartActions,
    limitations: assessment.limitations,
    disclaimer: assessment.disclaimer,
  };
}

/** Plain-language labels. The internal vocabulary is not a reading vocabulary. */
export const STANCE_LABEL: Record<string, string> = {
  strongly_positive: 'The evidence leans clearly positive',
  moderately_positive: 'The evidence leans positive',
  balanced: 'The evidence points both ways',
  moderately_negative: 'The evidence leans negative',
  strongly_negative: 'The evidence leans clearly negative',
  insufficient_data: 'Not enough data to lean either way',
};

export const READING_LABEL: Record<string, string> = {
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
  expensive: 'Expensive',
  full: 'Full',
  improving: 'Improving',
  weakening: 'Weakening',
  neutral: 'Neutral',
  elevated: 'Elevated',
  contained: 'Contained',
  not_assessed: 'Not assessed',
  requires_user_context: 'Needs your context',
  assessed_against_shared_context: 'Assessed against what you shared',
};
