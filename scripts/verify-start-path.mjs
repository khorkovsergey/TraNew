import { chromium } from 'playwright';

/**
 * The Start-free path, end to end.
 *
 * It exists because the break it covers was invisible to every other check: the
 * pages all returned 200, the interview rendered, the plan appeared — and the
 * seven answers behind it were destroyed by a refresh, with no account ever
 * offered. Nothing that looks at a page in isolation can see that.
 *
 * The account half needs a real session, so it signs up, confirms through the
 * preview mailbox and reads the workspace. Set MAILBOX_KEY to include it;
 * without it the anonymous half still runs and the rest is reported as skipped
 * rather than passed.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const MAILBOX_KEY = process.env.MAILBOX_KEY ?? '';

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

/** Answers the interview from wherever it currently is to the end. */
async function completeInterview(page) {
  for (let i = 0; i < 8; i += 1) {
    /*
     * Stop the moment the plan is on screen.
     *
     * Without this the loop takes one more turn, and the first button on the
     * plan screen is "Keep this plan" — so the harness clicked straight through
     * to the sign-up page and then reported that the plan had not been produced.
     * The check was failing on its own last click.
     */
    if ((await page.locator('main').innerText()).includes('Your investment research plan')) break;

    const option = page
      .locator('main button')
      .filter({ hasNotText: /^Next$|^Back$|^Create my research plan$|^Restart/ })
      .first();
    if (await option.count()) {
      await option.click();
      await page.waitForTimeout(120);
    }

    const advance = page.getByRole('button', { name: /^Next$|^Create my research plan$/ });
    if (!(await advance.count())) break;
    await advance.first().click();
    await page.waitForTimeout(420);
  }
  await page.waitForTimeout(700);
}

const browser = await chromium.launch();

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1300 } });
  const page = await context.newPage();

  group('The interview keeps what you put into it');

  await page.goto(`${BASE}/en/strategy`, { waitUntil: 'networkidle' });
  for (let i = 0; i < 3; i += 1) {
    await page
      .locator('main button')
      .filter({ hasNotText: /^Next$|^Back$/ })
      .first()
      .click();
    await page.waitForTimeout(120);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(350);
  }

  check('three questions answered', (await page.locator('main').innerText()).includes('Step 4 of 7'));

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check('a reload does not throw them away', (await page.locator('main').innerText()).includes('Step 4 of 7'));

  await page.goto(`${BASE}/en`, { waitUntil: 'networkidle' });
  await page.goto(`${BASE}/en/strategy`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check('nor does leaving and coming back', (await page.locator('main').innerText()).includes('Step 4 of 7'));

  group('/start acknowledges what you started');

  await page.goto(`${BASE}/en/start`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const started = await page.locator('main').innerText();
  check('it offers to continue', started.includes('Continue where you left off'));
  check('and names what it is', started.includes('Your research plan interview'));

  const firstVisit = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const cleanPage = await firstVisit.newPage();
  await cleanPage.goto(`${BASE}/en/start`, { waitUntil: 'networkidle' });
  await cleanPage.waitForTimeout(500);
  check(
    'and stays quiet on a first visit',
    !(await cleanPage.locator('main').innerText()).includes('Continue where you left off')
  );

  group('The finished plan offers to keep itself');

  await page.goto(`${BASE}/en/strategy`, { waitUntil: 'networkidle' });
  await completeInterview(page);
  check('the plan is produced', (await page.locator('main').innerText()).includes('Your investment research plan'));

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  check('and it survives a reload too', (await page.locator('main').innerText()).includes('Your investment research plan'));
  check('it offers to keep it', (await page.getByRole('button', { name: 'Keep this plan' }).count()) === 1);
  check(
    'and says what is at stake',
    (await page.locator('main').innerText()).includes('lives in this browser only')
  );

  await page.getByRole('button', { name: 'Keep this plan' }).click();
  await page.waitForTimeout(3000);
  check('keeping it reaches registration', page.url().includes('/sign-up'), page.url().replace(BASE, ''));

  const stored = await page.evaluate(() => localStorage.getItem('tn_pending_strategy_v1'));
  check('and the request is recorded for the return trip', String(stored).includes('"claim":true'));

  group('The chart names what it saves');

  await cleanPage.goto(`${BASE}/en/supercharts`, { waitUntil: 'networkidle' });
  const saveLinks = await cleanPage.evaluate(() =>
    [...document.querySelectorAll('a')]
      .filter((a) => /alert|watchlist/i.test(a.textContent ?? ''))
      .map((a) => a.getAttribute('href'))
  );
  check(
    'alert and watchlist go where keeping happens',
    saveLinks.length > 0 && saveLinks.every((href) => href?.includes('/sign-up')),
    saveLinks.join(', ')
  );

  group('Registration finishes the job');

  if (!MAILBOX_KEY) {
    console.log('  skipped — set MAILBOX_KEY to run the account half');
  } else {
    const email = `path-${Date.now()}@example.com`;
    await page.locator('input').nth(0).fill('Path Prober');
    await page.locator('input[type=email]').first().fill(email);
    await page.locator('input[type=password]').first().fill('Str0ng-Passw0rd-2026');
    await page.getByRole('button', { name: /create|sign up/i }).first().click();
    await page.waitForTimeout(4200);

    const mailbox = await page.request.get(`${BASE}/dev/mailbox?key=${encodeURIComponent(MAILBOX_KEY)}`);
    const link = ((await mailbox.text()).match(/https?:\/\/[^"'<> ]*verify[^"'<> ]*/) ?? [])[0];
    check('a confirmation link arrived', Boolean(link));

    if (link) {
      await page.goto(link.replace(/&amp;/g, '&'), { waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
    }

    await page.goto(`${BASE}/en/strategy`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500);
    const returned = await page.locator('main').innerText();
    check('the plan is still there', returned.includes('Your investment research plan'));
    check('and it saved itself on the way back', returned.includes('Saved to your account'));

    await page.goto(`${BASE}/en/account/workspace`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    // The default tab is Collections; the saved item is under the next one.
    await page.locator('[role=tablist] button').nth(1).click();
    await page.waitForTimeout(900);
    const workspace = await page.locator('main').innerText();
    check('the workspace lists it', workspace.includes('My research plan'));
    check(
      'with a subtitle a person can read',
      !/\bu\d\b|preserve ·/.test(workspace.slice(workspace.indexOf('My research plan')))
    );
  }
} catch (error) {
  failed += 1;
  console.log(`\n  FAIL the run stopped early — ${String(error).split('\n')[0]}`);
} finally {
  console.log(`\n${passed}/${passed + failed} passed`);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
