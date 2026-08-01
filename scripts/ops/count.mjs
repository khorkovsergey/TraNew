import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) { console.log('no DATABASE_URL'); process.exit(1); }
const sql = postgres(url, { ssl: /\.rlwy\.net/.test(url) ? 'require' : undefined, max: 1 });

const tables = [
  'academy_progress', 'voyager_memory', 'activity', 'voyager_usage', 'preference',
  '"user"', 'wealth_asset', 'saved_object', 'event_registration', 'consent',
];

for (const t of tables) {
  try {
    const [row] = await sql.unsafe(`select count(*)::int as n from ${t}`);
    console.log(t.padEnd(22), row.n);
  } catch (error) {
    console.log(t.padEnd(22), 'missing —', String(error.message).split('\n')[0]);
  }
}

try {
  const rows = await sql`select key, count(*)::int as n from preference group by key order by n desc`;
  console.log('\npreference keys:', rows.map(r => `${r.key}=${r.n}`).join(', ') || '(none)');
} catch { /* table may not exist */ }

await sql.end();
