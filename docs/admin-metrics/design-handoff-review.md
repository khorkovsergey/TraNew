# Design handoff review — what the design assumes vs what the repository can do

Reviewed: `C:\Users\User\Documents\TradingView\Metrics\design_handoff_observatory\`
(`README.md`, `brief_v2.md`, `Product Observatory.dc.html`, `support.js`),
against `main` at `539620e`. Companion to [`current-state.md`](./current-state.md).

The design is the visual specification for the fourteen sections and is adopted
as such. This document exists for one reason: its README lists ten *assumptions
to confirm before implementation*, and the Phase 0 audit can now confirm or
refute six of them from the code. Refuting them here is cheaper than discovering
it in Phase 6 with a card already drawn.

The design's two governing rules — a missing source is displayed as missing, and
a zero for an unreachable feature is not underperformance — are exactly the
rules the audit arrived at independently. Nothing below weakens them; the
conflicts are all cases where the design assumed a source the portal does not
have, which is the same rule applied one level further.

## Confirmed by the repository

**Assumption 6 — entitlement vocabulary is data-driven, no plan name hardcoded.**
Correct, and necessary. The server model is `PlanId = 'free' | 'premium' |
'ai_private'` in `src/lib/session.ts`. The subscriptions marketing lineup is a
different vocabulary and a different length. The filter must read `PLAN_RANK`
keys at runtime. The design already does not hardcode them.

**Section 10 — four monetization columns that must never be combined.** Matches
the schema exactly: `purchase.status` separates `demo` from `paid｜pending｜
refunded｜failed`, and the column comment says `demo` is its own status
specifically so nothing counting revenue can pick it up by accident. The
design's separate demo/test line is the right shape.

**Section 03 — Awareness and Monetization deliberately "no source".** Correct on
both counts. No Search Console integration exists and no payment provider is
connected.

> **Corrected.** This line originally called `subscription.externalRef` an empty
> hook. It is not a hook at all: `external_ref` is a free-form application
> reference, and on `purchase` it holds course slugs and script product ids
> written by the enrolment paths — 16 rows in production, none of them `paid`.
> A non-null value proves a reference exists and nothing else.

**Section 05 — the retired diagnostic/plan journey is a separate Legacy card.**
Correct, with one correction below (`intent_selected`).

**Assumption 10 — access control happens before render; no login UI in the
design.** Compatible with the recommended design. One gap: the design has no
unauthorized state, so a small neutral shell has to be built that is not in the
mockup. It renders nothing but a generic message and carries no metrics data.

## Refuted or unsupported by the repository

### 1. Anonymous retention (assumption 3) — cannot be delivered

The design assumes the identity/session definition "includes anonymous
visitors" and treats cross-device return as a floor.

The portal has no cross-session anonymous identity. The only anonymous key that
exists is `anon:<HMAC(secret, "voyager:" + ip)>` in `src/lib/voyager/usage.ts`,
scoped to `(subject, day)` for rate limiting, IP-derived, and reset by secret
rotation — with a comment stating that not keeping a table of who visited from
where is the point of it. There is also no analytics consent surface:
`src/lib/consent.ts` has five kinds and none of them covers telemetry.

Per Override #5 this section will not create a persistent anonymous analytics
cookie to manufacture the number. **Section 06 must render the anonymous cohort
split as `not_measurable`, with the reason on the card, and the Split-by control
must not offer anonymous-vs-registered as though it worked.** Authenticated
retention is real and is computed.

What would unblock it, if the product owner wants it: a consent surface, a
first-party analytics cookie with a stated lifetime, and a privacy-policy
review. That is a product decision, not an implementation detail.

### 2. Geography at country level (assumption 9) — no source

Nothing in the portal resolves a location. The only input that could produce one
is the IP address, which the telemetry rules forbid storing and which the audit
excludes explicitly. There is no geo provider dependency and none is requested.

Any geography breakdown renders `source_not_connected` until a provider is
added deliberately, with its own privacy review.

### 3. Release annotations on the North Star chart (assumption 7) — no source

Assumes "the build pipeline can supply a timestamped change list". Railway
builds from a GitHub push and no such feed exists. A future phase could derive
annotations from tags or merge commits, but that is unbuilt, so the annotation
layer ships as `source_not_connected` rather than with invented markers.

### 4. Event attendance is External (assumption 8) — actually unmeasured

The design shows attendance as living on an external platform. The schema shows
no attendance capture and no external events integration —
`event_registration.status` tracks registration lifecycle only. `External` says
"measured somewhere else"; the truthful state is `not_measurable`, because it is
measured nowhere. The distinction matters: `External` invites someone to go look
it up.

### 5. `intent_selected` is not legacy

Both briefs list it in the retired plan funnel. Its only emitter is
`src/components/home/IntentCards.tsx` — the current Home intent cards. Section
05's Legacy card must not absorb it, and Section 01 should count it as a live
Home continuation signal. See `current-state.md` §9c for the rename request.

### 6. Every number in Section 01–13 starts empty, not small

Assumption 1 already says the values are placeholder shape-of-data. Worth
stating more precisely for implementation: because `LocalSink` is silent in
production, **no event-derived metric has any history at all**. On the first day
after the sink is connected, an event metric is `instrumented_going_forward` —
not `live` with a small sample and not `insufficient_sample`, both of which
imply data was being collected and there was merely not enough. Durable
database facts (users, purchases, bookings, Academy progress) are the exception:
those are real from day one.

## Provenance state vocabulary — three lists, one canon

Three sources define the states and none of them match: the design README has 8,
the implementation brief §37 has 9 (adds `stale`), and Override #9 has 10 (adds
`instrumented_going_forward` and `not_measurable`, and names the flag case
`feature_disabled` where the design says "Not exposed").

Proposed canonical union, as the discriminated type every metric query returns.
Design labels are kept for the UI; the ids are what the code uses.

| id | Design label | Meaning |
| --- | --- | --- |
| `live` | Live | Measured directly from the event stream |
| `derived` | Derived | Computed from live events |
| `instrumented_going_forward` | Live · from *date* | Instrumented, collecting, no history before the sink |
| `insufficient_sample` | Insufficient sample | Data exists, n below threshold — count shown, rate withheld |
| `source_not_connected` | Source not connected | External source missing, excluded from roll-ups |
| `feature_disabled` | Not exposed | Feature flag off or unreachable; a zero would be false |
| `coming_soon` | Coming soon | Announced but inert; a click is demand, not usage |
| `external` | External | Measured outside the portal, and actually measured |
| `legacy` | Legacy | Historical flow, never merged into current funnels or PMCR |
| `stale` | Delayed analytics | Telemetry has not arrived inside the freshness budget |
| `not_measurable` | Not measurable | No mechanism exists, and none is being faked |

Eleven states, one visual language. Section 14 of the design renders eight of
them plus loading, delayed analytics and unhealthy ingestion — so the kit is
nearly complete and gains `instrumented_going_forward` and `not_measurable`,
with `stale` mapping onto the delayed-analytics component that already exists.

Building this set first, before any chart, is the design's own instruction and
the audit agrees: it is the one thing every other section depends on.

## Adopted definitions from the design

**PMCR eligibility = landing view + ≥3s engaged time**, and actions on
non-exposed features excluded from both numerator and denominator. Adopted —
it is a better definition than "any session with a page view", because it
removes the bounce that no product change can affect.

It has an implementation consequence worth stating: PMCR then depends on an
engagement checkpoint event, so PMCR cannot exist before
`portal_engagement_checkpoint` is instrumented. It is not derivable from page
views alone.

**Minimum sample n ≥ 200 default, n ≥ 50 for marketplace bookings.** Adopted as
defaults, in the metric dictionary rather than in JSX, and flagged as the
product owner's to confirm.

**Freshness as a query-time snapshot**, with the chip green only when an event
actually arrived inside the budget. Adopted — it is the honest version, and it
is what `max(received_at)` supports.

## Implementation notes

The mockup is a standalone browser file: it loads Google Fonts and keeps its
runtime in `support.js`. Neither carries over. The implementation uses the
portal's own tokens and components (brief §34), and any CSS this section adds
must pass `node scripts/check-tokens.mjs` — a `var(--tn-*)` that does not exist
fails silently and looks like a styling mistake rather than a missing token.

The design file stays where it is, outside the repository, as the visual
reference. Nothing from it is copied in wholesale.
