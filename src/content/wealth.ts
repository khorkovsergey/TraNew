/**
 * Personal Wealth Hub demo data.
 *
 * Three layers, in this order: the Wealth Record (what you own and owe),
 * Intelligence (what it means), Decisions (what you could do). Every value carries
 * a data status so the screen never implies more precision than it has.
 */

export type DataStatus = 'verified' | 'connected' | 'manual' | 'estimated' | 'outdated';

export const DATA_STATUS_LABEL: Record<DataStatus, string> = {
  verified: 'Verified',
  connected: 'Connected',
  manual: 'Manually entered',
  estimated: 'Estimated',
  outdated: 'Estimated · Outdated',
};

export const WEALTH_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'assets', label: 'Assets' },
  { id: 'liabilities', label: 'Liabilities' },
  { id: 'goals', label: 'Goals' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'insights', label: 'Insights' },
  { id: 'data', label: 'Data & Connections' },
] as const;

export type WealthTab = (typeof WEALTH_TABS)[number]['id'] | 'add';

export const SNAPSHOT = [
  { k: 'NET WEALTH', v: '€1.21M', tone: 'plain' as const },
  { k: 'LIQUID WITHIN 30 DAYS', v: '€172K', tone: 'plain' as const },
  { k: 'MONTHLY PASSIVE INCOME', v: '€3,050', tone: 'good' as const },
  { k: 'TOTAL DEBT', v: '€185K', tone: 'bad' as const },
];

export const SNAPSHOT_CONFIDENCE =
  'Market prices updated today · Property valuation 9 months old · Confidence: Medium';

export const STRUCTURE_VIEWS = [
  { id: 'type', label: 'Asset type' },
  { id: 'currency', label: 'Currency' },
  { id: 'country', label: 'Country' },
  { id: 'liquidity', label: 'Liquidity' },
] as const;

export type StructureView = (typeof STRUCTURE_VIEWS)[number]['id'];

export const STRUCTURE: Record<
  StructureView,
  Array<{ k: string; v: string; width: number; color: string }>
> = {
  type: [
    { k: 'Real estate', v: '43% · €600K', width: 43, color: 'var(--tn-blue)' },
    { k: 'Private business', v: '34% · €475K', width: 34, color: 'var(--tn-purple)' },
    { k: 'Cash & deposits', v: '14% · €202K', width: 14, color: 'var(--tn-green)' },
    { k: 'Securities & ETFs', v: '9% · €120K', width: 9, color: 'var(--tn-orange)' },
  ],
  currency: [
    { k: 'EUR', v: '89% · €1.24M', width: 89, color: 'var(--tn-blue)' },
    { k: 'USD', v: '11% · €155K', width: 11, color: 'var(--tn-purple)' },
  ],
  country: [
    { k: 'Cyprus', v: '60% · €827K', width: 60, color: 'var(--tn-blue)' },
    { k: 'United States', v: '31% · €435K', width: 31, color: 'var(--tn-purple)' },
    { k: 'Other / global', v: '9% · €135K', width: 9, color: 'var(--tn-green)' },
  ],
  liquidity: [
    { k: 'Illiquid (12+ months)', v: '76% · €1.07M', width: 76, color: 'var(--tn-red)' },
    { k: 'Within a year', v: '13% · €175K', width: 13, color: 'var(--tn-orange)' },
    { k: 'Within days', v: '11% · €155K', width: 11, color: 'var(--tn-green)' },
  ],
};

export const LIQUIDITY_LADDER = [
  { k: 'Immediately', v: '€52K', tone: 'good' as const },
  { k: 'Within 1–7 days', v: '€120K', tone: 'good' as const },
  { k: 'Within 12 months', v: '€150K', tone: 'warn' as const },
  { k: 'More than 12 months', v: '€1,075K', tone: 'bad' as const },
];

/** Stated plainly because a net-wealth number invites exactly this misreading. */
export const LIQUIDITY_NOTE =
  '€1.21M does not mean €1.21M is available — 76% of it is illiquid.';

export type AttentionItem = {
  text: string;
  cta: string;
  target: { tab: WealthTab; assetId?: string; scenario?: string };
};

export const ATTENTION: AttentionItem[] = [
  {
    text: 'Apartment valuation has not been updated for 9 months',
    cta: 'Update',
    target: { tab: 'assets', assetId: 'apt' },
  },
  {
    text: 'Term deposit matures in 47 days',
    cta: 'Plan renewal',
    target: { tab: 'scenarios', scenario: 'Reallocate' },
  },
  {
    text: '60% of capital is tied to one country (Cyprus)',
    cta: 'See scenario',
    target: { tab: 'scenarios', scenario: 'Reallocate' },
  },
  {
    text: 'A single company (TechServe) is 34% of your wealth',
    cta: 'Review',
    target: { tab: 'insights' },
  },
  {
    text: 'Idle cash is above your reserve target',
    cta: 'Assign to a goal',
    target: { tab: 'goals' },
  },
];

export const WHAT_CHANGED = [
  'Tesla +2.9% today — your position gained ≈ €1,020.',
  'ECB signalled slower cuts — deposit renewal rates may stay higher than expected.',
  'Rent payment received: €2,300 (Limassol apartment).',
];

export const GOALS_SUMMARY = [
  { k: 'Emergency reserve €60K', percent: 87, color: 'var(--tn-green)' },
  { k: 'Passive income €3,000/mo by 2030', percent: 68, color: 'var(--tn-blue)' },
  { k: 'Office purchase 2028 · €250K', percent: 24, color: 'var(--tn-purple)' },
];

export const GOALS = [
  {
    name: 'Emergency reserve',
    meta: 'High priority · EUR · no deadline',
    percent: 87,
    color: 'var(--tn-green)',
    funded: '€52K of €60K',
    assets: 'Cash (Bank of Cyprus)',
  },
  {
    name: 'Passive income €3,000 / month',
    meta: 'By 2030 · medium risk tolerance',
    percent: 68,
    color: 'var(--tn-blue)',
    funded: '€2,050 of €3,000 monthly',
    assets: 'Limassol apartment (rent) · Term deposit · TechServe dividends',
  },
  {
    name: 'Office purchase',
    meta: 'By 2028 · €250,000 · low risk',
    percent: 24,
    color: 'var(--tn-purple)',
    funded: '€60K assigned',
    assets: 'Term deposit (partially)',
  },
];

/** One pool of capital cannot fund two goals twice — say so rather than double-count. */
export const GOAL_CONFLICT =
  'The term deposit is assigned to two goals at once. €150K cannot fund both the office purchase and the passive-income target — decide which one it serves.';

export const OPPORTUNITIES: Array<{ label: string; target: AttentionItem['target'] }> = [
  { label: 'Assign idle cash to a goal', target: { tab: 'goals' } },
  { label: 'Update apartment valuation', target: { tab: 'assets', assetId: 'apt' } },
  { label: 'Check refinancing at 3.6%', target: { tab: 'scenarios', scenario: 'Finance' } },
  {
    label: 'Reduce single-country exposure',
    target: { tab: 'scenarios', scenario: 'Reallocate' },
  },
];

export type AssetRow = {
  id: string;
  category: string;
  name: string;
  value: string;
  status: DataStatus;
  sub: string;
  hasDetail: boolean;
};

export const ASSETS: AssetRow[] = [
  {
    id: 'cash',
    category: 'Cash & Deposits',
    name: 'Cash — Bank of Cyprus (EUR)',
    value: '€52,000',
    status: 'connected',
    sub: 'Available instantly',
    hasDetail: false,
  },
  {
    id: 'dep',
    category: 'Cash & Deposits',
    name: 'Term deposit — Bank of Cyprus',
    value: '€150,000',
    status: 'manual',
    sub: '3.1% · matures Sep 15, 2026 — in 47 days',
    hasDetail: false,
  },
  {
    id: 'tsla',
    category: 'Public Securities',
    name: 'Tesla (TSLA) — 120 shares',
    value: '≈ €35,200',
    status: 'connected',
    sub: 'Avg $210 · +51% unrealized',
    hasDetail: true,
  },
  {
    id: 'voo',
    category: 'Funds & ETFs',
    name: 'Vanguard S&P 500 ETF',
    value: '€85,000',
    status: 'connected',
    sub: 'Broker: NorthBridge Securities',
    hasDetail: false,
  },
  {
    id: 'apt',
    category: 'Real Estate',
    name: 'Limassol apartment',
    value: '€600,000',
    status: 'outdated',
    sub: 'Net of mortgage €430,000 · valuation 9 months old',
    hasDetail: true,
  },
  {
    id: 'biz',
    category: 'Private Businesses',
    name: 'TechServe Ltd — 35% share',
    value: '€400–550K',
    status: 'estimated',
    sub: 'Range estimate · low liquidity',
    hasDetail: false,
  },
];

export const ASSETS_TOTAL = '€1,397,000';

export const ASSETS_NOTE =
  'Each asset shows how its value was obtained. A connected price and a nine-month-old estimate are both useful — but they are not the same kind of number, and the screen will not pretend otherwise.';

export type AssetDetail = {
  id: string;
  name: string;
  type: string;
  status: DataStatus;
  stats: Array<{ k: string; v: string; tone: 'plain' | 'good' | 'warn' | 'bad' }>;
  facts: Array<[string, string]>;
  liability: string;
  cashFlow: Array<{ k: string; v: string; tone: 'good' | 'bad' | 'muted' }>;
  liquidity: Array<[string, string]>;
  risks: string[];
  options: string[];
  copilotContext: string[];
  questions: string[];
};

export const ASSET_DETAILS: Record<string, AssetDetail> = {
  apt: {
    id: 'apt',
    name: 'Limassol apartment',
    type: 'Real Estate · Cyprus · 100% ownership',
    status: 'outdated',
    stats: [
      { k: 'VALUE', v: '€600,000', tone: 'plain' },
      { k: 'NET OF DEBT', v: '€430,000', tone: 'plain' },
      { k: 'SINCE PURCHASE', v: '+25%', tone: 'good' },
      { k: 'LIQUIDITY', v: '38/100', tone: 'bad' },
      { k: 'CONFIDENCE', v: 'Medium', tone: 'warn' },
      { k: 'UPDATED', v: '9 mo ago', tone: 'bad' },
    ],
    facts: [
      ['Ownership', '100% · sole owner'],
      ['Purchased', '2023 · €480,000'],
      ['Use', 'Rented out'],
      ['Rental income', '€2,300 / month'],
      ['Linked goal', 'Passive income €3,000/mo'],
      ['Jurisdiction', 'Cyprus'],
    ],
    liability:
      'Mortgage — Bank of Cyprus · balance €170,000 · 4.2% variable · €1,420/month · to 2041',
    cashFlow: [
      { k: 'Rental income', v: '+€2,300', tone: 'good' },
      { k: 'Operating costs & taxes', v: '−€410', tone: 'bad' },
      { k: 'Mortgage payment', v: '−€1,420', tone: 'bad' },
      { k: 'Net monthly cash flow', v: '+€470', tone: 'good' },
    ],
    liquidity: [
      ['Liquidity score', '38/100'],
      ['Estimated time to cash', '4–8 months'],
      ['Expected exit costs', '5–7%'],
      ['Urgent-sale discount', '10–15%'],
      ['Partial sale', 'Not available'],
      ['Legal restrictions', 'Mortgaged · otherwise none'],
      ['Price confidence', 'Medium — comparable sales'],
    ],
    risks: [
      'Cyprus property-market risk',
      'Interest-rate risk (variable mortgage)',
      'Concentration: 43% of assets',
      'Liquidity risk',
      'Tenant / vacancy risk',
    ],
    options: ['Keep', 'Sell', 'Rent (active)', 'Refinance', 'Use as collateral', 'Renovate'],
    copilotContext: [
      'Limassol apartment',
      'Linked mortgage',
      'Your income goal for 2030',
      'Current EUR interest-rate scenario',
    ],
    questions: [
      'What are my options for this asset?',
      'How liquid is it?',
      'Should I update its valuation?',
      'What happens if I sell it?',
    ],
  },
  tsla: {
    id: 'tsla',
    name: 'Tesla — 120 shares',
    type: 'Public Securities · NASDAQ · NorthBridge account',
    status: 'connected',
    stats: [
      { k: 'VALUE', v: '≈ €35,200', tone: 'plain' },
      { k: 'AVG PRICE', v: '$210', tone: 'plain' },
      { k: 'UNREALIZED P/L', v: '+51%', tone: 'good' },
      { k: 'LIQUIDITY', v: '92/100', tone: 'good' },
      { k: 'CONFIDENCE', v: 'High', tone: 'good' },
      { k: 'UPDATED', v: 'Live', tone: 'good' },
    ],
    facts: [
      ['Quantity', '120 shares'],
      ['Average purchase price', '$210.00'],
      ['Current price', '$317.42'],
      ['Share of net wealth', '2.9%'],
      ['Linked goal', 'Long-term growth'],
      ['Currency exposure', 'USD'],
    ],
    liability: '',
    cashFlow: [
      { k: 'Dividends', v: 'None — growth stock', tone: 'muted' },
      { k: 'Broker fees (annual)', v: '−€24', tone: 'bad' },
      { k: 'Net cash flow', v: '€0 / month', tone: 'muted' },
    ],
    liquidity: [
      ['Liquidity score', '92/100'],
      ['Estimated time to cash', 'Instantly (market hours)'],
      ['Expected exit costs', '~0.1%'],
      ['Urgent-sale discount', 'None'],
      ['Partial sale', 'Available — fully divisible'],
      ['Legal restrictions', 'None'],
      ['Price confidence', 'Public market price'],
    ],
    risks: [
      'Single-company risk',
      'High price volatility',
      'USD currency risk',
      'Sector concentration (with NVDA exposure)',
    ],
    options: ['Keep', 'Sell part', 'Sell all', 'Hedge', 'Set alert', 'Move to another goal'],
    copilotContext: [
      'Tesla position',
      'Your growth goal',
      'Concentration profile',
      'Current market data',
    ],
    questions: [
      'What happens if I sell half my position?',
      'How does it affect my overall risk?',
      'Compare with a broad ETF',
      'Set a downside alert',
    ],
  },
};

export const ASSET_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'cash', label: 'Cash Flow' },
  { id: 'liquidity', label: 'Liquidity' },
  { id: 'risk', label: 'Risk' },
  { id: 'options', label: 'Explore my options' },
] as const;

export const LIQUIDITY_DIMENSIONS_NOTE =
  'Liquidity is not one number. These six dimensions — time, cost, discount under pressure, divisibility, legal restrictions and price confidence — can point in different directions for the same asset.';

export const LIABILITIES = [
  {
    name: 'Mortgage — Bank of Cyprus',
    balance: '€170,000',
    terms: '4.2% variable · €1,420/month · matures 2041 · early repayment allowed',
    linked: 'Limassol apartment (€600K → €430K net)',
  },
  {
    name: 'Credit line — NorthBridge',
    balance: '€15,000',
    terms: '6.9% · revolving · interest-only',
    linked: '',
  },
];

export const LIABILITIES_NOTE =
  'Liabilities linked to an asset are shown net on the overview, never as free capital.';

export const SCENARIO_TYPES = ['Buy', 'Sell', 'Reallocate', 'Finance', 'Monetize', 'Hold'];

export const SCENARIO_ASSETS = [
  { id: 'apt', label: 'Limassol apartment' },
  { id: 'tsla', label: 'Tesla position (half)' },
];

export type Scenario = {
  title: string;
  deltas: Array<[string, string]>;
  assumptions: string;
  negative: string;
  positive: string;
};

export const SCENARIOS: Record<string, Scenario> = {
  'Sell|apt': {
    title: 'Sell: Limassol apartment',
    deltas: [
      ['Net Wealth', '€1.21M → €1.19M (−€24K costs)'],
      ['Liquid Wealth', '+€396K'],
      ['Monthly cash flow', '−€470'],
      ['Debt load', '−€170K — mortgage repaid'],
      ['Country exposure (Cyprus)', '60% → 33%'],
      ['Concentration', '−43pp single asset'],
      ['Goal: Office 2028', '24% → 100% covered'],
      ['Taxes & transaction costs', '≈ €36K'],
      ['Time to execute', '4–8 months'],
      ['Confidence', 'Medium'],
    ],
    assumptions:
      'Sale at €580–620K; agent fee 3%; Cyprus capital-gains rules; mortgage repaid at closing.',
    negative: 'Urgent sale at −12%: net proceeds fall to ≈ €358K.',
    positive: 'Strong market +5%: net proceeds ≈ €424K.',
  },
  'Sell|tsla': {
    title: 'Sell: half of Tesla position (60 shares)',
    deltas: [
      ['Net Wealth', 'Unchanged (−€40 fees)'],
      ['Liquid Wealth', '+€17,600'],
      ['Concentration (TSLA)', '2.9% → 1.5%'],
      ['Expected return', 'Lower growth exposure'],
      ['Currency exposure (USD)', '11% → 9.7%'],
      ['Taxes', 'Jurisdiction-dependent'],
      ['Time to execute', 'Instant (market hours)'],
      ['Confidence', 'High'],
    ],
    assumptions: 'Execution at market price $317.42; fees 0.1%; no lock-ups.',
    negative: 'Price gaps −5% before execution: proceeds ≈ €16,700.',
    positive: 'Limit order fills +2%: proceeds ≈ €17,950.',
  },
  'Reallocate|*': {
    title: 'Reallocate: €30K idle cash → short-duration bond ETF',
    deltas: [
      ['Liquid Wealth', 'Still available within 1–7 days'],
      ['Monthly income', '+€92 (est. 3.7% yield)'],
      ['Idle capital', '€52K → €22K'],
      ['Risk', 'Slightly higher duration risk'],
      ['Goal: Emergency reserve', 'Unchanged — €22K stays instant'],
      ['Time to execute', '1 day'],
      ['Confidence', 'High'],
    ],
    assumptions:
      'Yield estimate from current short-duration EUR bond ETFs; reserve target kept in cash.',
    negative: 'Rates rise 0.5pp: temporary −1.2% mark-to-market.',
    positive: 'Rates fall 0.5pp: +1.1% price gain plus yield.',
  },
  'Finance|*': {
    title: 'Finance: refinance mortgage at 3.6%',
    deltas: [
      ['Monthly payment', '€1,420 → €1,315 (−€105)'],
      ['Total interest to 2041', '−€18,900 (est.)'],
      ['Net Wealth', '−€1,800 refinancing costs'],
      ['Monthly cash flow', '+€105'],
      ['Time to execute', '1–2 months'],
      ['Confidence', 'Medium — subject to bank approval'],
    ],
    assumptions: 'Offer at 3.6% fixed 5 years; fees €1,800; remaining term unchanged.',
    negative: 'Approval declined or rate 3.9%: benefit −€60/mo.',
    positive: 'Rate 3.4% negotiated: benefit +€125/mo.',
  },
};

export const SCENARIO_EMPTY =
  'Choose a scenario type to begin. A scenario models Buy, Sell, Reallocate, Finance, Monetize or Hold decisions against your full capital profile.';

export const SCENARIO_UNMODELLED =
  'This scenario type is part of the extended prototype — Sell, Reallocate and Finance are fully modelled here. Buy, Monetize and Hold follow the same pattern: assumptions, ranges, negative and positive cases.';

export const SCENARIO_DISCLAIMER =
  'A scenario is a model of one decision under stated assumptions. It is not a promise of results.';

export const WEALTH_HEALTH = [
  { k: 'Liquid share of capital', v: '14%', state: 'Low', tone: 'bad' as const },
  { k: 'Financial reserve', v: '17 months', state: 'Strong', tone: 'good' as const },
  { k: 'Concentration — single business', v: '34%', state: 'Elevated', tone: 'bad' as const },
  { k: 'Currency balance', v: '89% EUR', state: 'Watch', tone: 'warn' as const },
  { k: 'Debt load', v: '13% of assets', state: 'Comfortable', tone: 'good' as const },
  { k: 'Idle capital', v: '€52K', state: 'Above target', tone: 'warn' as const },
  { k: 'Outdated valuations', v: '1 asset', state: 'Update', tone: 'warn' as const },
  { k: 'Assets without a goal', v: '2 assets', state: 'Assign', tone: 'warn' as const },
];

export const DATA_SOURCES = [
  {
    name: 'TradingNew Portfolios',
    sub: 'Reads positions & prices · synced 09:45 UTC · 2 assets created',
    status: 'Connected',
    tone: 'good' as const,
  },
  {
    name: 'NorthBridge Securities',
    sub: 'Reads holdings · synced 09:45 UTC · 1 asset created',
    status: 'Connected',
    tone: 'good' as const,
  },
  {
    name: 'Bank accounts',
    sub: 'Balances and deposits',
    status: 'Not connected',
    tone: 'muted' as const,
  },
  {
    name: 'Manual sources',
    sub: '3 assets entered manually or via Copilot',
    status: 'Active',
    tone: 'info' as const,
  },
];

/** A source is not the asset it created — disconnecting one must not delete the other. */
export const SOURCE_NOTE =
  'Disconnecting a source never silently deletes your assets — they switch to manual mode and keep their last known value, source and date.';

export const ADD_WHAT = [
  { title: 'Asset', sub: 'Property, securities, cash, business, crypto…' },
  { title: 'Liability', sub: 'Mortgage, loan, credit line, tax obligation' },
  { title: 'Income source', sub: 'Rent, dividends, business profit' },
  { title: 'Financial goal', sub: 'Reserve, income, purchase, retirement' },
];

export const ADD_HOW = [
  { id: 'manual', title: 'Add manually', sub: 'A short form — details can come later' },
  { id: 'copilot', title: 'Link an existing platform asset', sub: 'From your watchlists and charts' },
  { id: 'auth', title: 'Connect an account', sub: 'Broker, bank or wallet' },
  { id: 'auth', title: 'Upload a statement', sub: 'PDF or CSV — Copilot extracts the data' },
  { id: 'copilot', title: 'Use Copilot', sub: 'Describe it in your own words' },
];

export const ADD_COPILOT_EXAMPLE =
  'I own an apartment in Limassol, bought in 2023 for 480 thousand, now worth about 600. There is a mortgage of 170 thousand left at 4.2 percent.';

export const ADD_COPILOT_RECOGNIZED = [
  ['Asset', 'Property — Limassol apartment'],
  ['Purchase', '2023 · €480,000'],
  ['Current value', '€600,000 (estimated)'],
  ['Linked liability', 'Mortgage €170,000 · 4.2%'],
];

/** The chat is an input method, not the record. Nothing is stored until confirmed. */
export const ADD_COPILOT_NOTE = 'Creates two linked records: one asset and one liability.';

export const ADD_SAVED_TOAST =
  '✓ Saved to your Wealth Record — previous version kept, source and date recorded, analytics recalculated.';

export const MANUAL_FIELDS = [
  'Asset type',
  'Name',
  'Estimated value',
  'Currency',
  'Country',
  'Ownership share',
];
