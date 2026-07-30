import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Database schema.
 *
 * The first four tables are the shape better-auth expects. Everything after them
 * is ours: plans, the wealth record, the access log and consent records.
 *
 * Sensitive wealth values are never stored in the clear — see `lib/crypto.ts`.
 * Columns holding ciphertext are named with a `Enc` suffix so a plaintext write is
 * obvious in review.
 */

/* ------------------------------------------------------------ better-auth */

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified')
      .$defaultFn(() => false)
      .notNull(),
    image: text('image'),
    createdAt: timestamp('created_at')
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp('updated_at')
      .$defaultFn(() => new Date())
      .notNull(),

    twoFactorEnabled: boolean('two_factor_enabled'),

    /** Entitlement tier. Checked on the server for every gated capability. */
    plan: text('plan').$defaultFn(() => 'free').notNull(),
    planRenewsAt: timestamp('plan_renews_at'),

    /**
     * Per-user data key, itself encrypted with the master key. Wealth ciphertext is
     * encrypted with this key, so rotating a user's key never touches other rows.
     */
    dataKeyEnc: text('data_key_enc'),
  },
  (table) => [uniqueIndex('user_email_idx').on(table.email)]
);

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    /** Recorded so a person can recognise and revoke a device they do not know. */
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('session_token_idx').on(table.token),
    index('session_user_idx').on(table.userId),
  ]
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    /** argon2id digest for the credentials provider. Never a reversible value. */
    password: text('password'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [index('account_user_idx').on(table.userId)]
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
);

export const twoFactor = pgTable(
  'two_factor',
  {
    id: text('id').primaryKey(),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('two_factor_user_idx').on(table.userId)]
);

/* ----------------------------------------------------------- Wealth record */

export const wealthAsset = pgTable(
  'wealth_asset',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /** Non-identifying metadata stays in the clear so the app can group and filter. */
    category: text('category').notNull(),
    dataStatus: text('data_status').notNull(),
    currency: text('currency').notNull(),
    country: text('country'),

    /** Name and monetary values are encrypted with the user's data key. */
    nameEnc: text('name_enc').notNull(),
    valueEnc: text('value_enc').notNull(),
    detailsEnc: text('details_enc'),

    source: text('source'),
    valuedAt: timestamp('valued_at'),
    createdAt: timestamp('created_at')
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp('updated_at')
      .$defaultFn(() => new Date())
      .notNull(),
    /** Superseded rows are kept: a record shows its own history. */
    supersededAt: timestamp('superseded_at'),
  },
  (table) => [index('wealth_asset_user_idx').on(table.userId)]
);

export const wealthLiability = pgTable(
  'wealth_liability',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    linkedAssetId: text('linked_asset_id'),
    currency: text('currency').notNull(),
    nameEnc: text('name_enc').notNull(),
    balanceEnc: text('balance_enc').notNull(),
    termsEnc: text('terms_enc'),
    createdAt: timestamp('created_at')
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp('updated_at')
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index('wealth_liability_user_idx').on(table.userId)]
);

export const wealthGoal = pgTable(
  'wealth_goal',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    nameEnc: text('name_enc').notNull(),
    targetEnc: text('target_enc'),
    metaEnc: text('meta_enc'),
    priority: text('priority'),
    dueAt: timestamp('due_at'),
    createdAt: timestamp('created_at')
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp('updated_at')
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index('wealth_goal_user_idx').on(table.userId)]
);

/* -------------------------------------------------------------- Audit log */

/**
 * Every touch of financial data lands here. Append-only by convention: the app has
 * no delete path, and the account UI reads it but never writes it directly.
 */
export const dataAccessLog = pgTable(
  'data_access_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** read | create | update | delete | export | share */
    action: text('action').notNull(),
    /** wealth_asset | wealth_liability | wealth_goal | wealth_overview | consent */
    resource: text('resource').notNull(),
    resourceId: text('resource_id'),
    /** Who or what performed it: the person, Copilot, or an expert snapshot. */
    actor: text('actor').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    /** Never contains financial values — only what was touched, not what it said. */
    context: jsonb('context'),
    createdAt: timestamp('created_at')
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index('data_access_user_idx').on(table.userId),
    index('data_access_created_idx').on(table.createdAt),
  ]
);

/* ---------------------------------------------------- Email preview outbox */

/**
 * Where messages go when no mail provider is configured.
 *
 * This exists so the real verification and reset flows can be exercised without a
 * sending domain: the token is genuine, single-use and time-limited — only the
 * delivery is simulated. Rows are readable solely through the key-protected preview
 * page, and the table is inert once EMAIL_TRANSPORT is set to a real provider.
 */
export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: text('id').primaryKey(),
    recipient: text('recipient').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    /** Extracted so the preview page can offer it as a link. */
    actionUrl: text('action_url'),
    createdAt: timestamp('created_at')
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index('email_outbox_created_idx').on(table.createdAt)]
);

/* --------------------------------------------------------------- Consents */

/**
 * Consents are separate records, never one bundled flag, and they are versioned:
 * changing the wording of what someone agreed to requires a fresh grant.
 */
export const consent = pgTable(
  'consent',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** copilot_context | expert_sharing | ai_processing | marketplace_terms | cancellation */
    kind: text('kind').notNull(),
    /** For expert_sharing: which expert or booking the grant is scoped to. */
    scope: text('scope'),
    /** Exactly which items were granted — an empty list is a valid, meaningful state. */
    grants: jsonb('grants'),
    version: integer('version').notNull(),
    grantedAt: timestamp('granted_at')
      .$defaultFn(() => new Date())
      .notNull(),
    revokedAt: timestamp('revoked_at'),
    ipAddress: text('ip_address'),
  },
  (table) => [
    index('consent_user_idx').on(table.userId),
    index('consent_kind_idx').on(table.userId, table.kind),
  ]
);
