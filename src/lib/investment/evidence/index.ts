import type {
  AgentFinding,
  ClaimStatus,
  ConfidenceBreakdown,
  DataFreshness,
  EvidenceItem,
  ValidatedClaim,
  CalculationResult,
} from '../types';

/**
 * Evidence, claims and confidence.
 *
 * Two jobs. The validator decides whether each thing an agent said is actually
 * backed by something, and the confidence model turns the state of the evidence
 * into a number — in code, from named components, never by asking a model how
 * sure it feels.
 *
 * A model asked for its confidence produces a number correlated with how
 * fluent its answer was, not with how well evidenced it is. Those come apart
 * exactly when it matters: a confident, well-written analysis of a company
 * whose filings are eighteen months stale.
 */

/** Beyond this an annual figure is describing a company that may have changed. */
const STALE_AFTER_DAYS = 400;

function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/* -------------------------------------------------------------- Validator */

/**
 * Checks a claim against what exists.
 *
 * A claim that cites a calculation whose result is null is not supported by it:
 * the calculation ran and declined to produce a number, which is the opposite
 * of evidence. That case is the one this catches that a simple "does it cite
 * anything" check would not.
 */
export function validateClaim(
  claim: Omit<ValidatedClaim, 'supportStatus' | 'conflicts' | 'freshnessDays'>,
  evidence: EvidenceItem[],
  calculations: CalculationResult[],
  asOf: string
): ValidatedClaim {
  const conflicts: string[] = [];
  const byId = new Map(evidence.map((item) => [item.evidenceId, item]));
  const calcById = new Map(calculations.map((item) => [item.calculationId, item]));

  const citedEvidence = claim.evidenceIds.map((id) => byId.get(id)).filter(Boolean) as EvidenceItem[];
  const citedCalcs = claim.calculationIds
    .map((id) => calcById.get(id))
    .filter(Boolean) as CalculationResult[];

  const missingEvidence = claim.evidenceIds.length - citedEvidence.length;
  const missingCalcs = claim.calculationIds.length - citedCalcs.length;

  if (missingEvidence > 0) conflicts.push(`${missingEvidence} cited source(s) do not exist`);
  if (missingCalcs > 0) conflicts.push(`${missingCalcs} cited calculation(s) do not exist`);

  const emptyCalcs = citedCalcs.filter((calc) => calc.result === null);
  if (emptyCalcs.length) {
    conflicts.push(
      `${emptyCalcs.length} cited calculation(s) produced no number: ${emptyCalcs
        .map((calc) => calc.warnings[0] ?? calc.calculationType)
        .join('; ')}`
    );
  }

  const warned = citedCalcs.filter((calc) => calc.result !== null && calc.warnings.length);
  for (const calc of warned) conflicts.push(`${calc.calculationType}: ${calc.warnings[0]}`);

  const freshnessDays = citedEvidence.length
    ? Math.min(
        ...citedEvidence.map((item) => daysBetween(item.dataAsOf, asOf) ?? Number.MAX_SAFE_INTEGER)
      )
    : null;

  let supportStatus: ClaimStatus;

  if (!citedEvidence.length && !citedCalcs.length) {
    supportStatus = 'UNSUPPORTED';
  } else if (emptyCalcs.length || missingEvidence > 0 || missingCalcs > 0) {
    supportStatus = 'UNSUPPORTED';
  } else if (conflicts.length) {
    supportStatus = 'CONFLICTING';
  } else if (freshnessDays !== null && freshnessDays > STALE_AFTER_DAYS) {
    supportStatus = 'STALE';
  } else if (claim.claimType === 'numeric' && !citedCalcs.length) {
    // A number with a source but no calculation behind it was read off
    // something rather than worked out, which is weaker but not nothing.
    supportStatus = 'PARTIALLY_SUPPORTED';
  } else {
    supportStatus = 'SUPPORTED';
  }

  return { ...claim, supportStatus, conflicts, freshnessDays };
}

/** Claims that may be printed as fact. */
export function admissible(claims: ValidatedClaim[]): ValidatedClaim[] {
  return claims.filter(
    (claim) => claim.supportStatus === 'SUPPORTED' || claim.supportStatus === 'PARTIALLY_SUPPORTED'
  );
}

/* ------------------------------------------------------------- Freshness */

export function measureFreshness(
  evidence: EvidenceItem[],
  claims: ValidatedClaim[],
  asOf: string
): DataFreshness {
  const ages = evidence
    .map((item) => daysBetween(item.dataAsOf, asOf))
    .filter((value): value is number => value !== null);

  const stale = ages.filter((age) => age > STALE_AFTER_DAYS).length;
  const primary = evidence.filter((item) => item.primarySource).length;
  const supported = claims.filter(
    (claim) => claim.supportStatus === 'SUPPORTED' || claim.supportStatus === 'PARTIALLY_SUPPORTED'
  ).length;

  return {
    oldestEvidenceDays: ages.length ? Math.max(...ages) : null,
    newestEvidenceDays: ages.length ? Math.min(...ages) : null,
    staleEvidenceRatio: evidence.length ? stale / evidence.length : 0,
    primarySourceRatio: evidence.length ? primary / evidence.length : 0,
    evidenceCoverageRatio: claims.length ? supported / claims.length : 0,
    unsupportedClaimCount: claims.filter((claim) => claim.supportStatus === 'UNSUPPORTED').length,
    conflictingClaimCount: claims.filter((claim) => claim.supportStatus === 'CONFLICTING').length,
  };
}

/* ------------------------------------------------------------ Confidence */

/**
 * The weights, in one place and documented.
 *
 * Evidence coverage and data quality carry the most because they answer "is
 * this analysis about the real company"; risk coverage is weighted alongside
 * them because an assessment that has not looked for what could go wrong is
 * not more trustworthy for being cheerful.
 */
export const CONFIDENCE_WEIGHTS = {
  dataQuality: 0.2,
  dataFreshness: 0.1,
  evidenceCoverage: 0.2,
  methodology: 0.15,
  signalConsistency: 0.1,
  riskCoverage: 0.15,
  sourceQuality: 0.1,
} as const;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function computeConfidence(options: {
  facts: number;
  expectedFacts: number;
  freshness: DataFreshness;
  calculations: CalculationResult[];
  findings: AgentFinding[];
  claims: ValidatedClaim[];
}): ConfidenceBreakdown {
  const explanation: string[] = [];

  const dataQuality = clamp(options.expectedFacts ? options.facts / options.expectedFacts : 0);
  if (dataQuality < 0.7) {
    explanation.push(
      `Only ${options.facts} of the ${options.expectedFacts} figures this analysis wanted were available.`
    );
  }

  const newest = options.freshness.newestEvidenceDays;
  const dataFreshness = newest === null ? 0 : clamp(1 - newest / STALE_AFTER_DAYS);
  if (newest !== null && newest > 120) {
    explanation.push(`The most recent source is ${newest} days old.`);
  }

  const evidenceCoverage = clamp(options.freshness.evidenceCoverageRatio);
  if (options.freshness.unsupportedClaimCount > 0) {
    explanation.push(
      `${options.freshness.unsupportedClaimCount} statement(s) were dropped for having nothing behind them.`
    );
  }

  // A calculation that declined to produce a number is not a failure of the
  // engine, but it does mean the method did not fit — which is a real reason to
  // be less sure of the conclusion built on top of it.
  const usable = options.calculations.filter((calc) => calc.result !== null).length;
  const methodology = clamp(options.calculations.length ? usable / options.calculations.length : 0);
  if (methodology < 1) {
    explanation.push(
      `${options.calculations.length - usable} calculation(s) did not apply to this company's figures.`
    );
  }

  const stances = options.findings.map((finding) => finding.stance);
  const positive = stances.filter((stance) => stance.includes('positive')).length;
  const negative = stances.filter((stance) => stance.includes('negative')).length;
  const decided = positive + negative;
  const signalConsistency = decided ? clamp(Math.abs(positive - negative) / decided) : 0.5;
  if (decided && signalConsistency < 0.4) {
    explanation.push('The specialists disagree with each other, which is itself information.');
  }

  const withRisks = options.findings.filter((finding) => finding.risks.length > 0).length;
  const riskCoverage = clamp(options.findings.length ? withRisks / options.findings.length : 0);

  const sourceQuality = clamp(options.freshness.primarySourceRatio);
  if (sourceQuality < 0.5) {
    explanation.push('Most of this rests on secondary sources rather than filings.');
  }

  const overall =
    dataQuality * CONFIDENCE_WEIGHTS.dataQuality +
    dataFreshness * CONFIDENCE_WEIGHTS.dataFreshness +
    evidenceCoverage * CONFIDENCE_WEIGHTS.evidenceCoverage +
    methodology * CONFIDENCE_WEIGHTS.methodology +
    signalConsistency * CONFIDENCE_WEIGHTS.signalConsistency +
    riskCoverage * CONFIDENCE_WEIGHTS.riskCoverage +
    sourceQuality * CONFIDENCE_WEIGHTS.sourceQuality;

  const score = Math.round(overall * 100);

  if (!explanation.length) {
    explanation.push('Every figure used came from a dated source and every method applied cleanly.');
  }

  return {
    dataQuality: Math.round(dataQuality * 100),
    dataFreshness: Math.round(dataFreshness * 100),
    evidenceCoverage: Math.round(evidenceCoverage * 100),
    methodology: Math.round(methodology * 100),
    signalConsistency: Math.round(signalConsistency * 100),
    riskCoverage: Math.round(riskCoverage * 100),
    sourceQuality: Math.round(sourceQuality * 100),
    overall: score,
    label: score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low',
    explanation,
  };
}
