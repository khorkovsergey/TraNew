/**
 * What Market Overview shows, per asset class.
 *
 * Eight views, and choosing one swaps all of them together: the pulse cards,
 * what moved, what to watch, the Ideas card and the Voyager prompts. A strip
 * that changed only the cards would be a filter on one block rather than a
 * change of subject, and the reader would be left comparing bond prompts
 * against crypto cards.
 *
 * Every figure here is illustrative. The screen says so — the `Sample data`
 * chip beside the heading is not decoration and stays until a real feed is
 * wired. Numbers that look like quotes and are not are the one thing a market
 * page cannot get away with, so they are labelled rather than hidden.
 *
 * The sparkline series are eight points on an arbitrary scale. They are
 * normalised for drawing, so only their shape carries meaning, and the shape is
 * chosen to agree with the change beside it: a card cannot show a falling line
 * against a rising number.
 */

export type AssetView =
  | 'global'
  | 'stocks'
  | 'etfs'
  | 'indices'
  | 'crypto'
  | 'forex'
  | 'futures'
  | 'bonds';

export type PulseCard = {
  name: string;
  /** The small upper-case tag: where this sits — "US", "Crypto", "Sector". */
  group: string;
  value: string;
  /** A change, or a short phrase where the view has no number to change. */
  change: string;
  series: number[];
};

export type MovedRow = {
  name: string;
  kind: string;
  change: string;
  /** The sentence. A number without one is the thing this screen refuses. */
  why: string;
};

export type WatchRow = { label: string; when: string };

export type MarketView = {
  title: string;
  pulse: PulseCard[];
  moved: MovedRow[];
  watch: WatchRow[];
  idea: { title: string; sub: string };
  prompts: string[];
};

export const ASSET_VIEWS: Array<{ id: AssetView; label: string }> = [
  { id: 'global', label: 'Global overview' },
  { id: 'stocks', label: 'Stocks' },
  { id: 'etfs', label: 'ETFs' },
  { id: 'indices', label: 'Indices' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'forex', label: 'Forex' },
  { id: 'futures', label: 'Futures & Commodities' },
  { id: 'bonds', label: 'Bonds' },
];

export const MARKET_VIEWS: Record<AssetView, MarketView> = {
  global: {
    title: 'Global markets',
    pulse: [
      { name: 'S&P 500', group: 'US', value: '5,842.10', change: '+0.62%', series: [4, 5, 4, 6, 7, 6, 8, 9] },
      { name: 'Nasdaq 100', group: 'US', value: '21,104.6', change: '+0.94%', series: [3, 4, 4, 5, 6, 8, 8, 10] },
      { name: 'Euro Stoxx 50', group: 'Europe', value: '5,318.40', change: '+0.21%', series: [6, 6, 5, 6, 7, 6, 7, 7] },
      { name: 'Nikkei 225', group: 'Asia', value: '41,265', change: '−0.38%', series: [8, 8, 7, 7, 6, 6, 5, 5] },
      { name: 'Bitcoin', group: 'Crypto', value: '$118,430', change: '+2.10%', series: [4, 5, 5, 7, 6, 8, 9, 11] },
      { name: 'EUR/USD', group: 'FX', value: '1.0942', change: '−0.15%', series: [7, 7, 6, 7, 6, 6, 5, 6] },
      { name: 'Brent crude', group: 'Commodities', value: '$73.85', change: '+1.35%', series: [5, 5, 6, 6, 7, 7, 8, 8] },
      { name: 'US 10Y', group: 'Bonds', value: '4.18%', change: '+4 bps', series: [4, 4, 5, 5, 6, 6, 7, 7] },
    ],
    moved: [
      {
        name: 'Nvidia',
        kind: 'Stock',
        change: '+4.2%',
        why: 'Supplier orders point to another strong data-centre quarter; the whole AI hardware complex followed.',
      },
      {
        name: 'Brent crude',
        kind: 'Commodity',
        change: '+1.4%',
        why: 'Supply disruption headlines out of the Gulf pushed energy names higher across Europe.',
      },
      {
        name: 'US 10-year yield',
        kind: 'Rates',
        change: '+4 bps',
        why: 'Hotter services inflation trimmed the odds of a September rate cut.',
      },
      {
        name: 'Nikkei 225',
        kind: 'Index',
        change: '−0.4%',
        why: 'A stronger yen weighed on Japanese exporters for a third session.',
      },
    ],
    watch: [
      { label: 'US CPI release', when: 'Thu 14:30' },
      { label: 'Nvidia earnings', when: 'Next Wed' },
      { label: 'ECB meeting minutes', when: 'Fri 13:30' },
      { label: 'China trade balance', when: 'Mon' },
    ],
    idea: {
      title: 'Rate cuts keep slipping — who pays?',
      sub: 'Three investors on what a higher-for-longer path does to duration and dividend names.',
    },
    prompts: [
      'Why are US indices up while Asia is down?',
      'What is driving the 10-year yield today?',
      'Summarise this week for a long-term investor',
    ],
  },

  stocks: {
    title: 'Stocks',
    pulse: [
      { name: 'Technology', group: 'Sector', value: '+1.42%', change: '5 of 6 sub-sectors up', series: [4, 5, 5, 7, 7, 8, 9, 10] },
      { name: 'Energy', group: 'Sector', value: '+1.10%', change: 'Led by oil majors', series: [5, 5, 6, 6, 7, 7, 8, 8] },
      { name: 'Financials', group: 'Sector', value: '+0.24%', change: 'Banks flat, insurers up', series: [6, 6, 6, 7, 6, 7, 7, 7] },
      { name: 'Healthcare', group: 'Sector', value: '−0.52%', change: 'Pharma dragged', series: [8, 7, 7, 6, 6, 6, 5, 5] },
      { name: 'Utilities', group: 'Sector', value: '−0.31%', change: 'Rate sensitive', series: [7, 7, 6, 6, 6, 5, 5, 5] },
      { name: 'Consumer', group: 'Sector', value: '+0.18%', change: 'Staples outperform', series: [6, 6, 6, 6, 7, 6, 7, 7] },
      { name: 'Most active', group: 'US', value: 'NVDA', change: '182M shares', series: [4, 6, 5, 7, 8, 7, 9, 9] },
      { name: 'Breadth', group: 'S&P 500', value: '318 / 182', change: 'Advancers / decliners', series: [5, 6, 6, 7, 7, 8, 8, 9] },
    ],
    moved: [
      {
        name: 'Nvidia',
        kind: 'NVDA',
        change: '+4.2%',
        why: 'Data-centre order commentary from two suppliers ahead of next week’s results.',
      },
      {
        name: 'Novo Nordisk',
        kind: 'NOVO-B',
        change: '−3.1%',
        why: 'Competitor trial data landed better than expected in the obesity segment.',
      },
      { name: 'Shell', kind: 'SHEL', change: '+2.4%', why: 'Crude strength plus a raised buyback pace.' },
      {
        name: 'Walmart',
        kind: 'WMT',
        change: '+1.1%',
        why: 'Retail spending data pointed to a resilient low-end consumer.',
      },
    ],
    watch: [
      { label: 'Nvidia earnings', when: 'Next Wed' },
      { label: 'US retail sales', when: 'Tue' },
      { label: 'Buyback window opens', when: 'Aug 18' },
      { label: 'Index rebalance', when: 'Sep 19' },
    ],
    idea: {
      title: 'The market is narrow again',
      sub: 'Six names explain most of the index move this month — and what that means for risk.',
    },
    prompts: [
      'Which sectors led today and why?',
      'Show me large caps down on strong earnings',
      'How concentrated is the S&P 500 right now?',
    ],
  },

  etfs: {
    title: 'ETFs',
    pulse: [
      { name: 'SPY', group: 'US broad', value: '$583.10', change: '+0.61%', series: [5, 5, 6, 6, 7, 7, 8, 9] },
      { name: 'QQQ', group: 'US tech', value: '$512.44', change: '+0.93%', series: [4, 5, 5, 6, 7, 8, 8, 10] },
      { name: 'VWCE', group: 'World', value: '€132.80', change: '+0.48%', series: [5, 6, 6, 6, 7, 7, 8, 8] },
      { name: 'IEUR', group: 'Europe', value: '$61.20', change: '+0.22%', series: [6, 6, 6, 7, 6, 7, 7, 7] },
      { name: 'EEM', group: 'Emerging', value: '$46.15', change: '−0.27%', series: [7, 7, 6, 6, 6, 6, 5, 6] },
      { name: 'AGG', group: 'Bonds', value: '$99.02', change: '−0.18%', series: [7, 6, 6, 6, 6, 5, 5, 5] },
      { name: 'GLD', group: 'Gold', value: '$248.70', change: '+0.71%', series: [5, 5, 6, 6, 7, 7, 7, 8] },
      { name: 'Flows 5d', group: 'Europe UCITS', value: '+€2.4bn', change: 'Into world equity', series: [4, 5, 6, 6, 7, 8, 8, 9] },
    ],
    moved: [
      {
        name: 'Semiconductor ETFs',
        kind: 'Theme',
        change: '+3.0%',
        why: 'The AI hardware bid pulled every chip basket with it.',
      },
      {
        name: 'European defence',
        kind: 'Theme',
        change: '+1.8%',
        why: 'Budget headlines kept the multi-month trend going.',
      },
      {
        name: 'Long-duration treasuries',
        kind: 'Bonds',
        change: '−0.9%',
        why: 'Yields rose after the services inflation print.',
      },
      {
        name: 'Gold miners',
        kind: 'Theme',
        change: '+1.2%',
        why: 'Gold held above its range high for a second week.',
      },
    ],
    watch: [
      { label: 'Monthly flow report', when: 'Mon' },
      { label: 'Fed minutes', when: 'Wed' },
      { label: 'Index rebalance', when: 'Sep 19' },
      { label: 'Distribution dates', when: 'Sep 1' },
    ],
    idea: {
      title: 'One world ETF or three regional ones?',
      sub: 'What the cost and overlap actually look like once you hold both.',
    },
    prompts: [
      'Compare SPY, QQQ and VOO',
      'Which ETFs saw the largest inflows this week?',
      'What does an expense ratio really cost me?',
    ],
  },

  indices: {
    title: 'Indices',
    pulse: [
      { name: 'S&P 500', group: 'US', value: '5,842.10', change: '+0.62%', series: [4, 5, 5, 6, 7, 7, 8, 9] },
      { name: 'Dow Jones', group: 'US', value: '41,980', change: '+0.34%', series: [5, 5, 6, 6, 6, 7, 7, 8] },
      { name: 'Nasdaq 100', group: 'US', value: '21,104.6', change: '+0.94%', series: [4, 4, 5, 6, 7, 8, 9, 10] },
      { name: 'DAX', group: 'Europe', value: '19,240', change: '+0.28%', series: [6, 6, 6, 7, 7, 7, 7, 8] },
      { name: 'FTSE 100', group: 'Europe', value: '8,412', change: '+0.44%', series: [5, 6, 6, 6, 7, 7, 7, 8] },
      { name: 'Nikkei 225', group: 'Asia', value: '41,265', change: '−0.38%', series: [8, 8, 7, 7, 6, 6, 6, 5] },
      { name: 'Hang Seng', group: 'Asia', value: '18,730', change: '−0.62%', series: [8, 7, 7, 6, 6, 6, 5, 5] },
      { name: 'VIX', group: 'Volatility', value: '14.20', change: '−3.1%', series: [8, 7, 7, 6, 6, 5, 5, 4] },
    ],
    moved: [
      {
        name: 'Nasdaq 100',
        kind: 'Index',
        change: '+0.9%',
        why: 'Semis carried the index; breadth was narrow again.',
      },
      {
        name: 'Hang Seng',
        kind: 'Index',
        change: '−0.6%',
        why: 'Property developers fell after weak new-home sales data.',
      },
      {
        name: 'FTSE 100',
        kind: 'Index',
        change: '+0.4%',
        why: 'Energy and mining weight paid off on the commodity bid.',
      },
      {
        name: 'VIX',
        kind: 'Volatility',
        change: '−3.1%',
        why: 'Options demand cooled into a quiet macro window.',
      },
    ],
    watch: [
      { label: 'US CPI release', when: 'Thu 14:30' },
      { label: 'Quad witching', when: 'Sep 19' },
      { label: 'BoJ decision', when: 'Sep 20' },
      { label: 'Index rebalance', when: 'Sep 19' },
    ],
    idea: {
      title: 'When the index and the average stock disagree',
      sub: 'Equal weight vs cap weight, and what the gap has meant historically.',
    },
    prompts: [
      'Why is the Nasdaq outperforming the Dow?',
      'What is the VIX telling me today?',
      'Compare US and European index setups',
    ],
  },

  crypto: {
    title: 'Crypto',
    pulse: [
      { name: 'Bitcoin', group: 'BTC', value: '$118,430', change: '+2.10%', series: [4, 5, 5, 7, 6, 8, 9, 11] },
      { name: 'Ethereum', group: 'ETH', value: '$4,265', change: '+1.62%', series: [5, 5, 6, 6, 7, 8, 8, 9] },
      { name: 'Solana', group: 'SOL', value: '$214.30', change: '+3.44%', series: [4, 5, 6, 6, 8, 8, 9, 11] },
      { name: 'Total market cap', group: 'Global', value: '$3.68T', change: '+1.9%', series: [5, 5, 6, 7, 7, 8, 8, 9] },
      { name: 'BTC dominance', group: 'Share', value: '56.4%', change: '+0.3 pp', series: [6, 6, 6, 7, 7, 7, 7, 8] },
      { name: 'Stablecoin supply', group: 'Liquidity', value: '$182bn', change: '+0.8%', series: [6, 6, 7, 7, 7, 7, 8, 8] },
      { name: 'ETF flows 5d', group: 'Spot BTC', value: '+$940m', change: 'Four green days', series: [4, 5, 6, 6, 7, 8, 8, 9] },
      { name: 'Funding rate', group: 'Perps', value: '0.014%', change: 'Neutral', series: [6, 6, 6, 6, 7, 6, 7, 7] },
    ],
    moved: [
      {
        name: 'Solana',
        kind: 'SOL',
        change: '+3.4%',
        why: 'Network activity hit a monthly high as fees stayed low.',
      },
      {
        name: 'Bitcoin',
        kind: 'BTC',
        change: '+2.1%',
        why: 'Spot ETF inflows continued for a fourth straight session.',
      },
      {
        name: 'Ethereum L2 basket',
        kind: 'Theme',
        change: '+2.8%',
        why: 'A fee-reduction upgrade shipped on schedule.',
      },
      {
        name: 'Memecoins',
        kind: 'Theme',
        change: '−4.6%',
        why: 'Speculative flow rotated back into majors.',
      },
    ],
    watch: [
      { label: 'Spot ETF flow update', when: 'Daily 22:00' },
      { label: 'Options expiry', when: 'Fri' },
      { label: 'Network upgrade', when: 'Aug 22' },
      { label: 'US CPI release', when: 'Thu 14:30' },
    ],
    idea: {
      title: 'What ETF flows changed about bitcoin',
      sub: 'Two years of spot access, and what it did to volatility and correlation.',
    },
    prompts: [
      'Why is bitcoin up but altcoins are not?',
      'How correlated is crypto with the Nasdaq now?',
      'Explain funding rates simply',
    ],
  },

  forex: {
    title: 'Forex',
    pulse: [
      { name: 'EUR/USD', group: 'Major', value: '1.0942', change: '−0.15%', series: [7, 7, 6, 7, 6, 6, 6, 5] },
      { name: 'GBP/USD', group: 'Major', value: '1.2884', change: '−0.09%', series: [7, 7, 7, 6, 7, 6, 6, 6] },
      { name: 'USD/JPY', group: 'Major', value: '146.20', change: '−0.52%', series: [8, 8, 7, 7, 6, 6, 5, 5] },
      { name: 'USD/CHF', group: 'Major', value: '0.8612', change: '+0.11%', series: [6, 6, 6, 6, 7, 7, 7, 7] },
      { name: 'AUD/USD', group: 'Commodity', value: '0.6702', change: '+0.27%', series: [5, 6, 6, 6, 7, 7, 7, 8] },
      { name: 'USD/CNH', group: 'Asia', value: '7.1840', change: '+0.08%', series: [6, 6, 7, 6, 7, 7, 7, 7] },
      { name: 'Dollar index', group: 'DXY', value: '103.42', change: '+0.18%', series: [6, 6, 6, 7, 7, 7, 7, 8] },
      { name: 'FX volatility', group: 'CVIX', value: '7.10', change: '−1.4%', series: [7, 7, 6, 6, 6, 5, 5, 5] },
    ],
    moved: [
      {
        name: 'USD/JPY',
        kind: 'Major',
        change: '−0.5%',
        why: 'Rate-differential narrowing kept the yen bid for a third session.',
      },
      {
        name: 'Dollar index',
        kind: 'DXY',
        change: '+0.2%',
        why: 'Firmer US services inflation supported front-end yields.',
      },
      {
        name: 'AUD/USD',
        kind: 'Commodity FX',
        change: '+0.3%',
        why: 'Iron ore and copper strength lifted the Aussie.',
      },
      {
        name: 'EUR/USD',
        kind: 'Major',
        change: '−0.2%',
        why: 'Soft German industrial orders kept the euro capped.',
      },
    ],
    watch: [
      { label: 'US CPI release', when: 'Thu 14:30' },
      { label: 'BoJ decision', when: 'Sep 20' },
      { label: 'ECB minutes', when: 'Fri 13:30' },
      { label: 'Jackson Hole', when: 'Aug 22' },
    ],
    idea: {
      title: 'The yen carry unwind, one year on',
      sub: 'What positioning data says about the next leg.',
    },
    prompts: [
      'Why is the yen strengthening?',
      'How do rate differentials drive FX?',
      'What moves EUR/USD this week?',
    ],
  },

  futures: {
    title: 'Futures & Commodities',
    pulse: [
      { name: 'Brent crude', group: 'Energy', value: '$73.85', change: '+1.35%', series: [5, 5, 6, 6, 7, 7, 8, 8] },
      { name: 'WTI crude', group: 'Energy', value: '$70.12', change: '+1.28%', series: [5, 5, 6, 6, 7, 7, 7, 8] },
      { name: 'Natural gas', group: 'Energy', value: '$2.84', change: '−2.10%', series: [8, 7, 7, 6, 6, 5, 5, 4] },
      { name: 'Gold', group: 'Metals', value: '$2,486', change: '+0.68%', series: [5, 6, 6, 6, 7, 7, 7, 8] },
      { name: 'Silver', group: 'Metals', value: '$28.94', change: '+0.92%', series: [5, 5, 6, 7, 7, 7, 8, 8] },
      { name: 'Copper', group: 'Metals', value: '$4.28', change: '+1.04%', series: [5, 6, 6, 6, 7, 7, 8, 8] },
      { name: 'Wheat', group: 'Agriculture', value: '$542', change: '−0.74%', series: [7, 7, 6, 6, 6, 6, 5, 5] },
      { name: 'S&P futures', group: 'Index', value: '5,851', change: '+0.58%', series: [5, 5, 6, 6, 7, 7, 8, 8] },
    ],
    moved: [
      {
        name: 'Brent crude',
        kind: 'Energy',
        change: '+1.4%',
        why: 'Supply disruption headlines out of the Gulf.',
      },
      {
        name: 'Natural gas',
        kind: 'Energy',
        change: '−2.1%',
        why: 'Storage build came in above the five-year average.',
      },
      {
        name: 'Copper',
        kind: 'Metals',
        change: '+1.0%',
        why: 'Chinese grid spending guidance was raised again.',
      },
      {
        name: 'Gold',
        kind: 'Metals',
        change: '+0.7%',
        why: 'Central-bank buying continued despite firmer real yields.',
      },
    ],
    watch: [
      { label: 'EIA inventories', when: 'Wed 16:30' },
      { label: 'OPEC+ meeting', when: 'Sep 5' },
      { label: 'China PMI', when: 'Sep 1' },
      { label: 'USDA report', when: 'Fri' },
    ],
    idea: {
      title: 'Copper as a macro thermometer',
      sub: 'What the grid build-out means for a multi-year supply gap.',
    },
    prompts: [
      'Why is oil rising today?',
      'What drives natural gas seasonally?',
      'Is gold still an inflation hedge?',
    ],
  },

  bonds: {
    title: 'Bonds',
    pulse: [
      { name: 'US 2Y', group: 'Treasury', value: '3.92%', change: '+3 bps', series: [5, 5, 6, 6, 6, 7, 7, 7] },
      { name: 'US 10Y', group: 'Treasury', value: '4.18%', change: '+4 bps', series: [4, 5, 5, 6, 6, 6, 7, 7] },
      { name: 'US 30Y', group: 'Treasury', value: '4.44%', change: '+4 bps', series: [5, 5, 6, 6, 6, 7, 7, 7] },
      { name: 'German 10Y', group: 'Bund', value: '2.31%', change: '+2 bps', series: [5, 5, 6, 6, 6, 6, 7, 7] },
      { name: 'UK 10Y', group: 'Gilt', value: '4.02%', change: '+3 bps', series: [5, 6, 6, 6, 6, 7, 7, 7] },
      { name: '2s10s spread', group: 'Curve', value: '+26 bps', change: 'Steeper', series: [4, 4, 5, 5, 6, 6, 7, 8] },
      { name: 'IG spread', group: 'Credit', value: '92 bps', change: '−1 bp', series: [7, 7, 6, 6, 6, 6, 5, 5] },
      { name: 'HY spread', group: 'Credit', value: '318 bps', change: '−4 bps', series: [8, 7, 7, 6, 6, 6, 5, 5] },
    ],
    moved: [
      {
        name: 'US 10-year yield',
        kind: 'Rates',
        change: '+4 bps',
        why: 'Services inflation surprised to the upside; cut odds fell.',
      },
      {
        name: '2s10s curve',
        kind: 'Curve',
        change: '+2 bps',
        why: 'The long end sold off faster than the front end.',
      },
      {
        name: 'High-yield spreads',
        kind: 'Credit',
        change: '−4 bps',
        why: 'Risk appetite held up; issuance was absorbed easily.',
      },
      {
        name: 'German 10Y',
        kind: 'Bund',
        change: '+2 bps',
        why: 'Followed treasuries despite softer domestic data.',
      },
    ],
    watch: [
      { label: 'US CPI release', when: 'Thu 14:30' },
      { label: '10Y auction', when: 'Wed 19:00' },
      { label: 'Fed minutes', when: 'Wed' },
      { label: 'ECB minutes', when: 'Fri 13:30' },
    ],
    idea: {
      title: 'Locking in yield before the cuts',
      sub: 'Duration choices when the path down is slower than expected.',
    },
    prompts: [
      'What does a steeper curve signal?',
      'Explain bond prices vs yields',
      'Should duration worry me right now?',
    ],
  },
};

/** The four macro tiles under "Why is it happening?". */
export const MACRO_TILES: Array<{ label: string; value: string; note: string }> = [
  { label: 'Fed funds rate', value: '4.25–4.50%', note: 'Unchanged · next decision Sep 17' },
  { label: 'US inflation (CPI)', value: '2.9%', note: 'Services still sticky' },
  { label: 'Euro area GDP', value: '+0.3% q/q', note: 'Second estimate' },
  { label: 'US unemployment', value: '4.3%', note: 'Cooling, not breaking' },
];

/**
 * A row in the search overlay.
 *
 * Built by the page from the symbols that actually have a page, rather than
 * listed here. The prototype's list included Apple and QQQ, which the portal
 * does not carry — and a search result that 404s is a worse answer than a
 * shorter list of ones that work.
 */
export type SymbolHit = {
  ticker: string;
  name: string;
  meta: string;
  price: string;
  change: string;
  up: boolean;
};

/**
 * Is this change a rise?
 *
 * The real minus is what the data uses, and it is not the ASCII hyphen. Both are
 * checked because one of them will eventually be typed by hand.
 */
export function isUp(change: string): boolean {
  return !change.startsWith('−') && !change.startsWith('-');
}

/** Does this string carry a number at all, or is it a phrase like "Neutral"? */
export function isQuantity(change: string): boolean {
  return /%|bps|bp\b|pp/.test(change);
}

/**
 * A sparkline, normalised into the box it is drawn in.
 *
 * Only the shape means anything — the series has no unit — so it is stretched
 * to fill the height whatever its range, and a flat series draws a flat line
 * rather than dividing by zero.
 */
export function sparkPoints(values: number[], width = 64, height = 22): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);

  return values
    .map((value, index) => {
      const x = (index * step).toFixed(1);
      const y = (height - ((value - min) / span) * (height - 2)).toFixed(1);
      return `${x},${y}`;
    })
    .join(' ');
}
