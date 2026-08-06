import { chromium } from 'playwright';

/**
 * Signing out, and the two ways it can go.
 *
 * The bug this guards: `authClient.signOut()` resolves with `{ error }` rather
 * than throwing, and the old code navigated home whatever came back. A refused
 * request therefore produced the entire appearance of having signed out — menu
 * closed, home page, session still live. On a shared machine that is not a
 * cosmetic failure, so both branches are checked here rather than only the happy
 * one.
 *
 * Run it twice, against two ports:
 *
 *   node scripts/verify-signout.mjs http://localhost:3210          # trusted origin
 *   node scripts/verify-signout.mjs http://localhost:3111 --refused # untrusted
 *
 * The second form asserts the *failure* is visible, which is the half that was
 * silently wrong.
 */

const base = process.argv[2] ?? 'http://localhost:3210';
const expectRefusal = process.argv.includes('--refused');

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

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

let signOutStatus = null;
page.on('response', (response) => {
  if (response.url().includes('/api/auth/sign-out')) signOutStatus = response.status();
});

// The demo stub redirects to the configured public origin, which in a local run
// is not this server. Nothing about sign-out depends on following it.
await context.route('**://tradingnew.space/**', (route) => route.fulfill({ status: 204, body: '' }));

try {
  console.log(`\n${expectRefusal ? 'A refused sign-out' : 'A sign-out that works'} — ${base}`);

  // The stub is a server-side sign-in: it never passes through the origin check,
  // which is exactly why signing in kept working while signing out did not.
  await page.goto(`${base}/api/auth-stub/google`).catch(() => {});
  await page.goto(`${base}/en/account`, { waitUntil: 'networkidle' });

  const avatar = page.locator('header button[aria-label="Account menu"]');
  check('the demo session signed in', (await avatar.count()) === 1);
  if ((await avatar.count()) !== 1) throw new Error('no session to sign out of');

  await avatar.click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.waitForTimeout(2500);

  const cookies = (await context.cookies()).map((cookie) => cookie.name);
  const stillIn = cookies.some((name) => name.includes('session_token'));

  if (expectRefusal) {
    check('the request was refused', signOutStatus === 403, `status ${signOutStatus}`);
    check('the session is still live', stillIn);
    check(
      'and the page did not pretend otherwise by navigating home',
      page.url().includes('/account'),
      page.url()
    );

    const alert = page.locator('[role="alert"]');
    check('a notice says so', (await alert.count()) > 0);
    check(
      'and it says the session is unchanged rather than something vague',
      /still signed in/i.test(await alert.first().innerText().catch(() => '')),
      await alert.first().innerText().catch(() => '(none)')
    );
  } else {
    check('the request was accepted', signOutStatus === 200, `status ${signOutStatus}`);
    check('the session cookie is gone', !stillIn, cookies.join(', '));
    check('the page went home', page.url().endsWith('/en'), page.url());

    await page.waitForTimeout(500);
    check(
      'and the header is back to its signed-out state',
      (await page.locator('header button[aria-label="Account menu"]').count()) === 0
    );
  }
} finally {
  await browser.close();
}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
