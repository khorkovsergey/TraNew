import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Database handle.
 *
 * The connection is opened lazily on first query, not at import time: a build step
 * that merely imports a module holding a query must not fail for want of a
 * DATABASE_URL. Next.js reloads modules in development, so the client is cached on
 * globalThis to avoid a new pool per hot reload.
 */
type Sql = ReturnType<typeof postgres>;
type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { tnSql?: Sql; tnDb?: Db };

function connect(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set — the database is required for authentication.');
  }

  /*
   * TLS applies to the public proxy only. Inside Railway the app reaches Postgres
   * over the private network on *.railway.internal, which does not speak TLS —
   * demanding it there fails the connection outright.
   */
  const isPublicProxy = /\.proxy\.rlwy\.net|\.rlwy\.net/.test(url);

  return postgres(url, {
    max: 10,
    idle_timeout: 20,
    ssl: isPublicProxy ? 'require' : undefined,
  });
}

function client(): Db {
  if (!globalForDb.tnDb) {
    globalForDb.tnSql = globalForDb.tnSql ?? connect();
    globalForDb.tnDb = drizzle(globalForDb.tnSql, { schema });
  }
  return globalForDb.tnDb;
}

/** Proxied so `db.select(...)` connects on first use rather than on import. */
export const db = new Proxy({} as Db, {
  get(_target, property) {
    const value = client()[property as keyof Db];
    return typeof value === 'function' ? value.bind(client()) : value;
  },
});

/**
 * Whether a database is reachable at all.
 *
 * The public parts of Events — the catalogue, an event page, an organizer profile
 * — must render for an anonymous visitor with no database behind them, since
 * there is no events backend yet and the catalogue is seeded. Anything personal
 * still requires one, and says so rather than pretending the answer is "none".
 */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export { schema };
