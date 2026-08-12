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

`customerAccounts()` is `eq(user.role, 'user')`. It is applied to every query
that counts people:

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

### What was deliberately left measuring everything

| Query | Why it is not filtered |
| --- | --- |
| `commerce` purchases — records, people, status/kind mix, amounts, reconciliation | Money records, not a population. A row exists because something was recorded against an account; dropping some would stop these counts reconciling with the table they name. A staff entitlement is a `demo` row and the status distribution already says so. |
| `commerce` subscriptions — records, people, status/plan mix | Same. Billing history is an audit surface. |
| `access.ts` role read | Access control. It is *supposed* to single out `admin`. |
| `overview.telemetryEvents` | Instrumentation volume — a system fact about collection, not customer behaviour. |
| `coverage.ts` declared-vs-observed | Instrumentation coverage. A staff event still proves an emitter runs, which is the only thing this asks. |
| `reliability` Web Vitals, runtime failures, and their page-view denominator | "Does the portal work". A crash on a staff machine is the same defect as anybody else's, and excluding those samples would make the product look healthier the more of it we used ourselves. |
| `retention` route bounds (`min(received_at)`) | When collection started. A date, not a person. |

Nothing was blanket-filtered. Each of the above is a query that is deliberately
about all traffic or about the system rather than about customers.

### Not filtered, and why it does not need to be

`events`, `academy`, `experts`, `saves` and `wealth` read tables that hang off
`user` by foreign key and never join `user` itself, so a staff row is
indistinguishable there today. They are not filtered, because the reset plan
clears those tables **entirely** — they are customer/demo behavioural facts, and
after the reset the only rows in them would be the owner's own demo activity,
which is exactly what the reset removes. See the inventory document. If that
decision changes and staff-owned rows are kept, these five families need the
same treatment as `accounts`, and the handoff says so.

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
