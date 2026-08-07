import { chromium } from 'playwright';

/**
 * The shell, driven rather than read.
 *
 * The redesign cut five dropdowns down to one, so most of what this suite used
 * to measure — where each panel lands relative to its trigger — now applies to a
 * single menu. What replaced it is the more important question: the five
 * headings that lost their menus took roughly forty destinations with them, and
 * every one of those has to still be reachable. That is what the third group
 * checks, against the footer.
 *
 *   node scripts/verify-header.mjs [baseUrl]
 */

const base = process.argv[2] ?? process.env.BASE_URL ?? 'http://localhost:3111';
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

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(`${base}/en`, { waitUntil: 'networkidle' });

  group('The guest navigation');

  const labels = (await page.locator('header nav a, header nav button').allInnerTexts()).map(
    (text) => text.trim().split('\n')[0]
  );

  for (const expected of ['Home', 'Start Investing', 'Explore', 'Learn', 'Voyager', 'Marketplace']) {
    check(`"${expected}" is in the top navigation`, labels.includes(expected));
  }

  check('and nothing else is', labels.length === 6, `found ${labels.length}: ${labels.join(', ')}`);

  // The three sections Explore absorbed are named groups inside its menu, so
  // somebody who knew where Market or Economy used to live finds them by name.
  await page.locator('header nav button', { hasText: 'Explore' }).first().click();
  await page.waitForTimeout(300);
  const exploreGroups = await page.locator('div[class*="groupTitle"]').allInnerTexts();
  for (const group of ['MARKET', 'SYMBOLS', 'ECONOMY']) {
    check(`Explore names ${group} as a group`, exploreGroups.includes(group), exploreGroups.join(' | '));
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  check(
    'the current section is marked in the markup, not only in colour',
    (await page.locator('header nav [aria-current="page"]').count()) === 1
  );

  group('Every section carries a dropdown');

  /*
   * Four of them. The redesign shipped with only Marketplace; the sections
   * underneath then had to be reached through the page they belonged to, and
   * the shortcuts came back. Each menu opens with its own section, so a label
   * that opens a panel is still a way in.
   */
  for (const section of ['Start Investing', 'Explore', 'Learn', 'Marketplace']) {
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

  // Last in the row, after Marketplace.
  check(
    'Voyager sits after Marketplace',
    labels.indexOf('Voyager') === labels.length - 1 &&
      labels.indexOf('Marketplace') === labels.indexOf('Voyager') - 1,
    labels.join(', ')
  );

  const trigger = page.locator('header nav button', { hasText: 'Marketplace' });

  check(
    'it is announced as a menu, not a link',
    (await trigger.getAttribute('aria-haspopup')) === 'true'
  );
  check('and starts closed', (await trigger.getAttribute('aria-expanded')) === 'false');

  await trigger.click();
  await page.waitForTimeout(300);

  check('opening it reports open', (await trigger.getAttribute('aria-expanded')) === 'true');

  const panel = page.locator('div[class*="panel"]').first();
  const panelBox = await panel.boundingBox();
  const triggerBox = await trigger.boundingBox();
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

  const items = (await panel.allInnerTexts()).join(' | ');
  check(
    'it carries every Marketplace destination',
    ['Expert services', 'Tools and data', 'Academy', 'Events', 'Subscriptions', 'Merchandise'].every(
      (name) => items.includes(name)
    ),
    items.replace(/\n/g, ' · ')
  );

  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check('Escape closes it', (await trigger.getAttribute('aria-expanded')) === 'false');

  group('Nothing lost its way in');

  /*
   * The destinations the five removed dropdowns used to hold. Each was one click
   * from the top of the page before the redesign; a route with no link into it
   * is a deleted feature wearing a URL.
   */
  const MUST_REACH = [
    '/en/markets/global',
    '/en/news',
    '/en/ideas',
    '/en/economy',
    '/en/research',
    '/en/supercharts',
    '/en/academy',
    '/en/academy/path',
    '/en/events',
    '/en/events/create',
    '/en/portfolio',
    '/en/community',
    '/en/brokers',
    '/en/marketplace',
    '/en/marketplace/experts',
    '/en/marketplace/subscriptions',
    // The localised slugs, not the internal keys: `/tools` is served at
    // `/professional-tools` and `/trust` at `/trust-center`.
    '/en/professional-tools',
    '/en/trust-center',
    '/en/why-tradingnew',
  ];

  const hrefs = await page
    .locator('a[href]')
    .evaluateAll((nodes) => nodes.map((node) => new URL(node.href).pathname));

  for (const route of MUST_REACH) {
    check(`${route} is linked from every page`, hrefs.includes(route));
  }

  group('The search control goes somewhere');

  const search = page.locator('header button[aria-label="Search"]');
  check('it exists', (await search.count()) === 1);

  await search.click();
  await page.waitForTimeout(400);

  /*
   * An overlay with a field, not a jump to a search screen. Sending somebody to
   * another page to type is asking them to leave the thing they wanted to look
   * something up about.
   */
  const field = page.locator('[role="dialog"] input[type="text"], [role="search"] input');
  check('it opens a field in place', (await field.count()) > 0);
  check(
    'and puts the cursor in it',
    await field.first().evaluate((node) => node === document.activeElement).catch(() => false)
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

  await page.goto(`${base}/en/research`, { waitUntil: 'networkidle' });
  const emptyBody = await page.locator('main').innerText();

  // The canned "Direct answer" with sources and a timestamp used to render under
  // a heading that admitted nobody had asked anything.
  check('the empty research page carries no answer', !/direct answer/i.test(emptyBody), emptyBody.slice(0, 80));
  check(
    'and offers a field instead',
    (await page.locator('main [role="search"] input').count()) === 1
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
} finally {
  await browser.close();
}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
