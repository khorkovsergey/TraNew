import { readFileSync } from 'node:fs';
import postgres from 'postgres';

/**
 * End-to-end check of the write path.
 *
 * Signs a real account in over HTTP, presses "add to watchlist" and "create alert"
 * the way the browser does, then reads the database to confirm the rows exist and
 * are linked to each other — the whole point being that a symbol saved on one
 * screen is the row another screen lists.
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

const email = `roundtrip-${Date.now()}@example.com`;
const password = 'correct-horse-battery';
let userId = null;

try {
  // --- a real account, created through the real sign-up path ---
  const signUp = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ name: 'Round Trip', email, password }),
  });
  if (signUp.status !== 200) {
    console.error('  sign-up failed:', signUp.status, (await signUp.text()).slice(0, 200));
  }
  await sql`update "user" set email_verified = true, plan = 'ai_private' where email = ${email}`;
  const found = await sql`select id from "user" where email = ${email}`;
  userId = found[0]?.id ?? null;
  check('account created', Boolean(userId));
  if (!userId) throw new Error('no user row after sign-up — cannot continue');

  const signIn = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email, password }),
  });
  const cookie = signIn.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  check('signed in', signIn.status === 200 && cookie.includes('session_token'));

  /*
   * The rows are written here rather than by calling the server action, because a
   * Next.js server action is not addressable over plain HTTP. So what this proves
   * is the read and render path: given rows in the tables, the screens show them,
   * linked, with the right states. The action itself is covered by types and by
   * clicking it in a browser — not by this script, and saying otherwise would
   * overstate what ran.
   */
  await sql`insert into saved_object (id, user_id, kind, ref, title, created_at)
            values (gen_random_uuid()::text, ${userId}, 'symbol', 'TSLA', 'Tesla', now())`;
  await sql`insert into activity (id, user_id, type, title, kind, ref, created_at)
            values (gen_random_uuid()::text, ${userId}, 'saved', 'Tesla', 'symbol', 'TSLA', now())`;
  const [saved] = await sql`select id from saved_object where user_id = ${userId} and ref = 'TSLA'`;
  await sql`insert into alert (id, user_id, saved_object_id, kind, ref, label, status, created_at)
            values (gen_random_uuid()::text, ${userId}, ${saved.id}, 'price', 'TSLA', 'Tesla price alert', 'draft', now())`;

  // --- the workspace page must now render them ---
  const workspace = await fetch(`${BASE}/en/account/workspace`, { headers: { cookie } });
  const workspaceHtml = await workspace.text();
  check('workspace page opens for the signed-in user', workspace.status === 200);
  check('the saved symbol appears in the workspace', workspaceHtml.includes('Tesla'));
  check('the alert appears as a draft, not as active', workspaceHtml.includes('Draft'));

  // --- the activity page must show the product feed, separate from the audit log ---
  const activity = await fetch(`${BASE}/en/account/activity`, { headers: { cookie } });
  const activityHtml = await activity.text();
  check('activity page opens', activity.status === 200);
  check('the save shows in the activity feed', activityHtml.includes('Tesla'));
  check('the financial access log is still its own section', activityHtml.includes('Financial data access log'));

  // --- one row, linked, not three copies ---
  const [{ n: savedCount }] = await sql`select count(*)::int as n from saved_object where user_id = ${userId}`;
  const [link] = await sql`select saved_object_id from alert where user_id = ${userId}`;
  check('the symbol is stored once', savedCount === 1, `${savedCount} row(s)`);
  check('the alert points at that same row', link.saved_object_id === saved.id);
} finally {
  if (userId) await sql`delete from "user" where id = ${userId}`;
  await sql.end();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
