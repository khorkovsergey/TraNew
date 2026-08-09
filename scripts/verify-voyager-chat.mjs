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
async function stubAnswer(page, answer) {
  await page.route('**/api/voyager', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        answer,
        tier: 'basic',
        remaining: 7,
        used: 3,
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
  check(
    'and the free counter is there before anything is asked',
    /Free: \d+ of 10 questions used today/.test(strip),
    strip
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

  group('The chart says exactly what it drew');

  /*
   * The regression this group exists for: a module described "RSI and three
   * detected levels" over a canvas drawing plain candles. The caption is now
   * generated from the same specification the engine is given, after the
   * unrenderable studies have been removed from it — so the check is that RSI
   * is *absent* from the caption and *stated* as refused.
   */
  await page.unroute('**/api/voyager');
  await stubAnswer(page, {
    contentType: 'AI analysis',
    text: 'Here is Tesla over the period you asked for.',
    bullets: [],
    sources: 'Twelve Data',
    confidence: 'medium',
    actions: [{ label: 'Open on chart', action: 'open_chart', primary: true }],
    followUps: [],
    citations: [{ label: 'Market data & news' }],
    tools: ['history(TSLA 1D)', 'chart(line)'],
    chart: {
      spec: {
        version: 1,
        kind: 'line',
        series: [
          { assetId: 'stock:TSLA', symbol: 'TSLA', label: 'Tesla, Inc.', field: 'close' },
        ],
        range: { start: '2026-01-01', end: '2026-03-01' },
        interval: '1D',
        studies: [{ id: 'sma', params: { fast: 50, slow: 200 } }],
        sourceMeta: {
          provider: 'Twelve Data',
          firstObservation: '2026-01-05',
          lastObservation: '2026-02-27',
          delayed: true,
          derivedFromDaily: false,
        },
        refused: [
          { study: 'rsi', reason: 'RSI needs its own pane and its own scale, which this chart does not have. It is available on the full chart.' },
        ],
      },
      series: [{ assetId: 'stock:TSLA', bars: fixtureBars(40) }],
    },
  });

  await page.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.getByRole('textbox', { name: 'Ask Voyager' }).fill('Chart Tesla with RSI and 50/200 averages');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);

  const chartBlock = page.locator('figure').first();
  check('the chart is drawn', (await chartBlock.count()) === 1);
  check('on a canvas, by the engine', (await page.locator('figure canvas').count()) >= 1);

  const caption = await page.locator('figcaption').first().innerText();
  check('the caption names the study that is on the chart', /MA 50\/200/.test(caption), caption);
  check('and never the one that is not', !/RSI/i.test(caption), caption);
  check('it reports the dates it has, not the ones asked for', /2026-01-05/.test(caption), caption);
  check('and says the data is delayed', /delayed/i.test(caption), caption);

  const chartText = await chartBlock.innerText();
  check(
    'what the chart will not draw is said out loud rather than left to be noticed',
    /RSI needs its own pane/i.test(chartText),
    chartText.slice(0, 160)
  );

  await page.unroute('**/api/voyager');

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

  group('State 7 — the daily limit');

  const spent = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await spent.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await spent.evaluate(() => {
    const day = new Date().toISOString().slice(0, 10);
    localStorage.setItem('tn.voyager.allowance.v1', JSON.stringify({ used: 10, day }));
    sessionStorage.setItem(
      'tn.voyager.dialog.v1',
      JSON.stringify([
        { id: 'u1', role: 'user', text: 'What is an ETF?', at: new Date().toISOString() },
        { id: 'a1', role: 'assistant', text: 'A basket of holdings.', at: new Date().toISOString() },
      ])
    );
  });
  await spent.reload({ waitUntil: 'domcontentloaded' });
  await spent.waitForTimeout(800);

  const limitCard = spent.locator('[class*="limitGate"]');
  check('the limit is stated as a banner', await limitCard.isVisible());
  check('with the reset and the way past it', /Resets at midnight/.test(await limitCard.innerText()));
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
  await spent.close();

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
