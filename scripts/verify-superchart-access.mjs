import { chromium, devices } from 'playwright';

/**
 * Accessibility and responsiveness for the chart workspace.
 *
 * A canvas is one opaque element, so nothing about the chart can be checked by
 * reading the accessibility tree of the thing that draws it. What can be
 * checked is whether the same data exists a second time as text, whether the
 * keyboard reaches everything, and whether a phone gets a usable layout rather
 * than a desktop one squeezed — which is the failure that never shows up on the
 * machine it was built on.
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

const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(`${BASE}/en/supercharts`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 20_000 });

  group('The chart exists as text as well as pixels');

  const region = page.getByRole('region', { name: 'Chart data as text' });
  check('there is a text representation', (await region.count()) > 0);

  const described = await region.innerText();
  check('it names the instrument and interval', /TSLA/.test(described), described.slice(0, 80));
  check('it gives the close', /Closed at \d/.test(described), described.slice(0, 200));
  check('and the direction in words, not only a colour', /up|down/.test(described));
  check('and the extremes with their dates', /highest price in view/.test(described));

  const table = region.getByRole('table');
  check('recent bars are a real table', (await table.count()) > 0);

  const headers = await table.getByRole('columnheader').allInnerTexts();
  check(
    'with named columns',
    ['Date', 'Open', 'High', 'Low', 'Close'].every((name) => headers.includes(name)),
    headers.join(', ')
  );

  const rows = await table.getByRole('row').count();
  check('and a readable number of rows, not every bar', rows > 1 && rows <= 12, `${rows} rows`);

  check(
    'the canvas itself is hidden from the tree',
    await page.locator('canvas').first().getAttribute('aria-hidden'),
    'the canvas would be announced as an unlabelled element'
  );

  group('The keyboard reaches the workspace');

  // ⌥V is in the design's keyboard map. `event.code`, because Alt rewrites the
  // character on several layouts.
  await page.keyboard.press('Alt+KeyV');
  await page.waitForTimeout(400);

  const voyagerTab = page.getByRole('tab', { name: 'Voyager' });
  check(
    'Alt+V opens Voyager',
    (await voyagerTab.getAttribute('aria-selected')) === 'true',
    'the Voyager tab did not become selected'
  );

  const focusable = await page.evaluate(
    () =>
      document.querySelectorAll(
        'button:not([disabled]), a[href], input, textarea, [tabindex]:not([tabindex="-1"])'
      ).length
  );
  check('there are focusable controls', focusable > 10, `${focusable}`);

  // Tab from the top and confirm focus actually lands somewhere visible.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return null;
    return { tag: element.tagName, label: element.textContent?.slice(0, 30) ?? '' };
  });
  check('tab moves focus into the workspace', Boolean(focused), 'focus stayed on the body');

  group('Every icon control says what it is');

  const unlabelled = await page.evaluate(() =>
    [...document.querySelectorAll('button')].filter((button) => {
      const text = (button.textContent ?? '').trim();
      const label = button.getAttribute('aria-label') ?? button.getAttribute('title') ?? '';
      return !text && !label;
    }).length
  );
  check('no button is nameless', unlabelled === 0, `${unlabelled} unnamed buttons`);

  group('The parity the flag was holding back');

  const keepLinks = await page.evaluate(() =>
    [...document.querySelectorAll('a')]
      .filter((a) => /watchlist|alert/i.test(a.textContent ?? ''))
      .map((a) => a.getAttribute('href'))
  );
  check('watchlist and alert are reachable', keepLinks.length >= 2, keepLinks.join(', '));
  check(
    'and they lead to registration',
    keepLinks.every((href) => href?.includes('/sign-up')),
    keepLinks.join(', ')
  );

  await page.close();

  group('A phone gets a phone layout');

  const phone = await browser.newContext({ ...devices['iPhone 13'] });
  const small = await phone.newPage();

  await small.goto(`${BASE}/en/supercharts`, { waitUntil: 'domcontentloaded' });
  await small.waitForSelector('canvas', { timeout: 20_000 });
  await small.waitForTimeout(600);

  const tabBar = small.getByRole('navigation', { name: 'Workspace sections' });
  check('the section tabs are shown', await tabBar.isVisible());

  const tabs = await tabBar.getByRole('button').all();
  check('with four sections', tabs.length === 4, `${tabs.length}`);

  // The 44px minimum from the accessibility rules.
  const tooSmall = [];
  for (const tab of tabs) {
    const box = await tab.boundingBox();
    if (!box || box.height < 44) tooSmall.push(`${(await tab.innerText()).trim()} ${box?.height}px`);
  }
  check('every target is at least 44 pixels tall', tooSmall.length === 0, tooSmall.join(', '));

  const overflow = await small.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check('the page does not scroll sideways', overflow <= 1, `${overflow}px of overflow`);

  await tabBar.getByRole('button', { name: 'Voyager', exact: true }).click();
  await small.waitForTimeout(500);

  const panelVisible = await small.getByRole('complementary', { name: 'Chart panels' }).isVisible();
  check('switching to Voyager shows the panel', panelVisible);

  const chartVisible = await small.locator('canvas').first().isVisible();
  check('and the chart is not fighting it for the screen', !chartVisible, 'both panes were shown');

  await tabBar.getByRole('button', { name: 'Chart', exact: true }).click();
  await small.waitForTimeout(500);
  check('switching back shows the chart', await small.locator('canvas').first().isVisible());

  const overflowAfter = await small.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check('still no sideways scroll after switching', overflowAfter <= 1, `${overflowAfter}px`);

  await phone.close();
} catch (error) {
  failed += 1;
  console.log(`\n  FAIL the run stopped early — ${error.message}`);
} finally {
  await browser.close();
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}
