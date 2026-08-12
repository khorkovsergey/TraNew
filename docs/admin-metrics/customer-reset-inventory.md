# Customer reset inventory — for the Orchestrator

**Nothing in this document has been executed.** No production data was deleted,
no table was truncated, no SQL was run against Railway. This is the plan the
later reset should follow, derived from `src/db/schema.ts`, the migrations in
`drizzle/`, and the code that writes each table.

Companion document: [`internal-traffic.md`](internal-traffic.md), which is the
measurement semantics this reset depends on.

## The goal

> After the reset the Observatory shows zero real customers and zero customer
> activity, while the product owner's admin account and the product itself
> survive intact.

## The two rules

1. **Relational truth only.** Role, foreign keys, table semantics. Never an
   email, never a name, never a guessed account.
2. **The preserved user population is exactly `role IN ('admin', 'moderator')`.**
   Schema inspection found **no system or service user** that would also need
   preserving: `organizer.user_id` is nullable precisely so TradingNew's own
   organizer and imported external ones have no account behind them, and no
   other table requires a sentinel user row. If that changes, it must be
   re-checked before the reset runs.

---

## PRESERVE — product and system inventory

These describe the product. None of them is evidence of customer adoption, and
§11 of the brief is explicit that they may legitimately stay non-zero.

| Table | What it is | Notes for the reset |
| --- | --- | --- |
| `user` **where `role <> 'user'`** | Staff accounts — the owner and any moderator | The delete is scoped by role, not by identity |
| `session`, `account`, `two_factor` **of staff rows** | Sign-in state for preserved accounts | Survive automatically: they only cascade from the users being deleted |
| `event` | Published and draft events — product inventory | `created_by` is `ON DELETE SET NULL`, so deleting a customer author leaves the event standing. Verify none is left with no organizer — `organizer_id` is `RESTRICT`, so this cannot happen silently |
| `organizer` | Organizer profiles, including TradingNew's own and imported external ones | `user_id` is nullable and `ON DELETE SET NULL`. **Do not delete organizers** — `event.organizer_id` is `RESTRICT` and an event would block it anyway |
| `event_moderation` | Append-only moderation history of product inventory | `actor_id` is `SET NULL`. The history is about the event, not about a customer |
| `email_outbox` — see REVIEW | | |

Product inventory that is **not in the database at all**, and therefore cannot
be touched by any reset: the Academy course catalogue (`src/content/academy*.ts`),
the Experts catalogue (`src/content/experts.ts`), the Supercharts catalogue,
feature flags (`src/lib/featureFlags.ts`), market provider configuration
(environment), the event/telemetry declarations (`src/lib/events/analytics.ts`,
`src/lib/analytics/registry.ts`) and the surface catalogue. All of these keep
working and keep reporting after the reset, which is why "instrumentation
coverage" and "published events" stay non-zero while every customer number goes
to zero.

---

## RESET — customer and demo behavioural facts

Every table here is a record of somebody using the product. After the reset the
brief expects each of them to be empty, which means **whole-table deletion, not
deletion by user id**: rows owned by the preserved admin account are the owner's
own demo activity, and leaving them is exactly what would keep "event
registrations" at 1 instead of 0.

"FK cascade" below says whether deleting the *customer users* alone would clear
the table. Where it says "customer rows only", staff-owned rows survive the
cascade and must be deleted explicitly.

### Telemetry

| Table | Why it is customer/demo data | FK cascade |
| --- | --- | --- |
| `product_telemetry_event` | Every behavioural metric in the Observatory. Sessions, PMCR, TTFA, funnels, retention, Voyager, Supercharts, Web Vitals | **None.** No foreign key to `user` by design — must be deleted explicitly (`DELETE FROM product_telemetry_event`) |

Deleting this is what makes PMCR, TTFA, second action, retention and the funnels
report *insufficient sample* rather than zero — see "Expected result" below.

### The customer accounts themselves

| Table | Why | FK cascade |
| --- | --- | --- |
| `user` **where `role = 'user'`** | The customer population | This delete is the *source* of every cascade below |
| `session`, `account`, `two_factor` | Sign-in state of deleted customers | Cascade, complete |
| `verification` | Email-verification and reset tokens, keyed by email `identifier` with **no FK** | **None.** Stale tokens for deleted addresses must be deleted explicitly |

### Durable customer activity

All of these cascade from `user`, so deleting customer users empties the
customer part. The remaining rows are staff-owned and should also go.

| Table | Why it is customer/demo data | FK cascade |
| --- | --- | --- |
| `event_registration` | A seat somebody took | Customer rows only |
| `event_bookmark` | Somebody saved an event | Customer rows only |
| `event_notification_preference` | Per-person notification choices | Customer rows only |
| `event_draft` | A half-written event | Customer rows only |
| `organizer_follow` | Somebody followed an organizer | Customer rows only |
| `expert_booking` | A consultation from intake to outcome | Customer rows only. `purchase_id` is `SET NULL` |
| `academy_progress` | Learning progress, one row per person | Customer rows only |
| `saved_object` | The cross-section save | Customer rows only |
| `collection`, `collection_item` | Saved-object collections | Cascade from `collection` and `saved_object`, so customer rows go; staff rows remain |
| `alert` | Watch conditions somebody set | Customer rows only. `saved_object_id` is `SET NULL` |
| `purchase` | Entitlements granted, all currently `demo` | Customer rows only |
| `subscription` | Billing history | Customer rows only |
| `wealth_asset`, `wealth_liability`, `wealth_goal` | Somebody's own money record | Customer rows only |
| `chart_layout`, `chart_script` | Saved Superchart workspaces and Script Lab documents | Customer rows only |
| `voyager_workspace`, `voyager_file`, `voyager_memory` | Saved Voyager libraries, uploaded context, remembered facts | Customer rows only |
| `profile`, `preference` | Investor profile and settings | Customer rows only |
| `activity` | The product activity feed | Customer rows only |
| `consent` | Consent grants | Customer rows only. See REVIEW — deleting a *live* customer's consent record would be wrong; deleting it *with* the account is the erasure it is there to support |
| `voyager_usage` | Daily question counters. `subject` is `user:<id>` or `anon:<hmac>`, with **no FK** | **None.** Must be deleted explicitly. Rows for deleted customers would otherwise linger until the day rolled over |
| `event_metric` | Per-event daily counters. Only `external_click` is ever written | **None from `user`** — cascades only from `event`, which is preserved. Must be deleted explicitly |

### Denormalised counters — the trap

Two columns are maintained in step with rows that this reset deletes, and
**nothing decrements them on delete**:

| Counter | Kept in step with | If not reset |
| --- | --- | --- |
| `event.registration_count` | `event_registration` rows holding a seat | The Observatory's `seatCounterDelta` publishes the difference as a data-health finding. A naive reset makes it read minus every registration that ever existed |
| `event.waitlist_count` | waitlisted `event_registration` rows | Capacity maths on a live event stays wrong |
| `organizer.follower_count` | `organizer_follow` rows | Organizer profiles claim followers who no longer exist |

The reset must set all three to `0` in the same transaction as the deletes.
This is the single most likely way for the reset to look successful and leave a
red card on the dashboard.

---

## REVIEW — inspect before deciding

| Table | The question | Recommendation |
| --- | --- | --- |
| `data_access_log` | It is a compliance audit log, append-only by convention, and the app has no delete path. But it cascades from `user`, so deleting a customer *does* delete their entries | Let the cascade run — an audit trail of a person's financial data is theirs, and erasing the account should erase it. **Confirm with the owner** that no retention obligation applies to a demo deployment before doing so. Staff-owned rows: keep |
| `consent` | Consent records are versioned evidence that somebody agreed to something. Deleting them for a *live* account would be wrong | Correct to delete *with* the account. Do not delete consent rows independently of the user they belong to |
| `event_report` | A report is a customer action, but it is also moderation history about preserved product inventory. `reporter_id` is `SET NULL`, so the report survives the reporter | **Decide.** Preserving keeps the moderation record honest; deleting removes a customer action. No Observatory metric reads this table, so either choice is invisible to the dashboard |
| `email_outbox` | Delivery previews holding recipient addresses and live single-use action tokens. No FK to anything | **Delete.** It holds customer email addresses and valid tokens for accounts that will no longer exist. It is not product inventory |
| `event` where `status = 'draft'` and the author was a customer | A draft by a deleted customer becomes an orphan draft with `created_by = NULL` | Decide: keep as inventory, or delete drafts whose author was a customer. Published events must be kept either way |
| `organizer` with `user_id` pointing at a customer | After the cascade its `user_id` is `NULL`, and it may have published events | Keep. `RESTRICT` on `event.organizer_id` means it cannot be deleted while events reference it, and an organizer with events is inventory |
| `verification` | Also used for staff password resets in flight | Deleting is safe; the worst case is a staff reset link stopping working and needing to be re-requested |

---

## Suggested order

Foreign keys make most of this automatic, but the order still matters for the
tables with no foreign key and for the counters.

1. `DELETE FROM product_telemetry_event`
2. Delete the non-cascading customer tables: `voyager_usage`, `event_metric`,
   `email_outbox`, `verification`
3. Delete the staff-owned rows of every durable-activity table listed under
   RESET (they will not cascade)
4. `DELETE FROM "user" WHERE role = 'user'` — this cascades through everything
   else
5. `UPDATE event SET registration_count = 0, waitlist_count = 0`
6. `UPDATE organizer SET follower_count = 0`
7. Verify: `SELECT role, count(*) FROM "user" GROUP BY role` returns only
   `admin` and/or `moderator`

All of it in one transaction. Take a database snapshot first — this is
irreversible and there is no soft-delete anywhere in this schema.

---

## Expected result on the Observatory

**Zero, and correctly zero:**

Registered users · New registrations · customer plan distribution (empty) ·
`entitledUsers` · event registrations, registered/waitlisted/cancelled/attended/
no-show, people registered, events with registrations · expert bookings ·
Academy learners and progress · saves and collections · purchases and
subscriptions · Wealth holders · telemetry events collected.

**Not zero — correctly absent, which is a different card:**

- PMCR, internal and external continuation → no eligible denominator,
  *insufficient sample*
- Second meaningful action → *insufficient sample*
- TTFA median/p75/p90 → no usable sample
- Authenticated retention D1/D7/D30 → no mature customer cohort
- Start funnel and the Events funnel → no customer activity
- Voyager metrics → back to `not_measurable` naming the missing emitter, since
  the "has it ever run" probe finds nothing once telemetry is cleared
- Anonymous return → `not_measurable`, unchanged and untouched
- Confirmed revenue → `Source not connected`, unchanged
- Web Vitals, runtime failures, Supercharts → below sample threshold

**Legitimately non-zero, and must not be forced down:**

Published events · total events · organizers · market provider configuration ·
the delayed-data policy · source status and freshness · feature availability ·
instrumentation coverage · declared event count · every catalogue that lives in
code rather than in the database.

A dashboard where every card reads `0` would be a broken dashboard, not a clean
one. The correct-absence states are the evidence that the reset removed
customers rather than removing the product.
