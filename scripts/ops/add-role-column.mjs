import postgres from 'postgres';

/**
 * Adds `user.role`, which the schema has and the database does not.
 *
 * Adding a column to a table better-auth reads is not a dormant migration. Its
 * session lookup selects every column drizzle knows about, so the moment the
 * schema gained `role` and the database did not, every request carrying a
 * session cookie failed — the widget reported that it could not reach its
 * analysis service, which is true and says nothing about the cause.
 *
 * Additive and idempotent: a column with a default, nothing dropped, nothing
 * rewritten. Existing rows become 'user', which is what they already were.
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

const [before] = await sql`
  select count(*)::int as n from information_schema.columns
  where table_name = 'user' and column_name = 'role'
`;
console.log('role column present before:', before.n === 1);

await sql`alter table "user" add column if not exists "role" text not null default 'user'`;

const [after] = await sql`
  select count(*)::int as n from information_schema.columns
  where table_name = 'user' and column_name = 'role'
`;
console.log('role column present after :', after.n === 1);

const rows = await sql`select role, count(*)::int as n from "user" group by role`;
console.log('roles:', rows.map((r) => `${r.role}=${r.n}`).join(', '));

await sql.end();
