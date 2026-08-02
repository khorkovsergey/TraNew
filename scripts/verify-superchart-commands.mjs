import { chromium } from 'playwright';

/**
 * F2 from the design, end to end: plan → preview → apply → undo.
 *
 * The rule this checks is the one the acceptance list states plainly — no AI
 * change reaches the chart without plan → preview → apply, and undo restores
 * the previous state exactly. None of that can be proven from the modules
 * alone: the preview is dashed pixels on a canvas, and "one undo" is a claim
 * about a component's state, not about a function.
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

/*
 * Real pixel comparison, done inside the page.
 *
 * The first version of this compared the bytes of two PNG screenshots. Two
 * compressed images of the same size have different byte lengths, so the
 * "different length means completely different" branch fired on images that
 * were nearly identical — and reported 100%. Comparing compressed bytes is not
 * comparing pixels.
 *
 * So the frames stay in the browser as raw `ImageData` and only the ratio
 * crosses the bridge. A megabyte of pixels per snapshot never travels.
 */
async function snapshot(page, key) {
  await page.evaluate((name) => {
    const canvas = document.querySelector('canvas');
    const context = canvas.getContext('2d');
    window.__frames = window.__frames || {};
    window.__frames[name] = context.getImageData(0, 0, canvas.width, canvas.height).data.slice();
  }, key);
}

/** Share of pixels whose colour differs between two stored frames. */
async function pixelDifference(page, first, second) {
  return page.evaluate(([a, b]) => {
    const one = window.__frames?.[a];
    const two = window.__frames?.[b];
    if (!one || !two || one.length !== two.length) return 1;

    let differing = 0;
    for (let i = 0; i < one.length; i += 4) {
      if (one[i] !== two[i] || one[i + 1] !== two[i + 1] || one[i + 2] !== two[i + 2]) {
        differing += 1;
      }
    }
    return differing / (one.length / 4);
  }, [first, second]);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

try {
  group('A build request produces a plan, not a change');

  await page.goto(`${BASE}/en/supercharts`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 20_000 });
  await page.getByRole('tab', { name: 'Voyager' }).click();
  await page.waitForTimeout(400);

  await snapshot(page, 'blank');

  await page.getByRole('textbox', { name: /Ask Voyager/ }).fill('add EMA 20 and EMA 50 and mark the crossovers');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await page.waitForTimeout(700);

  check('a plan card appears', (await page.locator('[class*="planCard"]').count()) > 0);
  check(
    'it says why it proposed this',
    ((await page.locator('[class*="voyagerBecause"]').first().textContent()) ?? '').includes(
      'Proposed because'
    )
  );

  const steps = page.locator('[class*="planStep"]');
  check('the steps are listed', (await steps.count()) > 0, `${await steps.count()} steps`);

  const stepText = (await steps.first().innerText()).replace(/\n/g, ' ');
  check('with the parameters it will use', /20/.test(stepText) && /50/.test(stepText), stepText);

  group('The preview is on the chart and is visibly a proposal');

  await snapshot(page, 'previewed');
  const previewChange = await pixelDifference(page, 'blank', 'previewed');
  check(
    'the chart already shows the proposal',
    previewChange > 0.001,
    `${(previewChange * 100).toFixed(2)}% of pixels changed`
  );

  const diffRows = await page.locator('[class*="diffRow"]').count();
  check('Before/After rows are shown', diffRows > 0, `${diffRows} rows`);

  await page.getByRole('button', { name: 'Show before' }).click();
  await page.waitForTimeout(400);
  await snapshot(page, 'showingBefore');
  check(
    'Show before takes the proposal back off the chart',
    (await pixelDifference(page, 'showingBefore', 'blank')) < previewChange,
    'before looked no closer to the original than the preview did'
  );

  await page.getByRole('button', { name: 'Show after' }).click();
  await page.waitForTimeout(400);

  group('Nothing is applied until it is applied');

  const undoDisabledBeforeApply = await page
    .getByRole('button', { name: 'Undo' })
    .first()
    .isDisabled();
  check(
    'a preview creates nothing to undo',
    undoDisabledBeforeApply,
    'the preview had already been committed'
  );

  const stored = await page.evaluate(() => localStorage.getItem('tn_superchart_layout_v1'));
  check('and nothing was written to the saved layout', !String(stored).includes('"ema"'));

  group('Apply selected applies only what is selected');

  // Switch the only step off; the button must say so rather than doing it anyway.
  await steps.first().locator('input').uncheck();
  await page.waitForTimeout(300);
  const applyLabel = await page.locator('[class*="planApply"]').first().textContent();
  check('the Apply button reports the reduced count', /0 of|Apply 0/.test(applyLabel ?? ''), applyLabel ?? '');
  check('and it cannot be pressed', await page.locator('[class*="planApply"]').first().isDisabled());

  await steps.first().locator('input').check();
  await page.waitForTimeout(300);

  group('Apply, then one undo puts it back');

  await page.locator('[class*="planApply"]').first().click();
  await page.waitForTimeout(700);

  await snapshot(page, 'applied');
  check('the study is on the chart', (await pixelDifference(page, 'blank', 'applied')) > 0.001);
  check('the plan card is gone', (await page.locator('[class*="planCard"]').count()) === 0);

  const activity = await page.locator('[class*="activityRow"]').count();
  check('the activity log records it', activity > 0, `${activity} entries`);

  const undo = page.getByRole('button', { name: 'Undo' }).first();
  check('and now there is something to undo', !(await undo.isDisabled()));

  await undo.click();
  await page.waitForTimeout(700);
  await snapshot(page, 'undone');

  const residue = await pixelDifference(page, 'undone', 'blank');
  check(
    'one undo restores the chart exactly',
    residue < 0.0005,
    `${(residue * 100).toFixed(3)}% of pixels still differ`
  );

  group('A request the chart cannot serve is refused by name');

  await page.getByRole('textbox', { name: /Ask Voyager/ }).fill('buy 100 shares at market');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await page.waitForTimeout(700);

  const refusal = await page.locator('[class*="planRefusal"]').first().textContent();
  check('the refusal is shown', Boolean(refusal), 'no refusal displayed');
  check('and it names what was refused', /place_order/.test(refusal ?? ''), refusal ?? '');
  check(
    'with nothing applied',
    (await page.locator('[class*="planApply"]').count()) === 0,
    'an Apply button was offered for a plan with no steps'
  );
} catch (error) {
  failed += 1;
  console.log(`\n  FAIL the run stopped early — ${error.message}`);
} finally {
  await browser.close();
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}
