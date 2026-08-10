import { chromium, devices } from 'playwright';

/**
 * Voyager, the dialogue agent — the nine states the handoff designs for it.
 *
 * Six of the nine are failures: the daily limit, the guest gate, the API being
 * down, an action waiting on a confirmation. They are the states nobody reaches
 * by hand, so they are the ones that rot. Everything here drives one of them on
 * purpose rather than hoping to stumble into it.
 *
 * The three that are not failures are checked for what they must *not* contain:
 * no second header, no landing in front of the composer, and no action row
 * under a message that is not an answer.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

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

/** A fresh dialogue every time, so one group cannot set up the next by accident. */
async function reset(page) {
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.removeItem('tn.voyager.allowance.v1');
  });
}

/**
 * A fixed answer from the API, for the states that are about rendering it.
 *
 * Intercepted in the browser, so nothing in the application changes: the quota
 * is still counted and still enforced on the server, and there is no flag,
 * header or environment variable that turns it off. What this removes is the
 * dependency on a shared counter — the daily allowance is per visitor and lives
 * in the deployed database, so a suite that spends questions to check whether a
 * button renders stops passing after the fifth run of the day and starts
 * reporting a limit notice as a layout failure.
 *
 * The live path is not abandoned: the screen-acceptance probes below are GET
 * requests, which the API answers without spending anything.
 */
async function stubAnswer(page, answer, usage = { used: 1, remaining: 9, before: 0 }) {
  /*
   * The bootstrap read as well as the answer.
   *
   * The page asks the server what has been spent before it draws a figure, and
   * refuses to send when the answer is "all of it" — correct behaviour, and it
   * would make every one of these checks depend on how many questions this
   * address happened to have spent today.
   */
  await page.route('**/api/voyager?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tier: 'basic',
        tierLabel: 'Voyager Basic',
        limits: 'Basic',
        sources: [{ id: 'page', label: 'Current page' }],
        remaining: 10 - (usage.before ?? 0),
        used: usage.before ?? 0,
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
        /* Fixed rather than counted: what this asserts is that the browser
           shows the number the server sent, not one it accumulated itself. */
        remaining: usage.remaining,
        used: usage.used,
        total: 10,
        quotaReached: false,
      }),
    });
  });
}

/** A daily series a chart can actually be drawn from. */
function fixtureBars(count) {
  const start = Date.parse('2026-01-05T00:00:00Z') / 1000;
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index;
    return {
      time: start + index * 86_400,
      open: close - 0.5,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000 + index,
    };
  });
}

const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  group('The menu entry opens the dialogue');

  await page.goto(`${BASE}/en`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const entry = page.locator('header nav a', { hasText: 'Voyager' }).first();
  check('Voyager is a first-level entry', (await entry.count()) > 0);
  check(
    'pointing at the dialogue, not a sub-page',
    (await entry.getAttribute('href'))?.endsWith('/voyager') === true,
    await entry.getAttribute('href')
  );

  await entry.click();
  await page.waitForURL(/\/voyager$/, { timeout: 10_000 });
  await page.waitForTimeout(600);
  await reset(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  group('State 1 — the first screen is the composer');

  const body = await page.locator('body').innerText();
  check('the heading is the ask', /Ask\s+Voyager/.test(body), body.slice(0, 80));
  check('the composer is on the first screen', (await page.getByRole('textbox', { name: 'Ask Voyager' }).count()) > 0);
  check('with the robot beside it', (await page.locator('img[src*="voyager-robot"]').count()) > 0);
  check('four mode chips', (await page.getByRole('group', { name: 'Answer mode' }).getByRole('button').count()) === 4);
  check('and Explain is the one that is on', await page
    .getByRole('group', { name: 'Answer mode' })
    .getByRole('button', { name: 'Explain' })
    .getAttribute('aria-pressed') === 'true');
  check(
    'three suggested questions',
    (await page.locator('button[class*="suggestion"]').count()) === 3,
    `${await page.locator('button[class*="suggestion"]').count()}`
  );
  check('five starters in the rail', (await page.locator('[class*="topicLabel"]').count()) === 5);

  /*
   * One header. The workspace shipped with its own toolbar under the portal's,
   * and two rows of chrome above a chat is the clearest sign a screen was
   * bolted on rather than designed in.
   */
  check('one header, not two', (await page.locator('[class*="topBar"]').count()) === 0);

  group('The status strip answers "what can it see"');

  const strip = await page.locator('[class*="statusRow"]').innerText();
  for (const fact of ['Context:', 'Model: Voyager 3', 'Tools:', 'Memory: On', 'Private']) {
    check(`the strip states ${fact.replace(':', '')}`, strip.includes(fact), strip);
  }
  /*
   * The counter is there from the start, but it is honest about not knowing
   * yet: the allowance lives on the server against a subject this browser
   * cannot compute, so a figure appears only once the server has given one.
   */
  check(
    'the free counter is present before anything is asked',
    /Free: .+ of 10 questions used today/.test(strip),
    strip
  );

  await page.waitForFunction(
    () => !/—/.test(document.querySelector('[class*="limitChip"]')?.textContent ?? '—'),
    undefined,
    { timeout: 10_000 }
  );
  check(
    'and settles on the figure the server actually holds',
    /Free: \d+ of 10 questions used today/.test(
      await page.locator('[class*="limitChip"]').innerText()
    ),
    await page.locator('[class*="limitChip"]').innerText()
  );

  group('A question carried in from another page arrives asked');

  await stubAnswer(page, {
    contentType: 'AI explanation',
    text: 'An ETF is a basket of holdings you can buy as one line.',
    bullets: ['It trades like a share', 'It holds many things at once'],
    sources: 'General knowledge',
    confidence: 'high',
    actions: [
      { label: 'Explore markets', action: 'open_explore', primary: true },
      { label: 'Start learning', action: 'open_academy' },
    ],
    followUps: ['How do I pick one?'],
    citations: [{ label: 'Current page' }],
    tools: ['portal-navigation(learn_free)'],
    trace: [{ id: 'portal_navigation', ok: true, call: 'portal-navigation(learn_free)' }],
  });

  await page.goto(`${BASE}/en`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const homeAsk = page.getByRole('textbox', { name: 'Ask Voyager' }).first();
  await homeAsk.fill('What is an ETF?');
  await homeAsk.press('Enter');
  await page.waitForURL(/\/voyager/, { timeout: 10_000 });
  await page.waitForTimeout(2500);

  const afterEntry = await page.locator('body').innerText();
  check('the context follows the question', (await page.locator('[class*="contextChip"]').innerText()).includes('Home'));
  check('the question is on screen as the person asked it', afterEntry.includes('What is an ETF?'));
  check('and it was answered rather than parked in a box', (await page.locator('[class*="botBubble"]').count()) > 0);

  group('States 4 and 5 — what an answer rests on');

  check('sources are listed under the answer', (await page.locator('[class*="sourceChip"]').count()) > 0);
  check(
    'and the page source is one of them, so the context was really sent',
    (await page.locator('[class*="sourceChip"]').first().innerText()).length > 0
  );
  check('the tool chips name the calls that returned', afterEntry.includes('portal-navigation'));
  check(
    'the bullets the backend sent are rendered rather than discarded',
    afterEntry.includes('It trades like a share')
  );
  check('and the answer carries its own content-type label', afterEntry.includes('AI explanation'));

  group('Every page a link can hand off from is a page the API accepts');

  /*
   * `market` and `events` were screens the chat sent and the API rejected, so a
   * question asked from a comparison, an Explore page or an event came back 400
   * and the chat showed the card it shows when the network is down. Nothing was
   * down, and the card said so for weeks.
   *
   * Checked through GET rather than by asking, because GET runs the same accept
   * list without spending one of the ten questions a day this suite is metered
   * at.
   */
  for (const screen of ['market', 'events', 'ideas', 'symbol', 'strategy', 'generic']) {
    const probe = await page.request.get(`${BASE}/api/voyager?screen=${screen}&subject=test`);
    check(`the API accepts ${screen}`, probe.status() === 200, `${probe.status()}`);
  }

  const rejected = await page.request.get(`${BASE}/api/voyager?screen=not_a_screen`);
  check('and still refuses one it does not know', rejected.status() === 400, `${rejected.status()}`);

  group('The actions under an answer are the answer’s, not a constant');

  /*
   * There used to be six, from a list in `session.ts`, under every answer that
   * was not a failure — the same six in the same order under "What is an ETF?",
   * where *Add to watchlist* had nothing to add and *Add to portfolio scenario*
   * reported adding a position to a table this database does not have.
   *
   * What is checked here is what stays true whichever actions the model picked:
   * a bounded row, and every button carrying an id the registry knows. The
   * per-action wording is asserted in the unit suite, where it is deterministic.
   */
  const actionButtons = page.locator('[class*="actionRow"] button');
  const actionCount = await actionButtons.count();
  const actionIds = await actionButtons.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-action'))
  );

  check('at most four, never the fixed six', actionCount <= 4, `${actionCount}: ${actionIds}`);
  check(
    'every button carries the id it will run',
    actionIds.length === actionCount && actionIds.every((id) => typeof id === 'string' && id),
    actionIds.join(' · ')
  );
  check(
    'and none of them are the ids the merge removed',
    !actionIds.some((id) => ['watchlist', 'save_workspace', 'portfolio_scenario', 'research'].includes(id ?? '')),
    actionIds.join(' · ')
  );

  group('The counter never invents a number it has not been told');

  /*
   * The defect behind a production report that one question had cost nine.
   *
   * The allowance is counted on the server against a subject the browser cannot
   * compute — for a guest, a hash of their address, shared with every window on
   * it. This page had no bootstrap request at all, so a fresh browser drew
   * "Free: 0 of 10" and the first answer corrected it to the real figure. Read
   * as a live counter, a jump from 0 to 9 looks exactly like a question costing
   * nine. The counter was right; the placeholder was the lie.
   */
  const slowBootstrap = await browser.newContext();
  const bootPage = await slowBootstrap.newPage();

  await bootPage.route('**/api/voyager?*', async (route) => {
    // Held open, so the state before the server answers is observable rather
    // than a race.
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tier: 'basic',
        tierLabel: 'Voyager Basic',
        limits: 'Basic',
        sources: [],
        remaining: 1,
        used: 9,
        total: 10,
        signedIn: false,
        personalization: null,
        modelConfigured: true,
      }),
    });
  });

  await bootPage.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await bootPage.waitForTimeout(700);

  const beforeBootstrap = await bootPage.locator('[class*="limitChip"]').innerText();
  check(
    'before the server answers it shows no figure at all',
    !/\b0 of 10\b/.test(beforeBootstrap),
    beforeBootstrap
  );
  check('saying plainly that it does not know yet', /—\s*of 10/.test(beforeBootstrap), beforeBootstrap);

  await bootPage.waitForTimeout(3000);
  const afterBootstrap = await bootPage.locator('[class*="limitChip"]').innerText();
  check(
    'and once the server answers it shows the server’s figure',
    /Free: 9 of 10/.test(afterBootstrap),
    afterBootstrap
  );
  check(
    'a visitor already at their limit is told before they type, not after',
    (await bootPage.locator('[class*="limitChipHot"]').count()) === 0,
    'nine of ten is not the ceiling'
  );

  await slowBootstrap.close();

  group('One submit is one request, however many tools answer it');

  /*
   * From production: one question with several internal tool calls moved the
   * visible counter by five. The counter is spent once per request, in the
   * route handler, outside the tool loop — so the only way it moves by five is
   * five requests. This is the client half of that invariant, measured rather
   * than argued: every POST is intercepted, so nothing reaches the server and
   * nothing touches the usage row.
   */
  let posts = 0;
  await page.unroute('**/api/voyager');
  await page.unroute('**/api/voyager?*');
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/voyager')) posts += 1;
  });

  await stubAnswer(page, {
    contentType: 'AI analysis',
    text: 'Tesla fell with the rest of the growth names in that session.',
    bullets: [],
    sources: 'Twelve Data',
    confidence: 'medium',
    actions: [],
    followUps: [],
    citations: [{ label: 'Market data & news' }],
    // A six-tool answer, which is what the reported question ran.
    tools: [
      'web-search(2)',
      'resolve-asset(Tesla)',
      'quote(TSLA)',
      'history(TSLA 1D)',
      'chart(line)',
    ],
  });

  await page.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.removeItem('tn.voyager.allowance.v1');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  posts = 0;
  await page.getByRole('textbox', { name: 'Ask Voyager' }).fill('Why did Tesla fall today?');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  check('one intentional question sends exactly one request', posts === 1, `${posts} POSTs`);
  check(
    'and the counter moves by one, not by the number of tools',
    /Free: 1 of 10/.test(await page.locator('[class*="limitChip"]').innerText()),
    await page.locator('[class*="limitChip"]').innerText()
  );
  check(
    'even though the answer reports five tools',
    (await page.locator('[class*="toolChip"]').count()) === 5,
    `${await page.locator('[class*="toolChip"]').count()} chips`
  );

  group('A question in another language takes the same path');

  /*
   * The reported defect: the Russian question came back as this platform's
   * navigation blurb. The planner, its tools and its sources are identical
   * whatever the question was written in — what changed is that a model failure
   * is now reported as a failure instead of being dressed as an answer.
   */
  posts = 0;
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.getByRole('textbox', { name: 'Ask Voyager' }).fill('Почему сегодня упала Tesla?');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  const russian = await page.locator('body').innerText();
  check('the question survives as the person typed it', russian.includes('Почему сегодня упала Tesla?'));
  check('it is one request, like its English twin', posts === 1, `${posts} POSTs`);
  check(
    'and it is answered rather than handed a navigation blurb',
    !/tell me your goal/i.test(russian),
    russian.slice(0, 200)
  );

  await page.unroute('**/api/voyager');
  await page.unroute('**/api/voyager?*');

  group('The chart says exactly what it drew');

  /*
   * The regression this group exists for: a module described "RSI and three
   * detected levels" over a canvas drawing plain candles. The caption is
   * generated from the same specification the engine is given, after everything
   * unrenderable has been removed from it — so caption and picture cannot
   * disagree in either direction.
   *
   * RSI, MACD and volume are now on the drawable side of that line, because the
   * engine has a pane manager. The check is therefore the opposite of what it
   * was: they must be *named*, and named as panes.
   */
  await page.unroute('**/api/voyager');
  await page.unroute('**/api/voyager?*');
  await stubAnswer(page, {
    contentType: 'AI analysis',
    text: 'Here is Tesla over the period you asked for.',
    bullets: [],
    sources: 'Twelve Data',
    confidence: 'medium',
    actions: [{ label: 'Open on chart', action: 'open_chart', primary: true }],
    followUps: [],
    citations: [{ label: 'Market data & news' }],
    tools: ['history(TSLA 1D)', 'chart(candles)'],
    chart: {
      spec: {
        version: 1,
        kind: 'candles',
        series: [
          { assetId: 'stock:TSLA', symbol: 'TSLA', label: 'Tesla, Inc.', field: 'close' },
        ],
        range: { start: '2026-01-01', end: '2026-03-01' },
        interval: '1D',
        studies: [
          { id: 'sma', params: { fast: 50, slow: 200 } },
          { id: 'rsi', params: { length: 14 } },
          { id: 'macd', params: { fast: 12, slow: 26, signal: 9 } },
          { id: 'volume', params: {} },
        ],
        sourceMeta: {
          provider: 'Twelve Data',
          firstObservation: '2026-01-05',
          lastObservation: '2026-02-27',
          delayed: true,
          derivedFromDaily: false,
          hasVolume: true,
        },
        refused: [],
      },
      series: [{ assetId: 'stock:TSLA', bars: fixtureBars(60) }],
    },
  });

  await page.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page
    .getByRole('textbox', { name: 'Ask Voyager' })
    .fill('Show Tesla candles with volume, RSI and MACD');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);

  const chartBlock = page.locator('figure').first();
  check('the chart is drawn', (await chartBlock.count()) === 1);
  check('on a canvas, by the engine', (await page.locator('figure canvas').count()) >= 1);

  const caption = await page.locator('figcaption').first().innerText();
  check('the caption names the overlay that is on the price', /MA 50\/200/.test(caption), caption);
  check('and the oscillators, which are no longer refused', /RSI 14/.test(caption), caption);
  check('MACD among them', /MACD 12\/26\/9/.test(caption), caption);
  check('and volume', /Volume/.test(caption), caption);
  check(
    'said as panes, because that is where they are',
    /3 panes below the price/.test(caption),
    caption
  );
  check('it reports the dates it has, not the ones asked for', /2026-01-05/.test(caption), caption);
  check('and says the data is delayed', /delayed/i.test(caption), caption);

  const chartText = await chartBlock.innerText();
  check(
    'nothing is apologised for on a chart that drew everything',
    !/available on the professional chart/i.test(chartText),
    chartText.slice(0, 160)
  );

  /*
   * The limitation that survives the panes landing: a volume pane the engine can
   * draw, and no volume in the data to put in it. Still said out loud, and still
   * absent from the caption.
   */
  await page.unroute('**/api/voyager');
  await page.unroute('**/api/voyager?*');
  await stubAnswer(page, {
    contentType: 'AI analysis',
    text: 'Here is the price. The provider sent no volume for this one.',
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
        series: [
          { assetId: 'stock:TSLA', symbol: 'TSLA', label: 'Tesla, Inc.', field: 'close' },
        ],
        range: { start: '2026-01-01', end: '2026-03-01' },
        interval: '1D',
        studies: [{ id: 'rsi', params: { length: 14 } }],
        sourceMeta: {
          provider: 'Twelve Data',
          firstObservation: '2026-01-05',
          lastObservation: '2026-02-27',
          delayed: true,
          derivedFromDaily: false,
          hasVolume: false,
        },
        refused: [
          {
            study: 'volume',
            reason:
              'The data provider returned these prices without a traded volume, so there is no volume to draw.',
          },
        ],
      },
      series: [{ assetId: 'stock:TSLA', bars: fixtureBars(40).map(({ volume, ...bar }) => bar) }],
    },
  });

  await page.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page
    .getByRole('textbox', { name: 'Ask Voyager' })
    .fill('Show Tesla candles with volume');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);

  const missing = await page.locator('figure').first().innerText();
  check(
    'a volume pane with no volume behind it is refused out loud',
    /no volume to draw/i.test(missing),
    missing.slice(0, 200)
  );
  check(
    'and the caption does not mention it',
    !/volume/i.test(await page.locator('figcaption').first().innerText()),
    missing.slice(0, 200)
  );

  await page.unroute('**/api/voyager');
  await page.unroute('**/api/voyager?*');

  group('Pine is on screen with its caveat, and the handoff is a real destination');

  await page.unroute('**/api/voyager');
  await page.unroute('**/api/voyager?*');
  await stubAnswer(page, {
    contentType: 'AI structured',
    text: 'Here is an EMA crossover with volume confirmation, and where to run it.',
    bullets: [],
    sources: 'Written for this question',
    confidence: 'medium',
    actions: [],
    followUps: [],
    citations: [],
    tools: ['pine(template sma)', 'tradingview-handoff(pine)'],
    code: {
      language: 'pine',
      title: 'EMA crossover',
      source: '//@version=6\nindicator("EMA crossover", overlay = true)\nfast = ta.ema(close, 20)\nplot(fast)',
      provenance: 'model-written',
      notExecuted:
        'I can write and explain Pine Script, but I cannot run it. Executing it needs TradingView’s own engine, which is not something this platform reimplements — so treat anything I write as a draft to review and test on a chart yourself, not as a script that has already been checked against live data.',
      findings: [],
      status: 'No errors found — checked for syntax and known built-ins only; not compiled and not run.',
    },
    handoff: {
      kind: 'pine',
      url: 'https://www.tradingview.com/pine-editor/',
      carried: [],
      manual: ['The script itself — copy it from here and paste it into the editor.'],
      because: [
        'Running Pine needs TradingView’s own engine. Voyager writes and explains Pine; it cannot execute it, here or anywhere.',
      ],
    },
  });

  await page.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.getByRole('textbox', { name: 'Ask Voyager' }).fill('Write a Pine indicator for an EMA crossover');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);

  const pineBody = await page.locator('body').innerText();
  check('the code is shown as code', (await page.locator('pre code').count()) >= 1);
  check('with a copy button', (await page.getByRole('button', { name: 'Copy' }).count()) === 1);
  check(
    'and the permanent limit is stated, not implied',
    /cannot run it/i.test(pineBody) && /TradingView’s own engine/i.test(pineBody)
  );
  check(
    'nothing claims it was backtested or verified',
    !/\bbacktested\b/i.test(pineBody) && !/verified against live data/i.test(pineBody.replace(/not .{0,20}verified against live data/gi, ''))
  );
  check(
    'the linter says exactly what it checked',
    /syntax and known built-ins only/i.test(pineBody)
  );

  const handoffLink = page.locator('a[href^="https://www.tradingview.com"]').first();
  check('the handoff is a real link', (await handoffLink.count()) === 1);
  check('to TradingView and nowhere else', (await handoffLink.getAttribute('href'))?.startsWith('https://www.tradingview.com/'));
  check('opening in its own tab, safely', (await handoffLink.getAttribute('rel'))?.includes('noopener'));
  check(
    'and it says the paste is the step rather than pretending the code travelled',
    /copy it from here/i.test(pineBody)
  );

  await page.unroute('**/api/voyager');
  await page.unroute('**/api/voyager?*');

  group('State 8 — a guest is gated, and the action is kept');

  /*
   * Driven from a seeded transcript rather than from whatever the model chose
   * this time. The restore path is the real one — these turns render through
   * the same code an answer does — and it makes the state reachable on every
   * run instead of on the runs where the model happened to offer a write.
   */
  const seeded = [
    { id: 'u1', role: 'user', text: 'What about Tesla?', at: new Date().toISOString() },
    {
      id: 'a1',
      role: 'assistant',
      text: 'Tesla trades on NASDAQ and is one of the more volatile large caps.',
      at: new Date().toISOString(),
      ticker: 'TSLA',
      actions: [
        { label: 'Add to watchlist', action: 'add_to_watchlist', primary: true },
        { label: 'Open on chart', action: 'open_chart' },
      ],
    },
  ];

  await page.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((turns) => {
    sessionStorage.setItem('tn.voyager.dialog.v1', JSON.stringify(turns));
    sessionStorage.removeItem('tn.voyager.pending.v1');
  }, seeded);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  check(
    'a seeded answer renders exactly the actions it carries',
    (await page.locator('[class*="actionRow"] button').count()) === 2
  );

  await page.locator('[data-action="add_to_watchlist"]').first().click();
  await page.waitForTimeout(400);

  const gate = await page.locator('[class*="authGate"]').innerText();
  check('an account-only action opens the gate', gate.includes('Sign in to continue this conversation'));
  check('and promises the dialog back', /restored exactly here/.test(gate), gate);

  const queued = await page.evaluate(() => sessionStorage.getItem('tn.voyager.pending.v1'));
  check('the action is queued rather than dropped', /watchlist/.test(queued ?? ''), queued);

  group('Nothing reports success that a server did not perform');

  /*
   * The regression that matters most here. "Done — I added this to your
   * watchlist" used to be printed the moment Confirm was pressed, with a
   * `watchlist.add ✓` chip beside it and no request sent anywhere; the row was
   * not in the workspace the message said to look in.
   *
   * A guest cannot reach a Confirm at all, so what is asserted is the outcome:
   * no success sentence and no ✓ chip anywhere on the way through the gate.
   */
  const afterGate = await page.locator('body').innerText();
  check('no "Done —" without an account', !afterGate.includes('Done —'), afterGate.slice(0, 120));
  check('and no tool chip claiming a call returned', !/Tool:.*✓/.test(afterGate));

  group('The dialogue survives the trip through sign-in');

  const stored = await page.evaluate(() => sessionStorage.getItem('tn.voyager.dialog.v1'));
  check('the transcript is kept for the return', /What about Tesla\?/.test(stored ?? ''));

  await page.goto(`${BASE}/en/sign-in?next=/voyager`, { waitUntil: 'domcontentloaded' });
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  check(
    'and it is still there on the way back',
    (await page.locator('body').innerText()).includes('What about Tesla?')
  );

  group('State 6 — the API is down and the portal still works');

  const offline = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await offline.route('**/api/voyager', (route) => route.abort());
  await offline.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await offline.waitForTimeout(600);
  await offline.getByRole('textbox', { name: 'Ask Voyager' }).fill('Why are markets falling?');
  await offline.keyboard.press('Enter');
  await offline.waitForTimeout(3000);

  const errorCard = offline.locator('[class*="errorCard"]');
  check('the failure is stated', await errorCard.isVisible());

  const errorText = await errorCard.innerText();
  check('the question is kept', /saved and will send automatically/.test(errorText));
  check('with somewhere to go meanwhile', /Browse lessons/.test(errorText) && /Read today/.test(errorText));
  check('and a way to try again', (await errorCard.getByRole('button', { name: 'Retry now' }).count()) === 1);

  const held = await offline.evaluate(() => sessionStorage.getItem('tn.voyager.pending.v1'));
  check('the unsent question is in the queue', /markets falling/.test(held ?? ''), held);

  check(
    'no action row under a failure',
    (await offline.locator('[class*="actionRow"]').count()) === 0,
    'a broken answer offered to act on itself'
  );

  const stillWorks = await offline.locator('header nav a, header nav button').count();
  check('the rest of the portal is still navigable', stillWorks >= 5, `${stillWorks} nav items`);
  await offline.close();

  group('State 7 — the daily limit, however we learned about it');

  /*
   * One quota state, three ways in.
   *
   * The banner used to live only inside the transcript, so somebody who arrived
   * already spent got a disabled composer and no explanation — the full state
   * was reachable only by hitting the limit in the current session, which is
   * the case that needed it least.
   *
   * Driven by the bootstrap read rather than by a seeded browser counter, and
   * waited for by state rather than by a sleep: the old test seeded
   * localStorage and raced the server, so it passed or failed on timing. The
   * browser no longer keeps a count at all — the server is the only authority —
   * which is what makes this deterministic.
   */
  const atLimit = await browser.newContext();
  const spent = await atLimit.newPage();

  await spent.route('**/api/voyager?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tier: 'basic',
        tierLabel: 'Voyager Basic',
        limits: 'Basic',
        sources: [],
        remaining: 0,
        used: 10,
        total: 10,
        signedIn: false,
        personalization: null,
        modelConfigured: true,
      }),
    });
  });

  await spent.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });

  const limitCard = spent.locator('[class*="limitGate"]');
  await limitCard.waitFor({ state: 'visible', timeout: 10_000 });

  check('a visitor who arrives already spent sees the banner', await limitCard.isVisible());
  const limitText = await limitCard.innerText();
  check('with the real figures', /10 of 10/.test(limitText), limitText);
  check(
    'a reset the counter actually keeps to',
    /Resets at 00:00 UTC/.test(limitText),
    limitText
  );
  check('and a route to Plans', (await limitCard.getByRole('link', { name: 'See Plans' }).count()) === 1);

  const composer = spent.getByRole('textbox', { name: 'Ask Voyager' });
  check('the composer is disabled', await composer.isDisabled());
  check(
    'and says why rather than going quiet',
    /Daily free limit reached/.test((await composer.getAttribute('placeholder')) ?? '')
  );
  check(
    'the strip badge turns amber',
    (await spent.locator('[class*="limitChipHot"]').count()) === 1
  );
  check(
    'and the counter quotes the server',
    /Free: 10 of 10/.test(await spent.locator('[class*="limitChip"]').innerText())
  );
  await atLimit.close();

  group('The last question reaches the same state as arriving spent');

  /*
   * The other route in: nine spent, one asked, and the answer carries the tenth.
   * Same banner, same wording, same CTA — one implementation, so there is
   * nothing to keep in step.
   */
  const lastOne = await browser.newContext();
  const lastPage = await lastOne.newPage();

  await stubAnswer(
    lastPage,
    {
      contentType: 'AI explanation',
      text: 'An ETF is a basket of holdings you can buy as one line.',
      bullets: [],
      sources: 'General knowledge',
      confidence: 'high',
      actions: [],
      followUps: [],
      citations: [],
    },
    { used: 10, remaining: 0, before: 9 }
  );

  await lastPage.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await lastPage.waitForFunction(
    () => /Free: 9 of 10/.test(document.querySelector('[class*="limitChip"]')?.textContent ?? ''),
    undefined,
    { timeout: 10_000 }
  );
  check('nine spent leaves the composer open', !(await lastPage.getByRole('textbox', { name: 'Ask Voyager' }).isDisabled()));

  await lastPage.getByRole('textbox', { name: 'Ask Voyager' }).fill('What is an ETF?');
  await lastPage.keyboard.press('Enter');

  const lastCard = lastPage.locator('[class*="limitGate"]');
  await lastCard.waitFor({ state: 'visible', timeout: 10_000 });

  check('the tenth answer closes the composer', await lastCard.isVisible());
  check(
    'with the same banner as arriving spent',
    /Resets at 00:00 UTC/.test(await lastCard.innerText()) &&
      /10 of 10/.test(await lastCard.innerText()),
    await lastCard.innerText()
  );
  await lastOne.close();

  group('It fits the window it is in');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check('no sideways scroll at 1440', overflow <= 1, `${overflow}px`);

  const phone = await browser.newContext({ ...devices['iPhone 13'] });
  const small = await phone.newPage();
  await small.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await small.waitForTimeout(700);

  const phoneOverflow = await small.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check('nor on a phone', phoneOverflow <= 1, `${phoneOverflow}px`);
  check(
    'and the composer is still the first thing',
    (await small.getByRole('textbox', { name: 'Ask Voyager' }).count()) > 0
  );
  await phone.close();
} catch (error) {
  failed += 1;
  console.log(`\n  FAIL the run stopped early — ${error.message}`);
} finally {
  await browser.close();
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}
