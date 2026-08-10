# Product Observatory — Phase 0 audit of current `main`

Audited from the `metrics` worktree, branch `feat/metrics`, HEAD
`539620e1079f3e661a82606d32135d73cd33d478`, which is `origin/main` at the time
of writing. Everything below was read out of the repository at that commit. Where
a fact cannot be known from the repository — anything that depends on a runtime
environment variable — it is marked as such rather than guessed.

Nothing in this document is implemented yet. Phase 0 is the gate: it exists so
the schema request to the orchestrator is exact, and so no dashboard card is
built on a number the portal cannot actually produce.

## 0. The one finding that changes the plan

**`npm run check:analytics` is red on `main`, and was already red before this
section existed.**

```
59 events declared
7 declared but never emitted:
  diagnostic_completed, plan_generated, plan_step_started, plan_step_completed,
  save_prompt_viewed, registration_completed_from_plan, plan_resumed
```

Exit code 1. These seven are the old plan/diagnostic funnel, replaced by the
`/start` router. Their emitters were removed with the funnel; the union members
in `src/lib/events/analytics.ts` stayed.

This matters three ways:

1. Acceptance criterion 22 asks for `check:analytics` green. It cannot be made
   green by this section: the fix is deleting seven members from
   `src/lib/events/analytics.ts`, which is a `shared` file under an append-only
   protocol whose third rule is *never delete another section's entry*. See
   §9 for the exact request.
2. `sections.json` records a `lintBaseline` but says nothing about this gate
   being red. Anyone who runs the tn-flow pre-commit checks will meet it and
   have no way to know it is pre-existing. It should be written down.
3. **The checker can be silently defeated by this section's own work.**
   `scripts/check-analytics.mjs` decides an event has a caller by testing
   whether the literal `'event_name'` appears anywhere under `src/` outside
   `analytics.ts`. A telemetry registry that lists event names as string
   literals — exactly what §6 of the brief asks for — would make all seven
   orphans look emitted and turn the gate green while nothing emits them.
   Any registry this section builds must be excluded from the caller scan, or
   the check extended to distinguish *emitted* from *mentioned*. This is a real
   trap, not a hypothetical: the registry file is the natural place to put every
   event name in the product.

## 1. Verified repository state

| Fact | Value |
| --- | --- |
| Branch | `feat/metrics` |
| HEAD | `539620e` (= `origin/main`) |
| Port | 3414 |
| Next.js | `^16.2.12` |
| React | `^19.2.8` |
| drizzle-orm | `^0.45.2` |
| Locales | `['en']` only — `localePrefix: 'always'` |
| Target route | `/en/admin_admin_metrics` (name is intentional, not renamed) |

Files the brief named that **do not exist**, and are this section's to create:
`src/instrumentation.ts`, `src/instrumentation-client.ts`. Everything else it
named exists.

## 2. Analytics today

`src/lib/events/analytics.ts` is a typed union of 59 events with `AnalyticsSink`,
`setAnalyticsSink`, `track` and a `LocalSink` that prints in development and is
**silent in production**. `setAnalyticsSink` has no caller anywhere.

Therefore: **the portal collects nothing today.** Every existing `track()` call
is a fire-and-forget into a no-op. There is no historical telemetry to query, no
backfill is possible, and every event-derived metric starts at zero on the day
the sink is connected. The dashboard must say so — an event-derived metric on
day one is `instrumented_going_forward`, not `live` with a small sample.

52 of the 59 events have emitters, in 18 files. All emitters are client
components; there is no server-side tracking path at all.

## 3. Active vs legacy telemetry map

### Legacy — declared, no emitter, must not appear in any current KPI

`diagnostic_completed`, `plan_generated`, `plan_step_started`,
`plan_step_completed`, `save_prompt_viewed`, `registration_completed_from_plan`,
`plan_resumed`.

### The one the brief gets wrong

The brief lists `intent_selected` in the legacy plan-funnel family. **It is
not legacy.** Its only emitter is `src/components/home/IntentCards.tsx` — the
five intent cards on the current Home. It is an active Home event that happens
to share a name with the retired funnel.

Classifying it as legacy would delete a real Home continuation signal from the
dashboard. It is classified **active, surface = home** here, and the audit
recommends it be renamed by the `home` section later so the collision stops
misleading readers. That rename is a cross-section request (§9), not something
this section does.

### Active families

| Family | Events | Emitting files |
| --- | --- | --- |
| Events | 16 | 8 components under `src/components/events/` |
| Voyager chat | 13 | `voyager/chat/VoyagerChat.tsx`, `voyager/workspace/`, `voyager/AskEntry.ts` |
| Superchart | 11 | `superchart/SuperchartWorkspace.tsx`, `ScriptLab.tsx`, `VoyagerChartPanel.tsx` |
| Start / next step | 7 | `start/NextStepRouter.tsx` |
| Experts | 3 | `marketplace/ExpertConsultation.tsx`, `ExpertGrid.tsx`, `ProfileSidebar.tsx` |
| Home | 1 | `home/IntentCards.tsx` (`intent_selected`) |

### Surfaces with zero instrumentation

Markets, Explore, Symbols, Research, Economy, Ideas, News, Academy/Learn,
Practice, Account, Wealth, Subscriptions, Marketplace hub, Tools & Data, Chart
Market, and every info page. There is no page-view event, no session event and
no navigation event anywhere in the product.

This is the single largest gap. It is also the one this section can close on its
own, because a global route/session backbone does not require editing any other
section's components (§7).

## 4. Coverage matrix

Classification per Override #9. "Requires new instrumentation" means this section
can build it; "requires another section" means the event has to be added by the
owning worker.

### Already measurable — durable database facts, queryable today

| Metric | Source |
| --- | --- |
| Registered users, signups per day | `user.createdAt` |
| Entitlement distribution | `user.plan` (`free` / `premium` / `ai_private`) |
| Voyager questions charged per subject per day | `voyager_usage.count` keyed `(subject, day)` |
| Saved objects, by kind | `saved_object` |
| Academy learners, stage, lessons done, completion | `academy_progress` |
| Event registrations, waitlist, cancellations, bookmarks, drafts, moderation | `event_registration`, `event_bookmark`, `event_draft`, `event_moderation` |
| Per-event daily counters | `event_metric` (`page_view`, `card_view`, `registration`, `cancellation`, `save`, `external_click`, `share`) |
| Expert booking lifecycle, ratings | `expert_booking.status`, `.rating` |
| Purchases by status and kind | `purchase.status` ∈ `paid｜pending｜refunded｜failed｜demo` |
| Subscription records | `subscription.status`, `.plan`, `.interval` |
| Chart layouts and scripts saved | `chart_layout`, `chart_script` |
| Alerts by status | `alert.status` (but see feature state, §6) |
| Wealth adoption, coarse | row counts in `wealth_asset` / `wealth_liability` / `wealth_goal` |
| Consent grants and revocations | `consent.grantedAt`, `.revokedAt`, `.kind` |
| Per-user activity feed | `activity.type` ∈ `viewed｜saved｜asked｜learned｜alert｜booking｜purchase｜wealth` |

Note `event_metric` already contains a `page_view` counter — the only page-view
measurement that exists anywhere in the portal, and only for events.

### Derivable — computable once the sink is connected, from existing events

Voyager chat funnel from `voyager_opened` → `voyager_question_sent` →
`voyager_action_clicked` → `voyager_action_confirmed` / `voyager_action_failed`;
the `/start` funnel from the seven `next_step_*` events; the Events discovery
funnel; the Superchart usage events. All of these are already emitted and are
currently thrown away.

### Requires new instrumentation this section owns

Portal session start, page view, navigation, engagement checkpoint, meaningful
action, external continuation. Web Vitals. Client error taxonomy. Server-side
Voyager truth (accepted, answered vs simulated, provider error class, latency,
tool rounds, charged vs refunded). Telemetry ingest health.

Every one of these is reachable from `src/instrumentation-client.ts`,
`src/instrumentation.ts`, an API route under `src/app/api/admin-metrics/`, or a
server helper in `src/lib/analytics/` — all inside this section's boundary.

### Requires another section — cannot be built here

See §9. Chiefly: any event whose semantic trigger is inside another section's
component and cannot be inferred from a route transition or a server call.

### Not currently measurable

| Metric | Why |
| --- | --- |
| Anonymous D1/D7/D30 retention | No cross-session anonymous identity exists and creating one is a privacy decision this section must not take alone. See §7. |
| MRR, ARPU, LTV, churn revenue | No payment provider is connected. `purchase.status = 'demo'` is an entitlement granted without money. Must render `source_not_connected`. |
| Historical anything, before sink connection | Nothing was ever stored. |
| SEO rank, impressions, Search Console | No external source connected. §45 forbids promising it. |
| Attendance / no-show for events | Schema has registration status but no attendance capture found. |
| Alert adoption | Feature is flagged off (§6). |
| Session replay, user-level behavioural inspection | Explicitly a non-goal (§45). |

## 5. Durable business-fact source map

The rule from §4/§21 of the brief, applied: **current counts come from the
application table; sequencing and funnels come from telemetry.** Registration is
the sharp case — `event_registration` rows are the truth for "how many
registrations exist", and `event_registration_completed` is the truth for "how
many happened in this funnel step". Counting both as registrations double-counts.

| Domain | Durable table | Telemetry role |
| --- | --- | --- |
| Identity, entitlement | `user` | cohort dimension only |
| Voyager quota | `voyager_usage` | funnel sequencing, outcome classes |
| Events | `event*` family | discovery, filter, share behaviour |
| Academy | `academy_progress` | start, transitions, time-to-first-action |
| Experts | `expert_booking` | intake and selection funnel |
| Money | `purchase`, `subscription` | offer interaction only, never revenue |
| Wealth | `wealth_*` row presence | consent and usage counts only |
| Charts | `chart_layout`, `chart_script` | interaction events |
| Audit | `data_access_log` | **not an analytics source** — see §7 |

## 6. Feature availability map

`src/lib/featureFlags.ts` holds exactly three flags. All are read from the
environment, so **their production values cannot be known from this
repository** — the dashboard must read them at runtime rather than assume.

| Flag | Env var | Default when unset | Effect |
| --- | --- | --- | --- |
| `superchartEnabled` | `SUPERCHART_ENABLED` | **off** (`=== 'true'`) | Superchart workspace replaced by the placeholder chart screen |
| `wealthHubEnabled` | `NEXT_PUBLIC_WEALTH_HUB` | **on** (`!== 'false'`) | Wealth Hub surface; off ⇒ menu reads "Soon", Overview becomes a waitlist card |
| `alertsEnabled` | `NEXT_PUBLIC_ALERTS` | **off** (`=== 'true'`) | Alerts hidden until a live price feed exists |

Consequences the dashboard must honour:

- **Alerts**: `alert` rows may exist while the surface is unexposed. Adoption
  renders `feature_disabled`, never `0%`. Pre-exposure days are never
  backfilled as zeros.
- **Superchart**: every Superchart metric is conditional on the flag. If the
  flag is off in production, eleven declared events are unreachable, and
  Instrumentation Coverage must report them **unexposed**, not **unused**.
  This is precisely the distinction acceptance criterion 21 asks for.
- **Wealth Hub**: on by default, so its metrics are normally live.

### Menu-derived exposure

`src/components/shell/menu.ts` has a three-chip annotation system, documented in
the file: a row is `{ kind: 'inert', soon: true }` — visible, badged "Soon", and
**not clickable** — or an ordinary link, optionally chipped `live` or `new`. A
row is never both a link and "Soon".

Nineteen inert rows were counted: seven asset classes under Markets, six
screener/symbol entries, six economy entries. Every one is a surface a naive
adoption metric would report as 0% used. They are `coming_soon`.

The menu is owned by the `shell` section. This section reads it; it does not
edit it, and it does not keep a second copy of it (§14).

## 7. Privacy and security assessment

### What the product already decided, and this section inherits

`src/lib/events/analytics.ts` states two rules in its header: nothing
identifying in a payload, and analytics must never be able to fail a
registration. The existing event shapes keep them — `queryLength` instead of the
query, `steps`/`turns`/`contextKb` instead of content, and the three
`next_step_*` step events carry no payload at all because "I already invest" is a
fact about a person's money.

The `next_step_recommendation_shown` / `_destination_clicked` events carry
`destination`, which is a product area rather than a fact about the reader. That
line — *product area travels, self-description does not* — is the rule this
section extends rather than re-derives.

### Consent model

`src/lib/consent.ts` has five kinds: `voyager_context`, `expert_sharing`,
`ai_processing`, `marketplace_terms`, `cancellation_policy`. Each is versioned
and separately revocable.

**There is no analytics or cookie consent kind, and no cookie banner.**

### Anonymous identity — the decision Override #5 asks for

The product has exactly one anonymous identifier, in
`src/lib/voyager/usage.ts`:

```
anon:<HMAC-SHA256(BETTER_AUTH_SECRET, "voyager:" + ip)>[0..32]
```

Its documented design intent is narrow: *"the limit only needs 'same visitor as
earlier today'"*. It is used only as `(subject, day)` in `voyager_usage`, it is
derived from an IP address that changes, and rotating the app secret resets every
counter — described in the file as an acceptable trade specifically because no
table of who visited from where is kept.

**Recommendation: do not create a persistent anonymous visitor cookie, and do
not reuse the quota HMAC for retention.**

Reasons, in order of weight:

1. Reusing a rate-limiting key for cross-session behavioural tracking is exactly
   the repurposing the file's comment rules out. It would convert a day-scoped
   counter into a visitor history.
2. IP-derived keys are unreliable across sessions — mobile networks, NAT,
   rotation — so the resulting D7 would be wrong as well as unreviewed.
3. A new persistent analytics cookie is a non-essential identifier with no
   consent surface to attach it to. Introducing one silently, in a product whose
   consent model is this deliberate, is a privacy decision that belongs to the
   product owner, not to the metrics worker.

Therefore, per Override #5:

- session-scoped identity only, for anonymous visitors;
- **authenticated** retention is computed honestly, from a pseudonymous user key
  derived server-side from the session;
- anonymous D1/D7/D30 returns `not_measurable`, with the reason shown;
- what would be required to enable it correctly is documented in the Metric
  Dictionary: a consent surface, a first-party analytics cookie with a stated
  lifetime, and a review of the privacy policy.

### Sources this section must not touch

`data_access_log` stores `ipAddress` and `userAgent`. It is the wealth audit
trail, and it is the one table that would make the telemetry rules trivially
violable. It is **not** an analytics source. Likewise
`requestFingerprint()` in `src/lib/session.ts` returns raw IP and raw
user-agent; the telemetry layer must never call it. Device class is derived from
a coarse bucket, not from the UA string, and no raw IP is stored.

Also excluded by existing schema design: `expert_booking.briefEnc`,
`saved_object.noteEnc`, `expert_booking.summaryEnc` and `user.dataKeyEnc` are
encrypted at rest. Nothing in this section decrypts anything.

### Access control — the Override #4 comparison

The repository already has a role system: `user.role` defaults to `'user'`, and
`src/lib/events/access.ts` defines `Role = 'user' | 'moderator' | 'admin'` with
`admin` already carrying moderation authority. **A new admin user system is
therefore neither necessary nor permitted (§45).**

| Option | Verdict |
| --- | --- |
| 1. Existing session + `role === 'admin'` | Smallest, reuses real auth, no new identity surface. Requires an admin account to exist and be signed in — no direct-link demo. |
| 2. Fragment secret → short-lived HttpOnly cookie | Gives the direct-link demo UX the brief wants. Adds a second authorization path and a shared secret. |
| 3. Some other existing mechanism | None found. Better-auth session is the only one. |

**Recommended: both, server-validated, with option 1 primary.** An admin session
is authorized outright. The fragment secret is the demo path, exchanged
server-side for a short-lived opaque cookie, and never itself stored in the
cookie. Requirements that hold either way: no nav entry, no sitemap entry,
`noindex/nofollow/noarchive`, no secret in the client bundle, no metrics data in
any response that is not authorized server-side, and **no `robots.txt` entry** —
a disallow line would publish the path.

`src/app/robots.ts` currently disallows `/api/`, which already covers
`/api/admin-metrics/`. Nothing needs to change there, and nothing may.

## 8. Proposed metric definitions

Full definitions belong in the machine-readable dictionary in
`src/lib/admin-metrics/metrics/` (§35). The four that need a decision recorded
now, because the schema depends on them:

**Portal Meaningful Continuation Rate.** Numerator: eligible sessions with ≥1
meaningful action after the landing view. Denominator: eligible sessions.
Eligible excludes bot user-agents, sessions with no page view, and internal
access (any session authorized for this dashboard). Headline PMCR counts any
meaningful continuation; `Internal PMCR` and `External continuation` are shown
beside it as decomposition, because a TradingView handoff is a product boundary
and not a failure.

**Meaningful action.** A value-producing next step, defined in a code-backed
taxonomy, never a page view and never a click on an inert row — which cannot
occur anyway, since "Soon" rows do not click. A `prepare`-execution Voyager
action that succeeds is *not* a completed end action; the action registry's
`navigate | in_place | mutate | prepare` distinction is preserved end to end.

**Time to First Meaningful Action.** Median, p75, p90 of (first meaningful
action − session start), over sessions that had one. Sessions without one are
excluded from the median and reported separately as a share, so the metric
cannot be improved by losing people.

**Retention.** Cohort by first-seen UTC date. D1/D7/D30 use a window — returned
on day *n* or later within the period, not exactly on day *n*. Authenticated
only; anonymous returns `not_measurable` per §7. Minimum cohort size enforced
before any breakdown renders.

Every metric returns a discriminated state, never a bare number, and no query
may encode "missing" as `0`.

## 9. Requests this section cannot fulfil itself

### 9a. To the orchestrator — schema and environment

Exact contract in [`orchestrator-request.md`](./orchestrator-request.md).

### 9b. To the orchestrator — the analytics orphan problem

Seven legacy union members in `src/lib/events/analytics.ts` have no emitter and
make `check:analytics` exit 1. Deleting them is forbidden to this section by the
append-only protocol. Requested, in order of preference:

1. The `start` section owner confirms the plan funnel is gone for good, and the
   orchestrator removes the seven members in the integration tree; or
2. they are kept and explicitly marked legacy in the file, and the checker is
   taught to skip a marked block — a change to a `shared` file plus a script,
   both outside this section; or
3. at minimum, `lintBaseline` in `sections.json` gains a note that
   `check:analytics` is red at 7 orphans, so the next worker to run the gate
   knows it is inherited.

This section will keep the gate no worse than it found it and will state the
exact orphan count in every handoff.

### 9c. To the `home` section — event name collision

`intent_selected` is emitted by `src/components/home/IntentCards.tsx` but reads
as a member of the retired plan funnel. Suggested rename to `home_intent_selected`,
appended by the `home` owner, with the old member retired at the same time as
§9b. Until then this section classifies it as active/home and says why on the
card. **No file is edited by this section.**

### 9d. To product sections — instrumentation gaps

Each of these is a metric the Observatory will show as `not_measurable` until the
owning section adds the event. None is worked around, and none is inferred from a
click.

| Owner | Needed event | Trigger | Safe payload | Why global inference is not enough |
| --- | --- | --- | --- | --- |
| `markets` | `market_compare_started` | 2–4 instruments committed to a comparison | `instrumentCount` | A route transition to `/markets/compare` does not say a comparison was actually run |
| `explore` | `explore_class_opened` | asset-class page opened from the hub | `class` | Distinguishing hub browsing from a real class open needs the component's own state |
| `academy` | `lesson_marked_done` | lesson marked watched | `lessonIndex`, `ofLessons` | `academy_progress.lessonsDone` gives the count but not when, so TTFA is unavailable |
| `account` | `saved_object_created` | a save completes | `kind` | The row exists but the funnel step that produced it does not |
| `voyager` | server-side outcome events | see §9e | — | — |
| `superchart` | `superchart_pane_added` | a study opens on its own pane | `studyId`, `paneCount` | Native-pane fulfilment cannot be derived from `superchart_study_toggled` alone |

### 9e. To the `voyager` section — server truth

The single biggest measurement gap. `src/app/api/voyager/route.ts` is the only
place that knows: whether a request was accepted, whether the answer was real or
`simulated`, whether the quota charge was kept or released, which provider error
occurred, and how long it took. Today the route emits nothing — all Voyager
telemetry is client-side, and a client cannot know any of it.

Requested: the route calls a server tracker at the four decision points it
already computes — refusal, `quotaDelta` outcome, answer provenance, and error
class. Payload is codes and durations only; never the question, the answer, or
the subject.

Worth recording, because it changes what to measure: **the quota bug is already
fixed on `main`.** The route charges once before the model, and
`releaseQuestion` refunds on refusal and on a `simulated` answer;
`src/lib/voyager/quota.ts` takes `tools` as a parameter explicitly to assert it
is unused. So acceptance criterion 14 — one question is not multiplied by tool
calls — is satisfied by the product already. The Observatory's job is to *show*
charged-vs-refunded, not to reimplement the rule.

## 10. Phase 1 plan

In order, each a small commit, none of it started until the orchestrator's
schema lands and is synced back.

1. `src/lib/analytics/registry.ts` — one typed registry: name, schema version,
   client/server, surface, property schema, dimension flags, meaningful/
   continuation flags, legacy flag, privacy class. The ingest allowlist and the
   metric catalogue derive from it. **Excluded from the `check-analytics` caller
   scan**, per §0.3 — this is a precondition, not a detail.
2. `src/lib/analytics/identity.ts` — session-scoped visitor id, server-derived
   pseudonymous user key by HMAC of the session user id, coarse device class,
   acquisition bucket. No IP, no raw UA, no persistent anonymous cookie.
3. `src/app/api/admin-metrics/ingest/route.ts` — same-origin batched ingest,
   strict allowlist, schema validation per event, batch and byte caps, server
   timestamps, server-derived entitlement and auth state overriding anything the
   browser claims.
4. `src/lib/analytics/sink.ts` + wiring `setAnalyticsSink` — batching,
   `sendBeacon` on page hide, fetch fallback, bounded queue, bounded retry,
   never throws. **This is the one shared-file touch**: a single call in the
   existing seam, which is what `setAnalyticsSink` was written for.
5. `src/instrumentation-client.ts` — global session and page-view backbone via
   the Next 16 client instrumentation hook and `onRouterTransitionStart`.
   Chosen deliberately: it is in this section's `owns`, and it avoids editing
   `src/app/[locale]/layout.tsx`, which no section owns.
6. `src/lib/admin-metrics/access.ts` — the §7 access design, both paths,
   server-validated.
7. `src/app/[locale]/admin_admin_metrics/page.tsx` — authorized shell with an
   overview skeleton and real data states. No charts yet, no fixtures.
8. `scripts/verify-admin-metrics.mjs` — end-to-end: an event emitted through the
   real sink, ingested through the real route, stored in the real table, read
   back by the real query, with an unauthorized request proving it 401s first.

Proof standard for Phase 1, per Override #3: this is verified **locally against
real database persistence**, and it is not production-verified until the
orchestrator has merged, deployed and smoked it.

### Unowned files this section will not edit

`src/app/[locale]/layout.tsx` and `src/middleware.ts` belong to no section and
are not in `shared`. Plan step 5 is designed to avoid needing either. If a later
phase genuinely requires one, it becomes an orchestrator request rather than a
quiet edit.
