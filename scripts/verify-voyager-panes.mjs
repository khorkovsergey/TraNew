import { chromium } from 'playwright';

/**
 * Voyager's panes, in a real browser, read off the pixels.
 *
 * The unit suite proves that a clamped specification turns into pane requests
 * with a scale each. What it cannot prove is that any of it reaches the screen:
 * that the canvas is the size the layout thinks it is, that a study in the spec
 * ends up painted rather than skipped, and that three panes under the price do
 * not squash the candles into a stripe.
 *
 * That distinction is the whole of Acceptance E. Voyager spent a release with
 * RSI in its vocabulary and no pane to draw it in, and a suite that checked for
 * the word "RSI" in a caption would have passed throughout. So nothing here
 * trusts a label: the band boundaries are predicted from the layout rules in
 * `panes.ts` — 74 pixels a secondary pane, 24 for the time axis, the
 * secondaries scaled together past 60% of the plot — and then the canvas is
 * asked whether that is what was painted.
 *
 * The answers are stubbed in the browser, exactly as `verify-voyager-chat.mjs`
 * does it: the daily allowance is per visitor and lives in the deployed
 * database, and a suite that spends questions to find out whether a pane is
 * drawn stops passing after the fifth run of the day. Nothing in the
 * application changes — the quota is still counted and still enforced on the
 * server, and there is no flag that turns it off.
 *
 * What is stubbed is the answer. What is measured is the rendering, which is
 * the part under test. The one exception is marked where it appears: the Renko
 * group asserts that a handoff *renders*, not that the planner chose it — that
 * decision is deterministic and belongs to the unit suite.
 *
 *   npm run dev -- -p 3401
 *   BASE_URL=http://localhost:3401 node scripts/verify-voyager-panes.mjs
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3401';

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? `  — ${detail}` : ''}`);
  }
}

function group(title) {
  console.log(`\n${title}`);
}

/* ------------------------------------------------------------- The fixture */

/** A daily series with a real volume on every bar. */
function fixtureBars(count) {
  const start = Date.parse('2026-01-05T00:00:00Z') / 1000;

  return Array.from({ length: count }, (_, index) => {
    /* A shape rather than a ramp: RSI on a monotonic series pins to 100 and
       draws a flat line at the top of its pane, which would pass a "there is
       ink in the band" check while showing nothing anybody wants. */
    const close = 100 + Math.sin(index / 6) * 12 + index * 0.2;
    return {
      time: start + index * 86_400,
      open: close - 0.6,
      high: close + 1.4,
      low: close - 1.4,
      close,
      volume: 1_000_000 * (1 + (index % 5) * 0.4),
    };
  });
}

const STUDY_PARAMS = {
  sma: { fast: 20, slow: 50 },
  rsi: { length: 14 },
  macd: { fast: 12, slow: 26, signal: 9 },
  volume: {},
};

function chartAnswer(studies, options = {}) {
  return {
    contentType: 'AI analysis',
    text: 'Here is the chart you asked for.',
    bullets: [],
    sources: 'Twelve Data',
    confidence: 'medium',
    actions: [],
    followUps: [],
    citations: [{ label: 'Market data & news' }],
    tools: ['history(TSLA 1D)', 'chart(candles)'],
    chart: {
      spec: {
        version: 1,
        kind: 'candles',
        series: [{ assetId: 'stock:TSLA', symbol: 'TSLA', label: 'Tesla, Inc.', field: 'close' }],
        range: { start: '2026-01-01', end: '2026-04-01' },
        interval: '1D',
        studies: studies.map((id) => ({ id, params: STUDY_PARAMS[id] })),
        sourceMeta: {
          provider: 'Twelve Data',
          firstObservation: '2026-01-05',
          lastObservation: '2026-03-06',
          delayed: true,
          derivedFromDaily: false,
          hasVolume: options.hasVolume !== false,
        },
        refused: options.refused ?? [],
      },
      series: [{ assetId: 'stock:TSLA', bars: fixtureBars(70) }],
    },
  };
}

async function stub(page, answer) {
  await page.unroute('**/api/voyager').catch(() => {});
  await page.unroute('**/api/voyager?*').catch(() => {});

  await page.route('**/api/voyager?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tier: 'basic',
        tierLabel: 'Voyager Basic',
        limits: 'Basic',
        sources: [{ id: 'page', label: 'Current page' }],
        remaining: 10,
        used: 0,
        total: 10,
        signedIn: false,
        personalization: null,
        modelConfigured: true,
      }),
    });
  });

  await page.route('**/api/voyager', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        answer,
        tier: 'basic',
        remaining: 9,
        used: 1,
        total: 10,
        quotaReached: false,
      }),
    });
  });
}

/* ---------------------------------------------------------------- The read */

/**
 * What the canvas actually contains, in device pixels.
 *
 * Computed inside the page: moving a million pixels across the bridge once per
 * state costs more than the whole rest of the suite.
 */
async function readCanvas(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('figure canvas');
    const box = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;

    const dpr = width / box.width;
    /* The right-hand gutter is the scale column — 66 CSS pixels, from
       `panes.ts`. Everything left of it is plot. */
    const plotWidth = Math.round((box.width - 66) * dpr);

    const at = (x, y) => {
      const i = (y * width + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };

    const surface = at(2, Math.round(height / 2) - 1);
    const isSurface = ([r, g, b]) =>
      Math.abs(r - surface[0]) < 6 && Math.abs(g - surface[1]) < 6 && Math.abs(b - surface[2]) < 6;
    /* Candles, study lines and volume columns are coloured; grid, separators,
       pane titles and axis text are grey. Saturation separates them without
       hard-coding a palette the stylesheet owns. */
    const isColoured = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b) > 12;

    const rows = [];
    for (let y = 0; y < height; y += 1) {
      let coloured = 0;
      let uniform = 0;
      const first = at(0, y);

      for (let x = 0; x < plotWidth; x += 1) {
        const pixel = at(x, y);
        if (isColoured(pixel)) coloured += 1;
        if (
          !isSurface(pixel) &&
          Math.abs(pixel[0] - first[0]) < 4 &&
          Math.abs(pixel[1] - first[1]) < 4 &&
          Math.abs(pixel[2] - first[2]) < 4
        ) {
          uniform += 1;
        }
      }

      rows.push({ coloured, uniform });
    }

    return {
      dpr,
      cssHeight: box.height,
      height,
      plotWidth,
      rows,
      /** Rows that are one colour the whole way across: a grid line or a separator. */
      fullWidth: rows
        .map((row, y) => ({ y, ...row }))
        .filter((row) => row.uniform > plotWidth * 0.94)
        .map((row) => row.y),
    };
  });
}

/**
 * Where the panes must be, from the rules rather than from the picture.
 *
 * The arithmetic is `buildPaneLayout`'s, restated: a secondary pane asks for 74
 * pixels, the price keeps at least 80, and past 60% of the plot the secondaries
 * are scaled down together rather than any of them being dropped.
 */
function expectedBands(frame, count) {
  const plot = frame.cssHeight - 24;
  const requested = count * 74;
  const roomBelowMain = Math.max(0, plot - 80);
  const allowance = count
    ? Math.max(Math.min(count * 40, roomBelowMain), Math.min(requested, roomBelowMain, plot * 0.6))
    : 0;

  const each = count ? (allowance / requested) * 74 : 0;
  const main = plot - each * count;

  const bands = [{ id: 'price', from: 0, to: main }];
  for (let i = 0; i < count; i += 1) {
    bands.push({ id: `pane-${i}`, from: main + i * each, to: main + (i + 1) * each });
  }

  return bands.map((band) => ({
    ...band,
    from: band.from * frame.dpr,
    to: band.to * frame.dpr,
  }));
}

function ruleAt(frame, y) {
  return frame.fullWidth.some((row) => Math.abs(row - y) <= Math.ceil(frame.dpr) + 1);
}

function inkIn(frame, from, to) {
  let total = 0;
  for (let y = Math.max(0, Math.round(from)); y < Math.min(frame.height, Math.round(to)); y += 1) {
    total += frame.rows[y].coloured;
  }
  return total;
}

/** The first and last rows of a band carrying a coloured pixel. */
function inkSpan(frame, from, to) {
  let first = -1;
  let last = -1;
  for (let y = Math.max(0, Math.round(from)); y < Math.min(frame.height, Math.round(to)); y += 1) {
    if (frame.rows[y].coloured > 0) {
      if (first === -1) first = y;
      last = y;
    }
  }
  return first === -1 ? 0 : last - first;
}

/* ----------------------------------------------------------------- The run */

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

/**
 * The page, open and ready to be typed into.
 *
 * Waiting on a timer here is the flake this avoids. The composer is inside a
 * form, and a keypress before React has hydrated submits it natively: the
 * browser navigates to `?`, the question is lost, and the failure reads as a
 * chart that was never drawn. Which state it hits is a matter of how busy the
 * dev server was that second.
 *
 * The bootstrap read is the signal, because only hydrated client code issues
 * it. Once that response has landed, the handlers are attached — there is no
 * duration to tune.
 */
async function openVoyager(page) {
  await page.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => sessionStorage.clear());

  const bootstrap = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' && response.url().includes('/api/voyager'),
    { timeout: 30_000 }
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await bootstrap;
  await page.getByRole('textbox', { name: 'Ask Voyager' }).waitFor({ state: 'visible' });
}

async function ask(question, answer) {
  await stub(page, answer);
  await openVoyager(page);
  await page.getByRole('textbox', { name: 'Ask Voyager' }).fill(question);
  await page.keyboard.press('Enter');
  await page.waitForSelector('figure canvas', { timeout: 30_000 });
  // The engine initialises asynchronously and paints on the next frame.
  await page.waitForTimeout(900);
}

/**
 * One state, measured.
 *
 * `count` is panes below the price, not studies: an overlay costs the chart no
 * height, and volume with a volume average would cost one pane between them.
 */
async function measure(question, studies, count) {
  await ask(question, chartAnswer(studies));
  const frame = await readCanvas(page);
  const bands = expectedBands(frame, count);
  return { frame, bands };
}

group('Candles alone: one pane, and the price has all of it');

{
  const { frame, bands } = await measure('Show Tesla candles', [], 0);
  check('the chart is on a canvas', frame.height > 0);
  check('there is one band, and it is the price', bands.length === 1);
  check('the candles are painted in it', inkIn(frame, bands[0].from, bands[0].to) > 400);
  check(
    'and they fill it rather than sitting in a stripe',
    inkSpan(frame, bands[0].from, bands[0].to) > (bands[0].to - bands[0].from) * 0.5,
    `${inkSpan(frame, bands[0].from, bands[0].to)} of ${Math.round(bands[0].to - bands[0].from)}`
  );
}

group('Candles and RSI: a second pane, with a scale of its own');

{
  const { frame, bands } = await measure('Show NVDA with RSI', ['rsi'], 1);
  check('a rule separates the price from the pane below it', ruleAt(frame, bands[1].from));
  check('the price pane is painted', inkIn(frame, bands[0].from, bands[0].to) > 400);
  check(
    'and so is the RSI pane — the study is drawn, not described',
    inkIn(frame, bands[1].from, bands[1].to) > 30,
    String(inkIn(frame, bands[1].from, bands[1].to))
  );
  check(
    'the candles still fill the price pane, so its scale was not shared',
    inkSpan(frame, bands[0].from, bands[0].to) > (bands[0].to - bands[0].from) * 0.5,
    `${inkSpan(frame, bands[0].from, bands[0].to)} of ${Math.round(bands[0].to - bands[0].from)}`
  );

  const caption = await page.locator('figcaption').first().innerText();
  check('the caption calls it a pane', /RSI 14 in a pane below the price/.test(caption), caption);
}

group('Candles and MACD');

{
  const { frame, bands } = await measure('Show AAPL candles with MACD', ['macd'], 1);
  check('the MACD pane is separated by a rule', ruleAt(frame, bands[1].from));
  check(
    'and carries ink of its own — line, signal and histogram',
    inkIn(frame, bands[1].from, bands[1].to) > 60,
    String(inkIn(frame, bands[1].from, bands[1].to))
  );
  check('the price pane is untouched by it', inkIn(frame, bands[0].from, bands[0].to) > 400);
}

group('Candles and volume');

{
  const { frame, bands } = await measure('Show Tesla candles with volume', ['volume'], 1);
  check('the volume pane is separated by a rule', ruleAt(frame, bands[1].from));
  check(
    'and the columns are painted in it',
    inkIn(frame, bands[1].from, bands[1].to) > 200,
    String(inkIn(frame, bands[1].from, bands[1].to))
  );
  check(
    'a million-share bar did not become the price scale',
    inkSpan(frame, bands[0].from, bands[0].to) > (bands[0].to - bands[0].from) * 0.5,
    `${inkSpan(frame, bands[0].from, bands[0].to)} of ${Math.round(bands[0].to - bands[0].from)}`
  );
}

group('All three at once');

{
  const { frame, bands } = await measure(
    'Show NVDA candles with volume, RSI and MACD',
    ['rsi', 'macd', 'volume'],
    3
  );

  check('one chart, not three', (await page.locator('figure canvas').count()) === 1);

  for (let i = 1; i < bands.length; i += 1) {
    check(`pane ${i} starts where the layout says it does`, ruleAt(frame, bands[i].from));
    check(
      `pane ${i} has something drawn in it`,
      inkIn(frame, bands[i].from, bands[i].to) > 20,
      String(inkIn(frame, bands[i].from, bands[i].to))
    );
  }

  check(
    'and the price still fills the pane above them',
    inkSpan(frame, bands[0].from, bands[0].to) > (bands[0].to - bands[0].from) * 0.5,
    `${inkSpan(frame, bands[0].from, bands[0].to)} of ${Math.round(bands[0].to - bands[0].from)}`
  );

  const caption = await page.locator('figcaption').first().innerText();
  check('the caption counts them', /3 panes below the price/.test(caption), caption);
}

group('Renko still leaves, and says why');

/*
 * The decision is not what is under test here — the capability table decides
 * it, deterministically, and the unit suite walks the whole table. What this
 * checks is that the handoff still *renders* as a real destination once the
 * panes exist beside it.
 */
{
  await stub(page, {
    contentType: 'AI explanation',
    text: 'Renko is not one of the chart types here — the professional chart draws it.',
    bullets: [],
    sources: 'Voyager',
    confidence: 'high',
    actions: [],
    followUps: [],
    handoff: {
      kind: 'chart',
      url: 'https://www.tradingview.com/chart/?symbol=NASDAQ%3ANVDA&interval=D',
      carried: [
        { label: 'Symbol', value: 'NASDAQ:NVDA' },
        { label: 'Timeframe', value: '1D' },
      ],
      manual: ['renko', 'session volume profile', 'The exact date range — the chart opens on TradingView’s default window.'],
      because: [
        'Renko is not one of the chart types here.',
        'Session volume profile is not built here.',
      ],
    },
  });

  await openVoyager(page);
  await page
    .getByRole('textbox', { name: 'Ask Voyager' })
    .fill('Build a Renko chart for NVDA with Session Volume Profile');
  await page.keyboard.press('Enter');
  await page.waitForSelector('a[href^="https://www.tradingview.com/chart/"]', { timeout: 30_000 });

  const link = page.getByRole('link', { name: /TradingView/i }).first();
  check('the destination is offered', (await link.count()) === 1);
  check(
    'and it is TradingView, with the symbol on it',
    /^https:\/\/www\.tradingview\.com\/chart\/\?symbol=NASDAQ%3ANVDA/.test(
      (await link.getAttribute('href')) ?? ''
    ),
    (await link.getAttribute('href')) ?? 'no href'
  );

  const body = await page.locator('body').innerText();
  check('the reason is Renko, not an oscillator', /Renko is not one of the chart types/i.test(body));
  check(
    'and nothing promises it later',
    !/not yet|coming soon|in a future/i.test(body),
    body.slice(0, 200)
  );
  check(
    'no chart was drawn for a chart type this product does not draw',
    (await page.locator('figure canvas').count()) === 0
  );
}

await browser.close();

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
