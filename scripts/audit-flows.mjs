import { chromium } from 'playwright';

/**
 * The journeys, driven end to end.
 *
 * A link crawl finds broken doors. This walks through them: does the search take
 * you anywhere, does signing in return you to what you were doing, does saving
 * work when signed out, does an event page offer a way back. Reports rather than
 * asserts — every line is a lead to check by hand.
 */

const BASE = process.env.BASE_URL ?? 'https://tradingnew.space';
const out = [];

function note(severity, journey, what, detail = '') {
  out.push({ severity, journey, what, detail });
  console.log(`  ${severity.padEnd(6)} [${journey}] ${what}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

console.log('\nSearching from the home page');
await page.goto(`${BASE}/en`, { waitUntil: 'networkidle' });

const search = page.getByPlaceholder(/Search any asset/i);
await search.fill('Tesla');
await page.waitForTimeout(700);

const suggestions = await page
  .locator('[role="option"], [role="listbox"] a, [role="listbox"] button')
  .count();
if (suggestions === 0) {
  note('MEDIUM', 'search', 'typing offers no suggestions', 'nothing appears under the field');
} else {
  note('INFO', 'search', `${suggestions} suggestions appear`);
}

await search.press('Enter');
await page.waitForTimeout(1600);
note('INFO', 'search', 'Enter lands on', page.url().replace(BASE, ''));

await page.goto(`${BASE}/en`, { waitUntil: 'networkidle' });
await page.getByPlaceholder(/Search any asset/i).fill('qqqzzz-nothing');
await page.waitForTimeout(800);
if (!/no (results|matches)/i.test(await page.locator('body').innerText())) {
  note('LOW', 'search', 'a query with no matches says nothing');
}

console.log('\nSigning in from a private page');
for (const path of ['/en/account/wealth', '/en/events/my', '/en/events/create', '/en/account/workspace']) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  const url = new URL(page.url());

  if (!url.pathname.includes('/sign-in')) {
    note('HIGH', 'auth', `${path} did not ask for sign-in`, `landed on ${url.pathname}`);
  } else if (!url.searchParams.get('next')) {
    note('MEDIUM', 'auth', `${path} forgets where you were going`, 'no next parameter');
  } else {
    note('INFO', 'auth', `${path} → sign-in, returning to ${url.searchParams.get('next')}`);
  }
}

console.log('\nSaving while signed out');
await page.goto(`${BASE}/en/events`, { waitUntil: 'networkidle' });
const saveButton = page.getByRole('button', { name: /^Save / }).first();
if ((await saveButton.count()) === 0) {
  note('MEDIUM', 'events', 'no save control on a card');
} else {
  await saveButton.click();
  await page.waitForTimeout(1000);
  if ((await page.locator('[role="dialog"]').count()) === 0) {
    note('HIGH', 'events', 'Save does nothing for a signed-out visitor');
  } else {
    note('INFO', 'events', 'Save opens the sign-in dialogue');
  }
  await page.keyboard.press('Escape');
}

console.log('\nStarting Academy');
await page.goto(`${BASE}/en/academy`, { waitUntil: 'networkidle' });
const start = page.getByRole('link', { name: /start|begin|continue/i }).first();
if ((await start.count()) === 0) {
  note('MEDIUM', 'academy', 'no obvious way to start');
} else {
  await start.click();
  await page.waitForTimeout(1400);
  note('INFO', 'academy', 'the first step lands on', page.url().replace(BASE, ''));
}

console.log('\nFinding an expert');
await page.goto(`${BASE}/en/marketplace/experts`, { waitUntil: 'networkidle' });
const expert = page.locator('main a[href*="/marketplace/experts/"]').first();
if ((await expert.count()) === 0) {
  note('HIGH', 'experts', 'no expert is listed');
} else {
  await expert.click();
  await page.waitForTimeout(1400);
  if ((await page.getByRole('link', { name: /book/i }).count()) === 0) {
    note('MEDIUM', 'experts', 'an expert page offers no way to book', page.url().replace(BASE, ''));
  } else {
    note('INFO', 'experts', 'an expert page offers booking');
  }
}

console.log('\nRegistering for an event');
await page.goto(`${BASE}/en/events`, { waitUntil: 'networkidle' });
await page.locator('main article a').first().click();
await page.waitForTimeout(1400);

const register = page.getByRole('button', { name: /^Register$/ });
if ((await register.count()) === 0) {
  note('MEDIUM', 'events', 'the first event offers no Register', page.url().replace(BASE, ''));
} else {
  await register.click();
  await page.waitForTimeout(1200);
  if ((await page.locator('[role="dialog"]').count()) === 0) {
    note('HIGH', 'events', 'Register does nothing when signed out');
  } else {
    note('INFO', 'events', 'Register opens the sign-in dialogue');
  }
  await page.keyboard.press('Escape');
}

console.log('\nGetting back');
for (const path of ['/en/events/understanding-market-cycles', '/en/symbols/TSLA', '/en/economy']) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  const first = (await page.locator('main a').first().innerText().catch(() => '')).replace(/\n/g, ' ');
  note('INFO', 'navigation', `${path} — first link is "${first.trim()}"`);
}

console.log('\nKeyboard');
await page.goto(`${BASE}/en/events`, { waitUntil: 'networkidle' });
const focusVisible = await page.evaluate(() => {
  const control = document.querySelector('main button, main a');
  if (!control) return true;
  control.focus();
  const style = getComputedStyle(control);
  return style.outlineStyle !== 'none' && style.outlineWidth !== '0px';
});
if (!focusVisible) note('MEDIUM', 'accessibility', 'focus is not visible on the first control');

console.log(`\n${out.length} observations`);
await browser.close();
