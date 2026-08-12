# Internal traffic — what the Observatory can and cannot exclude

The Observatory answers questions about a customer base. Until now it was
answering them about a population that included the people who build the
product. This document states the rule that fixed it, where the rule reaches,
and — the part that matters more — where it does not.

Companion document: [`customer-reset-inventory.md`](customer-reset-inventory.md),
which is the table-by-table plan for the later production reset.

---

## 1. The rule

> **Only `user.role = 'user'` is a customer.**

`role` is `user | moderator | admin`. The schema is explicit that it is staff
authority and is separate from `plan`, which is what somebody bought — paying
for Private must not confer the ability to approve an event, and being an
administrator must not look like somebody choosing a tier.

Everything below is that one predicate, applied in two different places.

**The rule is never an identity.** No email, no user id, no account name
appears in any query, in any test, or in the reset plan. An address would be
wrong the first time a second person joined the team, it would need changing
again when they left, and it would put a real identity into a query layer that
three phases of work have kept free of them. `src/lib/admin-metrics/internalTraffic.ts`
is the only place that defines who a customer is, and it says `role`.

---

## 2. Customer accounts — the durable side

Two predicates, one rule.

- **`customerAccounts()`** — `eq(user.role, 'user')`. Scopes a read *of* `user`.
- **`ownedByCustomer(userIdColumn)`** — a semi-join, `exists (select 1 from
  "user" where "user"."id" = <owner> and "user"."role" = 'user')`. Scopes a read
  of the things a person *did*: a registration, a booking, a save, a purchase,
  an asset.

The second exists because the first is not enough. The owner is going to keep
demonstrating the portal while signed in as an administrator, and every
demonstration writes durable rows — a seat, an `academy_progress` row, a demo
purchase. Without the ownership predicate those rows are customer adoption
forever, and the reset would only postpone the problem by one day.

`ownedByCustomer` is a semi-join rather than a fetched id list: it composes into
the aggregate the query already runs, nothing is loaded, and `user.id` is the
primary key so the inner side is a lookup. It is written as *owned by a
customer* rather than *not owned by staff* deliberately — the two differ for a
row whose owner has gone, and a customer metric that silently adopted orphans
would be the wrong way round.

### Reads of `user`

`customerAccounts()` is applied to every query that counts people:

| Query | File | Was | Is |
| --- | --- | --- | --- |
| Registered users (headline) | `overview.ts` | every row in `user` | `role = 'user'` |
| New registrations (headline) | `overview.ts` | every row created in the window | `role = 'user'` and in the window |
| `accounts.registeredUsers` | `families/accounts.ts` | every row | `role = 'user'` |
| `accounts.verifiedUsers` | `families/accounts.ts` | every verified row | `role = 'user'` and verified |
| `accounts.newRegistrations` | `families/accounts.ts` | every row in the window | `role = 'user'` and in the window |
| `accounts.registrationsPerDay` | `families/accounts.ts` | every row per day | `role = 'user'` per day |
| `accounts.freshestAt` | `families/accounts.ts` | newest account | newest **customer** account |
| `commerce.entitlement` distribution | `families/commerce.ts` | `user.plan` over every row | `user.plan` over `role = 'user'` |
| `commerce.entitledUsers` | `families/commerce.ts` | sum of that distribution | sum of the customer distribution |

The predicate is in the query, not subtracted afterwards. A card that showed a
real number and then adjusted it would be misrepresenting a different thing.

### Reads of what a person did

`ownedByCustomer()` is applied to every durable table `productFamilies()` reads
that hangs off `user`:

| Family | Table | Owning column | Covers |
| --- | --- | --- | --- |
| Events | `event_registration` | `user_id` | registrations, the status mix, people, events-with-registrations, the window, attendance rate, marked and unresolved seats, marking coverage |
| Academy | `academy_progress` | `user_id` | learners, new learners, path-ready, completed, with-a-lesson, asked, median lessons, completion rate, stage and mode mixes |
| Experts | `expert_booking` | `user_id` | bookings, people, the window, open pipeline, every status count, rated bookings, mean rating, bookings-with-purchase |
| Saves | `saved_object` | `user_id` | saved objects, savers, repeat savers, the window, the kind mix |
| Saves | `collection` | `user_id` | collections, owners |
| Saves | `collection_item` | *through* `collection.user_id` | items, collections with items, mean items |
| Wealth | `wealth_asset` | `user_id` | holders, current assets, superseded revisions |
| Wealth | `wealth_liability` | `user_id` | holders, records |
| Wealth | `wealth_goal` | `user_id` | holders, records |
| Wealth | `consent` | `user_id` | Voyager-context grants and revocations |
| Commerce | `purchase` | `user_id` | records, people, status and kind mixes, recorded paid gross, demo gross, provider-reconciled records, the window |
| Commerce | `subscription` | `user_id` | records, people, active, cancelled, status and plan mixes |

`collection_item` is the one that needed a decision. It carries no `user_id` —
it joins a collection to a saved object — so its owner is resolved **through the
collection**, not through the saved object. The two need not be the same person,
and the honest owner of an item is whoever owns the collection it sits in.

### What is deliberately left measuring everything

| Query | Classification | Why |
| --- | --- | --- |
| `event` — published and total | **product inventory** | How many events exist is a fact about the catalogue. A staff-created event is still an event somebody can attend. |
| `event.registration_count` and its all-account row population | **operational integrity** | The counter is physical — a staff seat occupies capacity like any other. See §2a. |
| `access.ts` role read | operational | Access control. It is *supposed* to single out `admin`. |
| `overview.telemetryEvents` | system | Instrumentation volume, not customer behaviour. |
| `coverage.ts` declared-vs-observed | system | A staff event still proves an emitter runs, which is the only thing this asks. |
| `reliability` Web Vitals, runtime failures, and their page-view denominator | system health | Does the portal work. A crash on a staff machine is the same defect as anybody else's, and excluding those samples would make the product look healthier the more of it we used ourselves. |
| `reliability` market data, provider configuration, source freshness | system | Operational, and unattributable anyway. |
| `retention` route bounds (`min(received_at)`) | system | When collection started. A date, not a person. |
| `voyager` "has the emitter ever run" probe | system | An instrumentation question. Filtering it would report a missing emitter that is in fact running. |
| `overview.alertAdoption` | not a query | Alerts are behind a flag and no `alert` table read exists; the card is `feature_disabled` or a declared zero. If an alert query is ever written it is customer adoption and needs `ownedByCustomer(alert.userId)`. |

Nothing was blanket-filtered, and nothing that is genuinely about the system or
the catalogue was narrowed.

### 2a. Events: two populations that must not be subtracted

`event.registration_count` is a denormalised counter the Events section
maintains in step with the rows — +1 on registration, −1 on cancellation, +1 on
promotion from the waitlist. It counts **every** seat, and it should: capacity is
physical, and a staff member holding a seat occupies it exactly as anybody else
does.

Once staff registrations leave the customer metrics, comparing that counter
against the customer row population would report a discrepancy of precisely the
number of staff registrations — every day, forever. An integrity alarm firing
because the filter works is worse than no alarm at all.

So the family reads `event_registration` twice and keeps the two apart:

| | Population | Presented as |
| --- | --- | --- |
| `registrations`, the status mix, `peopleRegistered`, `eventsWithRegistrations`, `registrationsInWindow`, `attendanceRate`, `attendanceMarkedSeats`, `attendanceUnresolvedSeats`, `attendanceMarkingCoverage` | customer-owned rows | customer adoption |
| `operationalSeatCounterDelta`, `operationalSeatsAllAccounts` | **all** rows | operational integrity |

Both operational keys carry `operational` in the name, because the Observatory
renders a family's metric keys as its labels — so the word has to be in the key
to reach a reader. Their provenance string says `all accounts, operational` too.

The same rule governs commerce: `providerReconciledRecords` counts `externalRef`
*within the customer population*, and there is no all-account provider total
anywhere to subtract it from. If one ever arrives, it must be compared against
an all-account count, exactly as the seat counter is.

---

## 3. Internal telemetry — the query-side exclusion

### Why it works without touching an emitter, a column or a migration

`product_telemetry_event` stores `user_key_hash`: an HMAC of the application
user id, derived server-side by `pseudonymousUserKey(userId)`, and the table has
**no foreign key to `user`** on purpose — the pseudonym is not an id, and a
cascade would either fail to match or force the real id into the table.

That property is used rather than broken. `staffAnalyticsKeys()` reads the ids
of accounts whose role is not `user`, hashes them with the *same* function the
ingest route uses, and returns the keys. Hashes are compared against hashes.

- No raw user id is written to `product_telemetry_event`.
- No raw user id reaches an Observatory payload — the ids never leave the
  function that hashes them.
- No email is used anywhere.
- No new identity, no new lifetime, no new column, no migration.
- No emitter changed, so nothing about what the browser sends moved.

### Two shapes of exclusion, and why there are two

**By session** — `notStaffSession(keys)`, a correlated `NOT EXISTS`: a session
is dropped if *any* event in it was ever attributed to staff.

Session metrics are reduced per session. Filtering events instead would leave an
administrator's session stripped of its authenticated rows but still holding its
landing page view — and that half-session would be reduced into a visit with a
landing surface, no meaningful action, and a place in the PMCR denominator. A
fictional failed session is worse than an included real one.

**By event** — `notStaffEvent(keys)` (keeps unattributed rows) and
`customerKeyOnly(keys)` (for queries that already require a key). Used where a
row is a complete interaction on its own: a Voyager request, a retention day.

Unattributed rows are kept, never dropped. An event with no key is anonymous or
operational; discarding it would silently shrink every denominator it belongs
to, which is a much worse error than including traffic that might be ours.

### Where it is applied

| Reader | Feeds | Exclusion |
| --- | --- | --- |
| `readSessions` | sessions, eligible sessions, PMCR + internal/external, TTFA, sessions without action, second action, journeys, acquisition/device/auth/entitlement breakdowns, exclusion breakdown | by session |
| `readFunnelEvents` | Start funnel, Events behavioural funnel | by session |
| `readUserDays` | authenticated cohort retention, cohort grid | by event (key required) |
| `voyagerReport` window read | every Voyager customer-usage metric | by event |
| `reliabilityReport` Supercharts subset | Supercharts customer usage | by session, in memory |

The Voyager "has this emitter ever run" probe is **not** filtered, deliberately.
It asks whether the instrumentation exists, not whether anybody used it. A staff
request is perfectly good evidence that the wiring works, and filtering it would
put the card back to `not_measurable` — reporting a missing emitter that is in
fact running.

### Cost

One extra query per report (`select id from "user" where role <> 'user'`), over
a table with a handful of rows, returning a handful of 34-character strings. The
session predicate is an anti-join against `telemetry_user_occurred_idx`.

When there are no staff accounts at all, every helper returns `undefined` and
Drizzle's `and()` drops it — the queries are byte-identical to what they were.

---

## 4. Attribution matrix

Per Observatory family: can internal traffic be excluded from it?

**A — reliably excludable.** Authenticated user or session attribution exists.

| Family / metric | Mechanism |
| --- | --- |
| Registered users, new registrations | `role = 'user'` on `user` |
| Verified users, registrations-per-day trend | `role = 'user'` on `user` |
| Customer entitlement distribution, `entitledUsers` | `role = 'user'` on `user` |
| Every durable Events figure (registrations, status mix, people, events, window, attendance) | `ownedByCustomer(event_registration.user_id)` |
| Every durable Academy figure (learners, stages, modes, completion) | `ownedByCustomer(academy_progress.user_id)` |
| Every durable Experts figure (bookings, pipeline, ratings) | `ownedByCustomer(expert_booking.user_id)` |
| Saves, savers, repeat savers, kind mix, collections, collection items | `ownedByCustomer` on `saved_object` / `collection`, and through the collection for items |
| Wealth holders and records, Voyager-context consent | `ownedByCustomer` on each wealth table and `consent` |
| Purchases, subscriptions and every distribution over them | `ownedByCustomer` on `purchase` / `subscription` |
| Authenticated cohort retention (D1/D7/D30), cohort grid | staff keys excluded per event |

**B — partially excludable.** Some events carry attribution, some do not, and
what is left over is anonymous traffic that is indistinguishable from a
customer's by design.

| Family / metric | What is excluded | What is not |
| --- | --- | --- |
| Sessions, eligible sessions | sessions that were ever signed in as staff | a signed-out session |
| PMCR (overall, internal, external) | as above | as above |
| TTFA (median, p75, p90, sessions without action) | as above | as above |
| Second meaningful action | as above | as above |
| Journeys — acquisition, device, auth state, entitlement, landing surface | as above | as above |
| Start funnel | as above | as above |
| Events behavioural funnel | as above | as above |
| Voyager customer usage — requests, outcomes, quota, latency, tools, capability mix | requests made while signed in as staff | a signed-out Voyager question |
| Supercharts customer usage — opens, study intent, rendered studies, drawings, layouts, scripts | sessions ever signed in as staff | a signed-out charting session |
| Anonymous return (D7) | — | already `not_measurable`, and stays exactly as it was |

**C — not attributable.** The event carries no customer or staff identity, by
design, and no filter can be honestly claimed.

| Family / metric | Why |
| --- | --- |
| Published events, total events | Product inventory. Not traffic at all. |
| `operationalSeatCounterDelta`, `operationalSeatsAllAccounts` | Operational integrity, all accounts by design — see §2a. |
| Market data resolutions — requests, successes, no-data, provider errors, freshness buckets, volume | `market_data_request_completed` is an operational server event. It has no session and no user, and it should not gain one. |
| Market provider configuration, delayed-data policy | Runtime configuration. Nobody's traffic. |
| Web Vitals, runtime failure counts and their page-view denominator | Attributable in principle; deliberately **not** excluded — see §2. Included here so the distinction is on the record. |
| Instrumentation coverage, event declarations, source status/freshness | System facts about collection. |
| Telemetry event volume, collection start date | System facts about collection. |
| Confirmed revenue | `source_not_connected`. There is no source to filter. |

---

## 5. What this cannot do

**A signed-out administrator is indistinguishable from a customer.** There is no
cross-session anonymous identity in this portal, and there is deliberately not
going to be one. Browsing the product while signed out produces sessions, page
views, funnel steps and possibly Voyager questions that will be counted as
customer activity, and no query can tell otherwise.

None of the things that *would* make it possible are acceptable, and none of
them were added:

- no persistent anonymous tracking cookie
- no IP matching
- no user-agent or browser fingerprint
- no `localStorage` identity
- no hidden query parameter or internal-traffic flag
- no symbol, query or user identifier added to an operational event

The mitigation is a workflow, not a mechanism: **demo and administer the portal
while signed in to the admin account.** Then every attributable family in
section A and B excludes it automatically.

The second limitation is narrower and worth stating: exclusion is evaluated at
*read* time against the roles as they are *now*. Someone promoted to `admin`
today has their entire past telemetry excluded retroactively, and someone
demoted to `user` has theirs reappear. For this portal that is the desirable
direction — it means the owner's whole history drops out the moment the account
is marked admin, with no backfill and no migration.
