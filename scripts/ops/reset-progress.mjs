import postgres from 'postgres';

/**
 * Clears the server-side progress so the app looks unvisited.
 *
 * What it removes and what it deliberately does not is the whole content of
 * this script, so both are listed rather than left to be read out of the SQL.
 *
 * Removed — things that describe how far someone got:
 *   activity          the "you viewed / saved / asked" feed
 *   academy_progress  lessons done, diagnostic answers, terms seen
 *   voyager_memory    what the assistant remembers about a person
 *   voyager_usage     the per-day question counters
 *   preference        rows whose key is an onboarding marker, and only those
 *
 * Kept — things that belong to a person rather than to their progress:
 *   user, session, account   the ability to sign in at all
 *   wealth_*                 encrypted financial records
 *   saved_object, collection, alert, purchase, expert_booking
 *   consent                  a record of what someone agreed to, which is
 *                            evidence and must survive a demo reset
 *   event_*                  registrations and bookmarks
 *
 * Requires DATABASE_URL and, because it deletes from production, an explicit
 * CONFIRM_RESET=yes. A destructive script that runs on an env var somebody
 * already has is a script that runs by accident.
 */

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

if (process.env.CONFIRM_RESET !== 'yes') {
  console.error('Refusing to run without CONFIRM_RESET=yes.');
  process.exit(1);
}

const sql = postgres(url, {
  ssl: /\.rlwy\.net|\.proxy\.rlwy\.net/.test(url) ? 'require' : undefined,
  max: 1,
});

/** Preference keys that mean "has been here before", as opposed to a setting. */
const ONBOARDING_KEYS = ['voyager.intro_seen', 'academy.setup_done', 'events.onboarded'];

const wiped = [];

async function clear(table, where = '') {
  try {
    const [before] = await sql.unsafe(`select count(*)::int as n from ${table}`);
    if (before.n === 0) {
      wiped.push([table, 0, 'already empty']);
      return;
    }
    const result = await sql.unsafe(`delete from ${table} ${where}`);
    wiped.push([table, result.count ?? before.n, 'deleted']);
  } catch (error) {
    // A table that does not exist is not a failure here: the events schema has
    // not been migrated on this environment, and saying so is more useful than
    // stopping halfway through a reset.
    wiped.push([table, 0, String(error.message).split('\n')[0]]);
  }
}

await clear('activity');
await clear('academy_progress');
await clear('voyager_memory');
await clear('voyager_usage');
await clear(
  'preference',
  `where key in (${ONBOARDING_KEYS.map((key) => `'${key}'`).join(', ')})`
);

for (const [table, count, note] of wiped) {
  console.log(`  ${table.padEnd(20)} ${String(count).padStart(5)}  ${note}`);
}

// Printed so the operator can see that the reset stopped where it was meant to.
console.log('\nUntouched:');
for (const table of ['"user"', 'wealth_asset', 'saved_object', 'consent']) {
  try {
    const [row] = await sql.unsafe(`select count(*)::int as n from ${table}`);
    console.log(`  ${table.padEnd(20)} ${String(row.n).padStart(5)}  rows remain`);
  } catch {
    console.log(`  ${table.padEnd(20)}     -  table not present`);
  }
}

await sql.end();
