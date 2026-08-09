import { chromium } from 'playwright';

/**
 * Market Overview and Compare assets, clicked rather than read.
 *
 * The acceptance list in the Explore handoff is mostly about what must *not*
 * happen: no education on the market screen, no live prices on the education
 * one, no comparison that mixes asset types, no primary call to action that
 * leaves for TradingView. Those are the checks here — a screen can look right
 * in a screenshot and still fail every one of them.
 *
 *   node scripts/verify-markets.mjs [baseUrl]
 */

const base = process.argv[2] ?? 'http://localhost:3406';

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function group(title) {
  console.log(`\n${title}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1512, height: 1000 } });

try {
  await page.goto(`${base}/en/markets/global`, { waitUntil: 'networkidle' });

  group('Market Overview says what it is');

  const h1 = await page.locator('#main h1').first().innerText();
  check('the heading is the view, not the section', h1 === 'Global markets', h1);

  const head = await page.locator('#main').innerText();
  check('it is announced as Market', /\bmarket\b/i.test(head.slice(0, 200)));
  check('and the figures are labelled as illustrative', /sample data/i.test(head));

  /*
   * The session line is the one thing on this screen that must never be
   * decorative. It is derived from real exchange hours, so it has to name a
   * state and a next transition rather than a fixed sentence.
   */
  group('The session state is derived, not written down');

  /*
   * Scoped to the line itself, not to the page. The exchange panel further
   * down is headed "Which markets are open now", which matched a looser test
   * and made this claim that the market was open on a Sunday.
   */
  const state = await page.locator('[class*="state"]').first().innerText();
  check(
    'it names an open or closed state',
    /markets (open|closed)/i.test(state),
    state.replace(/\s+/g, ' ')
  );
  check('and says when that changes', /opens|closes/i.test(state));

  const dotColour = await page
    .locator('[class*="dot_"]')
    .first()
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  const open = /markets open/i.test(state);
  check(
    open ? 'green while a session is open' : 'not green while everything is closed',
    open ? dotColour === 'rgb(46, 230, 168)' : dotColour !== 'rgb(46, 230, 168)',
    dotColour
  );

  group('Every view moves the whole screen');

  for (const label of ['Stocks', 'Crypto', 'Bonds']) {
    await page.locator('[role="radio"]', { hasText: label }).first().click();
    await page.waitForTimeout(250);

    const title = await page.locator('#main h1').first().innerText();
    const body = await page.locator('#main').innerText();
    check(`${label}: the heading follows the strip`, title === label, title);
    check(
      `${label}: and so do the movers and the prompts`,
      body.includes('What moved') && body.includes('Context: ' + label),
      title
    );
  }

  await page.locator('[role="radio"]', { hasText: 'Global overview' }).first().click();
  await page.waitForTimeout(250);

  group('Nothing on it pretends to be a page that does not exist');

  const hrefs = await page
    .locator('#main a[href]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''));
  const internal = hrefs.filter((href) => href.startsWith('/en/'));

  const statuses = await Promise.all(
    [...new Set(internal)].map(async (href) => ({
      href,
      status: (await page.request.get(`${base}${href}`, { maxRedirects: 0 })).status(),
    }))
  );
  const broken = statuses.filter((entry) => entry.status >= 400);
  check(
    'every internal link on the page resolves',
    broken.length === 0,
    broken.map((entry) => `${entry.href} → ${entry.status}`).join(', ')
  );

  check(
    'the pulse cards are not links',
    (await page.locator('[class*="pulseCard"] a').count()) === 0
  );

  group('It is a market screen, not a lesson');

  check(
    'no "what is a stock" education on it',
    !/what is a (stock|bond|share)/i.test(head),
  );
  check(
    'but investment options are one link away',
    (await page.locator('#main a[href="/en/explore"]').count()) > 0
  );

  /*
   * TradingView is an escalation. It may be on the page and it may not be the
   * mint filled button that the eye lands on first.
   */
  const tvIsPrimary = await page
    .locator('#main a[href*="tradingview.com"]')
    .first()
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  check(
    'TradingView is not the page’s primary call to action',
    tvIsPrimary !== 'rgb(46, 230, 168)',
    tvIsPrimary
  );

  group('The Compare entry is a shortcut, not the tool');

  const compareBlock = await page.locator('#compare').innerText();
  check('it says where the tool lives', /lives in symbols/i.test(compareBlock));
  check(
    'it does not carry a metric table',
    !/expense ratio|forward|drawdown/i.test(compareBlock),
    compareBlock.slice(0, 80).replace(/\s+/g, ' ')
  );
  check(
    'and it links to the other comparison as a different thing',
    /investment types/i.test(compareBlock)
  );

  // ---- Compare assets ----

  await page.goto(`${base}/en/markets/compare`, { waitUntil: 'networkidle' });

  group('Compare assets opens on a real comparison');

  check(
    'three instruments by default',
    (await page.locator('[class*="chipSym"]').count()) === 3,
    `${await page.locator('[class*="chipSym"]').count()}`
  );
  check(
    'the heading names them',
    (await page.locator('#main h1').innerText()) === 'NVDA vs AMD vs AVGO',
    await page.locator('#main h1').innerText()
  );
  check('and the numbers are labelled as illustrative', /sample data/i.test(await page.locator('#main').innerText()));

  group('It works at two, three and four');

  await page.locator('button', { hasText: '+ Add symbol' }).first().click();
  await page.waitForTimeout(250);
  // The button, not the list that contains it — `[class*="result"]` also
  // matches the results container, and clicking that adds whatever sits at
  // its centre.
  await page.locator('button[class*="result"]', { hasText: 'TSMC' }).first().click();
  await page.waitForTimeout(300);

  const four = await page.locator('[class*="chipSym"]').allInnerTexts();
  check('a fourth instrument really joins', four.length === 4, four.join(', '));
  check('and it is the one that was clicked', four.includes('TSM'), four.join(', '));
  check(
    'the metric table grows a column with it',
    (await page.locator('[class*="tableHead"] [class*="colSym"]').count()) === 4
  );
  check(
    'and the add button closes at four',
    await page.locator('button', { hasText: '+ Add symbol' }).first().isDisabled()
  );

  // Down to the floor, whichever two survive.
  for (let i = 0; i < 2; i += 1) {
    await page.locator('button[aria-label^="Remove"]').last().click();
    await page.waitForTimeout(250);
  }

  check('and back down to two', (await page.locator('[class*="chipSym"]').count()) === 2);
  check(
    'where removing stops',
    await page.locator('button[aria-label^="Remove"]').first().isDisabled()
  );

  group('The metrics follow the asset type');

  const stockRows = await page.locator('#main').innerText();
  check('stocks are compared on valuation', /P\/E forward/i.test(stockRows));

  await page.locator('button', { hasText: 'SPY vs QQQ vs VOO' }).first().click();
  await page.waitForTimeout(350);
  const etfRows = await page.locator('#main').innerText();
  check('ETFs on cost and concentration', /Expense ratio/i.test(etfRows) && /Top-10/i.test(etfRows));
  check('and not on a P/E they do not have', !/P\/E forward/i.test(etfRows));

  await page.locator('button', { hasText: 'BTC vs ETH vs SOL' }).first().click();
  await page.waitForTimeout(350);
  const cryptoRows = await page.locator('#main').innerText();
  check('crypto on issuance and fees', /Supply issuance/i.test(cryptoRows) && /Fees paid/i.test(cryptoRows));

  group('A comparison is a thing you can send somebody');

  await page.goto(`${base}/en/markets/compare?symbols=BTC,ETH`, { waitUntil: 'networkidle' });
  check(
    'the URL decides what is compared',
    (await page.locator('#main h1').innerText()) === 'BTC vs ETH',
    await page.locator('#main h1').innerText()
  );

  // Written by anybody, so it is parsed rather than trusted.
  await page.goto(`${base}/en/markets/compare?symbols=NVDA,BTC,NONSENSE`, { waitUntil: 'networkidle' });
  const mixed = await page.locator('#main h1').innerText();
  check('a mixed or invalid list does not produce a mixed table', !mixed.includes('BTC'), mixed);

  group('The two comparisons are different features');

  const footer = await page.locator('#main').innerText();
  check('this one names the other', /Compare investment types/i.test(footer));
  check(
    'and links to it',
    (await page.locator('#main a[href="/en/explore"]').count()) > 0
  );
} finally {
  await browser.close();
}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
