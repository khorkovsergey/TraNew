import { chromium } from 'playwright';

/**
 * The shell, driven rather than read.
 *
 * Three things this suite exists to catch, all of which have already happened
 * once:
 *
 * - the navigation and the action buttons drawn on top of each other, at a width
 *   nobody develops at;
 * - a menu that looks like a different component to the menu beside it;
 * - a destination that quietly stopped being linked from anywhere.
 *
 * The third one used to be measured against the footer, which held about forty
 * links. The footer is now a brand line and a legal block, so it is measured
 * against the four dropdowns instead — which means opening them, because a
 * dropdown that is closed is not in the document.
 *
 *   node scripts/verify-header.mjs [baseUrl]
 */

const base = process.argv[2] ?? process.env.BASE_URL ?? 'http://localhost:3409';
const MARGIN = 12;

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

const MENUS = ['Explore', 'Ideas', 'Learn', 'Marketplace'];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const openMenu = async (name) => {
  await page.locator('header nav button', { hasText: name }).first().click();
  await page.waitForTimeout(280);
};

const closeMenu = async () => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
};

try {
  await page.goto(`${base}/en`, { waitUntil: 'networkidle' });

  group('The guest navigation');

  const labels = (await page.locator('header nav a, header nav button').allInnerTexts()).map(
    (text) => text.trim().split('\n')[0]
  );

  const EXPECTED = ['Home', 'Explore', 'Ideas', 'Learn', 'Marketplace', 'Community', 'Voyager'];

  for (const expected of EXPECTED) {
    check(`"${expected}" is in the top navigation`, labels.includes(expected));
  }

  check(
    'in that order, and nothing else with it',
    labels.length === EXPECTED.length && labels.every((label, index) => label === EXPECTED[index]),
    `found ${labels.length}: ${labels.join(', ')}`
  );

  // It was a menu of five ways into a questionnaire standing beside four
  // sections of the product. `/start` is the hero call to action and the
  // `Get started` button; the row is for sections.
  check('Start Investing is gone from the row', !labels.includes('Start Investing'));

  check(
    'the current section is marked in the markup, not only in colour',
    (await page.locator('header nav [aria-current="page"]').count()) === 1
  );

  group('Community leaves the portal, and says so');

  const community = page.locator('header nav a', { hasText: 'Community' }).first();
  check('it is a link, not a menu', (await community.count()) === 1);
  check(
    'it points at the TradingView network',
    (await community.getAttribute('href')) === 'https://www.tradingview.com/social-network/',
    await community.getAttribute('href')
  );
  check('it opens in a new tab', (await community.getAttribute('target')) === '_blank');
  check(
    'and cannot hand the opener over with it',
    (await community.getAttribute('rel'))?.includes('noopener') === true
  );

  group('Four sections carry a dropdown');

  for (const section of MENUS) {
    const item = page.locator('header nav button', { hasText: section }).first();
    check(`${section} opens a menu`, (await item.getAttribute('aria-haspopup')) === 'true');
  }

  /*
   * Voyager is the exception, and deliberately. Its menu held three entries that
   * all opened `/voyager` plus a duplicate of Marketplace's Subscriptions, so
   * the label goes straight to the workspace instead of listing ways to get
   * there.
   */
  const voyager = page.locator('header nav a', { hasText: 'Voyager' }).first();
  check('Voyager is a link, not a menu', (await voyager.count()) === 1);
  check(
    'and it opens the workspace',
    (await voyager.getAttribute('href'))?.endsWith('/voyager') === true,
    await voyager.getAttribute('href')
  );
  check('Voyager is last in the row', labels.indexOf('Voyager') === labels.length - 1, labels.join(', '));

  group('One row anatomy in all four menus');

  /*
   * The point of the redesign. Explore was the only menu built as a surface —
   * icon, label, description — and the other three were lists of links beside
   * it. A reader who opens two menus one click apart should not be able to tell
   * that they were written at different times.
   */
  for (const section of MENUS) {
    await openMenu(section);

    const panel = page.locator('div[class*="panel"]').first();
    // `menuItemWide` is the row itself. `[class*="menuItem"]` would also match
    // the label, the text wrapper and the description inside every one of them.
    const rowCount = await panel.locator('[class*="menuItemWide"]').count();
    const icons = await panel.locator('[class*="menuIcon"]').count();
    const subs = await panel.locator('[class*="menuItemSub"]').count();

    check(`${section}: every row carries a glyph`, rowCount > 0 && icons === rowCount, `${icons}/${rowCount}`);
    check(`${section}: and a description under the label`, subs >= rowCount - 1, `${subs}/${rowCount}`);

    const heading = panel.locator('div[class*="groupTitle"]').first();
    const weight = await heading.evaluate((node) => getComputedStyle(node).fontWeight);
    check(`${section}: its section headings are the shared one`, weight === '800', weight);

    await closeMenu();
  }

  group('The Ideas menu');

  await openMenu('Ideas');
  const ideasPanel = page.locator('div[class*="panel"]').first();
  const ideasGroups = await ideasPanel.locator('div[class*="groupTitle"]').allInnerTexts();

  for (const name of ['DISCOVER', 'GO DEEPER']) {
    check(`Ideas names ${name} as a group`, ideasGroups.includes(name), ideasGroups.join(' | '));
  }

  const ideasRows = await ideasPanel.locator('a[class*="menuItem"]').all();
  check('it holds six destinations', ideasRows.length === 6, `${ideasRows.length}`);

  /*
   * Six rows, six anchors. Ideas is one page with six named parts, so without
   * the hash this would be six links to the same place — which is the reason
   * Voyager's dropdown was deleted.
   */
  const ideasHrefs = await Promise.all(ideasRows.map((row) => row.getAttribute('href')));
  check(
    'each lands on the part of /ideas it names',
    ideasHrefs.every((href) => /\/en\/ideas#[a-z]+$/.test(href ?? '')) &&
      new Set(ideasHrefs).size === 6,
    ideasHrefs.join(' ')
  );

  const panelBox = await ideasPanel.boundingBox();
  const triggerBox = await page.locator('header nav button', { hasText: 'Ideas' }).first().boundingBox();
  const centre = triggerBox ? triggerBox.x + triggerBox.width / 2 : 0;

  check(
    'the panel sits under the item that opened it',
    Boolean(panelBox) && centre > panelBox.x - 4 && centre < panelBox.x + panelBox.width + 4,
    panelBox ? `panel ${Math.round(panelBox.x)}–${Math.round(panelBox.x + panelBox.width)}` : 'no panel'
  );
  check(
    'and stays inside the window',
    Boolean(panelBox) && panelBox.x >= MARGIN - 1 && panelBox.x + panelBox.width <= 1440 - MARGIN + 1
  );

  await closeMenu();

  group('Explore is still the roadmap');

  await openMenu('Explore');
  const exploreGroups = await page.locator('div[class*="groupTitle"]').allInnerTexts();
  for (const name of ['MARKET', 'SYMBOLS', 'ECONOMY']) {
    check(`Explore names ${name} as a group`, exploreGroups.includes(name), exploreGroups.join(' | '));
  }

  /*
   * Announced, not routed — and never dimmed: a greyed-out roadmap announces
   * nothing.
   *
   * "Not routed" is no longer all of them. Market overview and Compare assets
   * are built, so they are links and carry a Live or New chip instead of the
   * Coming soon badge. The rule the count is written against is that pairing,
   * not the number twenty: a row clicks if and only if it is chipped, and it is
   * never both chipped and badged.
   */
  const rows = await page.locator('[class*="menuItemWide"]').count();
  const chipped = await page.locator('[class*="menuItemLabel"] > [class*="chipLive"]').count();
  const inertRows = await page.locator('div[class*="menuItemInert"]').count();

  check(
    'its rows do not click unless they are ready',
    inertRows === rows - chipped,
    `${rows} rows, ${chipped} ready, ${inertRows} inert`
  );
  check(
    'and no row both warns and navigates',
    (await page
      .locator('[class*="menuItemLabel"]:has([class*="soon"]):has([class*="chipLive"])')
      .count()) === 0
  );

  const inert = page.locator('div[class*="menuItemInert"]').first();
  check(
    'and are not dimmed for it',
    (await inert.evaluate((node) => getComputedStyle(node).opacity)) === '1'
  );
  await closeMenu();

  group('The header row holds together');

  /*
   * Between roughly 1080px and 1280px the old `1fr auto 1fr` grid pushed the
   * action column below its own content and the search button was drawn on top
   * of the Community and Voyager labels. Nobody develops at 1200px; everybody
   * browses at it.
   */
  for (const width of [1440, 1280, 1200, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(200);

    const nav = await page.locator('header nav').boundingBox();
    const actions = await page.locator('header div[class*="actions"]').boundingBox();
    const overlaps =
      nav && actions && nav.x + nav.width > actions.x + 1 && nav.y < actions.y + actions.height;

    check(`${width}px: the buttons are not drawn over the labels`, !overlaps);
  }

  await page.setViewportSize({ width: 1440, height: 900 });

  group('Nothing lost its way in');

  /*
   * Every destination the four menus and the header buttons hold. The footer
   * used to answer this question with a directory of forty links; it is a brand
   * line now, so the menus have to be honest on their own.
   *
   * Routes that lost their only link when the directory went are listed in the
   * handoff and belong to the sections that own their pages — they are not
   * quietly re-listed here to make this suite pass.
   */
  const reachable = new Set();

  const collect = async () => {
    const found = await page
      .locator('a[href]')
      .evaluateAll((nodes) => nodes.map((node) => new URL(node.href).pathname));
    for (const href of found) reachable.add(href);
  };

  await collect();
  for (const section of MENUS) {
    await openMenu(section);
    await collect();
    await closeMenu();
  }

  const MUST_REACH = [
    '/en/ideas',
    '/en/academy',
    '/en/academy/path',
    '/en/academy/setup',
    '/en/academy/dashboard',
    '/en/portfolio',
    '/en/events',
    '/en/events/create',
    '/en/marketplace/experts',
    '/en/marketplace/tools',
    '/en/marketplace/academy',
    '/en/marketplace/subscriptions',
    // The hero call to action, and the reason Start Investing did not need a
    // heading of its own.
    '/en/start',
  ];

  for (const route of MUST_REACH) {
    check(`${route} is reachable from the header`, reachable.has(route));
  }

  group('The footer is a brand line');

  check(
    'the link directory is gone',
    (await page.locator('footer nav').count()) === 0,
    `${await page.locator('footer a').count()} links left`
  );
  check(
    'the disclaimer stays',
    (await page.locator('footer').innerText()).includes('Nothing here is financial advice')
  );

  group('Ideas');

  await page.goto(`${base}/en/ideas`, { waitUntil: 'networkidle' });

  check('the page is Ideas', (await page.locator('main h1, h1').first().innerText()) === 'Ideas');

  for (const id of ['trending', 'themes', 'opportunities', 'popular', 'portfolios', 'compare']) {
    check(`#${id} is on the page`, (await page.locator(`#${id}`).count()) === 1);
  }

  const body = await page.locator('body').innerText();
  check('every set of figures is labelled illustrative', /illustrative/i.test(body));

  /*
   * The language rule for this whole section. Ideas describes what is happening
   * and what is connected to what; the moment it recommends, it is a different
   * product with a different licence.
   */
  const forbidden = ['strong buy', 'guaranteed', 'best investment'];
  for (const phrase of forbidden) {
    check(`it never says "${phrase}"`, !body.toLowerCase().includes(phrase));
  }

  check(
    'the ecosystem chain is drawn, not described',
    (await page.locator('[class*="chainChip"]').count()) >= 12
  );
  check('the sparklines render', (await page.locator('#trending polyline').count()) === 4);

  group('The search control goes somewhere');

  await page.goto(`${base}/en`, { waitUntil: 'networkidle' });
  const search = page.locator('header button[aria-label="Search"]');
  check('it exists', (await search.count()) === 1);

  await search.click();
  await page.waitForTimeout(400);

  const field = page.locator('[role="dialog"] input[type="text"], [role="search"] input');
  check('it opens a field in place', (await field.count()) > 0);
  check(
    'and puts the cursor in it',
    await field
      .first()
      .evaluate((node) => node === document.activeElement)
      .catch(() => false)
  );

  await field.first().fill('What is an ETF?');
  await field.first().press('Enter');
  await page.waitForURL(/\/research\?q=/, { timeout: 5000 }).catch(() => {});
  check(
    'and the question travels in the URL',
    // Read through URLSearchParams, not decodeURIComponent: a query string
    // encodes a space as "+", which decodeURIComponent leaves alone.
    new URL(page.url()).searchParams.get('q') === 'What is an ETF?',
    page.url()
  );

  group('Phones');

  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto(`${base}/en`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  // The header used to push the document 15px wide at this size, so every page on
  // the site scrolled sideways a little.
  check('the page does not scroll sideways', overflow <= 0, `${overflow}px of overflow`);

  check(
    'signing in is still reachable',
    (await page.locator('header a, header button').filter({ hasText: 'Sign in' }).count()) > 0
  );

  // A phone that opens one menu as a drawer and the next as a floating card is
  // two products.
  await openMenu('Ideas');
  const drawer = await page.locator('div[class*="panel"]').first().boundingBox();
  check(
    'a menu is a full-screen drawer here',
    Boolean(drawer) && drawer.width >= 389 && drawer.y <= 1,
    drawer ? `${Math.round(drawer.width)}×${Math.round(drawer.height)} at y=${Math.round(drawer.y)}` : 'no panel'
  );
  check('with a way out of it', (await page.locator('button[aria-label="Close menu"]').count()) === 1);
  await closeMenu();

  /*
   * The descriptions are hidden at 1024 and come back at 640, and the two rules
   * are one specificity step apart: the tablet one is written against
   * `.panelMega` and still matches at 390px, so the phone rule has to be at
   * least as specific or Explore reads as twenty bare labels here.
   */
  await openMenu('Explore');
  check(
    'and its rows keep their descriptions',
    await page.locator('[class*="menuItemSub"]').first().isVisible()
  );
  await closeMenu();

  await page.goto(`${base}/en/ideas`, { waitUntil: 'networkidle' });
  const ideasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check('and Ideas does not scroll sideways either', ideasOverflow <= 0, `${ideasOverflow}px`);
} finally {
  await browser.close();
}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
