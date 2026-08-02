import { readFileSync } from 'node:fs';
import postgres from 'postgres';

/**
 * Compares the columns the code expects with the columns the database has.
 *
 * Written after `user.role` existed in the schema and not in the database for
 * several hours. That is not a dormant migration: better-auth's session lookup
 * selects every column drizzle knows about, so the moment the two disagreed,
 * every request carrying a session cookie failed — and the only symptom anyone
 * saw was the assistant saying it could not reach its analysis service.
 *
 * Reports rather than fixes. Deciding to add a column is a decision; noticing
 * that one is missing should not be.
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

// The schema is TypeScript and this is plain Node, so the expectation is read
// from the file rather than imported: every pgTable and the columns inside it.
const source = readFileSync('src/db/schema.ts', 'utf8');

const expected = new Map();
const tableBlocks = source.split(/export const \w+ = pgTable\(/).slice(1);

for (const block of tableBlocks) {
  const name = block.match(/^\s*'([^']+)'/)?.[1];
  if (!name) continue;
  const columns = [...block.matchAll(/\b(?:text|integer|boolean|timestamp|jsonb)\('([^']+)'\)/g)].map(
    (match) => match[1]
  );
  expected.set(name, [...new Set(columns)]);
}

const rows = await sql`
  select table_name, column_name from information_schema.columns
  where table_schema = 'public'
`;

const actual = new Map();
for (const row of rows) {
  if (!actual.has(row.table_name)) actual.set(row.table_name, new Set());
  actual.get(row.table_name).add(row.column_name);
}

let problems = 0;

for (const [table, columns] of expected) {
  if (!actual.has(table)) {
    console.log(`  MISSING TABLE   ${table}`);
    problems += 1;
    continue;
  }
  const missing = columns.filter((column) => !actual.get(table).has(column));
  if (missing.length) {
    console.log(`  MISSING COLUMNS ${table}: ${missing.join(', ')}`);
    problems += 1;
  }
}

console.log(
  problems === 0
    ? `\n${expected.size} tables checked, the database matches the schema`
    : `\n${problems} of ${expected.size} tables disagree with the schema`
);

await sql.end();
process.exit(problems === 0 ? 0 : 1);
