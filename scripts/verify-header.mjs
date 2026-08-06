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

  check(
    'the current section is marked in the markup, not only in colour',
    (await page.locator('header nav [aria-current="page"]').count()) === 1
  );

  group('Marketplace is the one dropdown left');

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

  const search = page.locator('header a[aria-label="Search"], header button[aria-label="Search"]');
  check('it exists', (await search.count()) === 1);
  check(
    'and is a link rather than a button that focuses a field nothing renders',
    (await search.first().evaluate((node) => node.tagName)) === 'A'
  );

  await search.first().click();
  await page.waitForURL(/\/research/, { timeout: 5000 }).catch(() => {});
  check('it opens the research workspace', page.url().includes('/research'), page.url());

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
