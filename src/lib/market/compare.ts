/**
 * Compare assets — the instruments, and the metrics that suit them.
 *
 * A research tool rather than a terminal: two to four instruments of the *same*
 * asset type, the handful of measures that actually separate them, and a
 * plain-language read at the end. Mixing types is refused rather than supported,
 * because a table with a P/E ratio in one column and an expense ratio in another
 * is two tables printed on top of each other.
 *
 * The metric set therefore belongs to the type, not to the screen. Stocks are
 * compared on valuation and drawdown, ETFs on cost and concentration, crypto on
 * volatility and issuance — and the same component renders all three because the
 * rows are data.
 *
 * Every number is illustrative and the screen carries a `Sample data` chip that
 * says so. The series are monthly points already expressed as a percentage from
 * a common start, which is what makes the chart a comparison: instruments with
 * very different prices are all rebased to zero, so what is being read is the
 * shape rather than the size.
 */

export type AssetKind = 'stocks' | 'etfs' | 'crypto';

/** How a value is printed, and which direction counts as better. */
export type MetricRow = {
  key: string;
  label: string;
  hint: string;
  format: '%' | 'bn' | 'm' | 'x' | 'shares' | 'count';
  /** `null` where "better" is not a claim this portal is willing to make. */
  better: 'high' | 'low' | null;
};

export type Instrument = {
  name: string;
  market: string;
  /** Rebased to 0 at the first point, twelve months of monthly readings. */
  series: number[];
  metrics: Record<string, number>;
};

export type CompareSet = {
  label: string;
  note: string;
  base: string[];
  rows: MetricRow[];
  items: Record<string, Instrument>;
  takeaways: string[];
  prompts: string[];
};

/** The four line colours, in the order instruments are added. */
export const SERIES_COLORS = ['var(--tn-mint)', 'var(--tn-cyan)', 'var(--tn-amber-text)', 'var(--tn-purple)'];

export const COMPARE_SETS: Record<AssetKind, CompareSet> = {
  stocks: {
    label: 'NVDA vs AMD vs AVGO',
    note: 'Metrics shown for stocks',
    base: ['NVDA', 'AMD', 'AVGO'],
    rows: [
      { key: 'p1y', label: 'Performance 1Y', hint: 'Price only, no dividends', format: '%', better: 'high' },
      { key: 'ytd', label: 'Performance YTD', hint: 'Since 1 January', format: '%', better: 'high' },
      { key: 'vol', label: 'Volatility 30d', hint: 'Annualised', format: '%', better: 'low' },
      { key: 'dd', label: 'Max drawdown 1Y', hint: 'Largest peak-to-trough fall', format: '%', better: 'low' },
      { key: 'cap', label: 'Market cap', hint: 'Company size', format: 'bn', better: null },
      { key: 'pe', label: 'P/E forward', hint: 'Price vs expected earnings', format: 'x', better: 'low' },
      { key: 'dy', label: 'Dividend yield', hint: 'Annual, trailing', format: '%', better: null },
      { key: 'adv', label: 'Avg daily volume', hint: 'Liquidity', format: 'shares', better: null },
    ],
    items: {
      NVDA: {
        name: 'Nvidia',
        market: 'Nasdaq · Stock',
        series: [0, 6, 14, 9, 22, 31, 27, 38, 44, 39, 52, 61, 58],
        metrics: { p1y: 58, ytd: 41.8, vol: 38, dd: -22, cap: 4400, pe: 38.2, dy: 0.02, adv: 182 },
      },
      AMD: {
        name: 'Advanced Micro',
        market: 'Nasdaq · Stock',
        series: [0, 4, 9, 3, 11, 16, 9, 14, 21, 16, 24, 27, 22],
        metrics: { p1y: 22, ytd: 18.2, vol: 44, dd: -34, cap: 266, pe: 31.5, dy: 0, adv: 64 },
      },
      AVGO: {
        name: 'Broadcom',
        market: 'Nasdaq · Stock',
        series: [0, 3, 7, 6, 12, 18, 21, 19, 26, 30, 28, 33, 31],
        metrics: { p1y: 31, ytd: 27.6, vol: 29, dd: -19, cap: 1160, pe: 29.4, dy: 1.2, adv: 28 },
      },
      TSM: {
        name: 'TSMC',
        market: 'NYSE · Stock',
        series: [0, 4, 9, 7, 15, 21, 18, 26, 31, 28, 37, 42, 44],
        metrics: { p1y: 44, ytd: 33.5, vol: 31, dd: -21, cap: 980, pe: 24.6, dy: 1.1, adv: 41 },
      },
      INTC: {
        name: 'Intel',
        market: 'Nasdaq · Stock',
        series: [0, -2, -5, -9, -4, -8, -12, -15, -11, -14, -10, -13, -12],
        metrics: { p1y: -12, ytd: -8.4, vol: 41, dd: -38, cap: 96, pe: 22.1, dy: 1.9, adv: 74 },
      },
      MU: {
        name: 'Micron',
        market: 'Nasdaq · Stock',
        series: [0, 3, 8, 1, 10, 15, 7, 13, 18, 12, 21, 24, 19],
        metrics: { p1y: 19, ytd: 12.7, vol: 47, dd: -36, cap: 128, pe: 14.8, dy: 0.5, adv: 52 },
      },
      ASML: {
        name: 'ASML',
        market: 'Nasdaq · Stock',
        series: [0, 2, 6, -1, 4, 9, 3, 6, 11, 7, 12, 10, 8],
        metrics: { p1y: 8, ytd: 4.2, vol: 33, dd: -27, cap: 340, pe: 28.9, dy: 1.0, adv: 6 },
      },
    },
    takeaways: [
      'NVDA leads on 12-month performance, but it also carries the widest daily swings of the three.',
      'AMD has the deepest drawdown in the period — same theme, noticeably rougher ride.',
      'AVGO is the only one of the three paying a meaningful dividend, and trades on the lowest forward multiple.',
    ],
    prompts: [
      'Why did AMD fall further than NVDA?',
      'Which of these is least volatile?',
      'Explain forward P/E simply',
    ],
  },

  etfs: {
    label: 'SPY vs QQQ vs VOO',
    note: 'Metrics shown for ETFs',
    base: ['SPY', 'QQQ', 'VOO'],
    rows: [
      { key: 'p1y', label: 'Performance 1Y', hint: 'Price only, no distributions', format: '%', better: 'high' },
      { key: 'ytd', label: 'Performance YTD', hint: 'Since 1 January', format: '%', better: 'high' },
      { key: 'er', label: 'Expense ratio', hint: 'Annual cost', format: '%', better: 'low' },
      { key: 'aum', label: 'AUM', hint: 'Fund size', format: 'bn', better: null },
      { key: 'hold', label: 'Holdings', hint: 'Number of positions', format: 'count', better: 'high' },
      { key: 'top10', label: 'Top-10 concentration', hint: 'Share of the largest ten', format: '%', better: 'low' },
      { key: 'dy', label: 'Distribution yield', hint: 'Trailing 12 months', format: '%', better: null },
      { key: 'vol', label: 'Volatility 30d', hint: 'Annualised', format: '%', better: 'low' },
    ],
    items: {
      SPY: {
        name: 'S&P 500 ETF',
        market: 'NYSE · ETF',
        series: [0, 2, 5, 3, 7, 9, 8, 11, 13, 12, 15, 17, 16],
        metrics: { p1y: 16, ytd: 11.8, er: 0.09, aum: 612, hold: 503, top10: 36, dy: 1.24, vol: 12 },
      },
      QQQ: {
        name: 'Nasdaq 100 ETF',
        market: 'Nasdaq · ETF',
        series: [0, 3, 7, 4, 10, 13, 11, 16, 19, 17, 22, 25, 24],
        metrics: { p1y: 24, ytd: 16.4, er: 0.2, aum: 318, hold: 101, top10: 51, dy: 0.55, vol: 17 },
      },
      VOO: {
        name: 'Vanguard S&P 500',
        market: 'NYSE · ETF',
        series: [0, 2, 5, 3, 7, 9, 8, 11, 13, 12, 15, 17, 16],
        metrics: { p1y: 16, ytd: 11.9, er: 0.03, aum: 548, hold: 504, top10: 36, dy: 1.28, vol: 12 },
      },
      VTI: {
        name: 'Vanguard Total Market',
        market: 'NYSE · ETF',
        series: [0, 2, 5, 2, 6, 8, 7, 10, 12, 11, 14, 16, 15],
        metrics: { p1y: 15, ytd: 11.2, er: 0.03, aum: 480, hold: 3600, top10: 31, dy: 1.29, vol: 12 },
      },
      VWCE: {
        name: 'Vanguard FTSE All-World',
        market: 'Xetra · ETF',
        series: [0, 2, 4, 2, 5, 7, 6, 9, 10, 9, 12, 14, 13],
        metrics: { p1y: 13, ytd: 9.8, er: 0.22, aum: 28, hold: 3700, top10: 22, dy: 1.6, vol: 11 },
      },
      IWDA: {
        name: 'iShares Core MSCI World',
        market: 'LSE · ETF',
        series: [0, 2, 4, 2, 6, 7, 6, 9, 11, 10, 12, 14, 13],
        metrics: { p1y: 13, ytd: 10.1, er: 0.2, aum: 92, hold: 1400, top10: 24, dy: 1.4, vol: 11 },
      },
      AGG: {
        name: 'iShares Core US Aggregate',
        market: 'NYSE · ETF',
        series: [0, 1, 0, -1, 1, 2, 1, 0, 2, 1, 3, 2, 2],
        metrics: { p1y: 2, ytd: 1.4, er: 0.03, aum: 118, hold: 12000, top10: 3, dy: 3.8, vol: 5 },
      },
    },
    takeaways: [
      'SPY and VOO track the same index — the real difference is cost: 0.09% against 0.03%.',
      'QQQ outperformed over the year, but half its weight sits in ten companies.',
      'On a €10,000 position the fee gap between VOO and QQQ is roughly €17 a year.',
    ],
    prompts: [
      'SPY or VOO — does it matter?',
      'How much overlap do these three have?',
      'What does 0.20% cost me over 20 years?',
    ],
  },

  crypto: {
    label: 'BTC vs ETH vs SOL',
    note: 'Metrics shown for crypto assets',
    base: ['BTC', 'ETH', 'SOL'],
    rows: [
      { key: 'p1y', label: 'Performance 1Y', hint: 'Price only', format: '%', better: 'high' },
      { key: 'ytd', label: 'Performance YTD', hint: 'Since 1 January', format: '%', better: 'high' },
      { key: 'vol', label: 'Volatility 30d', hint: 'Annualised', format: '%', better: 'low' },
      { key: 'dd', label: 'Max drawdown 1Y', hint: 'Largest peak-to-trough fall', format: '%', better: 'low' },
      { key: 'cap', label: 'Market cap', hint: 'Circulating supply', format: 'bn', better: null },
      { key: 'v24', label: '24h volume', hint: 'Liquidity', format: 'bn', better: 'high' },
      { key: 'iss', label: 'Supply issuance', hint: 'New coins per year', format: '%', better: 'low' },
      { key: 'fees', label: 'Fees paid 30d', hint: 'Network usage', format: 'm', better: null },
    ],
    items: {
      BTC: {
        name: 'Bitcoin',
        market: 'Crypto',
        series: [0, 9, 18, 12, 26, 34, 29, 41, 48, 44, 57, 66, 71],
        metrics: { p1y: 71, ytd: 42, vol: 46, dd: -28, cap: 2340, v24: 42, iss: 0.8, fees: 210 },
      },
      ETH: {
        name: 'Ethereum',
        market: 'Crypto',
        series: [0, 6, 12, 4, 17, 23, 15, 26, 31, 24, 36, 42, 39],
        metrics: { p1y: 39, ytd: 21, vol: 58, dd: -41, cap: 515, v24: 21, iss: 0.4, fees: 340 },
      },
      SOL: {
        name: 'Solana',
        market: 'Crypto',
        series: [0, 12, 26, 14, 38, 51, 36, 58, 72, 61, 84, 96, 88],
        metrics: { p1y: 88, ytd: 55, vol: 79, dd: -56, cap: 118, v24: 7.4, iss: 4.6, fees: 48 },
      },
      XRP: {
        name: 'XRP',
        market: 'Crypto',
        series: [0, 5, 11, 6, 16, 22, 14, 24, 29, 22, 31, 36, 34],
        metrics: { p1y: 34, ytd: 18, vol: 66, dd: -49, cap: 168, v24: 4.2, iss: 0, fees: 12 },
      },
      ADA: {
        name: 'Cardano',
        market: 'Crypto',
        series: [0, 3, 7, 1, 9, 13, 5, 11, 16, 8, 15, 14, 12],
        metrics: { p1y: 12, ytd: 6, vol: 71, dd: -58, cap: 32, v24: 1.1, iss: 2.1, fees: 3 },
      },
      LINK: {
        name: 'Chainlink',
        market: 'Crypto',
        series: [0, 4, 9, 3, 13, 18, 11, 19, 24, 17, 26, 30, 27],
        metrics: { p1y: 27, ytd: 14, vol: 74, dd: -52, cap: 19, v24: 0.9, iss: 1.4, fees: 5 },
      },
      AVAX: {
        name: 'Avalanche',
        market: 'Crypto',
        series: [0, 3, 6, -2, 7, 11, 2, 8, 13, 4, 11, 12, 9],
        metrics: { p1y: 9, ytd: 3, vol: 82, dd: -61, cap: 14, v24: 0.7, iss: 3.2, fees: 4 },
      },
    },
    takeaways: [
      'SOL delivered the strongest 12-month move and the deepest drawdown — the two go together.',
      'BTC is roughly four times the size of ETH and trades with about half the volatility of SOL.',
      'Higher issuance means more new supply arriving each year, which matters over long holding periods.',
    ],
    prompts: [
      'Why is SOL more volatile than BTC?',
      'What does supply issuance mean for me?',
      'How correlated are these three?',
    ],
  },
};

/** Signed values are the ones where the sign is the information. */
const SIGNED = new Set(['p1y', 'ytd', 'dd']);

export function isSigned(key: string): boolean {
  return SIGNED.has(key);
}

/** The real minus, never the hyphen — this is a number being read, not code. */
export function formatMetric(value: number, format: MetricRow['format'], signed: boolean): string {
  if (format === '%') {
    const sign = signed && value > 0 ? '+' : value < 0 ? '−' : '';
    const magnitude = Math.abs(value);
    const digits = magnitude < 10 ? 2 : 1;
    return `${sign}${magnitude.toFixed(digits).replace(/\.00$/, '')}%`;
  }
  if (format === 'bn') return value >= 1000 ? `$${(value / 1000).toFixed(2)}T` : `$${value}bn`;
  if (format === 'm') return `$${value}m`;
  if (format === 'x') return value.toFixed(1);
  if (format === 'shares') return `${value}M`;
  return value >= 1000 ? value.toLocaleString('en-US') : String(value);
}

/**
 * Which cell in a row is the best one, or null where the row does not say.
 *
 * Drawdown is the awkward case and the reason this is a function rather than a
 * comparison inline: "better" there means the *least negative*, so the smallest
 * fall is the largest number. Treating it like the other `low` rows would have
 * highlighted the worst drawdown as the best result.
 */
export function bestValue(values: number[], better: MetricRow['better'], key: string): number | null {
  if (!better || values.length === 0) return null;
  if (better === 'high') return Math.max(...values);
  return key === 'dd' ? Math.max(...values) : Math.min(...values);
}

/**
 * The set an instrument belongs to.
 *
 * A comparison holds one type at a time, so this is how an arriving URL is
 * resolved: the first symbol it recognises decides the set, and anything from
 * another type is dropped rather than mixed in.
 */
export function setForSymbol(symbol: string): AssetKind | null {
  const upper = symbol.trim().toUpperCase();
  for (const kind of Object.keys(COMPARE_SETS) as AssetKind[]) {
    if (upper in COMPARE_SETS[kind].items) return kind;
  }
  return null;
}

/**
 * What a `?symbols=` parameter asks for.
 *
 * Written by anybody, so it is parsed rather than trusted: unknown tickers are
 * dropped, duplicates collapsed, mixed types refused, and fewer than two means
 * fall back to the set's own base. One column is not a comparison and five is a
 * table nobody reads across.
 */
export function parseSymbols(raw: unknown): { kind: AssetKind; symbols: string[] } | null {
  if (typeof raw !== 'string') return null;

  const wanted = raw.split(',').map((part) => part.trim().toUpperCase()).filter(Boolean);
  if (wanted.length === 0) return null;

  const kind = wanted.map(setForSymbol).find(Boolean) ?? null;
  if (!kind) return null;

  const items = COMPARE_SETS[kind].items;
  const symbols: string[] = [];
  for (const symbol of wanted) {
    if (symbol in items && !symbols.includes(symbol)) symbols.push(symbol);
  }

  if (symbols.length < 2) return { kind, symbols: COMPARE_SETS[kind].base };
  return { kind, symbols: symbols.slice(0, 4) };
}
