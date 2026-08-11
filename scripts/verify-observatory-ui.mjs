import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Observatory, in a browser.
 *
 * Deliberately small. The metric suite already proves the numbers; this proves
 * the things only a rendered page can answer — that both modes render, that no
 * canonical state comes out looking like a zero, that a table scrolls inside
 * itself rather than pushing the page sideways, and that somebody who enters
 * presentation mode on a keyboard can leave it.
 *
 *   node scripts/verify-observatory-ui.mjs
 *
 * Needs a running app and `METRICS_ACCESS_SECRET`. Read-only: it authorizes,
 * looks, and writes nothing anywhere.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3414';
const SECRET = process.env.METRICS_ACCESS_SECRET;
const SHOTS = process.env.OBSERVATORY_SHOTS ?? '';

const WIDTHS = [
  { name: 'presentation', width: 1920, height: 1080 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'narrow', width: 390, height: 844 },
];

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

if (!SECRET) {
  console.error('METRICS_ACCESS_SECRET is not set; cannot authorize the dashboard.');
  process.exit(1);
}

const browser = await chromium.launch();

try {
  const context = await browser.newContext({
    viewport: WIDTHS[1],
    /* A headless UA is dropped by ingest, and this run must not write anyway. */
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  });

  const page = await context.newPage();

  console.log('\nAccess');
  await page.goto(`${BASE}/en/admin_admin_metrics`, { waitUntil: 'domcontentloaded' });
  check('the unauthorized shell renders nothing', !(await page.getByText('Product pulse').count()));

  const exchange = await page.request.post(`${BASE}/api/admin-metrics/access`, {
    data: { secret: SECRET },
  });
  check('the fragment secret is accepted', exchange.ok());

  await page.goto(`${BASE}/en/admin_admin_metrics`, { waitUntil: 'networkidle' });

  console.log('\nInformation architecture');
  const sections = ['pulse', 'journeys', 'surfaces', 'voyager', 'supercharts', 'market-data', 'reliability', 'monetization', 'coverage'];
  for (const id of sections) {
    check(`section ${id} renders`, (await page.locator(`#${id}`).count()) === 1);
  }

  const order = await page.$$eval('section[id]', (nodes) => nodes.map((node) => node.id));
  check(
    'sections appear outcome → journey → product → AI → reliability → measurement',
    sections.every((id, index) => order.indexOf(id) >= (index === 0 ? 0 : order.indexOf(sections[index - 1]))),
    order.join(' → ')
  );

  console.log('\nData states never look like zero');
  const absent = await page.$$eval('[data-state]', (nodes) =>
    nodes
      .filter((node) => !['live', 'derived', 'instrumented_going_forward'].includes(node.dataset.state ?? ''))
      .map((node) => ({ state: node.dataset.state, text: (node.textContent ?? '').trim() }))
  );

  check('at least one non-numeric state is on the page', absent.length > 0, `${absent.length} found`);
  check(
    'no absent metric renders a bare 0 or 0%',
    absent.every((card) => !/(^|\s)0(\.0)?%?(\s|$)/.test(card.text.split('\n')[1] ?? '')),
    absent.map((card) => card.state).join(', ')
  );

  const notMeasurable = absent.filter((card) => card.state === 'not_measurable');
  check(
    'a not-measurable card explains itself',
    notMeasurable.length === 0 || notMeasurable.every((card) => card.text.length > 40)
  );

  console.log('\nUnits');
  const vitalsText = await page.locator('#reliability').innerText();
  check('CLS is labelled a score, not a time', /CLS\s*\(score\)/.test(vitalsText), vitalsText.slice(0, 80));
  check('the time vitals are labelled as time', /LCP\s*\(time\)/.test(vitalsText));
  check(
    'client failures keep their stated denominator',
    vitalsText.includes('per 1,000') || (await page.getByText('Failures per 1,000 page views').count()) > 0
  );

  console.log('\nLimitations survive');
  check(
    'the Voyager server-request scope is on the page',
    (await page.getByText(/voyager\/research/).count()) > 0
  );
  check(
    'market wording says resolutions rather than provider requests',
    (await page.getByText('Market data resolutions').count()) > 0 &&
      (await page.getByText('Provider network requests').count()) === 0
  );
  check(
    'Supercharts separates intent from rendered outcome',
    (await page.getByText(/Intent and outcome are different rows/).count()) > 0
  );

  console.log('\nPresentation mode');
  const toggle = page.getByRole('button', { name: /Presentation mode/ });
  check('the toggle is a real button', (await toggle.count()) === 1);

  const beforeText = await page.locator('#pulse').innerText();
  await toggle.click();
  await page.waitForTimeout(200);

  check('the shell switches mode', (await page.locator('[data-mode="presentation"]').count()) === 1);
  check('values are unchanged by the mode', (await page.locator('#pulse').innerText()).includes(beforeText.split('\n')[2] ?? ''));
  check('detail drawers collapse', (await page.locator('details[class*="detail"]:visible').count()) === 0);
  check(
    'a limitation is still visible',
    (await page.getByText(/no payment provider is\s+connected|Confirmed revenue/).count()) > 0
  );

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('Escape leaves presentation mode', (await page.locator('[data-mode="detail"]').count()) === 1);

  console.log('\nAccessibility');
  await page.keyboard.press('Tab');
  const focusTag = await page.evaluate(() => document.activeElement?.tagName ?? '');
  check('something focusable exists', ['A', 'BUTTON', 'SUMMARY'].includes(focusTag), focusTag);
  check(
    'the period control marks the current option',
    (await page.locator('[aria-current="page"]').count()) === 1
  );
  check('tables carry captions or headers', (await page.locator('table th[scope]').count()) > 0);

  console.log('\nResponsive');
  for (const size of WIDTHS) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.waitForTimeout(250);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    check(`no page-level horizontal overflow at ${size.name} (${size.width}px)`, !overflow);

    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: join(SHOTS, `observatory-${size.name}.png`), fullPage: false });
    }
  }
} catch (error) {
  failed += 1;
  console.log(`\n  FAIL the run stopped early — ${String(error).split('\n')[0]}`);
} finally {
  await browser.close();
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed === 0 ? 0 : 1);
}
