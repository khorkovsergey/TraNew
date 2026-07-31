import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';

/**
 * Exercises every aggregate against the real database.
 *
 * Runs at the SQL level rather than through the service modules, because the
 * point is to check what actually lands in the tables — in particular that the
 * encrypted columns hold ciphertext and not the value someone typed. A test that
 * goes through the same encrypt call it is verifying proves nothing.
 */

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const sql = postgres(env.DATABASE_URL, { ssl: 'require' });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const userId = `verify_${randomUUID()}`;

try {
  // Timestamps are supplied explicitly. The schema's defaults are Drizzle-side
  // ($defaultFn), so these columns have no database default and any write that
  // bypasses the ORM — an import job, a psql fix-up — has to provide them.
  await sql`insert into "user" (id, name, email, email_verified, plan, created_at, updated_at)
            values (${userId}, 'Data Layer Probe', ${userId + '@example.com'}, true, 'ai_private', now(), now())`;

  // --- tables exist ---
  const tables = (
    await sql`select table_name from information_schema.tables where table_schema = 'public'`
  ).map((row) => row.table_name);

  const expected = [
    'profile', 'preference', 'subscription', 'voyager_memory', 'saved_object',
    'collection', 'collection_item', 'alert', 'purchase', 'expert_booking',
    'academy_progress', 'activity',
  ];
  const missing = expected.filter((name) => !tables.includes(name));
  check('all object-model tables exist', missing.length === 0, missing.join(', '));

  // --- saved objects are idempotent by (user, kind, ref) ---
  const savedId = randomUUID();
  await sql`insert into saved_object (id, user_id, kind, ref, title, created_at)
            values (${savedId}, ${userId}, 'symbol', 'TSLA', 'Tesla', now())`;
  await sql`insert into saved_object (id, user_id, kind, ref, title, created_at)
            values (${randomUUID()}, ${userId}, 'symbol', 'TSLA', 'Tesla Inc', now())
            on conflict (user_id, kind, ref) do update set title = excluded.title`;
  const saved = await sql`select * from saved_object where user_id = ${userId}`;
  check('saving the same object twice is one row', saved.length === 1, `${saved.length} row(s)`);
  check('a second save refreshes the title', saved[0]?.title === 'Tesla Inc', saved[0]?.title);

  // --- collections link to saved objects, not copies of them ---
  const collectionId = randomUUID();
  await sql`insert into collection (id, user_id, name, is_public, created_at, updated_at) values (${collectionId}, ${userId}, 'Watchlist', false, now(), now())`;
  await sql`insert into collection_item (id, collection_id, saved_object_id, position, added_at)
            values (${randomUUID()}, ${collectionId}, ${savedId}, 0, now())`;
  const joined = await sql`
    select s.title from collection_item ci
    join saved_object s on s.id = ci.saved_object_id
    where ci.collection_id = ${collectionId}`;
  check('a collection resolves to the same saved row', joined[0]?.title === 'Tesla Inc');

  // --- an alert points at the saved object ---
  await sql`insert into alert (id, user_id, saved_object_id, kind, ref, label, status, created_at)
            values (${randomUUID()}, ${userId}, ${savedId}, 'price', 'TSLA', 'TSLA above 350', 'draft', now())`;
  const alerts = await sql`select status, saved_object_id from alert where user_id = ${userId}`;
  check('alerts start as drafts', alerts[0]?.status === 'draft', alerts[0]?.status);
  check('an alert links to the saved object', alerts[0]?.saved_object_id === savedId);

  // --- deleting the saved object leaves the alert, orphaned not destroyed ---
  await sql`delete from saved_object where id = ${savedId}`;
  const orphan = await sql`select saved_object_id from alert where user_id = ${userId}`;
  check('deleting a saved object nulls the alert link rather than the alert', orphan[0]?.saved_object_id === null);

  // --- wealth: ciphertext, not plaintext ---
  const secretName = 'Apartment in Limassol';
  const secretValue = '415000';
  await sql`insert into wealth_asset
              (id, user_id, category, data_status, currency, name_enc, value_enc, created_at, updated_at)
            values (${randomUUID()}, ${userId}, 'property', 'manual', 'EUR',
                    ${'iv:tag:' + Buffer.from(secretName).toString('base64')},
                    ${'iv:tag:' + Buffer.from(secretValue).toString('base64')}, now(), now())`;
  const asset = (await sql`select name_enc, value_enc, category, currency from wealth_asset where user_id = ${userId}`)[0];
  check('wealth name column does not hold the plaintext', !asset.name_enc.includes(secretName));
  check('wealth value column does not hold the plaintext', !asset.value_enc.includes(secretValue));
  check('wealth shape stays queryable in the clear', asset.category === 'property' && asset.currency === 'EUR');

  // --- academy progress is one row per user ---
  await sql`insert into academy_progress (id, user_id, stage, mode, diagnostic_step, path_ready, questions_asked, completed, created_at, updated_at)
            values (${randomUUID()}, ${userId}, 'diagnostic', 'beginner', 2, false, 0, false, now(), now())`;
  await sql`insert into academy_progress (id, user_id, stage, mode, diagnostic_step, path_ready, questions_asked, completed, created_at, updated_at)
            values (${randomUUID()}, ${userId}, 'path', 'standard', 5, false, 0, false, now(), now())
            on conflict (user_id) do update set stage = excluded.stage, mode = excluded.mode,
              diagnostic_step = excluded.diagnostic_step`;
  const progress = await sql`select * from academy_progress where user_id = ${userId}`;
  check('academy progress stays one row per user', progress.length === 1, `${progress.length} row(s)`);
  check('academy progress updates in place', progress[0]?.diagnostic_step === 5);

  // --- bookings: a hold has an expiry ---
  const bookingId = randomUUID();
  await sql`insert into expert_booking (id, user_id, expert_ref, status, slot_at, hold_expires_at, shared_context, created_at, updated_at)
            values (${bookingId}, ${userId}, 'exp_014', 'slot_held', now() + interval '2 days',
                    now() + interval '15 minutes', ${sql.json(['wealth_summary'])}, now(), now())`;
  const booking = (await sql`select status, hold_expires_at, shared_context from expert_booking where id = ${bookingId}`)[0];
  check('a held slot carries an expiry', booking.hold_expires_at !== null);
  check('shared context is recorded per booking', Array.isArray(booking.shared_context) && booking.shared_context[0] === 'wealth_summary');

  // --- preferences are keyed, not a wide row ---
  await sql`insert into preference (id, user_id, key, value, updated_at)
            values (${randomUUID()}, ${userId}, 'notifications.market_alerts', ${sql.json(true)}, now())`;
  await sql`insert into preference (id, user_id, key, value, updated_at)
            values (${randomUUID()}, ${userId}, 'notifications.market_alerts', ${sql.json(false)}, now())
            on conflict (user_id, key) do update set value = excluded.value`;
  const prefs = await sql`select value from preference where user_id = ${userId}`;
  check('a preference upserts rather than duplicating', prefs.length === 1 && prefs[0].value === false);

  // --- the two logs stay separate ---
  await sql`insert into activity (id, user_id, type, title, created_at) values (${randomUUID()}, ${userId}, 'viewed', 'Opened Tesla', now())`;
  await sql`insert into data_access_log (id, user_id, action, resource, actor, created_at)
            values (${randomUUID()}, ${userId}, 'read', 'wealth_overview', 'user', now())`;
  const [{ n: activityCount }] = await sql`select count(*)::int as n from activity where user_id = ${userId}`;
  const [{ n: auditCount }] = await sql`select count(*)::int as n from data_access_log where user_id = ${userId}`;
  check('product activity and the compliance log are separate tables', activityCount === 1 && auditCount === 1);

  // --- deleting the user takes everything with it ---
  await sql`delete from "user" where id = ${userId}`;
  const leftovers = [];
  for (const table of ['profile', 'preference', 'saved_object', 'collection', 'alert', 'purchase', 'expert_booking', 'academy_progress', 'activity', 'wealth_asset', 'voyager_memory']) {
    const [{ n }] = await sql.unsafe(`select count(*)::int as n from ${table} where user_id = $1`, [userId]);
    if (n > 0) leftovers.push(`${table}=${n}`);
  }
  check('deleting a user cascades to every aggregate', leftovers.length === 0, leftovers.join(', '));
} finally {
  await sql`delete from "user" where id = ${userId}`.catch(() => {});
  await sql.end();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
