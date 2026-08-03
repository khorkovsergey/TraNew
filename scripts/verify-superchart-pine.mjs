import { chromium } from 'playwright';

/**
 * The Pine preview runtime, in a real browser.
 *
 * The unit tests prove the interpreter computes the right numbers. What they
 * cannot show is the part that only exists at runtime: that the worker starts
 * and returns, that a result reaches the chart as dashed lines, that a script
 * outside the subset explains itself instead of failing silently — and that the
 * page stays responsive while a script is running, which is the entire reason
 * the runtime is off the main thread.
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

async function snapshot(page, key) {
  await page.evaluate((name) => {
    const canvas = document.querySelector('canvas');
    const context = canvas.getContext('2d');
    window.__frames = window.__frames || {};
    window.__frames[name] = context.getImageData(0, 0, canvas.width, canvas.height).data.slice();
  }, key);
}

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
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

try {
  group('Opening the lab');

  await page.goto(`${BASE}/en/supercharts`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Dock' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Generate from the chart' }).click();
  await page.waitForTimeout(500);

  const source = page.getByRole('textbox', { name: 'Pine script source' });
  check('the lab is ready', (await source.count()) > 0);

  group('A script in the subset previews on the chart');

  await snapshot(page, 'before');

  await source.fill(
    '//@version=6\nindicator("Preview test", overlay = true)\nfast = ta.sma(close, 10)\nslow = ta.sma(close, 40)\nplot(fast, "Fast")\nplot(slow, "Slow")'
  );
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Run preview' }).click();
  await page.waitForTimeout(1500);

  const notice = await page.locator('[class*="labNotice"]').allInnerTexts();
  const noticeText = notice.join(' ');

  check('the run reports what it drew', /Previewing 2 plots/.test(noticeText), noticeText.slice(0, 140));
  check('and reports the cost', /operations/.test(noticeText), noticeText.slice(0, 140));
  check(
    'and says the script was interpreted, not executed',
    /was not executed as code|interpreted/.test(noticeText),
    noticeText.slice(0, 200)
  );

  await snapshot(page, 'previewed');
  const drawn = await pixelDifference(page, 'before', 'previewed');
  check('the result is on the chart', drawn > 0.001, `${(drawn * 100).toFixed(2)}% of pixels changed`);

  group('It is a preview, not a study');

  const stored = await page.evaluate(() => localStorage.getItem('tn_superchart_layout_v1'));
  check('nothing was written to the saved layout', !String(stored).includes('script_preview'));

  await page.getByRole('button', { name: 'Clear' }).click();
  await page.waitForTimeout(600);
  await snapshot(page, 'cleared');
  const residue = await pixelDifference(page, 'cleared', 'before');
  check(
    'clearing takes it back off',
    residue < 0.0005,
    `${(residue * 100).toFixed(3)}% of pixels still differ`
  );

  group('Outside the subset, it explains itself');

  await source.fill(
    '//@version=6\nindicator("Outside")\nspx = request.security("SPX", "D", close)\nplot(spx)'
  );
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Run preview' }).click();
  await page.waitForTimeout(1500);

  const failure = await page.locator('[class*="labFailure"]').first().textContent();
  check('the failure is shown', Boolean(failure), 'nothing was reported');
  check('it names the call', /request\.security/.test(failure ?? ''), failure ?? '');
  check('it gives the line', /Line 3/.test(failure ?? ''), failure ?? '');
  check(
    'and it says export is the way forward',
    /export/i.test(failure ?? ''),
    failure ?? ''
  );

  const sourceAfterFailure = await source.inputValue();
  check(
    'the script is untouched by a failed run',
    sourceAfterFailure.includes('request.security'),
    'the source changed'
  );

  group('A rejected construct is refused rather than approximated');

  await source.fill(
    '//@version=6\nindicator("Loop")\ntotal = 0\ntotal := total + close\nplot(total)'
  );
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Run preview' }).click();
  await page.waitForTimeout(1500);

  const refusal = await page.locator('[class*="labFailure"]').first().textContent();
  check(
    'reassignment is declined, not guessed at',
    /bar by bar|cannot express/.test(refusal ?? ''),
    refusal ?? ''
  );

  group('The page stays responsive while it runs');

  await source.fill('//@version=6\nindicator("Heavy")\nplot(ta.sma(close, 200))');
  await page.waitForTimeout(300);

  // Interacting with the chart during a run is the point of the worker: on the
  // main thread this click would queue behind the interpreter.
  await page.getByRole('button', { name: 'Run preview' }).click();
  const clicked = await page
    .getByRole('button', { name: '1W' })
    .click({ timeout: 2_000 })
    .then(() => true)
    .catch(() => false);

  check('the chart still takes input during a run', clicked, 'the interface blocked');
  await page.waitForTimeout(1500);
} catch (error) {
  failed += 1;
  console.log(`\n  FAIL the run stopped early — ${error.message}`);
} finally {
  await browser.close();
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}
