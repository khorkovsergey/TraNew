import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Migrations run from a workstation, so they use the public proxy URL.
    url: process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL ?? '',
  },
} satisfies Config;
