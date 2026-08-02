/**
 * Voyager Investment Intelligence Engine — the domain model.
 *
 * Import-free on purpose: every other module in the engine depends on these
 * names, and the unit harness compiles them on their own.
 *
 * The shape of this file encodes the rule the whole engine exists to enforce.
 * A number reaches a person only as a `CalculationResult`, which names the
 * formula and its version and points at the `FinancialFact`s it consumed; a
 * fact points at the `EvidenceItem` it came from; and an `AgentFinding` may
 * only reference calculations and evidence that already exist. There is no
 * field anywhere in which a model can put a number of its own.
 */

/* ------------------------------------------------------------- Instrument */

export type InstrumentType = 'stock' | 'etf' | 'index' | 'fund' | 'unknown';

/**
 * A ticker is not an instrument.
 *
 * "TSLA" is a Nasdaq listing in dollars and also a Frankfurt listing in euros,
 * and a valuation that mixes the two is wrong in a way nobody notices. Every
 * analysis resolves to one of these before any data is fetched.
 */
export type InstrumentIdentity = {
  instrumentId: string;
  symbol: string;
  exchange: string;
  /** ISO 10383 market identifier, where known. */
  mic: string | null;
  instrumentType: InstrumentType;
  companyName: string;
  country: string | null;
  currency: string;
  isin: string | null;
  figi: string | null;
  sector: string | null;
  industry: string | null;
  /** How the same instrument is spelled by each data provider. */
  providerSymbols: Record<string, string>;
  /** 0–1. Below `RESOLUTION_MIN` the engine asks rather than assumes. */
  resolutionConfidence: number;
};

/* ------------------------------------------------------------------- Time */

export type MarketSession = 'pre-market' | 'open' | 'closed' | 'after-hours' | 'unknown';

export type AnalysisTimeContext = {
  requestedAt: string;
  /** The instant the analysis is *about*. Differs from `requestedAt` in historical mode. */
  analysisAsOf: string;
  marketTimezone: string;
  marketSession: MarketSession;
  historicalMode: boolean;
  /** Nothing published after this may be used. See `pointInTime.ts`. */
  dataCutoff: string;
};

/* ---------------------------------------------------------------- Context */

export type PageContext = {
  pageType: string;
  pageUrl: string | null;
  locale: string;
  country: string | null;
  selectedMarket: string | null;
  selectedInstrument: string | null;
  visibleModules: string[];
  userQuestion: string;
};

export type ChartContext = {
  symbol: string;
  exchange: string | null;
  timeframe: string;
  visibleFrom: string | null;
  visibleTo: string | null;
  lastVisibleCandle: number | null;
  chartType: string | null;
  indicators: Array<{ id: string; params: Record<string, number> }>;
  comparisonSymbols: string[];
  currency: string | null;
};

/**
 * Optional, and absent by default.
 *
 * When it is missing the engine says `requires_user_context` for portfolio fit
 * rather than inventing a profile. A good company is not automatically a good
 * holding for a particular person, and the engine is not allowed to blur the
 * two.
 */
export type UserInvestmentContext = {
  userId: string;
  knowledgeLevel: 'new' | 'some' | 'experienced' | null;
  investmentHorizon: string | null;
  riskTolerance: 'low' | 'medium' | 'high' | null;
  baseCurrency: string | null;
  countryOfResidence: string | null;
  /** Fraction of the portfolio already in this instrument, 0–1. */
  existingExposure: number | null;
  sectorExposure: Record<string, number> | null;
  declaredGoals: string[];
  /** 0–1: how much of the above is actually known. */
  dataCompleteness: number;
  consentFlags: Record<string, boolean>;
};

/* --------------------------------------------------------------- Evidence */

/**
 * Tier 1 is an official filing or a government series; tier 5 is an aggregator
 * repeating someone else. The tier is not a judgement about truth — it is how
 * far the statement is from the entity that published it, and it is what makes
 * "two sources disagree" resolvable.
 */
export type EvidenceTier = 1 | 2 | 3 | 4 | 5;

export type EvidenceItem = {
  evidenceId: string;
  sourceType: 'filing' | 'exchange' | 'provider' | 'news' | 'macro' | 'fixture';
  sourceName: string;
  sourceUrl: string | null;
  provider: string;
  documentTitle: string | null;
  /** When the world learned it. Drives the point-in-time cutoff. */
  publishedAt: string | null;
  filingDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  retrievedAt: string;
  /** The instant the underlying value describes. */
  dataAsOf: string;
  excerpt: string | null;
  contentHash: string;
  qualityTier: EvidenceTier;
  primarySource: boolean;
};

/* ------------------------------------------------------------------ Facts */

export type PeriodType = 'annual' | 'quarterly' | 'ttm' | 'point';

export type FinancialFact = {
  factId: string;
  instrumentId: string;
  metric: string;
  value: number;
  unit: string;
  currency: string | null;
  period: string;
  periodType: PeriodType;
  filingDate: string | null;
  sourceEvidenceId: string;
  provider: string;
  restated: boolean;
  confidence: number;
};

/* ----------------------------------------------------------- Calculations */

export type CalculationResult = {
  calculationId: string;
  calculationType: string;
  /** Bumped whenever the formula changes, so an old run stays interpretable. */
  formulaVersion: string;
  inputs: Record<string, number | string | null>;
  result: number | null;
  unit: string;
  assumptions: string[];
  /** Says when the method does not fit the input, rather than returning a number anyway. */
  warnings: string[];
  evidenceIds: string[];
  calculatedAt: string;
};

/* ----------------------------------------------------------------- Agents */

export type AgentStance =
  | 'strongly_positive'
  | 'moderately_positive'
  | 'balanced'
  | 'moderately_negative'
  | 'strongly_negative'
  | 'insufficient_data';

export type AgentFinding = {
  agentName: string;
  stance: AgentStance;
  summary: string;
  keyFindings: string[];
  risks: string[];
  unknowns: string[];
  assumptions: string[];
  evidenceIds: string[];
  calculationIds: string[];
  confidence: number;
};

/* -------------------------------------------------------------- Validator */

export type ClaimStatus =
  | 'SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'CONFLICTING'
  | 'UNSUPPORTED'
  | 'STALE';

export type ValidatedClaim = {
  claimId: string;
  claimText: string;
  claimType: 'numeric' | 'factual' | 'interpretive';
  agentName: string;
  evidenceIds: string[];
  calculationIds: string[];
  supportStatus: ClaimStatus;
  conflicts: string[];
  freshnessDays: number | null;
};

/* ------------------------------------------------------------- Confidence */

/**
 * Assembled from components in code, never asked of a model.
 *
 * It is a statement about how well the analysis is evidenced — not a
 * probability that the price rises. The distinction is in the type name and in
 * every string the engine prints about it.
 */
export type ConfidenceBreakdown = {
  dataQuality: number;
  dataFreshness: number;
  evidenceCoverage: number;
  methodology: number;
  signalConsistency: number;
  riskCoverage: number;
  sourceQuality: number;
  overall: number;
  label: 'low' | 'medium' | 'high';
  explanation: string[];
};

/* ------------------------------------------------------------- Assessment */

export type ChartAction =
  | {
      type: 'horizontal_level';
      price: number;
      label: string;
      method: string;
      confidence: number;
    }
  | {
      type: 'indicator';
      indicator: string;
      parameters: Record<string, number>;
      reason: string;
    };

export type ChartActionPlan = {
  symbol: string;
  timeframe: string;
  actions: ChartAction[];
  /** True when the plan needs the existing Pine bridge to render it. */
  pinescriptRequired: boolean;
};

export type DataFreshness = {
  oldestEvidenceDays: number | null;
  newestEvidenceDays: number | null;
  staleEvidenceRatio: number;
  primarySourceRatio: number;
  evidenceCoverageRatio: number;
  unsupportedClaimCount: number;
  conflictingClaimCount: number;
};

export type InvestmentAssessment = {
  runId: string;
  instrument: InstrumentIdentity;
  analysisAsOf: string;
  mode: AnalysisMode;

  stance: AgentStance;
  confidence: ConfidenceBreakdown;
  horizon: string;

  businessQuality: string;
  valuationStatus: string;
  technicalState: string;
  macroState: string;
  riskLevel: string;
  portfolioFit: string;

  bullCase: string[];
  bearCase: string[];
  baseCase: string[];
  catalysts: string[];
  invalidationConditions: string[];
  unknowns: string[];
  whatAppearsPricedIn: string[];
  whatToMonitor: string[];

  findings: AgentFinding[];
  claims: ValidatedClaim[];
  calculations: CalculationResult[];
  evidence: EvidenceItem[];
  dataFreshness: DataFreshness;

  chartActions: ChartActionPlan;
  skillVersions: Record<string, string>;
  modelVersions: Record<string, string>;
  limitations: string[];
  disclaimer: string;
};

/* ------------------------------------------------------------------ Modes */

export type AnalysisMode = 'quick' | 'standard' | 'deep';

export type ModeBudget = {
  maxLlmCalls: number;
  maxToolCalls: number;
  maxTokens: number;
  timeoutMs: number;
  agents: string[];
};

/* ---------------------------------------------------------------- Streaming */

export type RunEventType =
  | 'run_started'
  | 'context_resolved'
  | 'instrument_resolved'
  | 'data_plan_created'
  | 'data_fetch_started'
  | 'data_fetch_completed'
  | 'calculations_completed'
  | 'agent_started'
  | 'agent_completed'
  | 'debate_completed'
  | 'validation_completed'
  | 'assessment_completed'
  | 'run_failed';

export type RunEvent = {
  type: RunEventType;
  runId: string;
  at: string;
  detail?: string;
  /** Never a prompt, never reasoning — only what a progress bar needs. */
  data?: Record<string, string | number | boolean | null>;
};

export const DISCLAIMER =
  'This is analytical information, not investment advice and not a forecast. It describes what the data shows as of the date given, cannot tell you what a price will do, and does not account for your circumstances unless you have chosen to share them.';

/** Below this the engine asks which instrument was meant instead of guessing. */
export const RESOLUTION_MIN = 0.6;
