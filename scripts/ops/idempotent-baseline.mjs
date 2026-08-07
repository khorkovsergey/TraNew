import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Rewrites a generated migration so it can be run against a database that
 * already has most of it.
 *
 * The drizzle journal was three migrations behind the database: tables had been
 * created by hand and by `push`, and nothing recorded them. So `generate`
 * produced a migration that recreates fourteen existing tables — which would
 * fail on its first statement and leave the rest unrun.
 *
 * This makes that migration a *baseline*: every statement becomes conditional,
 * so running it against production changes nothing and running it against an
 * empty database builds everything. After it, the snapshot matches reality and
 * the next `generate` produces a real diff.
 *
 *   node scripts/ops/idempotent-baseline.mjs drizzle/0004_baseline.sql
 */

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/ops/idempotent-baseline.mjs <migration.sql>');
  process.exit(1);
}

let sql = readFileSync(file, 'utf8');
const counts = { table: 0, index: 0, constraint: 0, column: 0 };

// CREATE TABLE "x" ( → CREATE TABLE IF NOT EXISTS "x" (
sql = sql.replace(/CREATE TABLE (?!IF NOT EXISTS)"/g, () => {
  counts.table += 1;
  return 'CREATE TABLE IF NOT EXISTS "';
});

// Same for indexes, both flavours.
sql = sql.replace(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)"/g, (_, unique) => {
  counts.index += 1;
  return `CREATE ${unique ?? ''}INDEX IF NOT EXISTS "`;
});

/*
 * Columns need a default as well as a guard.
 *
 * `ADD COLUMN "role" text NOT NULL` on a table with rows in it fails outright:
 * Postgres has no value to put in the existing ones. The generated statement
 * omits the default because drizzle assumes an empty table.
 */
sql = sql.replace(
  /ALTER TABLE ("[^"]+") ADD COLUMN ("[^"]+") ([^;]+);/g,
  (whole, table, column, rest) => {
    counts.column += 1;
    /*
     * The placeholder is a placeholder. This script cannot know what an
     * existing row should hold, so anything it fills in has to be read before
     * the migration ships — on a database that already has the column it is
     * never used, and on an empty one it is what every row starts as.
     */
    const needsDefault = /NOT NULL/.test(rest) && !/DEFAULT/i.test(rest);
    if (needsDefault) console.warn(`  review the default for ${table}.${column}`);
    const body = needsDefault ? `${rest} DEFAULT ''` : rest;
    return `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${body};`;
  }
);

/*
 * Constraints have no IF NOT EXISTS in Postgres, so each one is wrapped in a
 * block that swallows only the "already there" error and nothing else. A
 * blanket EXCEPTION WHEN others would hide a genuinely broken foreign key.
 */
sql = sql.replace(/ALTER TABLE ([^;]+ ADD CONSTRAINT [^;]+);/g, (_, statement) => {
  counts.constraint += 1;
  return `DO $$ BEGIN
  ALTER TABLE ${statement};
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;`;
});

writeFileSync(file, sql);
console.log(
  `guarded: ${counts.table} tables, ${counts.index} indexes, ` +
    `${counts.constraint} constraints, ${counts.column} columns`
);
