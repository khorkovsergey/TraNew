/**
 * The remaining nine scenarios.
 *
 * Written as the objects a model would have to return, and pushed through
 * `parsePlan` in the tests exactly as a model response is at runtime. Anything
 * that forgets a source, invents a module kind or omits provenance fails there
 * rather than reaching a canvas.
 *
 * They are deliberately not uniform. A screener answers with filters the person
 * can correct; a portfolio question answers with a permission request and
 * nothing else until it is granted; a beginner asks for questions back rather
 * than a portfolio. The shape of the answer is part of the answer.
 *
 * Import-free, so the harness compiles it alone.
 */

const NOW = '2026-08-03T09:15:00Z';

const quotes = {
  id: 'src_quotes',
  kind: 'MARKET DATA',
  provider: 'Twelve Data',
  at: NOW,
  detail: 'Prices and volumes',
  delayed: true,
};

const filings = {
  id: 'src_filings',
  kind: 'FILINGS',
  provider: 'SEC EDGAR',
  at: '2026-07-28T00:00:00Z',
  detail: 'Latest annual and quarterly reports',
};

const detection = {
  id: 'src_detect',
  kind: 'DETECTION',
  provider: 'TradingNew',
  at: NOW,
  detail: 'Computed on the visible series',
};

const learning = {
  id: 'src_learn',
  kind: 'EDUCATIONAL',
  provider: 'TradingNew Academy',
  at: '2026-06-01T00:00:00Z',
};

/* ------------------------------------------------------- Technology sell-off */

export const SELLOFF = {
  mode: 'analyse',
  because: 'you asked why a group of stocks moved, which is a question about breadth',
  steps: ['Read it as a sector question', 'Compare the 11 sectors', 'Look inside technology', 'Say what it does and does not show'],
  work: [
    { id: 'w1', label: 'Comparing 11 sectors', done: false },
    { id: 'w2', label: 'Ranking technology sub-industries', done: false },
  ],
  sources: [quotes, detection],
  assumptions: [{ id: 'a1', label: 'Window', value: 'Five sessions', editable: true }],
  modules: [
    {
      id: 'm_heat',
      kind: 'heatmap',
      title: 'How the sectors moved',
      subtitle: 'Five sessions to today',
      provenance: ['market-data'],
      sourceIds: ['src_quotes'],
      data: {
        cells: [
          { label: 'Semiconductors', value: '−6.2%', sign: -1 },
          { label: 'Software', value: '−1.8%', sign: -1 },
          { label: 'Hardware', value: '−0.4%', sign: -1 },
          { label: 'Energy', value: '+3.1%', sign: 1 },
          { label: 'Healthcare', value: '+1.9%', sign: 1 },
          { label: 'Utilities', value: '+1.2%', sign: 1 },
        ],
      },
      actions: [],
    },
    {
      id: 'm_why',
      kind: 'text-insight',
      title: 'What this shows, and what it does not',
      provenance: ['inference'],
      sourceIds: ['src_detect'],
      data: {
        body:
          'The fall is almost entirely semiconductors: software is down a third as much and hardware is flat. That is a narrow move inside one sector rather than technology as a whole reversing. What the prices cannot tell you is why — for that you need the reporting, and this workspace does not have a view on it.',
      },
      actions: [],
    },
  ],
};

/* ------------------------------------------------------------- Comparison */

export const COMPARE = {
  mode: 'analyse',
  because: 'you named three companies, so the answer is a comparison rather than a summary',
  steps: ['Identify the three companies', 'Pull the latest filings', 'Line the metrics up', 'Say what is not comparable'],
  work: [
    { id: 'w1', label: 'Reading three annual reports', done: false },
    { id: 'w2', label: 'Normalising fiscal years', done: false },
  ],
  sources: [quotes, filings],
  assumptions: [
    { id: 'a1', label: 'Period', value: 'Most recent full year', editable: true },
    { id: 'a2', label: 'Currency', value: 'USD', editable: false },
  ],
  modules: [
    {
      id: 'm_table',
      kind: 'comparison-table',
      title: 'Side by side',
      subtitle: 'Most recent full financial year, as filed',
      provenance: ['market-data'],
      sourceIds: ['src_filings'],
      data: {
        columns: ['NVDA', 'AMD', 'AVGO'],
        rows: [
          { label: 'Revenue', cells: ['$130.5bn', '$25.8bn', '$51.6bn'] },
          { label: 'Gross margin', cells: ['75%', '49%', '63%'] },
          { label: 'Operating margin', cells: ['62%', '8%', '30%'] },
          { label: 'Fiscal year ends', cells: ['January', 'December', 'October'] },
        ],
      },
      actions: [{ id: 'open_chart', label: 'Open in Supercharts', mutates: false }],
    },
    {
      id: 'm_caveat',
      kind: 'text-insight',
      title: 'Where the comparison breaks down',
      provenance: ['inference', 'educational'],
      sourceIds: ['src_filings'],
      data: {
        body:
          'These three do not end their financial years in the same month, so "most recent full year" covers different stretches of the same market. The margin gap is real; the revenue comparison is between periods that only partly overlap. Nothing here says which is the better investment — that depends on what you are buying it for.',
      },
      actions: [],
    },
  ],
};

/* ------------------------------------------------------------ Chart build */

export const CHART = {
  mode: 'build',
  because: 'you asked for something to be put on a chart',
  steps: ['Read the instrument and the studies', 'Detect the levels', 'Assemble the chart', 'Offer it before applying'],
  work: [
    { id: 'w1', label: 'Loading Tesla daily bars', done: false },
    { id: 'w2', label: 'Detecting support and resistance', done: false },
  ],
  sources: [quotes, detection],
  assumptions: [
    { id: 'a1', label: 'Interval', value: 'Daily', editable: true },
    { id: 'a2', label: 'RSI length', value: '14', editable: true },
  ],
  modules: [
    {
      id: 'm_chart',
      kind: 'chart',
      title: 'Tesla, daily, with RSI and detected levels',
      subtitle: 'Nothing is applied to your chart until you say so',
      provenance: ['market-data', 'inference'],
      sourceIds: ['src_quotes', 'src_detect'],
      data: {
        symbol: 'TSLA',
        interval: '1D',
        studies: ['rsi'],
        zones: 3,
        /*
         * The chart in words. Required, not optional: a canvas is opaque to a
         * screen reader, and the accessibility rules put a text summary beside
         * every chart rather than leaving the module unreadable.
         */
        summary:
          'Tesla daily bars over the last year, with a 14-period RSI below and three horizontal levels the detector found. Price fell from roughly 372 in February to a low near 252 in late May, then recovered to about 311. RSI is currently mid-range at 54 — neither stretched nor washed out.',
      },
      actions: [{ id: 'apply_chart', label: 'Apply to chart', mutates: true }],
    },
    {
      id: 'm_levels',
      kind: 'ranked-rows',
      title: 'Levels it found',
      provenance: ['inference'],
      sourceIds: ['src_detect'],
      data: {
        rows: [
          { name: '316.99', note: 'Tested four times since April', value: 'Resistance' },
          { name: '280.54', note: 'Held twice in June', value: 'Support' },
          { name: '244.09', note: 'One touch, weak', value: 'Support' },
        ],
      },
      actions: [],
    },
  ],
};

/* ----------------------------------------------------------------- Screener */

export const SCREEN = {
  mode: 'screen',
  because: 'you described a set of companies rather than naming one',
  steps: ['Turn the sentence into filters', 'Show the filters before running', 'Run the screen', 'Rank what came back'],
  work: [
    { id: 'w1', label: 'Screening 4 218 companies', done: false },
    { id: 'w2', label: 'Applying four filters', done: false },
  ],
  // `learning` is here because the closing card cites it. The contract refuses
  // a module whose sources are not in the response, which is how this was found.
  sources: [filings, learning],
  assumptions: [{ id: 'a1', label: 'Universe', value: 'US listed, above $2bn', editable: true }],
  modules: [
    {
      id: 'm_filters',
      kind: 'interpreted-filters',
      title: 'How the request was read',
      provenance: ['inference'],
      sourceIds: [],
      data: {
        filters: [
          { label: 'Listed in the US' },
          { label: 'Sector: Technology' },
          { label: 'Revenue growth > 0% for 3 years' },
          { label: 'Free cash flow > 0' },
        ],
      },
      actions: [],
    },
    {
      id: 'm_results',
      kind: 'ranked-rows',
      title: '38 companies matched',
      subtitle: 'Ranked by three-year revenue growth',
      provenance: ['market-data'],
      sourceIds: ['src_filings'],
      data: {
        rows: [
          { name: 'NVDA', note: 'Semiconductors', value: '+114%', sign: 1 },
          { name: 'AVGO', note: 'Semiconductors', value: '+44%', sign: 1 },
          { name: 'MSFT', note: 'Software', value: '+38%', sign: 1 },
          { name: 'NOW', note: 'Software', value: '+31%', sign: 1 },
        ],
      },
      actions: [{ id: 'watchlist', label: 'Create a watchlist', mutates: true }],
    },
    {
      id: 'm_note',
      kind: 'text-insight',
      title: 'What a screen is and is not',
      provenance: ['educational'],
      sourceIds: ['src_learn'],
      data: {
        body:
          'A screen is a filter over past filings. It says which companies met the test, not which will keep meeting it, and it has no view on price. Everything here is a starting list for research.',
      },
      actions: [],
    },
  ],
};

/* ---------------------------------------------------------------- Portfolio */

export const PORTFOLIO = {
  mode: 'analyse',
  because: 'this needs your own holdings, which are not read until you allow it',
  steps: ['Recognise that this needs your data', 'Ask for the narrowest scope that answers it', 'Wait'],
  work: [],
  sources: [],
  assumptions: [],
  modules: [
    {
      id: 'm_permission',
      kind: 'permission-request',
      title: 'This needs your Wealth Hub',
      subtitle: 'Nothing is read until you grant it, and you can revoke it in one click',
      provenance: ['your-data'],
      sourceIds: [],
      data: {
        scopes: [
          {
            id: 'holdings',
            label: 'Which assets you hold, and their weights',
            required: true,
          },
          {
            id: 'values',
            label: 'What each holding is worth',
            required: false,
            note: 'Refusing this keeps the analysis to proportions. Concentration still works; anything in currency does not.',
          },
          {
            id: 'history',
            label: 'When you bought them',
            required: false,
            note: 'Refusing this loses gains and holding periods.',
          },
        ],
        note: 'The analysis works without values — it can talk about concentration without knowing the amounts.',
      },
      actions: [
        { id: 'grant', label: 'Choose scopes and continue', mutates: true },
        { id: 'decline', label: 'Not now', mutates: false },
      ],
    },
  ],
};

/* ----------------------------------------------------------------- Monitor */

export const MONITOR = {
  mode: 'monitor',
  because: 'you asked to be told when something happens rather than what it is now',
  steps: ['Read the condition', 'Show the rule before creating it', 'Wait for you to enable it'],
  work: [{ id: 'w1', label: 'Reading five years of valuation history', done: false }],
  sources: [quotes, filings],
  assumptions: [{ id: 'a1', label: 'Baseline', value: 'Five-year median', editable: true }],
  modules: [
    {
      id: 'm_rule',
      kind: 'monitoring-rule',
      title: 'The rule this would create',
      subtitle: 'Nothing is created until you enable it',
      provenance: ['market-data', 'inference'],
      sourceIds: ['src_quotes', 'src_filings'],
      data: {
        rows: [
          { label: 'Instrument', value: 'NVDA' },
          { label: 'Measure', value: 'Forward price/earnings' },
          { label: 'Condition', value: 'Falls below the five-year median' },
          { label: 'Median now', value: '34.2×' },
          { label: 'Current', value: '38.3×' },
          { label: 'Tells you', value: 'By email, once, then pauses' },
        ],
      },
      actions: [{ id: 'enable_rule', label: 'Enable this rule', mutates: true }],
    },
  ],
};

/* ---------------------------------------------------------------- Beginner */

export const BEGINNER = {
  mode: 'learn',
  because: 'you described a situation rather than asking about an instrument',
  steps: ['Recognise this as a planning question', 'Ask what actually decides it', 'Wait for the answers'],
  work: [],
  sources: [learning],
  assumptions: [],
  modules: [
    {
      id: 'm_questions',
      kind: 'guided-questions',
      title: 'Three things that decide this',
      subtitle: 'None of them is which fund is best',
      provenance: ['educational'],
      sourceIds: ['src_learn'],
      data: {
        questions: [
          { id: 'q1', text: 'How long can the money stay invested before you might need it?' },
          { id: 'q2', text: 'If it fell 30% in a year, would you add, hold or sell?' },
          { id: 'q3', text: 'Is there any debt costing more than a portfolio is likely to earn?' },
        ],
      },
      actions: [],
    },
    {
      id: 'm_note',
      kind: 'text-insight',
      title: 'Why questions and not an answer',
      provenance: ['educational'],
      sourceIds: ['src_learn'],
      data: {
        body:
          'A monthly amount is the easy part. What it should buy depends on when you need it back and what you would do in a bad year, and nobody can answer those for you. This is educational analysis, not personalised advice.',
      },
      actions: [],
    },
  ],
};

/* ------------------------------------------------------- Carried context */

export const GOLD = {
  mode: 'analyse',
  because: 'you carried this question in from the assistant on another screen',
  steps: ['Take the context that came with you', 'Fetch the series', 'Say what moved with it'],
  work: [{ id: 'w1', label: 'Loading three years of gold', done: false }],
  sources: [
    quotes,
    {
      id: 'src_carried',
      kind: 'CARRIED CONTEXT',
      provider: 'Voyager, from the Markets screen',
      at: NOW,
      detail: 'You were looking at gold when you asked',
    },
  ],
  assumptions: [{ id: 'a1', label: 'Window', value: 'Three months', editable: true }],
  modules: [
    {
      id: 'm_metrics',
      kind: 'metric-row',
      title: 'Gold over three months',
      provenance: ['market-data'],
      sourceIds: ['src_quotes'],
      data: {
        metrics: [
          { label: 'Change', value: '+11.4%', sign: 1 },
          { label: 'High', value: '$2 684', sign: 1 },
          { label: 'Low', value: '$2 341', sign: -1 },
        ],
      },
      actions: [{ id: 'open_chart', label: 'Open in Supercharts', mutates: false }],
    },
    {
      id: 'm_context',
      kind: 'text-insight',
      title: 'What moved alongside it',
      provenance: ['market-data', 'inference'],
      sourceIds: ['src_quotes', 'src_carried'],
      data: {
        body:
          'Real yields fell over the same stretch and the dollar weakened. Gold has historically moved against both, so the direction is consistent — but three months is three months, and "consistent with" is not "caused by". This workspace can show you the two series together; it cannot tell you which way the causation ran.',
      },
      actions: [],
    },
  ],
};

/* --------------------------------------------------------------------- Pine */

export const PINE = {
  mode: 'build',
  because: 'you asked for an indicator, which is a script rather than a chart setting',
  steps: ['Read what the indicator should detect', 'Write it in Pine v6', 'Check it', 'Offer it before applying'],
  work: [
    { id: 'w1', label: 'Writing the script', done: false },
    { id: 'w2', label: 'Validating Pine Script', done: false },
  ],
  sources: [detection],
  assumptions: [
    { id: 'a1', label: 'Fast length', value: '20', editable: true },
    { id: 'a2', label: 'Slow length', value: '50', editable: true },
  ],
  modules: [
    {
      id: 'm_pine',
      kind: 'pine-editor',
      title: 'A possible trend reversal',
      subtitle: 'Generated, then checked — the checker reads the source, it does not run Pine',
      provenance: ['inference'],
      sourceIds: ['src_detect'],
      data: {
        source:
          '//@version=6\nindicator("Possible reversal", overlay = true)\nfast = ta.ema(close, 20)\nslow = ta.ema(close, 50)\nplot(fast)\nplot(slow)\nplotshape(ta.cross(fast, slow), style = shape.circle)',
        diagnostics: [],
      },
      actions: [
        { id: 'open_lab', label: 'Open in Script Lab', mutates: false },
        { id: 'apply_chart', label: 'Apply to chart', mutates: true },
      ],
    },
  ],
};
