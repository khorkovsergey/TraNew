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
     * Staff role — separate from `plan`, which is what someone bought. Paying for
     * AI Private must never confer the ability to approve an event or read
     * another organizer's attendee list.
     *
     * user | moderator | admin
     */
    role: text('role').$defaultFn(() => 'user').notNull(),

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
    /** Who or what performed it: the person, Voyager, or an expert snapshot. */
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

/* ============================================================================
 * The user object model
 *
 * Everything below hangs off a user and is the reason the sections stop being
 * separate screens. Two rules run through it:
 *
 * - **One saved-object table, not one per section.** A symbol saved from Explore,
 *   referenced by an alert and attached to an expert brief is the *same* row. A
 *   per-section table would give three copies that drift apart, which is exactly
 *   the "sections don't know about each other" problem.
 * - **Encrypt what is sensitive, leave queryable what is not.** Values, names and
 *   free text are ciphertext; kinds, ids and timestamps stay in the clear so the
 *   database can still filter and join. Encrypting a `kind` column would buy
 *   nothing and make the feature impossible to build.
 * ========================================================================== */

/* ----------------------------------------------------------------- Profile */

/**
 * Who the person is as an investor, separate from the auth record.
 *
 * better-auth owns `user`; anything we would want to change without touching the
 * authentication row lives here, so a schema change on our side never risks the
 * table that guards sign-in.
 */
export const profile = pgTable(
  'profile',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    displayName: text('display_name'),
    /** IANA zone; drives how release times and market hours are shown. */
    timezone: text('timezone'),
    baseCurrency: text('base_currency').$defaultFn(() => 'EUR').notNull(),
    /** beginner | standard | pro — set by the Academy diagnostic, editable after. */
    experience: text('experience').$defaultFn(() => 'beginner').notNull(),
    /** Free text the person wrote about what they are trying to achieve. */
    goalsEnc: text('goals_enc'),

    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [uniqueIndex('profile_user_idx').on(table.userId)]
);

/* ------------------------------------------------------------- Preferences */

/**
 * Settings the person toggles: notification channels, privacy, display.
 *
 * A key/value table rather than a wide column list, because settings screens grow
 * constantly and a migration per toggle is friction that ends with toggles living
 * in localStorage again.
 */
export const preference = pgTable(
  'preference',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /** Dotted key, e.g. `notifications.market_alerts` or `privacy.public_profile`. */
    key: text('key').notNull(),
    value: jsonb('value').$type<string | number | boolean | string[]>().notNull(),

    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [uniqueIndex('preference_user_key_idx').on(table.userId, table.key)]
);

/* ------------------------------------------------------------ Subscription */

/**
 * Billing history. `user.plan` stays the fast entitlement check; this is the
 * record of how it got that way, which a plan column cannot answer.
 */
export const subscription = pgTable(
  'subscription',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    plan: text('plan').notNull(),
    /** active | past_due | cancelled | expired */
    status: text('status').notNull(),
    /** monthly | yearly | lifetime */
    interval: text('interval'),
    priceCents: integer('price_cents'),
    currency: text('currency').$defaultFn(() => 'EUR').notNull(),

    startedAt: timestamp('started_at').$defaultFn(() => new Date()).notNull(),
    renewsAt: timestamp('renews_at'),
    cancelledAt: timestamp('cancelled_at'),

    /** Reference at the payment provider. Never a card number. */
    externalRef: text('external_ref'),
  },
  (table) => [index('subscription_user_idx').on(table.userId, table.startedAt)]
);

/* --------------------------------------------------------- Voyager memory */

/**
 * What Voyager is allowed to remember between sessions.
 *
 * Every row is individually visible and deletable in the account, which is the
 * whole point: memory a person cannot inspect is memory they cannot trust. The
 * content is encrypted because it describes their finances and intentions.
 */
export const voyagerMemory = pgTable(
  'voyager_memory',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /** goal | preference | holding | constraint | fact */
    kind: text('kind').notNull(),
    contentEnc: text('content_enc').notNull(),
    /** Where it came from, so the person can see why Voyager believes it. */
    sourceEvent: text('source_event'),

    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
    /** Soft delete: forgetting is an event worth keeping in the audit trail. */
    forgottenAt: timestamp('forgotten_at'),
  },
  (table) => [index('voyager_memory_user_idx').on(table.userId, table.createdAt)]
);

/* ----------------------------------------------------- Saved objects */

/**
 * The join between sections.
 *
 * `kind` + `ref` identifies the thing (a ticker, a lesson slug, an expert id); a
 * saved symbol is one row that Workspace lists, an alert points at, and an expert
 * brief can attach. This is what makes the sections aware of each other.
 */
/* -------------------------------------------------------- Chart layouts */

/**
 * A saved Superchart workspace.
 *
 * The JSON is versioned by the application rather than by the column, because
 * the shape changes far more often than the table does and a migration for a
 * field inside a layout should not be a database migration.
 *
 * One layout per user per name, so saving over an existing name replaces it
 * rather than leaving two entries a person cannot tell apart.
 */
export const chartLayout = pgTable(
  'chart_layout',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    /** Serialized `ChartLayout`; `schemaVersion` inside it drives migration. */
    state: text('state').notNull(),
    schemaVersion: integer('schema_version').notNull(),

    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex('chart_layout_user_name_idx').on(table.userId, table.name),
    index('chart_layout_user_updated_idx').on(table.userId, table.updatedAt),
  ]
);

/**
 * Script Lab documents.
 *
 * The whole document, versions included, is stored as one serialized value
 * rather than a row per version. A version is only ever read with its document
 * and never queried across users, so a table would buy nothing and cost a join
 * on every open — and the version cap keeps the value bounded.
 */
export const chartScript = pgTable(
  'chart_script',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    /** Serialized `ScriptDocument`, validated on the way in and on the way out. */
    document: text('document').notNull(),
    schemaVersion: integer('schema_version').notNull(),

    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex('chart_script_user_name_idx').on(table.userId, table.name),
    index('chart_script_user_updated_idx').on(table.userId, table.updatedAt),
  ]
);

/**
 * Saved Voyager workspaces.
 *
 * The whole library is one serialized value per user rather than a row per
 * workspace. It is only ever read whole, never queried across users, and the
 * cap keeps it bounded — a table would buy nothing and cost a query on every
 * open.
 */
export const voyagerWorkspace = pgTable(
  'voyager_workspace',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),

    /** Serialized `StoredLibrary`, validated on the way in and on the way out. */
    library: text('library').notNull(),
    schemaVersion: integer('schema_version').notNull(),

    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
  }
);

/**
 * Documents somebody uploaded as Voyager's standing context.
 *
 * Their notes about their own money, so the body is encrypted with their key
 * exactly as a wealth note is — the same rule, because it is the same kind of
 * material. Nothing here is readable without the account it belongs to.
 *
 * Text in a column rather than a file on a disk: these are notes, watchlists
 * and theses, capped at 2 MB, and only formats the server can actually read are
 * accepted. It moves to object storage the day binaries are, without the
 * interface above it changing.
 */
export const voyagerFile = pgTable(
  'voyager_file',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    /** txt | md | csv — what the parser was told it is. */
    kind: text('kind').notNull(),
    bytes: integer('bytes').notNull(),
    /** The document itself, sealed with the owner's data key. */
    bodyEnc: text('body_enc').notNull(),
    /** always | referenced | off */
    mode: text('mode').notNull(),

    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index('voyager_file_user_idx').on(table.userId, table.createdAt),
    // Uploading the same name twice replaces rather than duplicates.
    uniqueIndex('voyager_file_user_name_idx').on(table.userId, table.name),
  ]
);

export const savedObject = pgTable(
  'saved_object',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /** symbol | country | news | research | chart | expert | lesson | screener | idea */
    kind: text('kind').notNull(),
    /** Stable identifier within the kind: "TSLA", "us-cpi", "exp_014". */
    ref: text('ref').notNull(),
    /** Denormalised for listing without fetching every source. */
    title: text('title').notNull(),
    subtitle: text('subtitle'),

    /** The person's own note — their words about their money, so encrypted. */
    noteEnc: text('note_enc'),

    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    // Saving the same thing twice is a no-op rather than a duplicate row.
    uniqueIndex('saved_object_user_kind_ref_idx').on(table.userId, table.kind, table.ref),
    index('saved_object_user_created_idx').on(table.userId, table.createdAt),
  ]
);

/* -------------------------------------------------------------- Collections */

export const collection = pgTable(
  'collection',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    description: text('description'),
    /** Sharing is opt-in per collection, never account-wide. */
    isPublic: boolean('is_public').$defaultFn(() => false).notNull(),

    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [index('collection_user_idx').on(table.userId, table.createdAt)]
);

export const collectionItem = pgTable(
  'collection_item',
  {
    id: text('id').primaryKey(),
    collectionId: text('collection_id')
      .notNull()
      .references(() => collection.id, { onDelete: 'cascade' }),
    savedObjectId: text('saved_object_id')
      .notNull()
      .references(() => savedObject.id, { onDelete: 'cascade' }),

    position: integer('position').$defaultFn(() => 0).notNull(),
    addedAt: timestamp('added_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex('collection_item_idx').on(table.collectionId, table.savedObjectId),
  ]
);

/* ------------------------------------------------------------------ Alerts */

export const alert = pgTable(
  'alert',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /** Optional link to the saved object it watches, so deleting one cleans up. */
    savedObjectId: text('saved_object_id').references(() => savedObject.id, {
      onDelete: 'set null',
    }),

    /** price | percent_move | indicator_release | news | earnings */
    kind: text('kind').notNull(),
    /** What it watches: a ticker, an indicator slug. */
    ref: text('ref').notNull(),
    label: text('label').notNull(),
    /** Threshold and comparison, shape depending on kind. */
    condition: jsonb('condition').$type<Record<string, string | number>>(),

    /** in_app | email | push, as chosen per alert. */
    channels: jsonb('channels').$type<string[]>(),

    /** draft | active | paused | triggered */
    status: text('status').$defaultFn(() => 'draft').notNull(),
    lastTriggeredAt: timestamp('last_triggered_at'),

    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [index('alert_user_idx').on(table.userId, table.status)]
);

/* --------------------------------------------------------------- Purchases */

export const purchase = pgTable(
  'purchase',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /** subscription | consultation | report | course | script */
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').$defaultFn(() => 'EUR').notNull(),
    /**
     * paid | pending | refunded | failed | demo
     *
     * `demo` is an entitlement granted without money changing hands, because no
     * payment provider is connected yet. It is its own status rather than
     * `paid` so that anything counting revenue off this table cannot count it
     * by accident — and so the screens can say which one a row is.
     */
    status: text('status').notNull(),

    /** Provider reference for reconciliation. Never card details. */
    externalRef: text('external_ref'),
    invoiceUrl: text('invoice_url'),

    purchasedAt: timestamp('purchased_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [index('purchase_user_idx').on(table.userId, table.purchasedAt)]
);

/* --------------------------------------------------------- Expert bookings */

/**
 * A consultation from intake to outcome.
 *
 * The intake brief describes someone's finances in their own words, so it is
 * encrypted. `sharedContext` records which context blocks they approved — the
 * expert-facing counterpart of the consent record, kept here so a booking can be
 * audited on its own terms.
 */
export const expertBooking = pgTable(
  'expert_booking',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    expertRef: text('expert_ref').notNull(),
    packageRef: text('package_ref'),

    /** draft | slot_held | payment_pending | confirmed | completed | cancelled | refunded | no_show | disputed */
    status: text('status').$defaultFn(() => 'draft').notNull(),

    briefEnc: text('brief_enc'),
    /** Ids of the context blocks the person explicitly approved sharing. */
    sharedContext: jsonb('shared_context').$type<string[]>(),

    slotAt: timestamp('slot_at'),
    /** A held slot that is never paid for must expire, not linger. */
    holdExpiresAt: timestamp('hold_expires_at'),

    purchaseId: text('purchase_id').references(() => purchase.id, { onDelete: 'set null' }),
    rating: integer('rating'),
    summaryEnc: text('summary_enc'),

    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [index('expert_booking_user_idx').on(table.userId, table.createdAt)]
);

/* -------------------------------------------------------- Academy progress */

/**
 * Learning progress, one row per user.
 *
 * A single row rather than an event table: the Academy flow reads the whole state
 * on every screen, and splitting it would mean a join on every render for data
 * that is only ever used together.
 */
export const academyProgress = pgTable(
  'academy_progress',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /** landing | diagnostic | path | dashboard | lesson | done */
    stage: text('stage').$defaultFn(() => 'landing').notNull(),
    mode: text('mode').$defaultFn(() => 'beginner').notNull(),
    /** Diagnostic answers: five lists of option ids. */
    diagnostic: jsonb('diagnostic').$type<string[][]>(),
    diagnosticStep: integer('diagnostic_step').$defaultFn(() => 0).notNull(),
    pathReady: boolean('path_ready').$defaultFn(() => false).notNull(),

    /** Slugs of completed lessons, in completion order. */
    lessonsDone: jsonb('lessons_done').$type<string[]>(),
    /** Glossary terms the person opened — feeds "explain differently" in Voyager. */
    termsSeen: jsonb('terms_seen').$type<string[]>(),
    questionsAsked: integer('questions_asked').$defaultFn(() => 0).notNull(),
    completed: boolean('completed').$defaultFn(() => false).notNull(),

    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [uniqueIndex('academy_progress_user_idx').on(table.userId)]
);

/* ---------------------------------------------------------------- Activity */

/**
 * What the person did — the product feed behind the Activity tab.
 *
 * Deliberately *not* the same table as `dataAccessLog`. That one answers "who
 * touched financial data", is written for compliance and must stay small enough to
 * read line by line. Mixing "viewed a chart" into it would bury the entries that
 * matter. Two logs, two jobs.
 */
export const activity = pgTable(
  'activity',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /** viewed | saved | asked | learned | alert | booking | purchase | wealth */
    type: text('type').notNull(),
    title: text('title').notNull(),
    /** Where it happened, so the entry can link back. */
    kind: text('kind'),
    ref: text('ref'),

    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [index('activity_user_idx').on(table.userId, table.createdAt)]
);

/* ------------------------------------------------------------ Voyager usage */

/**
 * Daily question counter, so the Basic tier's limit means something.
 *
 * `subject` is a user id for a signed-in person and an HMAC of the IP address for
 * an anonymous one — hashed rather than stored raw, because the only thing this
 * table needs to know is "the same visitor as before", not who they are. Rows are
 * per day, so history expires by being irrelevant rather than by retention policy.
 */
export const voyagerUsage = pgTable(
  'voyager_usage',
  {
    id: text('id').primaryKey(),
    subject: text('subject').notNull(),
    /** Calendar day in UTC, as YYYY-MM-DD. */
    day: text('day').notNull(),
    count: integer('count').notNull().default(0),
    updatedAt: timestamp('updated_at')
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex('voyager_usage_subject_day_idx').on(table.subject, table.day)]
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
    /** voyager_context | expert_sharing | ai_processing | marketplace_terms | cancellation */
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

/* ------------------------------------------------------------------ Events */

/**
 * Events.
 *
 * Three rules are enforced by the shape rather than by the code that writes it.
 *
 * `status` decides visibility, so a draft cannot leak by being read through the
 * wrong query — the public catalogue selects on it and nothing else.
 *
 * `onlineMeetingUrl` sits apart from every other location field because it is the
 * one column that must never reach an anonymous client or a calendar export.
 * Keeping it in its own column rather than inside a venue blob is what makes
 * "select everything except this" possible.
 *
 * Registration counters live on the event rather than being counted on read.
 * Capacity is a promise to the people who registered, and it has to be checked
 * inside the same statement that takes the place.
 */

export const organizer = pgTable(
  'organizer',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    /** Null for TradingNew itself and for imported external organizers. */
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),

    name: text('name').notNull(),
    initials: text('initials').notNull(),
    /** tradingnew | individual | company | institution | community */
    type: text('type').notNull(),
    /** unverified | pending | verified | suspended */
    verificationStatus: text('verification_status')
      .$defaultFn(() => 'unverified')
      .notNull(),

    description: text('description'),
    website: text('website'),
    country: text('country'),
    followerCount: integer('follower_count').$defaultFn(() => 0).notNull(),

    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex('organizer_slug_idx').on(table.slug),
    index('organizer_user_idx').on(table.userId),
  ]
);

export const organizerFollow = pgTable(
  'organizer_follow',
  {
    id: text('id').primaryKey(),
    organizerId: text('organizer_id')
      .notNull()
      .references(() => organizer.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [uniqueIndex('organizer_follow_idx').on(table.organizerId, table.userId)]
);

export const event = pgTable(
  'event',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),

    title: text('title').notNull(),
    shortDescription: text('short_description').notNull(),
    description: text('description').notNull(),
    coverImageUrl: text('cover_image_url'),
    /** A brand gradient, until image upload exists. */
    coverGradient: text('cover_gradient'),

    /** draft | pending_review | changes_requested | published | rejected | suspended | cancelled | completed */
    status: text('status').$defaultFn(() => 'draft').notNull(),
    /** public | unlisted */
    visibility: text('visibility').$defaultFn(() => 'public').notNull(),
    /** in_person | online | hybrid */
    format: text('format').notNull(),
    /** conference | meetup | webinar | workshop | masterclass | panel | networking | live_market_session */
    eventType: text('event_type').notNull(),

    organizerId: text('organizer_id')
      .notNull()
      .references(() => organizer.id, { onDelete: 'restrict' }),

    /** tradingnew | community | external */
    sourceType: text('source_type').$defaultFn(() => 'community').notNull(),
    externalUrl: text('external_url'),
    externalDomain: text('external_domain'),
    externalTrusted: boolean('external_trusted').$defaultFn(() => false).notNull(),

    /** UTC. The organizer's IANA zone is the column beside them, never folded in. */
    startsAt: timestamp('starts_at').notNull(),
    endsAt: timestamp('ends_at').notNull(),
    timezone: text('timezone').notNull(),
    registrationDeadline: timestamp('registration_deadline'),

    language: jsonb('language').$type<string[]>().notNull(),
    country: text('country'),
    city: text('city'),
    venueName: text('venue_name'),
    venueAddress: text('venue_address'),
    /** Venue coordinates. An attendee location is never written to an event. */
    latitude: text('latitude'),
    longitude: text('longitude'),
    /** Never selected for an anonymous client or a calendar export. */
    onlineMeetingUrl: text('online_meeting_url'),

    capacity: integer('capacity'),
    registrationCount: integer('registration_count').$defaultFn(() => 0).notNull(),
    waitlistCount: integer('waitlist_count').$defaultFn(() => 0).notNull(),
    waitlistEnabled: boolean('waitlist_enabled').$defaultFn(() => false).notNull(),

    /** free | paid | external */
    priceType: text('price_type').$defaultFn(() => 'free').notNull(),
    /** Minor units, so no float ever touches a price. */
    priceAmount: integer('price_amount'),
    currency: text('currency'),

    /** beginner | intermediate | advanced | all_levels */
    experienceLevel: text('experience_level').$defaultFn(() => 'all_levels').notNull(),
    topics: jsonb('topics').$type<string[]>().notNull(),
    markets: jsonb('markets').$type<string[]>(),
    tags: jsonb('tags').$type<string[]>(),

    learningOutcomes: jsonb('learning_outcomes').$type<string[]>(),
    intendedAudience: text('intended_audience'),
    importantNotice: text('important_notice'),

    agenda: jsonb('agenda').$type<
      Array<{
        id: string;
        time: string;
        title: string;
        speaker: string | null;
        kind: string | null;
        position: number;
      }>
    >(),
    speakers: jsonb('speakers').$type<
      Array<{
        id: string;
        name: string;
        role: string;
        company: string | null;
        initials: string;
        avatarUrl: string | null;
        position: number;
      }>
    >(),

    isFeatured: boolean('is_featured').$defaultFn(() => false).notNull(),
    isPromoted: boolean('is_promoted').$defaultFn(() => false).notNull(),

    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
    publishedAt: timestamp('published_at'),
    moderationReason: text('moderation_reason'),
    cancellationReason: text('cancellation_reason'),
  },
  (table) => [
    uniqueIndex('event_slug_idx').on(table.slug),
    // The catalogue query: published events, soonest first.
    index('event_status_starts_idx').on(table.status, table.startsAt),
    index('event_organizer_idx').on(table.organizerId, table.startsAt),
    index('event_created_by_idx').on(table.createdBy),
    index('event_city_idx').on(table.country, table.city),
  ]
);

export const eventRegistration = pgTable(
  'event_registration',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => event.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /** registered | waitlisted | cancelled | attended | no_show */
    status: text('status').$defaultFn(() => 'registered').notNull(),

    name: text('name').notNull(),
    email: text('email').notNull(),
    company: text('company'),
    role: text('role'),
    experienceLevel: text('experience_level'),

    eventUpdatesConsent: boolean('event_updates_consent').$defaultFn(() => false).notNull(),
    termsAccepted: boolean('terms_accepted').$defaultFn(() => false).notNull(),

    /** Queue order. Promotion takes the lowest number, not the oldest row. */
    waitlistPosition: integer('waitlist_position'),

    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    // One row per person per event. This is what makes registration idempotent:
    // a repeated submit collides here instead of taking a second seat.
    uniqueIndex('event_registration_idx').on(table.eventId, table.userId),
    index('event_registration_user_idx').on(table.userId, table.status),
    index('event_registration_waitlist_idx').on(table.eventId, table.waitlistPosition),
  ]
);

export const eventBookmark = pgTable(
  'event_bookmark',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => event.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex('event_bookmark_idx').on(table.eventId, table.userId),
    index('event_bookmark_user_idx').on(table.userId, table.createdAt),
  ]
);

export const eventReport = pgTable(
  'event_report',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => event.id, { onDelete: 'cascade' }),
    /** Null when reported by someone who is not signed in. */
    reporterId: text('reporter_id').references(() => user.id, { onDelete: 'set null' }),

    reason: text('reason').notNull(),
    detail: text('detail'),
    resolved: boolean('resolved').$defaultFn(() => false).notNull(),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index('event_report_event_idx').on(table.eventId, table.resolved),
    index('event_report_created_idx').on(table.createdAt),
  ]
);

/**
 * Append-only. Nothing updates or deletes a row here — a moderation history that
 * can be rewritten answers no question anyone would ask of it.
 */
export const eventModeration = pgTable(
  'event_moderation',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => event.id, { onDelete: 'cascade' }),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    /** submitted | approved | rejected | changes_requested | suspended | restored | cancelled */
    action: text('action').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [index('event_moderation_event_idx').on(table.eventId, table.createdAt)]
);

export const eventNotificationPreference = pgTable(
  'event_notification_preference',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** registration_confirmed | reminder_24h | reminder_1h | event_changed | ... */
    kind: text('kind').notNull(),
    enabled: boolean('enabled').$defaultFn(() => true).notNull(),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [uniqueIndex('event_notification_pref_idx').on(table.userId, table.kind)]
);

/**
 * Counters for the organizer dashboard. One row per event per metric per day, so
 * a chart is a range scan rather than a scan of every page view ever recorded.
 */
export const eventMetric = pgTable(
  'event_metric',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => event.id, { onDelete: 'cascade' }),
    /** page_view | card_view | registration | cancellation | save | external_click | share */
    metric: text('metric').notNull(),
    /** UTC date, midnight. */
    day: timestamp('day').notNull(),
    count: integer('count').$defaultFn(() => 0).notNull(),
  },
  (table) => [uniqueIndex('event_metric_idx').on(table.eventId, table.metric, table.day)]
);

/** Wizard drafts, autosaved long before anything on them is valid. */
export const eventDraft = pgTable(
  'event_draft',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Set once the draft has become a real event row. */
    eventId: text('event_id').references(() => event.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').notNull(),
    step: integer('step').$defaultFn(() => 0).notNull(),
    updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (table) => [index('event_draft_user_idx').on(table.userId, table.updatedAt)]
);
