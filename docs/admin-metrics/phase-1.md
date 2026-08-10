# Phase 1 — the foundation, as built

What exists after Phase 1, written against the code rather than against the
plan. Phase 0's audit stays as it was: it describes a portal that collected
nothing, and that was true when it was written. This document describes what
changed and, more usefully, what still has not.

Branch `feat/metrics`, based on `main` at `27589c3`.

## The one sentence that governs every number

Production analytics was a no-op until this shipped. `LocalSink` printed in
development and was silent in production, and `setAnalyticsSink` was exported
and never called. **There is no history.** Every event-derived figure begins at
the moment the sink was connected, and the dashboard says so in its own state
vocabulary rather than in a footnote — see `instrumented_going_forward` below.

Durable facts from the application tables are the exception and are real from
day one: users, purchases, bookings, Academy progress, event registrations.

## Telemetry flow

```
feature component
  track({ name, … })                     unchanged, still the product-facing API
      ↓
lib/events/analytics.ts                  shared, untouched
  sink.track(event)
      ↓
lib/analytics/sink.ts                    HttpAnalyticsSink, installed by
  queue → batch → fetch / sendBeacon     instrumentation-client.ts
      ↓
POST /api/admin-metrics/ingest           same origin
  validateBatch()                        allowlist from the registry
  + server-derived identity              session, entitlement, auth state
      ↓
product_telemetry_event                  append-only
      ↓
lib/admin-metrics/{overview,coverage}    typed queries, discriminated states
      ↓
/en/admin_admin_metrics                  authorized, server-rendered
```

Two entry points feed the same queue. Feature code calls `track()` and knows
nothing about any of this — no component changed in Phase 1. The global
backbone (`portal_session_started`, `portal_page_viewed`,
`portal_navigation_completed`, `portal_engagement_checkpoint`) is emitted by
`src/instrumentation-client.ts` through `sink.enqueue`, because those events are
this section's own infrastructure rather than members of the product's typed
union.

`setAnalyticsSink` is called from `instrumentation-client.ts` and nowhere else.
That file was reserved for this in the section registry, and using it avoids
editing `src/app/[locale]/layout.tsx`, which no section owns.

## Identity, and the session boundary

| | Anonymous | Signed in |
| --- | --- | --- |
| Stored id | `session_id` from `sessionStorage` | same |
| Stored key | `visitor_key_hash` = HMAC(session id) | plus `user_key_hash` = HMAC(user id) |
| Lifetime | the tab | the tab |
| Cross-session | **none** | via the user key |
| Retention measurable | **no** | yes |

Session boundary: 30 minutes idle, or 12 hours total, whichever comes first. A
tab left open overnight is not one visit.

Both keys are HMAC-SHA256 under `ANALYTICS_HMAC_SECRET`, namespaced so a user
key and a visitor key cannot collide, truncated to 128 bits. The secret is
separate from `BETTER_AUTH_SECRET` on purpose: rotating the auth secret must not
silently reset every cohort, and rotating this one must not sign anybody out. A
missing secret is a hard failure in production rather than a fallback to a
development constant — a predictable key would produce the same pseudonym for
the same user on every deployment.

**No persistent anonymous cookie was introduced.** This is the Phase 0 decision,
implemented: the product has no consent surface covering analytics, and the only
anonymous identifier it has is a day-scoped HMAC of an IP address that exists to
rate-limit Voyager. That one is not reused here and must not be. The cost is
that anonymous D1/D7/D30 returns `not_measurable` with the reason and the
remedy on the card.

## Access control

Two paths, both settled server-side by `lib/admin-metrics/access.ts`. Every API
endpoint calls it independently; the page having rendered proves nothing.

1. **Admin session** — `user.role === 'admin'`, the role system that already
   exists and that `lib/events/access.ts` already treats as moderation
   authority. No new admin product was built.
2. **Fragment secret** — `#access=…` read by a client bootstrap, posted to
   `/api/admin-metrics/access`, compared in constant time, exchanged for an
   opaque `HttpOnly` `Secure` `SameSite=Strict` cookie valid for 8 hours. The
   cookie holds a token derived from the secret with its expiry inside the
   signed material, never the secret. The fragment is removed with
   `replaceState`, so it is not one Back press away either. If
   `METRICS_ACCESS_SECRET` is unset the path is disabled outright.

A fragment is used rather than a query string because a fragment is never sent
in the HTTP request: not to the server, not into an access log, not into a
`Referer`.

The route carries `noindex, nofollow, noarchive`, is absent from `sitemap.ts`,
and has **no `robots.txt` entry** — a disallow line would publish the path. All
three are asserted by the verification suite.

## Ingest constraints

| Limit | Value |
| --- | --- |
| Events per batch | 50 |
| Bytes per request | 32 768 |
| Clock skew, future | 60 s |
| Clock skew, past | 6 h |
| Per-session flood guard | 600 events / minute, per instance |

Rejected outright, never repaired: an unknown event, an unknown property, a
property outside its declared shape, a legacy event, a server event posted by a
browser, a malformed timestamp. One bad event does not discard its batch — the
browser cannot retry selectively, and losing 29 good events to one bug would
make holes that look like user behaviour.

The route answers **202 to almost everything**, including a batch it stored none
of. A browser can do nothing with a validation error, and a 500 would make the
transport retry a write that is not coming back.

## Server-derived fields

Read from the session and never from the request body. A value the client sends
for any of these is ignored rather than merged.

- `auth_state`
- `user_key_hash`
- `entitlement` — from `user.plan`, the server model (`free | premium |
  ai_private`), not the subscription marketing vocabulary
- `visitor_key_hash`
- `received_at`
- `feature_state` — resolved from the runtime flags
- automated-traffic exclusion — judged on the `user-agent` header, which is read
  and thrown away

The verification suite posts an envelope claiming `entitlement: 'ai_private'`,
`authState: 'registered'` and a forged `userKeyHash`, then reads the stored rows
back and asserts none of it survived.

## Privacy boundaries

The load-bearing part is structural rather than procedural. `PropertySpec` has
four kinds — a closed enum, a bounded token, a bounded integer, a boolean — and
**no free-text kind**. There is no way to declare a property that could hold a
question, an answer, a note, a brief or a search query, so the privacy rule is
not a review item.

That is necessary and was briefly not sufficient. The first cut of
`recordServerEvent` checked that an event existed and was of a server kind, then
passed its properties through unread — so a call site could have written
`{ prompt: '…' }` into the table, and the registry's inability to *declare* free
text would not have stopped it, because nothing on that path was consulting the
registry. Corrected by the changes below:

- **One validator, both directions.** `validateEvent` takes the allowed event
  kinds as an argument — `CLIENT_KINDS` for ingest, `SERVER_KINDS` for the
  tracker — and everything else is the same code. There is no second
  server-side schema to drift.
- **The boundary is refused both ways.** A browser cannot post a `server` event
  (it cannot observe what one describes), and the tracker cannot write a
  `client` event (it would manufacture an interaction nobody had).
- **`persistEvents` checks every row against the registry before writing.** Both
  callers have already validated, so this should never drop anything — which is
  the argument for it. The guarantee becomes a property of the table rather than
  of everyone who ever writes to it, and a call site added in two years cannot
  put an undeclared field in the database whatever it forgot to call.
- Rejections are dropped, never thrown, and never reported as telemetry — an
  event about a rejected event recurses the first time the reporting event is
  itself malformed. In development it prints, because a rejection here is a
  programming error at a call site.

Second lock: `FORBIDDEN_PROPERTY_NAMES` rejects field names that would be
well-formed tokens and still wrong — `email` is short, an IP matches the token
pattern, a ticker is a position somebody may hold. `auditRegistry()` runs over
every declared event and the suite asserts it finds nothing.

Never read by this layer: `data_access_log` (it holds raw IP and user agent, and
is the wealth audit trail), `requestFingerprint()`, and anything encrypted at
rest — `briefEnc`, `noteEnc`, `summaryEnc`, `dataKeyEnc`. Nothing here decrypts
anything.

A populated path never travels: `routeTemplateFor()` reduces `/en/symbols/TSLA`
to `/symbols/[ticker]` on the client, before the event is queued. An
unrecognised path becomes `unknown` rather than passing through intact.

`document.referrer` is reduced to one of eight buckets by hostname, in the
browser. The hostname itself is never sent.

## Current data availability

Live now, from durable tables: registered users, new registrations. Real from
the first query, with real history.

`instrumented_going_forward` — collecting, no history, and labelled as such for
as long as the collection start falls inside the requested window:

- telemetry events
- sessions
- meaningful continuation (PMCR, first form)

Explicitly absent, with the reason on the card:

| Metric | State | Why |
| --- | --- | --- |
| Confirmed revenue | `source_not_connected` | no payment provider; `purchase.status='demo'` is an entitlement without money |
| Alert adoption | `feature_disabled` | `alertsEnabled` is off; a zero would be false |
| Anonymous D7 return | `not_measurable` | no cross-session anonymous identity, and none was invented |

## Known gaps

**PMCR is not yet its full definition.** What ships is the numerator and
denominator over the same session set — enough to prove the pipeline computes a
rate. The agreed definition adds the three-second engagement floor and the
eligible-surface filter. `portal_engagement_checkpoint` is emitted already, so
the input exists; the query does not use it yet.

**Almost nothing calls the server tracker.** `trackServerEvent` is built and
tested, and only the ingest route and the query layer emit through it. Every
Voyager server fact — request accepted, real answer versus `simulated`, quota
charged versus refunded, provider error class, tool outcome — needs call sites
inside `src/app/api/voyager/route.ts` and `src/lib/voyager/`, which belong to
another section. The request is `current-state.md` §9e. Until it lands those
metrics stay `not_measurable`; none of them is inferred from a click.

**The seven orphaned plan events are still orphaned.** `check:analytics` still
exits 1, as it did before this section existed. It now separates the inherited
seven from anything new, and the suite asserts that a name appearing only in the
registry is still reported as an orphan — the failure mode the exclusion was
added to prevent.

**No dashboard.** Phase 1 renders one card of each data class and the coverage
table. The fourteen-section design is Phase 6.

## Two bugs the verification found

Recorded because both were invisible without it and both would have shipped.

**Queued events could stall indefinitely.** The transport armed a two-second
timer and then re-asked `shouldFlush` when it fired; the ten-second interval had
not elapsed, so the answer was no — and the timer had already cleared itself, so
nothing rearmed it. A page that emitted a session start and a page view sent the
first and held the second until the next event, which on a page nobody interacts
with is never. The queue now reports `msUntilDue` and the transport arms exactly
that; a due flush is not re-gated. Two unit checks guard it.

**The first event of every page was flushed alone.** `lastFlushAt` started at
zero, so the first event was always already past the interval. It is seeded at
construction.

## Verification

```
node scripts/verify-admin-metrics.mjs            71 checks, writes nothing
node scripts/verify-admin-metrics.mjs --unit     the same, said explicitly
node scripts/verify-admin-metrics.mjs --live     89 checks, real app and database
```

**The live half is opt-in, and that is deliberate.** `DATABASE_URL` in every
worktree of this project points at the production database, so running the
verification the obvious way must not mutate production telemetry however
carefully it tidies up. Cleanup in `finally` protects against a failing
assertion; it does not protect against somebody running a command they believed
was read-only. The default mode says out loud that the live checks were skipped
and how to ask for them, so a green run cannot be mistaken for full coverage.

`--live` announces the database host and the sentinel session before it writes
anything. Its rows go under one fixed sentinel session, exactly that session is
deleted in a `finally` block, and the deletion is limited to rows the
verification owns. Last run: 89/89, seven rows cleaned up, table left at zero.

It includes a real Chromium page load that proves `setAnalyticsSink` is wired,
the queue flushes, the batch reaches ingest, and the row lands in
`product_telemetry_event` — and a real server event written by the ingest route
through `recordServerEvent`, read back to confirm it carries exactly its two
declared properties and nothing else.
