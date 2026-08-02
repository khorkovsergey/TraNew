import { chromium } from 'playwright';

/**
 * The Voyager panel on the chart, in a real browser.
 *
 * The unit tests prove the compression finds the right bars and that the
 * references point at them. None of that reaches the screen on its own: the
 * numbered zones are drawn on a canvas no assertion can read, and the hover that
 * runs from a zone back to a sentence exists only as pointer events crossing
 * two components.
 *
 * So this checks the parts that only exist when it is running — that a question
 * produces numbered references, that hovering either end lights the other, and
 * that removing a chip changes the answer rather than just the panel.
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

/** Pixels differing between two screenshots, as a share of the total. */
function differenceRatio(a, b) {
  if (a.length !== b.length) return 1;
  let differing = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) differing += 1;
  }
  return differing / (a.length / 4);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  group('Reaching the chart');

  await page.goto(`${BASE}/en/supercharts`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 20_000 });
  check('the workspace renders a chart', (await page.locator('canvas').count()) > 0);

  const voyagerTab = page.getByRole('tab', { name: 'Voyager' });
  check('the Voyager tab is a control, not a "soon" label', (await voyagerTab.count()) > 0);

  await voyagerTab.click();
  await page.waitForTimeout(300);

  group('What Voyager is told is visible before anything is asked');

  const chips = page.locator('button:has-text("bars in view")');
  check('the context is shown as chips', (await chips.count()) > 0);

  const sizeLabel = await page.locator('text=/\\d+ KB/').first().textContent().catch(() => null);
  check('the payload size is stated', Boolean(sizeLabel), sizeLabel ?? 'no size shown');

  const kb = Number((sizeLabel ?? '').replace(/[^\d]/g, ''));
  check(
    'and it is a compressed payload, not the whole series',
    kb > 0 && kb < 40,
    `${kb} KB — a raw window would be far larger`
  );

  group('An answer that points at the chart');

  await page.getByRole('button', { name: /Explain what happened/ }).click();
  await page.waitForSelector('text=/bars in view,|Over the/', { timeout: 10_000 });
  await page.waitForTimeout(600);

  const references = page.locator('[class*="reference"]').filter({ hasText: /./ });
  const referenceCount = await references.count();
  check('the answer carries numbered references', referenceCount > 0, `${referenceCount} found`);

  const summary = (await page.locator('[class*="voyagerAnswer"]').first().textContent()) ?? '';
  check('the summary states the move it measured', /%/.test(summary));
  check('and declines to explain why', /does not explain why/.test(summary));

  const sources = await page.locator('[class*="voyagerSources"]').first().textContent();
  check('the answer is dated and sourced', /\d{4}-\d{2}-\d{2}/.test(sources ?? ''), sources ?? '');

  group('The highlight runs both ways');

  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();

  const before = await canvas.screenshot();

  await references.first().hover();
  await page.waitForTimeout(350);
  const afterHover = await canvas.screenshot();

  check(
    'hovering a sentence changes the chart',
    differenceRatio(before, afterHover) > 0.0005,
    `${(differenceRatio(before, afterHover) * 100).toFixed(2)}% of pixels changed`
  );

  // The reverse: the pointer over a zone should light the sentence. The window
  // reference spans the whole visible range, so the middle of the chart is
  // inside at least one zone.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(350);

  const lit = await page.locator('[class*="referenceOn"]').count();
  check('and hovering the chart lights a sentence', lit > 0, `${lit} lit`);

  group('Removing a chip changes the answer, not just the panel');

  await page.getByRole('button', { name: /Which of these had unusual volume/ }).click();
  await page.waitForTimeout(700);

  const withAnomalies = await page.locator('[class*="voyagerAnswer"]').first().textContent();
  const referencesWith = await references.count();

  const anomalyChip = page.locator('button:has-text("volume spikes")');
  const hadAnomalyChip = (await anomalyChip.count()) > 0;

  if (hadAnomalyChip) {
    await anomalyChip.first().click();
    await page.waitForTimeout(200);

    await page
      .getByRole('textbox', { name: /Ask Voyager/ })
      .fill('which bars had unusual volume?');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await page.waitForTimeout(900);

    const withoutAnomalies = await page.locator('[class*="voyagerAnswer"]').first().textContent();
    const referencesWithout = await page.locator('[class*="reference"]').count();

    check(
      'the same question answers differently once the chip is off',
      withAnomalies !== withoutAnomalies,
      'the answer did not change'
    );
    check(
      'and the references it cannot support are gone',
      referencesWithout < referencesWith,
      `${referencesWith} → ${referencesWithout}`
    );
  } else {
    // Honest rather than green: this window simply had no volume outlier.
    console.log('  skip the anomalies chip — this window contains no volume outlier');
  }

  group('The panel does not take the chart with it');

  await page.getByRole('tab', { name: 'Objects & data' }).click();
  await page.waitForTimeout(200);
  check('the object tree is still reachable', (await page.locator('text=STUDIES').count()) > 0);
  check('and the chart is still there', (await page.locator('canvas').count()) > 0);
} catch (error) {
  // An exception used to fall through to `finally`, print the completed count
  // and exit 0 — a suite that stopped early reported as a suite that passed.
  failed += 1;
  console.log(`\n  FAIL the run stopped early — ${error.message}`);
} finally {
  await browser.close();
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}
