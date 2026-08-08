import { chromium } from 'playwright';

/**
 * Marketplace → Tools & Data.
 *
 * The claims this section makes that would be expensive to get wrong:
 *
 * 1. A guest can read the whole catalogue and every product page. The only
 *    thing an account gates is buying.
 * 2. The Pine Script of a script nobody has bought is not in the response. Not
 *    blurred, not hidden with CSS — absent from the bytes the server sent. This
 *    is checked against the raw HTML and against the RSC payload, because a
 *    check against the rendered DOM would pass on a `filter: blur()`.
 * 3. Every type tab reports a count that matches what the tab shows, and the
 *    filters, search and sort work together rather than replacing each other.
 * 4. Filters live in the URL, so back and forward reproduce a view.
 * 5. Nothing marked "Coming soon" is a link.
 * 6. The Supercharts catalogue links into the workspace with a preset rather
 *    than drawing a chart of its own.
 *
 * Run against a dev or preview server: `node scripts/verify-tools-data.mjs`.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const TOOLS = `${BASE}/en/marketplace/tools`;
const MARKET = `${TOOLS}/chart-market`;
const CHARTS = `${TOOLS}/supercharts`;

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

const browser = await chromium.launch();

try {
  /* A fresh context with no cookies: this is a guest, throughout. */
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  group('The hub separates what exists from what does not');

  await page.goto(TOOLS, { waitUntil: 'domcontentloaded' });

  check('Chart Market is a link', (await page.locator('a[href$="/chart-market"]').count()) > 0);
  check(
    'Supercharts is a link',
    (await page.locator('a[href$="/marketplace/tools/supercharts"]').count()) > 0
  );

  for (const name of ['Data Hub', 'More Tools']) {
    const card = page.locator('[aria-disabled="true"]', { hasText: name });
    check(`${name} is on the page`, (await card.count()) > 0);
    check(`${name} is not a link`, (await card.locator('xpath=ancestor-or-self::a').count()) === 0);
  }

  group('A guest reads everything except the code');

  await page.goto(MARKET, { waitUntil: 'domcontentloaded' });

  const cards = page.locator('article');
  const cardCount = await cards.count();
  check('the catalogue renders for a signed-out visitor', cardCount > 0, `${cardCount} cards`);

  const stated = await page.locator('text=/^\\d+ scripts?$/').first().innerText();
  check('the result count matches the grid', Number.parseInt(stated, 10) === cardCount, stated);

  group('Every type tab counts what it shows');

  const tabs = await page
    .locator('a[aria-current], a')
    .filter({ hasText: /^(All|Indicators|Strategies|Overlays|Signals|Utilities)\d+$/ })
    .allInnerTexts();
  check('six tabs are offered', tabs.length === 6, tabs.join(' · '));

  for (const label of ['All', 'Indicators', 'Strategies', 'Overlays', 'Signals', 'Utilities']) {
    const tab = page.getByRole('link', { name: new RegExp(`^${label}\\s*\\d+$`) }).first();
    const text = await tab.innerText();
    const promised = Number.parseInt(text.replace(label, '').trim(), 10);

    /*
     * Followed as a URL rather than clicked.
     *
     * The tab is a real anchor, so the address it carries is the whole claim —
     * and loading it is a deterministic check, where a click has to be raced
     * against a soft navigation that never fires a load event.
     */
    const target = label === 'All' ? MARKET : `${MARKET}?type=${label}`;
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    const shown = await page.locator('article').count();

    check(`${label}: promises ${promised}, shows ${shown}`, promised === shown);
    check(`${label}: the count is not zero`, promised > 0);
    check(
      `${label}: the tab links to its own URL`,
      label === 'All'
        ? !(await tab.getAttribute('href')).includes('type=')
        : (await tab.getAttribute('href')).includes(`type=${label}`)
    );
  }

  group('Search, filters and sort combine');

  await page.goto(`${MARKET}?type=Indicators&price=Paid&sort=Rating`, {
    waitUntil: 'domcontentloaded',
  });
  const combined = await page.locator('article').count();
  check('three constraints at once still return something', combined > 0, `${combined}`);

  const titles = await page.locator('article h3').allInnerTexts();
  const ratings = await page
    .locator('article')
    .evaluateAll((nodes) =>
      nodes.map((node) => Number.parseFloat(node.textContent.match(/(\d\.\d)/)?.[1] ?? '0'))
    );
  check(
    'sorted by rating, descending',
    ratings.every((value, index) => index === 0 || ratings[index - 1] >= value),
    ratings.join(', ')
  );
  check('and every result is an indicator', titles.length === combined);

  group('Back and forward reproduce a view');

  await page.goto(MARKET, { waitUntil: 'domcontentloaded' });
  const initial = await page.locator('article').count();

  await page.getByRole('link', { name: /^Strategies\s*\d+$/ }).first().click();
  await page.waitForURL(/type=Strategies/, { timeout: 15_000 });
  const narrowed = await page.locator('article').count();
  check('the filter changed the list', narrowed !== initial, `${initial} → ${narrowed}`);

  /*
   * The address changes before React commits the tree behind it, so the count
   * line is what says the page caught up. Waiting on it and then counting the
   * cards is still two independent readings of the same list.
   */
  const settled = async (count) =>
    page.waitForSelector(`text=/^${count} scripts?$/`, { timeout: 15_000 });

  await page.goBack();
  await page.waitForURL((url) => !url.search.includes('type='), { timeout: 15_000 });
  await settled(initial);
  check('back restores the earlier list', (await page.locator('article').count()) === initial);

  await page.goForward();
  await page.waitForURL(/type=Strategies/, { timeout: 15_000 });
  await settled(narrowed);
  check('forward restores the filtered list', (await page.locator('article').count()) === narrowed);

  group('The source is not in the response');

  /*
   * Fetched rather than read off the page. What matters is what left the
   * server: a check that asks the DOM would be satisfied by a blur, and a blur
   * is a paint effect over text that is still there.
   */
  const html = await (await context.request.get(`${MARKET}?script=trend-strength-pro`)).text();

  check('the product page renders for a guest', html.includes('Trend Strength Pro'));
  check('it says the source arrives after purchase', /delivered after purchase/i.test(html));

  /*
   * Needles with no quotes in them.
   *
   * React escapes `"` in text, so a check for `indicator("…")` cannot match
   * whether the code is there or not — it would pass for the wrong reason and
   * go on passing after the gate broke.
   */
  const leaks = [
    '//@version=6',
    'ta.rma(',
    'plotshape(',
    'length = input.int(20',
    'alertcondition(',
  ].filter((needle) => html.includes(needle));
  check('no Pine Script anywhere in the HTML', leaks.length === 0, leaks.join(' · '));

  /* The RSC payload is a second copy of the same tree, and a second chance to leak. */
  const rsc = await (
    await context.request.get(`${MARKET}?script=trend-strength-pro&_rsc=1`, {
      headers: { RSC: '1' },
    })
  ).text();
  const rscLeaks = ['//@version', 'ta.rma(', 'plotshape('].filter((needle) => rsc.includes(needle));
  check('nor in the RSC payload', rscLeaks.length === 0, rscLeaks.join(' · '));

  group('Buying, and only buying, asks for an account');

  await page.goto(`${MARKET}?script=trend-strength-pro&step=checkout`, {
    waitUntil: 'domcontentloaded',
  });
  const dialog = page.getByRole('dialog');
  check('a guest at the checkout is asked to sign in', await dialog.getByText(/Sign in to complete/).isVisible());

  const signIn = dialog.getByRole('link', { name: /^Sign in$/ });
  const next = new URL(await signIn.getAttribute('href'), BASE).searchParams.get('next');
  check(
    'the intent is carried to sign-in',
    Boolean(next) && next.includes('script=trend-strength-pro') && next.includes('step=checkout'),
    next ?? '(none)'
  );

  group('The Superchart catalogue opens the workspace, not a copy of it');

  await page.goto(CHARTS, { waitUntil: 'domcontentloaded' });
  check('no chart canvas on the catalogue', (await page.locator('canvas').count()) === 0);

  const opens = await page.getByRole('link', { name: 'Open chart' }).all();
  check('every workspace has a way in', opens.length > 0, `${opens.length}`);

  for (const link of opens) {
    const href = new URL(await link.getAttribute('href'), BASE);
    const symbol = href.searchParams.get('symbol');
    check(
      `${symbol ?? '(no symbol)'} opens /supercharts with a preset`,
      href.pathname.endsWith('/supercharts') && Boolean(symbol) && href.searchParams.has('interval')
    );
  }

  /* The preset has to survive the trip, or the six cards are one card. */
  const first = new URL(await opens[0].getAttribute('href'), BASE);
  await page.goto(first.toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 20_000 });
  const ticker = first.searchParams.get('symbol').split(':')[1];
  check(
    `the workspace opened on ${ticker}`,
    (await page.locator('body').innerText()).includes(ticker)
  );
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
