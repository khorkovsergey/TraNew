# Orchestrator request — Metrics section, Phase 0 → Phase 1

From: `metrics` worker, branch `feat/metrics`, based on `539620e`.
Blocking: **yes.** Phase 1 cannot start until items 1 and 2 are on `main` and
merged back into the metrics worktree.

Everything here is in `orchestratorOnly` territory. Per Override #8 this is a
specification, not a request to design something — apply it as written, and
send back anything you disagree with rather than adjusting it silently.

The reasoning behind each choice is in [`current-state.md`](./current-state.md).

---

## 1. `src/db/schema.ts` — one new table

Append at the end of the file, in the repository's existing style. No existing
table is modified. No foreign key to `user` is declared **on purpose**: the
telemetry identity is a one-way HMAC, not a user id, so a cascade delete would
have nothing to match and a foreign key would defeat the pseudonymity.

```ts
/**
 * Product telemetry. Append-only.
 *
 * The identity columns are one-way HMACs, never the application user id, so a
 * row cannot be walked back to a person from this table alone. No raw IP, no
 * raw user agent, no free text: `properties` is validated per event against the
 * registry in `src/lib/analytics/registry.ts` before anything is written.
 *
 * Deliberately not foreign-keyed to `user`: the pseudonymous key is not a user
 * id, and a cascade would either fail to match or force the real id in here.
 */
export const productTelemetryEvent = pgTable(
  'product_telemetry_event',
  {
    id: text('id').primaryKey(),

    /** Registry schema version for this event name, so a shape change is readable. */
    schemaVersion: integer('schema_version').notNull().default(1),

    /** Client-reported, clamped server-side to a sane window around receipt. */
    occurredAt: timestamp('occurred_at').notNull(),
    /** Server clock. The only timestamp a query may trust for freshness. */
    receivedAt: timestamp('received_at').$defaultFn(() => new Date()).notNull(),

    eventName: text('event_name').notNull(),
    /** client | server | operational */
    eventKind: text('event_kind').notNull(),

    /** Product surface, from the surface registry. */
    surface: text('surface'),
    /** Route template such as `/markets/[market]` — never a populated URL. */
    routeTemplate: text('route_template'),

    /** Session-scoped, rotates on session boundary. Not a cross-session identity. */
    sessionId: text('session_id').notNull(),
    /** Session-scoped pseudonymous visitor key. Never IP-derived. */
    visitorKeyHash: text('visitor_key_hash'),
    /** HMAC of the authenticated user id. Derived server-side, never sent by a browser. */
    userKeyHash: text('user_key_hash'),

    /** anonymous | registered */
    authState: text('auth_state').notNull(),
    /** Server-derived entitlement at the time of the event. Never client-claimed. */
    entitlement: text('entitlement'),
    /** Coarse bucket: direct | organic | referral | social | ai | partner | internal | unknown */
    acquisitionSource: text('acquisition_source'),
    /** Coarse bucket: mobile | tablet | desktop | unknown. Never a UA string. */
    deviceClass: text('device_class'),
    /** live | disabled | coming_soon | external | legacy | unknown */
    featureState: text('feature_state').$defaultFn(() => 'unknown').notNull(),

    /** Registry-validated. Rejected outright if it carries an unlisted key. */
    properties: jsonb('properties').$defaultFn(() => ({})).notNull(),
  },
  (table) => [
    index('telemetry_occurred_idx').on(table.occurredAt),
    index('telemetry_name_occurred_idx').on(table.eventName, table.occurredAt),
    index('telemetry_session_occurred_idx').on(table.sessionId, table.occurredAt),
    index('telemetry_surface_occurred_idx').on(table.surface, table.occurredAt),
    index('telemetry_user_occurred_idx').on(table.userKeyHash, table.occurredAt),
    index('telemetry_received_idx').on(table.receivedAt),
  ]
);
```

### Column notes that matter for the migration

- All timestamps are `timestamp` without time zone, matching every other table
  in this schema. Cohort dates are computed in UTC at query time.
- `properties` defaults to `{}` and is `notNull`, so a query never has to handle
  a null JSON.
- No `CHECK` constraints on the enum-ish text columns. The rest of this schema
  uses plain `text` with the allowed values in a comment (`purchase.status`,
  `activity.type`, `alert.status`), and validation lives in the application.
  Following that convention rather than introducing a new one.

### Indexes — why these six

Five read patterns drive the dashboard: time window scans, per-event funnels,
per-session sequencing, per-surface rollups, and per-user cohorts. The sixth,
`received_at`, exists only for the freshness panel, which asks
`max(received_at)` per domain and must not scan the table to do it.

`telemetry_user_occurred_idx` is a plain index rather than partial. Drizzle's
partial-index support would work here, but every other index in this schema is
plain, and the null rows are cheap.

---

## 2. `.env.example` — two new variables

```bash
# Product Observatory (metrics section).

# Key for the one-way HMAC that turns an authenticated user id into a
# pseudonymous analytics key. Separate from BETTER_AUTH_SECRET on purpose:
# rotating the auth secret must not silently reset every retention cohort, and
# rotating this one must not sign anybody out. 32+ random bytes.
ANALYTICS_HMAC_SECRET=

# Direct-link access to /en/admin_admin_metrics for demonstration, exchanged
# server-side for a short-lived cookie. High entropy, 32+ random bytes. An
# account with role='admin' does not need it. Leave empty to disable the
# direct-link path entirely and require an admin session.
METRICS_ACCESS_SECRET=
```

**Both must also be set on Railway** for the deployed dashboard to work.
`ANALYTICS_HMAC_SECRET` unset must be a hard failure in production rather than a
silent fallback to a development constant — the worker will implement that check;
please make sure the value exists before the first deploy that includes this
section.

Neither is `NEXT_PUBLIC_`. Both are server-only and must never reach the client
bundle.

---

## 3. `package.json` — nothing requested

Stated explicitly so it is not assumed. Phase 1 needs no new dependency:

- Web Vitals come from Next's own `useReportWebVitals`;
- HMAC comes from `node:crypto`;
- batching and `sendBeacon` are platform APIs;
- charting is deferred to Phase 6, and the brief's §34 says to try the existing
  stack first. If a charting dependency turns out to be genuinely necessary, it
  will be a separate, later request with the alternatives that were tried.

---

## 4. Migration, retention and rollback

**Migration.** One `CREATE TABLE` plus six `CREATE INDEX`. No data migration, no
backfill — the table starts empty because nothing was ever collected (see
`current-state.md` §2). Generate with the project's normal drizzle flow and
apply with `scripts/ops/apply-migrations.mjs`. `scripts/ops/check-schema-drift.mjs`
should be green afterwards.

**Retention.** The table grows without bound by design in Phase 1; no deletion
job is requested yet. Phase 7 covers a retention policy, and it needs a product
decision about how long behavioural telemetry is kept — that decision is not
this worker's to make. Flagging it now so it is not discovered later: at portal
scale this is the table that will eventually need partitioning or a purge job.

**Rollback.** `DROP TABLE product_telemetry_event`. Nothing else references it;
no other table gains a column; no existing behaviour changes if it disappears.
The application side degrades safely on its own — `track()` swallows every
failure by design, so a missing table costs telemetry and nothing else. That
property is deliberate and the worker will not weaken it.

---

## 5. Not requested, but you should know

Three things this worker found and cannot fix. Full detail in
`current-state.md` §0 and §9.

1. **`npm run check:analytics` is red on `main` and was before this section
   existed** — 59 events declared, 7 with no emitter, all of them the retired
   plan funnel. Fixing it means deleting members from `src/lib/events/analytics.ts`,
   a `shared` file whose protocol forbids deleting another section's entries.
   Needs either a decision from the `start` owner or a note in `lintBaseline`.
   Acceptance criterion 22 asks for this gate green; it cannot go green from
   inside this section.
2. **`scripts/check-analytics.mjs` can be silently defeated** by the very event
   registry this section is asked to build, because it decides "has a caller" by
   grepping for the event name as a string literal anywhere under `src/`. The
   worker will exclude its registry from the scan and will say so in the handoff.
3. **`src/app/[locale]/layout.tsx` and `src/middleware.ts` are owned by no
   section** and are not in `shared`. Phase 1 is designed to avoid both. Worth
   assigning before someone edits them assuming they are unowned-therefore-free.

---

## 6. What happens after you apply this

```
# in the metrics worktree
git fetch origin && git merge origin/main
npx tsc --noEmit && node scripts/test-events.mjs
```

Then Phase 1 proceeds per `current-state.md` §10. The worker does not push
`main` and does not deploy. Production verification of live ingestion is yours,
after merge, and until then nothing in this section will be described as
production-verified.
