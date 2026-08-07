import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

/**
 * Runs the migration folder against the database.
 *
 * There was no runner. Schema changes were made by hand and by `push`, nothing
 * recorded them, and the journal fell three migrations behind — which is how
 * `drizzle-kit generate` came to emit a migration that recreated fourteen
 * existing tables.
 *
 * `0004_baseline` is the repair: every statement in it is conditional, so this
 * is a no-op against a database that already has the schema and a full build
 * against an empty one. Either way drizzle records all four migrations as
 * applied, and the next `generate` diffs against reality.
 *
 *   DATABASE_URL=... node scripts/ops/apply-migrations.mjs
 */

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const sql = postgres(url, {
  ssl: /\.rlwy\.net|\.proxy\.rlwy\.net/.test(url) ? 'require' : undefined,
  max: 1,
});

const applied = async () => {
  const [row] = await sql`
    select count(*)::int as n from information_schema.tables
    where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
  `;
  if (row.n === 0) return 0;
  const [count] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
  return count.n;
};

console.log('migrations recorded before:', await applied());

await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });

console.log('migrations recorded after :', await applied());

await sql.end();
