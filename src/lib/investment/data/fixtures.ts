import type { EvidenceItem, FinancialFact, InstrumentIdentity } from '../types';

/**
 * Frozen fixtures: a fictional company, fully dated.
 *
 * Fictional rather than real, and frozen rather than fetched, for three
 * reasons. Tests that assert a number must not change when a market moves; a
 * demo must run with no paid API key; and nothing here can be mistaken for a
 * statement about a real listed company, which matters when the output is an
 * investment assessment.
 *
 * Every item carries both the period it describes and the date it was filed,
 * because the gap between those two is what the point-in-time guard exists to
 * respect — and a fixture set without that gap cannot test it.
 */

export const DEMO_INSTRUMENT: InstrumentIdentity = {
  instrumentId: 'demo:NORTHWIND',
  symbol: 'NWND',
  exchange: 'DEMO',
  mic: null,
  instrumentType: 'stock',
  companyName: 'Northwind Instruments (fictional)',
  country: 'US',
  currency: 'USD',
  isin: null,
  figi: null,
  sector: 'Industrials',
  industry: 'Precision instruments',
  providerSymbols: { fixture: 'NWND' },
  resolutionConfidence: 1,
};

/**
 * The dates matter more than the numbers.
 *
 * FY2025 ended on 31 December 2025 and was filed on 12 February 2026. An
 * analysis dated in January 2026 must see FY2024 and not FY2025, and the
 * lookahead test asserts exactly that.
 */
export const DEMO_EVIDENCE: EvidenceItem[] = [
  {
    evidenceId: 'ev_fy2023',
    sourceType: 'filing',
    sourceName: 'Northwind Instruments FY2023 annual report',
    sourceUrl: null,
    provider: 'fixture',
    documentTitle: 'Annual report 2023',
    publishedAt: '2024-02-14',
    filingDate: '2024-02-14',
    periodStart: '2023-01-01',
    periodEnd: '2023-12-31',
    retrievedAt: '2026-08-02',
    dataAsOf: '2023-12-31',
    excerpt: 'Revenue of $2,140m and operating income of $312m for the year ended 31 December 2023.',
    contentHash: 'fixture-fy2023',
    qualityTier: 1,
    primarySource: true,
  },
  {
    evidenceId: 'ev_fy2024',
    sourceType: 'filing',
    sourceName: 'Northwind Instruments FY2024 annual report',
    sourceUrl: null,
    provider: 'fixture',
    documentTitle: 'Annual report 2024',
    publishedAt: '2025-02-13',
    filingDate: '2025-02-13',
    periodStart: '2024-01-01',
    periodEnd: '2024-12-31',
    retrievedAt: '2026-08-02',
    dataAsOf: '2024-12-31',
    excerpt: 'Revenue of $2,455m and operating income of $381m for the year ended 31 December 2024.',
    contentHash: 'fixture-fy2024',
    qualityTier: 1,
    primarySource: true,
  },
  {
    evidenceId: 'ev_fy2025',
    sourceType: 'filing',
    sourceName: 'Northwind Instruments FY2025 annual report',
    sourceUrl: null,
    provider: 'fixture',
    documentTitle: 'Annual report 2025',
    // Filed six weeks after the period it covers. This gap is the whole point.
    publishedAt: '2026-02-12',
    filingDate: '2026-02-12',
    periodStart: '2025-01-01',
    periodEnd: '2025-12-31',
    retrievedAt: '2026-08-02',
    dataAsOf: '2025-12-31',
    excerpt: 'Revenue of $2,690m and operating income of $404m for the year ended 31 December 2025.',
    contentHash: 'fixture-fy2025',
    qualityTier: 1,
    primarySource: true,
  },
  {
    evidenceId: 'ev_quote',
    sourceType: 'exchange',
    sourceName: 'Demo exchange closing prices',
    sourceUrl: null,
    provider: 'fixture',
    documentTitle: 'Daily closes',
    publishedAt: '2026-08-01',
    filingDate: null,
    periodStart: '2025-08-01',
    periodEnd: '2026-08-01',
    retrievedAt: '2026-08-02',
    dataAsOf: '2026-08-01',
    excerpt: 'Closing price of $94.20 on 1 August 2026.',
    contentHash: 'fixture-quote',
    qualityTier: 2,
    primarySource: true,
  },
  {
    evidenceId: 'ev_news',
    sourceType: 'news',
    sourceName: 'Demo newswire',
    sourceUrl: null,
    provider: 'fixture',
    documentTitle: 'Northwind guides to slower instrument demand',
    publishedAt: '2026-07-18',
    filingDate: null,
    periodStart: null,
    periodEnd: null,
    retrievedAt: '2026-08-02',
    dataAsOf: '2026-07-18',
    excerpt:
      'Northwind said order intake in its calibration division slowed in the second quarter, and guided full-year revenue growth towards the lower end of its range.',
    contentHash: 'fixture-news',
    qualityTier: 4,
    primarySource: false,
  },
];

function fact(
  metric: string,
  value: number,
  period: string,
  evidenceId: string,
  unit = 'USD_millions'
): FinancialFact {
  // A spot price is not an annual period. Marking it as one put "point" at the
  // end of the sorted list of years and made it the latest reporting period,
  // which silently emptied every fundamental calculation.
  const periodType: FinancialFact['periodType'] = period === 'point' ? 'point' : 'annual';
  const filingDate = DEMO_EVIDENCE.find((item) => item.evidenceId === evidenceId)?.filingDate ?? null;

  return {
    factId: `fact_${metric}_${period}`,
    instrumentId: DEMO_INSTRUMENT.instrumentId,
    metric,
    value,
    unit,
    currency: 'USD',
    period,
    periodType,
    filingDate,
    sourceEvidenceId: evidenceId,
    provider: 'fixture',
    restated: false,
    confidence: 1,
  };
}

export const DEMO_FACTS: FinancialFact[] = [
  fact('revenue', 2140, 'FY2023', 'ev_fy2023'),
  fact('operating_income', 312, 'FY2023', 'ev_fy2023'),
  fact('net_income', 231, 'FY2023', 'ev_fy2023'),
  fact('gross_profit', 1027, 'FY2023', 'ev_fy2023'),

  fact('revenue', 2455, 'FY2024', 'ev_fy2024'),
  fact('operating_income', 381, 'FY2024', 'ev_fy2024'),
  fact('net_income', 288, 'FY2024', 'ev_fy2024'),
  fact('gross_profit', 1203, 'FY2024', 'ev_fy2024'),
  fact('operating_cash_flow', 402, 'FY2024', 'ev_fy2024'),
  fact('capex', 118, 'FY2024', 'ev_fy2024'),
  fact('total_debt', 640, 'FY2024', 'ev_fy2024'),
  fact('total_equity', 1490, 'FY2024', 'ev_fy2024'),
  fact('cash', 305, 'FY2024', 'ev_fy2024'),

  fact('revenue', 2690, 'FY2025', 'ev_fy2025'),
  fact('operating_income', 404, 'FY2025', 'ev_fy2025'),
  fact('net_income', 302, 'FY2025', 'ev_fy2025'),
  fact('gross_profit', 1291, 'FY2025', 'ev_fy2025'),
  fact('operating_cash_flow', 437, 'FY2025', 'ev_fy2025'),
  fact('capex', 131, 'FY2025', 'ev_fy2025'),
  fact('total_debt', 705, 'FY2025', 'ev_fy2025'),
  fact('total_equity', 1655, 'FY2025', 'ev_fy2025'),
  fact('cash', 288, 'FY2025', 'ev_fy2025'),
  fact('shares_outstanding', 148.2, 'FY2025', 'ev_fy2025', 'millions'),

  fact('price', 94.2, 'point', 'ev_quote', 'USD'),
];

/**
 * A deterministic daily close series.
 *
 * Generated from a fixed seed rather than stored as a thousand literals, and
 * shaped to contain something worth finding: a run-up, a drawdown, and two
 * separate lows near the same level so the support-candidate clustering has a
 * real cluster to find rather than a single point.
 */
export function demoSeries(): Array<{ date: string; close: number }> {
  const out: Array<{ date: string; close: number }> = [];
  let state = 20260801;
  const random = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };

  const start = Date.UTC(2025, 7, 1);
  let price = 78;

  for (let day = 0; day < 260; day += 1) {
    const date = new Date(start + day * 86_400_000);
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;

    const drift = day < 120 ? 0.0016 : day < 190 ? -0.0022 : 0.0011;
    price *= 1 + drift + (random() - 0.5) * 0.021;

    // Two visits to the same neighbourhood, which is what makes a level a level.
    if (day === 150) price = 82.4;
    if (day === 196) price = 82.9;

    out.push({ date: date.toISOString().slice(0, 10), close: Number(price.toFixed(2)) });
  }

  return out;
}

/** The benchmark, for beta. Same generator, different seed and lower variance. */
export function demoBenchmark(): Array<{ date: string; close: number }> {
  const series = demoSeries();
  let state = 777;
  const random = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };

  let level = 4200;
  return series.map((point) => {
    level *= 1 + 0.0006 + (random() - 0.5) * 0.011;
    return { date: point.date, close: Number(level.toFixed(2)) };
  });
}
