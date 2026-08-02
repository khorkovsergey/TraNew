import type { CalculationResult, FinancialFact } from '../types';

/**
 * The deterministic calculation engine.
 *
 * The rule the whole engine is built around: **code calculates, the model
 * interprets, sources prove, the validator checks.** No language model is ever
 * asked what a margin is or what a ratio comes to. It is handed the numbers
 * this file produced, along with the formula version that produced them.
 *
 * That is not tidiness. A model asked for a P/E will answer with a plausible
 * number whether or not it has the inputs, and the answer will look exactly
 * like one that was computed. There is no way to tell them apart afterwards,
 * and a person deciding what to do with their money cannot be asked to.
 *
 * Every function here:
 *   - carries a formula version, so an old run stays interpretable;
 *   - returns `null` rather than a number when an input is missing;
 *   - attaches a warning when the method does not fit the input, instead of
 *     returning a figure that is arithmetically fine and meaningless;
 *   - names the evidence its inputs came from.
 */

let counter = 0;

/** Deterministic within a run — the run id makes it unique across runs. */
function nextId(type: string): string {
  counter += 1;
  return `calc_${type}_${counter}`;
}

type Build = {
  type: string;
  version: string;
  inputs: Record<string, number | string | null>;
  result: number | null;
  unit: string;
  assumptions?: string[];
  warnings?: string[];
  evidenceIds?: string[];
  at: string;
};

function build(options: Build): CalculationResult {
  return {
    calculationId: nextId(options.type),
    calculationType: options.type,
    formulaVersion: options.version,
    inputs: options.inputs,
    result: options.result,
    unit: options.unit,
    assumptions: options.assumptions ?? [],
    warnings: options.warnings ?? [],
    evidenceIds: options.evidenceIds ?? [],
    calculatedAt: options.at,
  };
}

/** Resets the counter so a run's calculation ids start from one. */
export function resetCalculationIds(): void {
  counter = 0;
}

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/* ------------------------------------------------------------ Fundamentals */

export function growth(
  current: number | null,
  previous: number | null,
  at: string,
  evidenceIds: string[] = []
): CalculationResult {
  const warnings: string[] = [];
  let result: number | null = null;

  if (finite(current) && finite(previous) && previous !== 0) {
    result = ((current - previous) / Math.abs(previous)) * 100;

    // Growth off a negative base is arithmetic without meaning: revenue moving
    // from -10 to -5 is not "50% growth" in any sense a reader would accept.
    if (previous < 0) {
      warnings.push('Prior period is negative, so a percentage change does not describe an improvement.');
      result = null;
    }
  }

  return build({
    type: 'growth',
    version: '1.0.0',
    inputs: { current: current ?? null, previous: previous ?? null },
    result,
    unit: '%',
    warnings,
    evidenceIds,
    at,
  });
}

export function cagr(
  endValue: number | null,
  startValue: number | null,
  years: number,
  at: string,
  evidenceIds: string[] = []
): CalculationResult {
  const warnings: string[] = [];
  let result: number | null = null;

  if (finite(endValue) && finite(startValue) && years > 0) {
    if (startValue <= 0 || endValue <= 0) {
      warnings.push('A compound rate is undefined when either endpoint is zero or negative.');
    } else {
      result = ((endValue / startValue) ** (1 / years) - 1) * 100;
    }
  }

  return build({
    type: 'cagr',
    version: '1.0.0',
    inputs: { endValue: endValue ?? null, startValue: startValue ?? null, years },
    result,
    unit: '%',
    warnings,
    evidenceIds,
    at,
  });
}

export function margin(
  part: number | null,
  revenue: number | null,
  name: string,
  at: string,
  evidenceIds: string[] = []
): CalculationResult {
  const warnings: string[] = [];
  let result: number | null = null;

  if (finite(part) && finite(revenue)) {
    if (revenue <= 0) warnings.push('Revenue is zero or negative, so a margin is not defined.');
    else result = (part / revenue) * 100;
  }

  return build({
    type: `${name}_margin`,
    version: '1.0.0',
    inputs: { part: part ?? null, revenue: revenue ?? null },
    result,
    unit: '%',
    warnings,
    evidenceIds,
    at,
  });
}

export function freeCashFlow(
  operatingCashFlow: number | null,
  capex: number | null,
  at: string,
  evidenceIds: string[] = []
): CalculationResult {
  const result =
    finite(operatingCashFlow) && finite(capex) ? operatingCashFlow - Math.abs(capex) : null;

  return build({
    type: 'free_cash_flow',
    version: '1.0.0',
    inputs: { operatingCashFlow: operatingCashFlow ?? null, capex: capex ?? null },
    result,
    unit: 'currency',
    // Capex is taken as an outflow whichever sign the filing used, because
    // providers disagree about that and the difference is a factor of two.
    assumptions: ['Capital expenditure is treated as an outflow regardless of its reported sign.'],
    evidenceIds,
    at,
  });
}

export function ratio(
  numerator: number | null,
  denominator: number | null,
  type: string,
  unit: string,
  at: string,
  evidenceIds: string[] = [],
  options: { percent?: boolean; warnOnNegativeDenominator?: boolean } = {}
): CalculationResult {
  const warnings: string[] = [];
  let result: number | null = null;

  if (finite(numerator) && finite(denominator) && denominator !== 0) {
    if (options.warnOnNegativeDenominator && denominator < 0) {
      warnings.push('The denominator is negative, which makes this ratio hard to read rather than simply low.');
    }
    result = options.percent ? (numerator / denominator) * 100 : numerator / denominator;
  }

  return build({
    type,
    version: '1.0.0',
    inputs: { numerator: numerator ?? null, denominator: denominator ?? null },
    result,
    unit,
    warnings,
    evidenceIds,
    at,
  });
}

/**
 * Return on invested capital.
 *
 * Uses NOPAT over debt plus equity minus cash. Providers differ on whether to
 * subtract cash and on which tax rate to use, so both choices are declared as
 * assumptions rather than buried — a ROIC that cannot be reproduced is a number
 * with no argument attached to it.
 */
export function roic(
  operatingIncome: number | null,
  taxRate: number,
  totalDebt: number | null,
  totalEquity: number | null,
  cash: number | null,
  at: string,
  evidenceIds: string[] = []
): CalculationResult {
  const warnings: string[] = [];
  let result: number | null = null;

  const investedCapital =
    finite(totalDebt) && finite(totalEquity) ? totalDebt + totalEquity - (finite(cash) ? cash : 0) : null;

  if (finite(operatingIncome) && finite(investedCapital)) {
    if (investedCapital <= 0) {
      warnings.push('Invested capital is zero or negative, so a return on it is not meaningful.');
    } else {
      result = ((operatingIncome * (1 - taxRate)) / investedCapital) * 100;
    }
  }

  return build({
    type: 'roic',
    version: '1.0.0',
    inputs: {
      operatingIncome: operatingIncome ?? null,
      taxRate,
      totalDebt: totalDebt ?? null,
      totalEquity: totalEquity ?? null,
      cash: cash ?? null,
    },
    result,
    unit: '%',
    assumptions: [
      `NOPAT uses a ${(taxRate * 100).toFixed(0)}% tax rate.`,
      'Invested capital is debt plus equity less cash.',
    ],
    warnings,
    evidenceIds,
    at,
  });
}

/* -------------------------------------------------------------- Valuation */

export function marketCap(
  price: number | null,
  sharesOutstanding: number | null,
  at: string,
  evidenceIds: string[] = []
): CalculationResult {
  return build({
    type: 'market_cap',
    version: '1.0.0',
    inputs: { price: price ?? null, sharesOutstanding: sharesOutstanding ?? null },
    result: finite(price) && finite(sharesOutstanding) ? price * sharesOutstanding : null,
    unit: 'currency',
    evidenceIds,
    at,
  });
}

export function enterpriseValue(
  cap: number | null,
  totalDebt: number | null,
  cash: number | null,
  at: string,
  evidenceIds: string[] = []
): CalculationResult {
  const result =
    finite(cap) && finite(totalDebt) ? cap + totalDebt - (finite(cash) ? cash : 0) : null;

  return build({
    type: 'enterprise_value',
    version: '1.0.0',
    inputs: { marketCap: cap ?? null, totalDebt: totalDebt ?? null, cash: cash ?? null },
    result,
    unit: 'currency',
    assumptions: ['Minority interests and preferred stock are not included.'],
    evidenceIds,
    at,
  });
}

/**
 * A price multiple.
 *
 * Negative earnings produce a negative P/E, which is not "cheap" — it is a
 * signal that the multiple is the wrong tool. The number is suppressed and a
 * warning takes its place, because a "-14x" printed next to a peer's "22x"
 * invites exactly the wrong reading.
 */
export function multiple(
  value: number | null,
  metric: number | null,
  type: string,
  at: string,
  evidenceIds: string[] = []
): CalculationResult {
  const warnings: string[] = [];
  let result: number | null = null;

  if (finite(value) && finite(metric)) {
    if (metric <= 0) {
      warnings.push('The denominator is zero or negative, so this multiple does not describe valuation.');
    } else {
      result = value / metric;
    }
  }

  return build({
    type,
    version: '1.0.0',
    inputs: { value: value ?? null, metric: metric ?? null },
    result,
    unit: 'x',
    warnings,
    evidenceIds,
    at,
  });
}

export type DcfInput = {
  baseFreeCashFlow: number;
  growthRates: number[];
  terminalGrowth: number;
  discountRate: number;
  netDebt: number;
  sharesOutstanding: number;
};

/**
 * A discounted cash-flow value per share.
 *
 * Rejects the two inputs that silently produce nonsense: a terminal growth rate
 * at or above the discount rate, which makes the terminal value infinite or
 * negative, and a terminal growth rate above long-run nominal GDP, which
 * assumes the company eventually becomes the economy.
 */
export function dcf(
  input: DcfInput,
  at: string,
  evidenceIds: string[] = []
): CalculationResult {
  const warnings: string[] = [];
  let result: number | null = null;

  const { baseFreeCashFlow, growthRates, terminalGrowth, discountRate, netDebt, sharesOutstanding } =
    input;

  if (terminalGrowth >= discountRate) {
    warnings.push(
      'Terminal growth is at or above the discount rate, which makes the terminal value meaningless.'
    );
  } else if (terminalGrowth > 0.04) {
    warnings.push('Terminal growth above 4% assumes the company outgrows the economy for ever.');
  } else if (sharesOutstanding <= 0) {
    warnings.push('Share count is zero or negative, so a per-share value cannot be produced.');
  } else {
    let flow = baseFreeCashFlow;
    let presentValue = 0;

    for (let year = 1; year <= growthRates.length; year += 1) {
      flow *= 1 + growthRates[year - 1];
      presentValue += flow / (1 + discountRate) ** year;
    }

    const terminalValue = (flow * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
    presentValue += terminalValue / (1 + discountRate) ** growthRates.length;

    result = (presentValue - netDebt) / sharesOutstanding;
  }

  return build({
    type: 'dcf_per_share',
    version: '1.0.0',
    inputs: {
      baseFreeCashFlow,
      years: growthRates.length,
      terminalGrowth,
      discountRate,
      netDebt,
      sharesOutstanding,
    },
    result,
    unit: 'currency_per_share',
    assumptions: [
      `Explicit forecast of ${growthRates.length} years, then a perpetuity.`,
      `Growth rates: ${growthRates.map((rate) => `${(rate * 100).toFixed(1)}%`).join(', ')}.`,
      `Discount rate ${(discountRate * 100).toFixed(1)}%, terminal growth ${(terminalGrowth * 100).toFixed(1)}%.`,
      'A DCF is a statement about assumptions, not a measurement of value.',
    ],
    warnings,
    evidenceIds,
    at,
  });
}

/** How far the value moves when the two assumptions that matter most change. */
export function dcfSensitivity(
  input: DcfInput,
  at: string
): { discountRate: number; terminalGrowth: number; valuePerShare: number | null }[] {
  const grid: { discountRate: number; terminalGrowth: number; valuePerShare: number | null }[] = [];

  for (const dr of [-0.01, 0, 0.01]) {
    for (const tg of [-0.005, 0, 0.005]) {
      const cell = dcf(
        {
          ...input,
          discountRate: input.discountRate + dr,
          terminalGrowth: input.terminalGrowth + tg,
        },
        at
      );
      grid.push({
        discountRate: input.discountRate + dr,
        terminalGrowth: input.terminalGrowth + tg,
        valuePerShare: cell.result,
      });
    }
  }

  return grid;
}

/* ------------------------------------------------------------- Technical */

export function returns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    if (closes[i - 1] === 0) continue;
    out.push(closes[i] / closes[i - 1] - 1);
  }
  return out;
}

/** Annualised standard deviation of daily returns. */
export function historicalVolatility(
  closes: number[],
  at: string,
  evidenceIds: string[] = []
): CalculationResult {
  const warnings: string[] = [];
  let result: number | null = null;

  const series = returns(closes);

  if (series.length < 20) {
    warnings.push('Fewer than twenty observations — the estimate is too noisy to describe.');
  } else {
    const mean = series.reduce((total, value) => total + value, 0) / series.length;
    const variance =
      series.reduce((total, value) => total + (value - mean) ** 2, 0) / (series.length - 1);
    result = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  return build({
    type: 'historical_volatility',
    version: '1.0.0',
    inputs: { observations: series.length },
    result,
    unit: '%',
    assumptions: ['252 trading days a year; daily log-free simple returns.'],
    warnings,
    evidenceIds,
    at,
  });
}

export function maxDrawdown(
  closes: number[],
  at: string,
  evidenceIds: string[] = []
): CalculationResult {
  let peak = closes[0] ?? 0;
  let worst = 0;

  for (const close of closes) {
    if (close > peak) peak = close;
    if (peak > 0) worst = Math.min(worst, close / peak - 1);
  }

  return build({
    type: 'max_drawdown',
    version: '1.0.0',
    inputs: { observations: closes.length },
    result: closes.length ? worst * 100 : null,
    unit: '%',
    assumptions: ['Measured on closing prices within the window supplied, not since inception.'],
    evidenceIds,
    at,
  });
}

/**
 * Price levels where the series turned more than once.
 *
 * Returned as candidates with the method attached, never as "support". A level
 * found this way is a description of where trading clustered, not a floor, and
 * the label it carries into the chart plan says so.
 */
export function supportCandidates(
  closes: number[],
  at: string,
  evidenceIds: string[] = []
): CalculationResult[] {
  if (closes.length < 30) return [];

  const window = 5;
  const pivots: number[] = [];

  for (let i = window; i < closes.length - window; i += 1) {
    const local = closes.slice(i - window, i + window + 1);
    if (closes[i] === Math.min(...local)) pivots.push(closes[i]);
  }

  if (!pivots.length) return [];

  // Cluster pivots within 2% of each other; a level touched once is a low, not
  // a level.
  const clusters: number[][] = [];
  for (const pivot of pivots.sort((a, b) => a - b)) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(pivot / last[0] - 1) < 0.02) last.push(pivot);
    else clusters.push([pivot]);
  }

  return clusters
    .filter((cluster) => cluster.length >= 2)
    .map((cluster) => {
      const level = cluster.reduce((total, value) => total + value, 0) / cluster.length;
      return build({
        type: 'support_candidate',
        version: '1.0.0',
        inputs: { touches: cluster.length, level },
        result: level,
        unit: 'price',
        assumptions: [
          'A swing low confirmed by five bars either side, clustered within 2%.',
          'This is where price turned before, which is not a promise that it will again.',
        ],
        evidenceIds,
        at,
      });
    });
}

export function trendClassification(
  closes: number[],
  at: string,
  evidenceIds: string[] = []
): CalculationResult {
  const warnings: string[] = [];
  let result: number | null = null;

  if (closes.length < 60) {
    warnings.push('Fewer than sixty bars — too short to describe a trend.');
  } else {
    const recent = closes.slice(-20).reduce((total, value) => total + value, 0) / 20;
    const older = closes.slice(-60, -40).reduce((total, value) => total + value, 0) / 20;
    result = older === 0 ? null : (recent / older - 1) * 100;
  }

  return build({
    type: 'trend_20_vs_60',
    version: '1.0.0',
    inputs: { observations: closes.length },
    result,
    unit: '%',
    assumptions: ['The last twenty closes against the twenty before the previous forty.'],
    warnings,
    evidenceIds,
    at,
  });
}

/* ------------------------------------------------------------------ Risk */

export function beta(
  assetCloses: number[],
  benchmarkCloses: number[],
  at: string,
  evidenceIds: string[] = []
): CalculationResult {
  const warnings: string[] = [];
  let result: number | null = null;

  const asset = returns(assetCloses);
  const benchmark = returns(benchmarkCloses);
  const n = Math.min(asset.length, benchmark.length);

  if (n < 60) {
    warnings.push('Fewer than sixty paired observations — the estimate is not stable.');
  } else {
    const a = asset.slice(-n);
    const b = benchmark.slice(-n);
    const meanA = a.reduce((total, value) => total + value, 0) / n;
    const meanB = b.reduce((total, value) => total + value, 0) / n;

    let covariance = 0;
    let varianceB = 0;
    for (let i = 0; i < n; i += 1) {
      covariance += (a[i] - meanA) * (b[i] - meanB);
      varianceB += (b[i] - meanB) ** 2;
    }

    result = varianceB === 0 ? null : covariance / varianceB;
  }

  return build({
    type: 'beta',
    version: '1.0.0',
    inputs: { observations: n },
    result,
    unit: 'ratio',
    assumptions: ['Daily simple returns against the benchmark supplied, over the common window.'],
    warnings,
    evidenceIds,
    at,
  });
}

/** Pulls the numeric value of a metric out of the fact set, or null. */
export function factValue(facts: FinancialFact[], metric: string, period?: string): number | null {
  const match = facts.find(
    (fact) => fact.metric === metric && (period === undefined || fact.period === period)
  );
  return match ? match.value : null;
}

export function factEvidence(facts: FinancialFact[], ...metrics: string[]): string[] {
  return [
    ...new Set(
      facts.filter((fact) => metrics.includes(fact.metric)).map((fact) => fact.sourceEvidenceId)
    ),
  ];
}
