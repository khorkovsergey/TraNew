# Phase 2 — global portal observability, as built

The measurement layer that answers one question: **does a visit turn into
product value, and does that value bring anybody back?**

Branch `feat/metrics`, based on `main` at `c14efb4`. Phase 0 and Phase 1 stay as
written; this describes what was added, and — more usefully — what still cannot
be known.

## The eligible session

Everything here rests on one population, defined once in
[`eligibility.ts`](../../src/lib/admin-metrics/eligibility.ts) and used by every
metric. A denominator that drifts between endpoints is worse than one that is
wrong, because two panels then disagree and nobody can tell which is lying.

A session is **eligible** when it rendered a page, on a live landing surface the
catalogue marks as eligible, and either stayed three seconds with the tab
visible or did something meaningful.

Excluded, each with a named reason that is reported rather than absorbed:

| Reason | What it is |
| --- | --- |
| `automated` | Crawlers and monitors. Dropped at ingest as well. |
| `observatory` | Us. Our own smoke test is not product usage. |
| `auth_plumbing` | Sign-in, sign-up, password reset — steps in somebody else's flow. |
| `not_a_landing_surface` | Signed-in housekeeping; not a visit whose continuation means anything. |
| `unknown_surface` | A route the catalogue does not recognise. |
| `surface_not_live` | The landing surface is behind a flag that is off. |
| `no_page_view` | Telemetry exists but nothing rendered. |
| `below_engagement_threshold` | A bounce. No product change could have improved it. |

The three-second floor is the design handoff's own PMCR definition, adopted in
the Phase 0 review and now actually applied — `portal_engagement_checkpoint`
was emitted in Phase 1 and unused until here. A session that acted inside three
seconds passes anyway: acting is stronger evidence of engagement than a timer,
and excluding somebody for succeeding too quickly would be absurd.

**This is visible in production already.** The first live query returned five
sessions excluded as `observatory` — the deploy smoke's own visits — against one
eligible session. Without the exclusion the portal's headline metric would have
been a measurement of us.

## Which clock

**`occurred_at` orders events inside a session; `received_at` dates cohorts.**

`received_at` cannot order events within a session: the transport batches, so
twenty events from one page arrive in one request stamped within a millisecond
of each other. Ordering by it would make TTFA a measurement of the flush
interval.

`occurred_at` is the client's clock and is not trusted absolutely — ingest
refuses anything more than a minute ahead or six hours old. But every duration
here is a difference between two stamps from the *same* client, so a machine
whose clock is an hour out still reports its own intervals correctly. A constant
offset cancels. What it cannot do is compare across clients, which is why
retention uses `received_at` and the server clock.

Negative intervals are clamped to zero. A clock that moved backwards is not
evidence that an action preceded the session it belongs to, and dropping those
sessions would bias the population toward people with well-behaved computers.

## The four metrics

### PMCR

```
eligible sessions with ≥1 meaningful action
-------------------------------------------
eligible sessions
```

Decomposed into `internal` and `external` over **the same denominator**, so the
three can be read against each other without arithmetic. An external
continuation — a TradingView handoff, an event's organiser link — counts in the
headline because it is continuation, and is shown apart because a session that
left is not a session that stayed.

That last point was a real correction during this phase: the external events
were marked `continuation: 'external'` but not `meaningful`, so they counted as
nothing at all. The tests caught it.

A meaningful action is one the registry declares meaningful, deduplicated by
identity. A page view is not one. A navigation is not one. A click is not one.
The rate is allowed to be low.

### TTFA

Median, p75 and p90 of (first meaningful action − session start), in seconds,
over eligible sessions **that had one**. Percentiles are nearest-rank, so every
reported figure is a duration somebody actually had rather than an interpolation
between two people.

Sessions with no action stay in the PMCR denominator and receive no TTFA value.
Imputing one would let the metric improve by losing people. How many were left
out is returned beside it.

### Second meaningful action

```
eligible sessions with ≥2 meaningful actions
--------------------------------------------
eligible sessions with ≥1
```

The same taxonomy and the same deduplication as PMCR. There is deliberately no
second definition of "action" — two definitions eventually disagree, and the
disagreement looks like a finding.

### Authenticated D1 / D7 / D30

Grouped by the HMAC-derived user key. **Cumulative windows, not anniversaries**:
DN is the share of a cohort that came back at least once on a day in `[1, N]`.
Asking whether somebody appeared exactly seven days later measures how weekly
their habits are, not whether they returned, and it moves with the day of the
week the cohort started on. Because the windows are cumulative, D1 ≤ D7 ≤ D30
always.

**Cohort start is the user's first *eligible portal day*** — a UTC day on which
they viewed a page on a real customer surface. Not their first telemetry row,
not a server or operational event, not an Observatory visit, not sign-in
plumbing. A user with no eligible portal day is not in the population at all:
they have not started a cohort, so they can be neither retained nor lost from
one.

**A return day is a page view on a real customer surface.** No quantity of
server or operational telemetry can create one.

**A meaningful return requires a return.** A meaningful action on a day with no
portal visit counts as neither primary nor meaningful retention — the person was
not there.

A cohort is only counted once the window has actually elapsed *and* telemetry
existed for the whole of it. A cohort formed yesterday has not failed D7; it has
not had the chance. Immature cohorts are reported, never counted as churn.

**Anonymous retention remains `not_measurable`**, with the reason and the remedy
on the card. Nothing in this phase reopened that.

#### Why retention-day eligibility is not PMCR eligibility

Deliberately different, in one direction only.

It **keeps** `account` and `wealth`. PMCR excludes them because they are not
landings — signed-in housekeeping is not a visit whose continuation means
anything. Retention asks the opposite question, and somebody returning to look
at their own account has plainly returned. Excluding them would understate
retention for exactly the people most attached to the product.

It **drops** the three-second engagement floor. A person who came back, acted
immediately and left has come back; requiring them to linger first would measure
patience.

It **keeps every exclusion that matters**: the Observatory, auth plumbing and the
backbone bucket are not customer visits under either rule.

#### Three defects this phase shipped and then fixed

Recorded because two of them were invisible from the outside and the third was
the reason to look.

1. **Cohort start was the first telemetry row of any kind.** A user with a server
   event on Monday and a first visit on Tuesday was dated to Monday and then
   measured as having failed to return on a day they had not yet arrived — churn
   invented out of bookkeeping.
2. **A meaningful action could count as a retained return on its own.** The
   invariant `meaningful return ⇒ eligible return ∧ meaningful action` was not
   enforced.
3. **The Observatory was never actually excluded from retention.** The predicate
   tested `surface <> 'observatory'`, and ingest stamps `surface` from the
   *event's registry entry* — `portal_page_viewed` is registered under `portal`,
   so every page view row carries `surface = 'portal'` whatever page it
   described. The condition was one no row had ever met. The real page is in
   `properties.area`, and the predicate reads that now.

   The consequence was live: the only authenticated user in production had nine
   Observatory page views and no customer visit at all, and counted as a
   returning customer. Under the corrected rule they are absent from the
   population, which is right.

## Deduplication

Repeating an action does not always create value, and the registry now says
which. `event_saved` on the same event twice is one save; toggling one study on
and off is one study interaction. `voyager_question_sent` is marked
`repeatable`, because a second question genuinely is a second question and its
payload — shapes and counts only — cannot tell two questions apart.

This is what stops a component that emits on every render, a double-click, or a
retried batch from inflating continuation.

## Navigation

`onRouterTransitionStart` now takes the URL Next hands it instead of reading
`location` from a zero-delay timeout, which was racing the router. A transition
to a route already recorded emits nothing.

**A full page load does not reach the hook at all** — it re-runs the whole
instrumentation module, which emits its own session start and page view. That
asymmetry is correct and deliberate: making a reload look like a client-side
transition would invent a navigation the product never performed. The production
smoke that noticed `portal_navigation_completed` missing on a hard navigation
was watching this work as intended.

No combination of navigation signals can manufacture continuation, because none
of the four backbone events is meaningful. A click that fires a navigation, a
page view and a feature event produces exactly one action.

## Journeys

Aggregate breakdowns by landing surface, acquisition, auth state, entitlement,
device, first action and first continuation surface, plus the internal/external
split and the exclusion counts.

Every breakdown suppresses the rate below 25 sessions and shows the count
instead. Sliced far enough — surface by entitlement by acquisition — a breakdown
describes one person, and the threshold is where that is stopped. Nothing in the
payload can name a session; a live check asserts it.

## What is measurable, and what is not

**Measurable now, with real history:** registered users, new registrations. From
the application tables.

**Instrumented going forward** — collecting, no history before the Phase 1
deployment: PMCR and its decomposition, TTFA, second action rate, sessions,
eligible sessions, all journey breakdowns.

**Structurally unavailable:**

| | State | Why |
| --- | --- | --- |
| Anonymous D1/D7/D30 | `not_measurable` | No cross-session anonymous identity, and none was invented. |
| Confirmed revenue | `source_not_connected` | No payment provider. |
| Alert adoption | `feature_disabled` | Flag is off; a zero would be false. |
| Voyager server truth | not instrumented | Call sites belong to the Voyager section. |

**Awaiting volume, not broken:** every rate currently returns
`insufficient_sample` because there is one eligible session. That is the correct
state, not a defect — a percentage over one session would be the exact failure
this dashboard exists to prevent.

## Instrumentation coverage

Coverage now answers "can this number be trusted" per KPI, not just "which
events exist". Each metric declares the events it genuinely needs and gets a
verdict: `trustworthy`, `partial` (an input is behind a flag that is off),
`awaiting_data` (declared, reachable, nothing yet), or `not_instrumented` (an
input is not declared at all — the metric cannot be computed).

Meaningful events are deliberately *not* listed as required inputs. A portal
where nobody continues is a finding, not a measurement failure.

## Query shape and its limit

Session metrics fetch a narrow projection — the backbone plus meaningful events,
named columns only, bounded by the range cap — and reduce in one tested place.
Retention never leaves the database: it is a plain group-by.

The projection is capped at 200,000 rows. **When the cap is hit every rate
becomes `not_measurable` and says so**, rather than being computed over whatever
fitted: a truncated denominator is a wrong denominator. Raising the cap is not
the fix; pushing the session aggregation into SQL is, and that is in the backlog
rather than pretended at.

No new index was requested. The existing six cover what these queries do —
`telemetry_occurred_idx` for the range scan, `telemetry_name_occurred_idx` for
the event filter, `telemetry_received_idx` for the retention group-by. Asking
for indexes that might be useful someday would be guessing.

## Tests

`node scripts/verify-admin-metrics.mjs` — **124 checks, writes nothing.**
`--live` — **146 checks**, real app and real database, explicit and announced.

The metric formulas are tested with fixtures rather than live data. A formula
only ever checked against whatever happened to be in the database is not checked
at all: the interesting cases — a bounce, a duplicate, a clock that went
backwards, a cohort too young to have returned — are exactly the ones production
has not produced yet.

## Known gaps

- **Voyager server instrumentation is still deferred.** Unchanged from Phase 1.
- **The seven Start orphans are still orphaned.** `check:analytics` exits 1 on
  the same seven and nothing else.
- **Feature-local value is invisible where the owning section emits nothing.**
  Compare use, explore class opens and lesson completion are examples; they are
  requests in `current-state.md` §9d, not workarounds here.
- **PMCR's landing surface comes from the first page view's `area`.** A session
  whose first page view was lost to a dropped batch lands as `unknown` and is
  excluded. Rare, bounded, and reported in the exclusion breakdown.
