import { chromium } from 'playwright';

/**
 * Registration without loss.
 *
 * The plan screen promises "nothing is lost either way" beside the sign-up
 * button. Until the migration existed that was untrue — a guest built a plan,
 * registered, and came back to an empty account. A promise a product makes in
 * its own copy is the one thing that has to be kept, so it is checked rather
 * than assumed.
 *
 *   node scripts/verify-plan-migration.mjs [baseUrl]
 */

const base = process.argv[2] ?? 'http://localhost:3210';

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
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();

// The demo stub redirects to the configured public origin, which is not this
// server in a local run.
await context.route('**://tradingnew.space/**', (route) => route.fulfill({ status: 204, body: '' }));

const option = (title) => page.locator('button', { hasText: title }).first();
const nextButton = () => page.getByRole('button', { name: /^(Continue|See my plan)$/ });

try {
  group('A guest builds a plan');

  await page.goto(`${base}/en/start`, { waitUntil: 'networkidle' });
  for (const label of ['I already invest', 'Growth', 'More than five years', 'By doing']) {
    await option(label).click();
    await page.waitForTimeout(150);
    await nextButton().click();
    await page.waitForTimeout(250);
  }
  await page.waitForURL(/\/start\/plan/, { timeout: 8000 });
  await page.waitForTimeout(400);

  const guestPlan = await page.locator('#main ol').first().innerText();
  const guestSteps = await page.locator('#main ol > li').count();
  check('the plan is on screen', guestSteps >= 3, `${guestSteps} steps`);

  await page.locator('#main ol > li button', { hasText: 'Mark done' }).first().click();
  await page.waitForTimeout(300);
  check('and a step is marked done', /1 of \d+ done/.test(await page.locator('#main').innerText()));

  group('Pressing save asks for an account, and says what is kept');

  await page.getByRole('button', { name: /Save my plan/ }).first().click();
  await page.waitForTimeout(500);

  const prompt = await page.locator('body').innerText();
  check('the prompt appears', /sign in|create an account/i.test(prompt));

  await page.locator('a', { hasText: /Log in|Sign in/ }).first().click();
  await page.waitForURL(/\/sign-in/, { timeout: 8000 });
  await page.waitForTimeout(400);

  check(
    'the return path travels with it',
    new URL(page.url()).searchParams.get('next')?.includes('/start/plan') ?? false,
    page.url()
  );

  const signIn = await page.locator('#main').innerText();
  check('and the page promises what is preserved', /plan is waiting/i.test(signIn));
  check('naming the answers and the progress', /four answers/i.test(signIn) && /progress/i.test(signIn));

  group('Signing in moves the plan onto the account');

  // A genuine server-side sign-in into the fixed demo account.
  await page.goto(`${base}/api/auth-stub/google`).catch(() => {});
  await page.goto(`${base}/en/start/plan`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const afterAuth = await page.locator('#main').innerText();
  check('the plan is still there', /Your plan is/i.test(afterAuth));
  check('with the same steps', (await page.locator('#main ol > li').count()) === guestSteps);
  check('and the same progress', /1 of \d+ done/.test(afterAuth), afterAuth.match(/\d+ of \d+ done/)?.[0]);
  check('and it says so rather than leaving them guessing', /saved to your account/i.test(afterAuth));

  group('The account is the source of truth now');

  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const withoutBrowser = await page.locator('#main').innerText();
  check(
    'clearing the browser does not lose it',
    /Your plan is/i.test(withoutBrowser),
    withoutBrowser.slice(0, 60)
  );
  check('nor the progress', /1 of \d+ done/.test(withoutBrowser));
  /*
   * Compared on content rather than on line numbers: marking a step done
   * replaces its number with a tick, which renders no text and shifts every
   * index after it.
   */
  const firstTitle = guestPlan
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^\d+$/.test(line))[0];

  check(
    'and the plan matches the one the guest built',
    (await page.locator('#main ol > li').first().innerText()).includes(firstTitle),
    firstTitle
  );

  group('The authed home offers to resume it');

  await page.goto(`${base}/en/account`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const account = await page.locator('#main').innerText();

  check('the strip is there', /continue where you left off/i.test(account));
  check(
    'it names the actual next step and position',
    /step 2 of \d+/i.test(account),
    account.match(/step \d+ of \d+/i)?.[0]
  );

  await page.locator('a', { hasText: 'Continue where you left off' }).first().click();
  await page.waitForURL(/\/start\/plan/, { timeout: 8000 });
  check('and it resumes the plan', page.url().includes('/start/plan'));
} finally {
  await browser.close();
}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
