import postgres from 'postgres';

/**
 * Creates `voyager_file`, the table behind personal context documents.
 *
 * Hand-written rather than generated, for the reason `add-role-column.mjs`
 * exists: the drizzle journal is behind the database. Asking drizzle-kit for a
 * migration produced one that recreated `event`, `organizer`, `chart_layout`
 * and eleven other tables that are already there, and re-added `user.role`.
 * Running that against production would fail at the first CREATE TABLE, and the
 * ones after it would not run.
 *
 * So: additive and idempotent. One new table, nothing dropped, nothing
 * rewritten, safe to run twice.
 *
 *   DATABASE_URL=... node scripts/ops/add-voyager-files.mjs
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

const present = async () => {
  const [row] = await sql`
    select count(*)::int as n from information_schema.tables
    where table_name = 'voyager_file'
  `;
  return row.n === 1;
};

console.log('voyager_file present before:', await present());

await sql`
  create table if not exists "voyager_file" (
    "id" text primary key not null,
    "user_id" text not null references "user"("id") on delete cascade,
    "name" text not null,
    "kind" text not null,
    "bytes" integer not null,
    "body_enc" text not null,
    "mode" text not null,
    "created_at" timestamp not null default now()
  )
`;

await sql`
  create index if not exists "voyager_file_user_idx"
  on "voyager_file" ("user_id", "created_at")
`;

// Uploading the same name twice replaces rather than duplicates.
await sql`
  create unique index if not exists "voyager_file_user_name_idx"
  on "voyager_file" ("user_id", "name")
`;

console.log('voyager_file present after :', await present());

await sql.end();
