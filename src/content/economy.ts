/**
 * Economy section data. Figures are illustrative demo values frozen from the design
 * prototype — the shape of the screen is the point, not the numbers.
 */

export type Tone = 'good' | 'warn' | 'bad';

export const ECONOMY_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'countries', label: 'Countries & Regions' },
  { id: 'indicators', label: 'Indicators' },
  { id: 'calendar', label: 'Economic Calendar' },
  { id: 'news', label: 'News & Insights' },
] as const;

export type EconomyTab = (typeof ECONOMY_TABS)[number]['id'];

export const MACRO_TOOLS = [
  { label: 'Macro Maps', slug: 'macro-maps' },
  { label: 'Country Compare', slug: 'country-compare' },
  { label: 'Yield Curves', slug: 'yield-curves' },
  { label: 'Indicator Compare', slug: 'indicator-compare' },
  { label: 'Scenario Explorer', slug: 'scenario-explorer' },
];

/** Four independent readings. Deliberately not collapsed into one score. */
export const OUTLOOK = [
  {
    key: 'Growth',
    state: 'Slowing',
    color: 'var(--tn-amber-text)',
    note: 'Global growth remains positive, but momentum is weakening across developed markets.',
  },
  {
    key: 'Inflation',
    state: 'Moderating slowly',
    color: 'var(--tn-blue)',
    note: 'Headline inflation keeps easing, though services prices remain sticky.',
  },
  {
    key: 'Interest rates',
    state: 'Restrictive',
    color: 'var(--tn-purple)',
    note: 'Major central banks hold rates above neutral; first cuts priced for late 2026.',
  },
  {
    key: 'Financial conditions',
    state: 'Tightening',
    color: 'var(--tn-red)',
    note: 'Credit spreads widened modestly as long-term yields rose.',
  },
];

export type ChangeCard = {
  title: string;
  surprise: string;
  why: string;
  assets: string[];
  target: { kind: 'indicator' } | { kind: 'country'; id: string };
};

export const THREE_CHANGES: ChangeCard[] = [
  {
    title: 'US inflation came above expectations',
    surprise: '+0.3pp vs consensus · High surprise',
    why: 'May reduce the probability of near-term rate cuts.',
    assets: ['Government bonds', 'USD', 'Growth stocks'],
    target: { kind: 'indicator' },
  },
  {
    title: 'The ECB signalled a slower pace of rate cuts',
    surprise: 'Guidance shift · Moderate surprise',
    why: 'Supports the euro; pressures EUR-denominated bonds.',
    assets: ['EUR', 'European equities'],
    target: { kind: 'country', id: 'EU' },
  },
  {
    title: 'Chinese manufacturing activity improved',
    surprise: 'PMI 50.8 vs 49.6 prior',
    why: 'Positive for commodities and industrial exporters.',
    assets: ['Commodities', 'Gold', 'EM equities'],
    target: { kind: 'country', id: 'CN' },
  },
];

/** Probabilistic language throughout — these are possibilities, never advice. */
export const MARKET_IMPACT = [
  { k: 'Equities', v: 'Mixed — earnings resilience against rate pressure on valuations.' },
  {
    k: 'Government bonds',
    v: 'Higher-for-longer rates may remain a headwind for long-duration bonds.',
  },
  { k: 'Corporate bonds', v: 'Spreads look vulnerable if growth slows further.' },
  { k: 'Cash', v: 'Attractive short-term yields persist while rates stay restrictive.' },
  {
    k: 'Commodities',
    v: 'Supported by improving Chinese activity and central-bank gold buying.',
  },
  {
    k: 'Currencies',
    v: 'USD supported by rate differentials; EUR helped by slower ECB cuts.',
  },
  { k: 'Real estate', v: 'Financing costs remain a constraint on valuations.' },
];

export type CalendarRow = {
  time: string;
  country: string;
  event: string;
  importance: 'high' | 'med' | 'low';
  forecast: string;
  previous: string;
  actual?: string;
  surprise?: string;
  surpriseTone?: Tone;
};

export const CALENDAR_PREVIEW: CalendarRow[] = [
  {
    time: 'Thu 12:30',
    country: 'US',
    event: 'CPI (July)',
    importance: 'high',
    forecast: '2.6%',
    previous: '2.9%',
  },
  {
    time: 'Fri 12:15',
    country: 'EU',
    event: 'ECB rate decision',
    importance: 'high',
    forecast: '2.15%',
    previous: '2.15%',
  },
  {
    time: 'Thu 20:00',
    country: 'US',
    event: 'Apple earnings',
    importance: 'med',
    forecast: 'EPS 1.43',
    previous: '1.40',
  },
  {
    time: 'Mon 01:45',
    country: 'CN',
    event: 'Caixin Manufacturing PMI',
    importance: 'med',
    forecast: '50.4',
    previous: '50.8',
  },
];

export const CALENDAR_FULL: CalendarRow[] = [
  ...CALENDAR_PREVIEW,
  {
    time: 'Wed 09:00',
    country: 'DE',
    event: 'Manufacturing PMI (final)',
    importance: 'med',
    forecast: '48.2',
    previous: '47.9',
    actual: '48.9',
    surprise: '+0.7',
    surpriseTone: 'good',
  },
  {
    time: 'Wed 06:00',
    country: 'UK',
    event: 'Retail sales (MoM)',
    importance: 'low',
    forecast: '0.2%',
    previous: '−0.1%',
    actual: '0.4%',
    surprise: '+0.2pp',
    surpriseTone: 'good',
  },
  {
    time: 'Tue 23:50',
    country: 'JP',
    event: 'Industrial production',
    importance: 'low',
    forecast: '1.0%',
    previous: '2.1%',
    actual: '0.6%',
    surprise: '−0.4pp',
    surpriseTone: 'bad',
  },
];

export const WORLD_METRICS = [
  'Growth',
  'Inflation',
  'Interest rates',
  'Employment',
  'Debt',
  'Momentum',
] as const;

export type WorldMetric = (typeof WORLD_METRICS)[number];

/** [level, change, tone] per metric. */
export type WorldRow = { id: string; name: string } & Record<WorldMetric, [string, string, Tone]>;

export const WORLD: WorldRow[] = [
  {
    id: 'US',
    name: 'United States',
    Growth: ['+1.8%', '−0.3pp', 'warn'],
    Inflation: ['2.9%', '+0.3pp', 'bad'],
    'Interest rates': ['4.25%', '0.0pp', 'warn'],
    Employment: ['4.2%', '+0.1pp', 'warn'],
    Debt: ['123%', '+2pp', 'bad'],
    Momentum: ['Slowing', '−', 'warn'],
  },
  {
    id: 'EU',
    name: 'Eurozone',
    Growth: ['+0.9%', '+0.1pp', 'warn'],
    Inflation: ['2.2%', '−0.1pp', 'good'],
    'Interest rates': ['2.15%', '−0.25pp', 'good'],
    Employment: ['6.3%', '0.0pp', 'warn'],
    Debt: ['89%', '+1pp', 'warn'],
    Momentum: ['Stable', '−', 'good'],
  },
  {
    id: 'CN',
    name: 'China',
    Growth: ['+4.6%', '+0.2pp', 'good'],
    Inflation: ['0.4%', '+0.1pp', 'good'],
    'Interest rates': ['3.00%', '−0.10pp', 'good'],
    Employment: ['5.1%', '0.0pp', 'warn'],
    Debt: ['84%', '+3pp', 'warn'],
    Momentum: ['Improving', '+', 'good'],
  },
  {
    id: 'JP',
    name: 'Japan',
    Growth: ['+0.7%', '−0.1pp', 'warn'],
    Inflation: ['1.8%', '−0.2pp', 'good'],
    'Interest rates': ['0.75%', '+0.25pp', 'warn'],
    Employment: ['2.5%', '0.0pp', 'good'],
    Debt: ['252%', '+1pp', 'bad'],
    Momentum: ['Stable', '−', 'good'],
  },
  {
    id: 'UK',
    name: 'United Kingdom',
    Growth: ['+1.1%', '+0.2pp', 'good'],
    Inflation: ['3.1%', '−0.2pp', 'bad'],
    'Interest rates': ['4.00%', '−0.25pp', 'warn'],
    Employment: ['4.4%', '+0.1pp', 'warn'],
    Debt: ['101%', '+2pp', 'bad'],
    Momentum: ['Recovering', '+', 'good'],
  },
  {
    id: 'IN',
    name: 'India',
    Growth: ['+6.8%', '+0.1pp', 'good'],
    Inflation: ['4.6%', '−0.3pp', 'warn'],
    'Interest rates': ['6.00%', '−0.25pp', 'warn'],
    Employment: ['7.8%', '−0.2pp', 'warn'],
    Debt: ['82%', '0pp', 'warn'],
    Momentum: ['Expanding', '+', 'good'],
  },
  {
    id: 'BR',
    name: 'Brazil',
    Growth: ['+2.1%', '−0.4pp', 'warn'],
    Inflation: ['4.1%', '+0.2pp', 'warn'],
    'Interest rates': ['12.75%', '0.0pp', 'bad'],
    Employment: ['7.1%', '−0.1pp', 'warn'],
    Debt: ['78%', '+1pp', 'warn'],
    Momentum: ['Slowing', '−', 'warn'],
  },
  {
    id: 'CY',
    name: 'Cyprus',
    Growth: ['+2.8%', '+0.1pp', 'good'],
    Inflation: ['1.9%', '−0.1pp', 'good'],
    'Interest rates': ['2.15%', '−0.25pp', 'good'],
    Employment: ['5.0%', '−0.2pp', 'good'],
    Debt: ['70%', '−3pp', 'good'],
    Momentum: ['Expanding', '+', 'good'],
  },
];

export const NEWS_CLUSTERS = [
  {
    id: 'us-inflation',
    title: 'US inflation',
    meta: '12 related stories · High market impact',
    summary:
      'July CPI came in at 2.9% YoY against a 2.6% consensus, driven by sticky services prices. Rate-cut odds for September fell from 68% to 41%.',
    facts: 'CPI 2.9% YoY; core 3.2%; services +4.1%.',
    interpretation: 'Bond yields rose; long-duration growth stocks under pressure.',
    assets: ['US 10Y', 'S&P 500', 'Gold'],
  },
  {
    id: 'ecb',
    title: 'ECB policy',
    meta: '8 related stories · Relevant to EUR assets',
    summary:
      'The ECB held at 2.15% and signalled a slower pace of further cuts, citing wage growth. Markets now price one cut by year-end instead of two.',
    facts: 'Deposit rate 2.15%; two dissents; next meeting Sep 11.',
    interpretation: 'EUR firmer; EUR-denominated bonds repriced lower.',
    assets: ['EUR/USD', 'European equities'],
  },
  {
    id: 'china',
    title: 'China growth',
    meta: '6 related stories · Relevant to commodities',
    summary:
      'Caixin manufacturing PMI rose to 50.8, the first expansion reading in four months, on stronger export orders and stimulus effects.',
    facts: 'PMI 50.8 vs 49.6; new orders 51.4.',
    interpretation: 'Supportive for industrial commodities and EM equities.',
    assets: ['Commodities', 'EM equities'],
  },
];

export const VOYAGER_QUESTIONS = [
  'Why is inflation falling so slowly?',
  'How could this affect bond prices?',
  'Compare the US and Eurozone economies',
  'Explain the yield curve in simple terms',
  'Which events may affect my watchlist this week?',
];

/** Recommendations carry their reason — never an unexplained "for you". */
export const RECOMMENDED_COUNTRIES = [
  { id: 'US', name: 'United States', reason: 'Affects your US equity watchlist' },
  { id: 'EU', name: 'Eurozone', reason: 'Relevant to EUR assets' },
  { id: 'CN', name: 'China', reason: 'Major driver of commodities' },
  { id: 'CY', name: 'Cyprus', reason: 'Your local economy' },
];

export const COUNTRY_GROUPS = [
  {
    title: 'Major economies',
    items: [
      { label: 'United States', id: 'US' },
      { label: 'Eurozone', id: 'EU' },
      { label: 'China', id: 'CN' },
      { label: 'Japan', id: 'JP' },
      { label: 'United Kingdom', id: 'UK' },
    ],
  },
  {
    title: 'Emerging markets',
    items: [
      { label: 'India', id: 'IN' },
      { label: 'Brazil', id: 'BR' },
      { label: 'Mexico', id: null },
      { label: 'Indonesia', id: null },
      { label: 'Türkiye', id: null },
    ],
  },
  {
    title: 'Recently changed',
    items: [
      { label: 'Japan — policy normalisation', id: 'JP' },
      { label: 'China — momentum improving', id: 'CN' },
    ],
  },
];

export const INDICATOR_THEMES = [
  'Growth',
  'Inflation',
  'Labor',
  'Interest Rates & Credit',
  'Consumer',
  'Business Activity',
  'Housing',
  'Trade',
  'Government Finances',
  'Energy & Commodities',
];

export const ESSENTIAL_INDICATORS: Record<
  string,
  Array<{ k: string; v: string; trend: string; tone: Tone | 'info' }>
> = {
  Growth: [
    { k: 'GDP Growth (YoY)', v: '+1.8%', trend: 'Slowing', tone: 'warn' },
    { k: 'GDP per Capita', v: '$82,715', trend: 'Rising', tone: 'good' },
    { k: 'Manufacturing PMI', v: '49.1', trend: 'Contracting', tone: 'bad' },
    { k: 'Services PMI', v: '52.3', trend: 'Expanding', tone: 'good' },
  ],
  Inflation: [
    { k: 'CPI (YoY)', v: '2.9%', trend: 'Above forecast', tone: 'bad' },
    { k: 'Core CPI (YoY)', v: '3.2%', trend: 'Sticky', tone: 'warn' },
    { k: 'PPI (YoY)', v: '1.8%', trend: 'Easing', tone: 'good' },
    { k: 'Inflation expectations 5Y', v: '2.4%', trend: 'Anchored', tone: 'good' },
  ],
  Labor: [
    { k: 'Unemployment rate', v: '4.2%', trend: 'Edging up', tone: 'warn' },
    { k: 'Nonfarm payrolls', v: '+148k', trend: 'Cooling', tone: 'warn' },
    { k: 'Wage growth (YoY)', v: '3.8%', trend: 'Moderating', tone: 'good' },
    { k: 'Job openings', v: '7.4M', trend: 'Declining', tone: 'warn' },
  ],
  'Interest Rates & Credit': [
    { k: 'Policy rate', v: '4.25%', trend: 'Restrictive', tone: 'info' },
    { k: '10Y Treasury yield', v: '4.38%', trend: 'Rising', tone: 'bad' },
    { k: '2s10s spread', v: '+0.31pp', trend: 'Normalising', tone: 'good' },
    { k: 'Credit spreads (IG)', v: '1.12pp', trend: 'Widening', tone: 'warn' },
  ],
};

export const MORE_INDICATORS: Record<string, string[]> = {
  Inflation: [
    'Trimmed-mean CPI',
    'PCE deflator',
    'Import prices',
    'Shelter CPI',
    'Sticky-price CPI',
  ],
};

export const MORE_INDICATORS_DEFAULT = [
  'Retail sales',
  'Industrial production',
  'Capacity utilisation',
  'Durable goods orders',
  'Business inventories',
];

export type Country = {
  id: string;
  name: string;
  status: string;
  centralBank: string;
  snapshot: Array<[string, string]>;
  changed: string[];
  cb: Array<[string, string]>;
  risks: Array<[string, string, Tone]>;
  connections: string[];
  compare: Array<{ label: string; id: string | null }>;
  /** Five years of policy rate, oldest first — drives the SVG chart. */
  rateHistory: number[];
};

export const COUNTRIES: Record<string, Country> = {
  US: {
    id: 'US',
    name: 'United States',
    status: 'Growth resilient · Inflation elevated · Rates restrictive',
    centralBank: 'Federal Reserve',
    snapshot: [
      ['GDP growth (YoY)', '+1.8%'],
      ['Inflation (CPI)', '2.9%'],
      ['Unemployment', '4.2%'],
      ['Policy rate', '4.25%'],
      ['Government debt', '123% GDP'],
      ['Currency (DXY)', '103.4'],
      ['Manufacturing PMI', '49.1'],
    ],
    changed: [
      'July CPI came in above expectations at 2.9% — rate-cut odds fell.',
      'Payroll growth cooled to +148k, the slowest in six months.',
      '10-year Treasury yield rose to 4.38% after the inflation print.',
    ],
    cb: [
      ['Current rate', '4.25%'],
      ['Last decision', 'Hold · Jun 17'],
      ['Next meeting', 'Sep 16'],
      ['Market expectations', '41% odds of a 25 bp cut'],
    ],
    risks: [
      ['Inflation risk', 'Elevated', 'bad'],
      ['Recession risk', 'Moderate', 'warn'],
      ['Fiscal risk', 'Elevated', 'bad'],
      ['Financial stability', 'Contained', 'good'],
    ],
    connections: ['S&P 500', 'USD', 'US 10Y Treasury', 'Country ETF', 'Tech sector', 'NVIDIA'],
    compare: [
      { label: 'Compare with Eurozone', id: 'EU' },
      { label: 'Compare with China', id: 'CN' },
      { label: 'Compare with 10-year history', id: null },
    ],
    rateHistory: [0.25, 0.25, 1.75, 4.5, 5.5, 5.25, 4.75, 4.25],
  },
  EU: {
    id: 'EU',
    name: 'Eurozone',
    status: 'Growth subdued · Inflation near target · Rates easing slowly',
    centralBank: 'European Central Bank',
    snapshot: [
      ['GDP growth (YoY)', '+0.9%'],
      ['Inflation (HICP)', '2.2%'],
      ['Unemployment', '6.3%'],
      ['Policy rate', '2.15%'],
      ['Government debt', '89% GDP'],
      ['Currency (EUR/USD)', '1.128'],
      ['Composite PMI', '50.6'],
    ],
    changed: [
      'ECB held rates and signalled a slower pace of cuts.',
      'German manufacturing PMI improved to 48.9.',
      'Wage growth remains above the level consistent with 2% inflation.',
    ],
    cb: [
      ['Current rate', '2.15%'],
      ['Last decision', 'Hold · Jul 24'],
      ['Next meeting', 'Sep 11'],
      ['Market expectations', 'One cut priced by year-end'],
    ],
    risks: [
      ['Inflation risk', 'Contained', 'good'],
      ['Recession risk', 'Moderate', 'warn'],
      ['Fiscal risk', 'Moderate', 'warn'],
      ['Financial stability', 'Contained', 'good'],
    ],
    connections: ['EUR/USD', 'European equities', 'Bunds', 'EU ETFs'],
    compare: [
      { label: 'Compare with United States', id: 'US' },
      { label: 'Compare with United Kingdom', id: 'UK' },
    ],
    rateHistory: [-0.5, -0.5, 0.0, 2.5, 4.0, 3.75, 3.0, 2.15],
  },
  CN: {
    id: 'CN',
    name: 'China',
    status: 'Momentum improving · Inflation low · Policy supportive',
    centralBank: "People's Bank of China",
    snapshot: [
      ['GDP growth (YoY)', '+4.6%'],
      ['Inflation (CPI)', '0.4%'],
      ['Unemployment (urban)', '5.1%'],
      ['Policy rate (LPR 1Y)', '3.00%'],
      ['Government debt', '84% GDP'],
      ['Currency (USD/CNY)', '7.08'],
      ['Caixin Mfg PMI', '50.8'],
    ],
    changed: [
      'Caixin manufacturing PMI returned to expansion at 50.8.',
      'New stimulus measures target household consumption.',
      'Export orders improved for a second month.',
    ],
    cb: [
      ['Current rate', '3.00%'],
      ['Last decision', 'Cut 10 bp · Jul 21'],
      ['Next fixing', 'Aug 20'],
      ['Market expectations', 'Further easing likely'],
    ],
    risks: [
      ['Inflation risk', 'Low', 'good'],
      ['Recession risk', 'Low', 'good'],
      ['Property sector risk', 'Elevated', 'bad'],
      ['Financial stability', 'Watchful', 'warn'],
    ],
    connections: ['Commodities', 'EM equities', 'USD/CNY', 'Industrial metals'],
    compare: [
      { label: 'Compare with United States', id: 'US' },
      { label: 'Compare with India', id: 'IN' },
    ],
    rateHistory: [3.85, 3.7, 3.65, 3.55, 3.45, 3.35, 3.1, 3.0],
  },
  JP: {
    id: 'JP',
    name: 'Japan',
    status: 'Growth stable · Inflation near target · Policy normalising',
    centralBank: 'Bank of Japan',
    snapshot: [
      ['GDP growth (YoY)', '+0.7%'],
      ['Inflation (CPI)', '1.8%'],
      ['Unemployment', '2.5%'],
      ['Policy rate', '0.75%'],
      ['Government debt', '252% GDP'],
      ['Currency (USD/JPY)', '148.2'],
      ['Tankan index', '+11'],
    ],
    changed: [
      'BoJ raised its policy rate to 0.75% in June.',
      'Wage negotiations delivered the strongest gains in decades.',
      'Industrial production softened to +0.6%.',
    ],
    cb: [
      ['Current rate', '0.75%'],
      ['Last decision', 'Hike 25 bp · Jun 13'],
      ['Next meeting', 'Sep 19'],
      ['Market expectations', 'Hold; next hike Dec'],
    ],
    risks: [
      ['Inflation risk', 'Contained', 'good'],
      ['Recession risk', 'Low', 'good'],
      ['Fiscal risk', 'Elevated', 'bad'],
      ['FX volatility', 'Watchful', 'warn'],
    ],
    connections: ['Nikkei 225', 'USD/JPY', 'JGBs'],
    compare: [
      { label: 'Compare with United States', id: 'US' },
      { label: 'Compare with Eurozone', id: 'EU' },
    ],
    rateHistory: [-0.1, -0.1, -0.1, -0.1, 0.0, 0.25, 0.5, 0.75],
  },
  UK: {
    id: 'UK',
    name: 'United Kingdom',
    status: 'Recovering · Inflation above target · Rates easing',
    centralBank: 'Bank of England',
    snapshot: [
      ['GDP growth (YoY)', '+1.1%'],
      ['Inflation (CPI)', '3.1%'],
      ['Unemployment', '4.4%'],
      ['Policy rate', '4.00%'],
      ['Government debt', '101% GDP'],
      ['Currency (GBP/USD)', '1.31'],
      ['Composite PMI', '51.2'],
    ],
    changed: [
      'Retail sales beat expectations at +0.4% MoM.',
      'Services inflation remains sticky at 4.6%.',
      'BoE cut rates 25 bp in June, the second cut this year.',
    ],
    cb: [
      ['Current rate', '4.00%'],
      ['Last decision', 'Cut 25 bp · Jun 19'],
      ['Next meeting', 'Sep 18'],
      ['Market expectations', 'One more cut this year'],
    ],
    risks: [
      ['Inflation risk', 'Elevated', 'bad'],
      ['Recession risk', 'Moderate', 'warn'],
      ['Fiscal risk', 'Elevated', 'bad'],
      ['Financial stability', 'Contained', 'good'],
    ],
    connections: ['FTSE 100', 'GBP/USD', 'Gilts'],
    compare: [
      { label: 'Compare with Eurozone', id: 'EU' },
      { label: 'Compare with United States', id: 'US' },
    ],
    rateHistory: [0.1, 0.25, 1.75, 4.0, 5.25, 5.0, 4.25, 4.0],
  },
  CY: {
    id: 'CY',
    name: 'Cyprus',
    status: 'Expanding · Inflation low · ECB rates apply',
    centralBank: 'ECB (euro area member)',
    snapshot: [
      ['GDP growth (YoY)', '+2.8%'],
      ['Inflation (HICP)', '1.9%'],
      ['Unemployment', '5.0%'],
      ['Policy rate (ECB)', '2.15%'],
      ['Government debt', '70% GDP'],
      ['Currency', 'EUR'],
      ['Tourism arrivals (YoY)', '+6.2%'],
    ],
    changed: [
      'Government debt fell below 70% of GDP.',
      'Tourism season tracking ahead of last year.',
      'Credit rating outlook upgraded to positive.',
    ],
    cb: [
      ['Current rate', '2.15% (ECB)'],
      ['Last decision', 'Hold · Jul 24'],
      ['Next meeting', 'Sep 11'],
      ['Market expectations', 'One ECB cut by year-end'],
    ],
    risks: [
      ['Inflation risk', 'Low', 'good'],
      ['Recession risk', 'Low', 'good'],
      ['Fiscal risk', 'Improving', 'good'],
      ['External demand', 'Watchful', 'warn'],
    ],
    connections: ['EUR', 'European equities', 'Tourism sector'],
    compare: [{ label: 'Compare with Eurozone', id: 'EU' }],
    rateHistory: [-0.5, -0.5, 0.0, 2.5, 4.0, 3.75, 3.0, 2.15],
  },
  IN: {
    id: 'IN',
    name: 'India',
    status: 'Expanding fast · Inflation moderating · Rates easing',
    centralBank: 'Reserve Bank of India',
    snapshot: [
      ['GDP growth (YoY)', '+6.8%'],
      ['Inflation (CPI)', '4.6%'],
      ['Unemployment', '7.8%'],
      ['Policy rate', '6.00%'],
      ['Government debt', '82% GDP'],
      ['Currency (USD/INR)', '85.6'],
      ['Manufacturing PMI', '57.4'],
    ],
    changed: [
      'RBI cut rates 25 bp as inflation eased.',
      'Manufacturing PMI stays among the strongest globally.',
      'FDI inflows accelerated in Q2.',
    ],
    cb: [
      ['Current rate', '6.00%'],
      ['Last decision', 'Cut 25 bp · Jun 6'],
      ['Next meeting', 'Aug 8'],
      ['Market expectations', 'Hold'],
    ],
    risks: [
      ['Inflation risk', 'Moderate', 'warn'],
      ['Recession risk', 'Low', 'good'],
      ['Fiscal risk', 'Moderate', 'warn'],
      ['External balance', 'Watchful', 'warn'],
    ],
    connections: ['Nifty 50', 'USD/INR', 'EM equities'],
    compare: [{ label: 'Compare with China', id: 'CN' }],
    rateHistory: [4.0, 4.0, 5.9, 6.5, 6.5, 6.5, 6.25, 6.0],
  },
  BR: {
    id: 'BR',
    name: 'Brazil',
    status: 'Slowing · Inflation above target · Rates very restrictive',
    centralBank: 'Banco Central do Brasil',
    snapshot: [
      ['GDP growth (YoY)', '+2.1%'],
      ['Inflation (IPCA)', '4.1%'],
      ['Unemployment', '7.1%'],
      ['Policy rate (Selic)', '12.75%'],
      ['Government debt', '78% GDP'],
      ['Currency (USD/BRL)', '5.42'],
      ['Composite PMI', '49.3'],
    ],
    changed: [
      'Central bank held the Selic at 12.75%.',
      'Inflation ticked up on food prices.',
      'Activity indicators point to a slowdown.',
    ],
    cb: [
      ['Current rate', '12.75%'],
      ['Last decision', 'Hold · Jul 30'],
      ['Next meeting', 'Sep 17'],
      ['Market expectations', 'Cuts from Q4'],
    ],
    risks: [
      ['Inflation risk', 'Moderate', 'warn'],
      ['Recession risk', 'Moderate', 'warn'],
      ['Fiscal risk', 'Elevated', 'bad'],
      ['FX volatility', 'Elevated', 'bad'],
    ],
    connections: ['Bovespa', 'USD/BRL', 'Commodities'],
    compare: [{ label: 'Compare with India', id: 'IN' }],
    rateHistory: [2.0, 4.25, 9.25, 13.75, 13.75, 11.75, 12.25, 12.75],
  },
};

export const COUNTRY_IDS = Object.keys(COUNTRIES);

/** The one indicator page built out in full. */
export const INDICATOR = {
  slug: 'us-cpi',
  name: 'US Inflation Rate',
  subtitle: 'Consumer Price Index, year over year',
  stats: [
    { k: 'CURRENT', v: '2.9%', tone: 'plain' as const },
    { k: 'PREVIOUS', v: '2.6%', tone: 'muted' as const },
    { k: 'CONSENSUS', v: '2.6%', tone: 'muted' as const },
    { k: 'SURPRISE', v: '+0.3pp', tone: 'bad' as const },
  ],
  chart: [7.0, 9.1, 6.4, 4.9, 3.7, 3.1, 2.4, 2.6, 2.9],
  chartRange: '2.4–9.1%',
  provenance: 'Source: BLS · Updated Jul 30 · Next release: Aug 27, 12:30 UTC',
  whyItMatters:
    'Inflation determines how quickly money loses purchasing power, and it is the single biggest input into central-bank rate decisions. Rates in turn set the discount applied to every future cash flow, which is why an inflation print moves bonds, equities and currencies at the same time.',
  interpretation:
    'The July reading came in 0.3pp above consensus, driven by services rather than goods. Services inflation responds slowly to rate changes, so a single hot print may push the first rate cut further out. Markets moved the September cut probability from 68% to 41% within an hour of the release.',
  compare: [
    { k: 'United States', v: '2.9%', width: 64, tone: 'bad' as Tone },
    { k: 'United Kingdom', v: '3.1%', width: 69, tone: 'bad' as Tone },
    { k: 'Eurozone', v: '2.2%', width: 49, tone: 'warn' as Tone },
    { k: 'Japan', v: '1.8%', width: 40, tone: 'good' as Tone },
    { k: 'China', v: '0.4%', width: 9, tone: 'good' as Tone },
  ],
  affectedAssets: ['Government bonds', 'USD', 'Gold', 'Growth stocks', 'S&P 500'],
};
