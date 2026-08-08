import { chromium } from 'playwright';

/**
 * Academy, driven rather than read.
 *
 * The section's claims are arithmetic — a duration counted from a lesson list, a
 * percentage counted from lessons marked watched, a library counted from
 * enrolment rows — and arithmetic is the kind of thing that stays right until
 * somebody edits the content file. This walks the whole loop against a running
 * server: browse, hit the sign-in gate, enrol, mark lessons, and check that the
 * same numbers arrive on the course page, in My Learning and in the account.
 *
 * It creates a real account through the preview mailbox, so it needs the dev
 * server and a database.
 *
 *   node scripts/verify-academy.mjs [baseUrl] [mailboxKey]
 */

const base = process.argv[2] ?? process.env.BASE_URL ?? 'http://localhost:3111';
const mailboxKey = process.argv[3] ?? process.env.PREVIEW_MAILBOX_KEY ?? 'local-preview-key';

const SLUG = 'technical-analysis-masterclass';
const TITLE = 'Technical Analysis Masterclass';
const PASSWORD = 'correct horse battery staple';

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
const page = await browser.newPage({ viewport: { width: 1520, height: 1000 } });

const courseLinks = () => page.locator('a[href^="/en/marketplace/academy/"]').count();
const unwatched = () => page.getByRole('button', { name: 'Mark watched', exact: true }).count();
const watched = () => page.getByRole('button', { name: 'Watched', exact: true }).count();

try {
  group('The catalogue, without an account');

  await page.goto(`${base}/en/marketplace/academy`, { waitUntil: 'networkidle' });
  const all = await courseLinks();
  check('every course is listed', all >= 12, `found ${all} links, including the two featured`);

  await page.getByRole('button', { name: 'Crypto', exact: true }).first().click();
  await page.waitForTimeout(300);
  check('a category chip filters the grid', (await courseLinks()) < all);

  await page.getByPlaceholder('Search courses').fill('options');
  await page.waitForTimeout(400);
  check(
    'a filter combination with no matches says so',
    await page.getByText('No courses match your filters').isVisible()
  );

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.waitForTimeout(400);
  check('clearing brings everything back', (await courseLinks()) === all);

  group('The purchase gate');

  await page.goto(`${base}/en/marketplace/academy/${SLUG}`, { waitUntil: 'networkidle' });
  const curriculum = await page.locator('body').innerText();
  check(
    'the course page is public and shows its curriculum',
    curriculum.includes('Curriculum') && curriculum.includes('What you’ll learn')
  );

  await page.getByRole('button', { name: 'Buy now' }).click();
  await page.waitForTimeout(600);
  const gate = await page.getByRole('dialog').innerText();
  check('buying asks a guest to sign in', gate.includes('Sign in to complete your purchase'));
  check('and names the course it is keeping', gate.includes(TITLE));

  group('Enrolling');

  const email = `academy.verify.${Date.now()}@example.com`;
  await page.goto(`${base}/en/sign-up`, { waitUntil: 'networkidle' });
  await page.fill('#name', 'Academy Verify');
  await page.fill('#email', email);
  await page.fill('#new-password', PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForTimeout(2500);

  await page.goto(`${base}/dev/mailbox?key=${mailboxKey}`, { waitUntil: 'networkidle' });
  const link = await page
    .locator('a[href*="token"], a[href*="verify"]')
    .first()
    .getAttribute('href')
    .catch(() => null);
  check('the confirmation mail arrived', Boolean(link));
  if (!link) throw new Error('no verification link — is EMAIL_TRANSPORT=preview?');

  await page.goto(link.startsWith('http') ? link : `${base}${link}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  await page.goto(`${base}/en/marketplace/academy/${SLUG}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Buy now' }).click();
  await page.waitForTimeout(700);
  const checkout = await page.getByRole('dialog').innerText();
  check('the checkout says nothing is charged', checkout.includes('Demonstration checkout'));
  check('the discount and the total agree', checkout.includes('€299.00') && checkout.includes('€199.00'));

  await page.getByRole('button', { name: /Complete enrolment/ }).click();
  await page.waitForTimeout(3500);
  check('enrolment confirms', (await page.getByRole('dialog').innerText()).includes('You’re enrolled'));

  group('Progress is counted, not claimed');

  await page.goto(`${base}/en/marketplace/academy/${SLUG}`, { waitUntil: 'networkidle' });
  const before = await unwatched();
  check('an enrolled course offers its lessons', before > 0);

  for (let i = 0; i < 3; i += 1) {
    await page.getByRole('button', { name: 'Mark watched', exact: true }).first().click();
    await page.waitForTimeout(1800);
  }
  check('three lessons are marked', (await watched()) === 3);

  await page.reload({ waitUntil: 'networkidle' });
  check('and survive a reload', (await watched()) === 3, `${await watched()} after reload`);

  await page.goto(`${base}/en/marketplace/academy/my-learning`, { waitUntil: 'networkidle' });
  const library = await page.locator('body').innerText();
  check('My Learning lists the course', library.includes(TITLE));
  check('with a percentage under 100', /\b\d{1,2}% watched/.test(library), library.slice(0, 200));
  check('and names the next lesson', library.includes('Next:'));
  check('hours watched is not zero', !/Hours watched\s*\n\s*0\.0/.test(library));

  await page.goto(`${base}/en/marketplace/academy`, { waitUntil: 'networkidle' });
  check(
    'the catalogue marks what is owned',
    (await page.getByText('In your library').count()) === 1
  );

  group('A free course');

  await page.goto(`${base}/en/marketplace/academy/investing-foundations`, {
    waitUntil: 'networkidle',
  });
  check(
    'is priced as free, not as €0',
    (await page.locator('body').innerText()).includes('Free, and free permanently')
  );
  await page.getByRole('button', { name: 'Enrol for free' }).click();
  await page.waitForTimeout(3000);
  check(
    'enrols without a checkout',
    (await page.getByRole('dialog').innerText()).includes('You’re enrolled')
  );

  await page.goto(`${base}/en/account/purchases`, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: /Learning/ }).click();
  await page.waitForTimeout(400);
  const purchases = await page.locator('body').innerText();
  check('the account records the purchase', purchases.includes(TITLE));
  check('and says it was a demo', purchases.includes('Demo purchase'));
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
