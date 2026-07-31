import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { chromium } from 'playwright';

/**
 * Checks the wealth record end to end, through the browser.
 *
 * The asset is added by filling the real form and pressing the real button, so
 * the server action runs for real. It is then read back two ways: from the
 * re-rendered page, and raw from the table. The raw read is the point — it proves
 * the value is stored as ciphertext rather than as the number someone typed.
 */

const BASE = process.env.SHOT_BASE ?? 'http://localhost:3210';
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map((line) => {
    const i = line.indexOf('=');
    return [line.slice(0, i), line.slice(i + 1)];
  })
);

const sql = postgres(env.DATABASE_URL, { ssl: 'require' });
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const email = `wealth-${Date.now()}@example.com`;
const password = 'correct-horse-battery';
const secretName = 'Apartment in Limassol';
const secretValue = '415000';
let userId = null;
let browser = null;

try {
  await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ name: 'Wealth Probe', email, password }),
  });
  await sql`update "user" set email_verified = true, plan = 'ai_private' where email = ${email}`;
  const found = await sql`select id from "user" where email = ${email}`;
  userId = found[0]?.id ?? null;
  if (!userId) throw new Error('sign-up did not create a user');

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(`${BASE}/en/sign-in`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/account**', { timeout: 30000 });
  check('signed in through the form', true);

  // --- an empty record must look empty, not like someone else's sample ---
  await page.goto(`${BASE}/en/account/wealth`, { waitUntil: 'networkidle' });
  await page.click('text=Assets');
  const emptyHtml = await page.content();
  check('a new record shows an empty state', emptyHtml.includes('Your record is empty'));
  check('no demo assets are shown', !emptyHtml.includes('Bank of Cyprus'));

  // --- add an asset through the real form ---
  // The add flow is three stages: what → how → the form.
  await page.click('button:has-text("Add to My Wealth")');
  await page.click('button:has-text("Property, securities, cash")');
  await page.click('button:has-text("Add manually")');
  await page.fill('input[placeholder="Name — something you will recognise"]', secretName);
  await page.fill('input[placeholder="Estimated value"]', secretValue);
  await page.click('text=Save to my Wealth Record');
  await page.waitForTimeout(2500);

  // --- raw read: ciphertext, not the typed value ---
  const [row] = await sql`select name_enc, value_enc, category, currency, data_status
                          from wealth_asset where user_id = ${userId}`;
  check('the asset reached the database', Boolean(row));
  if (row) {
    check('the name is stored as ciphertext', !row.name_enc.includes(secretName));
    check('the value is stored as ciphertext', !row.value_enc.includes(secretValue));
    check('the shape stays queryable', row.category === 'property' && row.currency === 'EUR');
    check('a typed figure is marked manual', row.data_status === 'manual');
  }

  // --- it survives a full reload ---
  await page.goto(`${BASE}/en/account/wealth`, { waitUntil: 'networkidle' });
  await page.click('text=Assets');
  const afterHtml = await page.content();
  check('the asset survives a reload', afterHtml.includes(secretName));
  check('the total is shown per currency', afterHtml.includes('Total (EUR)'));

  // --- the read is logged ---
  const [{ n }] = await sql`select count(*)::int as n from data_access_log
                            where user_id = ${userId} and resource = 'wealth_overview'`;
  check('opening the hub is logged as a read of financial data', n > 0, `${n} entries`);

  const [{ m }] = await sql`select count(*)::int as m from data_access_log
                            where user_id = ${userId} and resource = 'wealth_asset' and action = 'create'`;
  check('adding an asset is logged as a create', m > 0, `${m} entries`);
} finally {
  if (browser) await browser.close();
  if (userId) await sql`delete from "user" where id = ${userId}`;
  await sql.end();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
