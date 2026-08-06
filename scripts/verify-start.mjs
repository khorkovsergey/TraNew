import { chromium } from 'playwright';

/**
 * Start Investing, driven in a browser.
 *
 * The rules that turn answers into a path are unit-tested in `test-events.mjs`;
 * what cannot be tested there is whether a person can actually get through the
 * four questions — whether Continue unlocks, whether the rail follows, whether
 * the suggested path on the right changes as answers change, and whether a
 * reload brings the draft back.
 *
 *   node scripts/verify-start.mjs [baseUrl]
 */

const base = process.argv[2] ?? 'http://localhost:3111';
const url = `${base}/en/start`;

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${String(error.message).split('\n')[0]}`);
  }
}

function group(title) {
  console.log(`\n${title}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

/** The option card carrying this title. */
const option = (title) => page.locator('button', { hasText: title }).first();
const continueButton = () => page.getByRole('button', { name: /^Continue$/ });
const pathTitles = () => page.locator('ol li span').filter({ hasText: /./ });

try {
  await page.goto(url, { waitUntil: 'networkidle' });

  group('A guest can get through all four questions');

  await check('Continue is closed until the first question is answered', async () => {
    if (!(await continueButton().isDisabled())) throw new Error('Continue was enabled at step 1');
  });

  await check('Back is closed on the first step', async () => {
    const back = page.getByRole('button', { name: /Back/ });
    if (!(await back.isDisabled())) throw new Error('Back was enabled at step 1');
  });

  await check('answering opens Continue', async () => {
    await option('All of it').click();
    await continueButton().waitFor({ state: 'visible' });
    if (await continueButton().isDisabled()) throw new Error('Continue stayed disabled');
  });

  await check('the choice is marked by more than colour', async () => {
    // The tick, not the border: a border is the first thing to go for anybody
    // who cannot separate these greens from the card behind them.
    const checked = page.locator('[role="radio"][aria-checked="true"]');
    if ((await checked.count()) !== 1) throw new Error(`${await checked.count()} radios checked`);
  });

  await check('Continue moves to the second question', async () => {
    await continueButton().click();
    await page.getByText('What matters most right now?').waitFor();
    const progress = await page.getByText(/Step 2 of 4/).count();
    if (!progress) throw new Error('the step counter did not move');
  });

  group('Choose up to two');

  await check('two priorities can be held at once', async () => {
    await option('Safety').click();
    await option('Growth').click();
    const checked = await page.locator('[role="checkbox"][aria-checked="true"]').count();
    if (checked !== 2) throw new Error(`${checked} checked, expected 2`);
  });

  await check('a third replaces the oldest rather than being ignored', async () => {
    await option('Regular income').click();
    const checked = await page.locator('[role="checkbox"][aria-checked="true"]').count();
    if (checked !== 2) throw new Error(`${checked} checked after a third click`);

    const safety = page.locator('[role="checkbox"]', { hasText: 'Safety' }).first();
    if ((await safety.getAttribute('aria-checked')) === 'true') {
      throw new Error('the oldest choice survived');
    }
  });

  group('The rail promises nothing until the answers are in');

  await check('it says the path is still being built', async () => {
    /*
     * This panel used to render a finished five-step route from the moment the
     * page loaded — the same five rows whatever anybody answered, under a
     * heading that called it theirs. The route is its own page now and
     * `verify-plan.mjs` drives it; what has to be true *here* is that nothing
     * pretends to be personalised before it is.
     */
    const rail = await page.locator('aside').innerText();
    if (!/being built/i.test(rail)) throw new Error(rail.split('\n')[0]);
  });

  await check('and names no step of a route that does not exist yet', async () => {
    const rail = await page.locator('aside').innerText();
    if (/cash reserve|beginner path|practice portfolio/i.test(rail)) {
      throw new Error('a step was named before the answers were in');
    }
  });

  group('Through the remaining questions');

  await check('the horizon question accepts an answer', async () => {
    await continueButton().click();
    await page.getByText('When might you need this money?').waitFor();
    await option('Within a year').click();
  });

  await check('and the last one opens', async () => {
    await continueButton().click();
    await page.getByText('How do you want to learn?').waitFor();
  });

  group('The last step produces the result rather than asking for an account');

  await check('the final button is closed until every question is answered', async () => {
    const finish = page.getByRole('button', { name: 'See my plan' });
    if (!(await finish.isDisabled())) throw new Error('it was open with a question outstanding');
  });

  await check('answering the last question opens it', async () => {
    await option('Short reads').click();
    const finish = page.getByRole('button', { name: 'See my plan' });
    if (await finish.isDisabled()) throw new Error('it stayed closed');
  });

  await check('and it leads to the plan, not to a sign-up prompt', async () => {
    await page.getByRole('button', { name: 'See my plan' }).click();
    await page.waitForURL(/\/start\/plan/, { timeout: 8000 });
  });

  await check('the answers are still there behind it', async () => {
    await page.goBack();
    await page.waitForTimeout(500);
    const checked = await page.locator('[role="radio"][aria-checked="true"]').count();
    if (checked !== 1) throw new Error('the last answer was lost');
  });

  group('The draft survives a reload');

  await check('a returning visitor opens where they stopped', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('How do you want to learn?').waitFor({ timeout: 5000 });
  });

  await check('and their answers are still selected', async () => {
    const checked = await page.locator('[role="radio"][aria-checked="true"]').count();
    if (checked !== 1) throw new Error(`${checked} answers restored on step 4`);
  });


  group('A corrupt draft is discarded, not half-restored');

  await check('an unknown answer resets the wizard rather than resuming it', async () => {
    /*
     * Local storage is writable by anything on the page. A draft that failed a
     * check must take the whole draft down — half-restoring it would put
     * somebody on the last step holding answers they never gave.
     */
    await page.evaluate(() =>
      window.localStorage.setItem(
        'tn.start.draft.v1',
        JSON.stringify({ knowledge: 'expert', priorities: ['gambling'], horizon: 'forever' })
      )
    );
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('How much of this is new to you?').waitFor({ timeout: 5000 });

    const checked = await page.locator('[role="radio"][aria-checked="true"]').count();
    if (checked !== 0) throw new Error('something was restored from a rejected draft');
  });
} finally {
  await browser.close();
}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
