# Phase 3 — product families and durable business facts

Branch `feat/metrics`, based on `main` at `d1312b7`. Phases 0–2 stand as
written; nothing here redefines a global metric.

## The one rule

**Telemetry describes behaviour. A table describes an outcome. They are
different evidence about the same flow, and they are never added.**

`event_registration_completed` says a form reported success.
`event_registration` says a seat exists. One is not a check on the other and
neither is a correction of it — a network failure after the row was written
produces the seat without the event, and a double submit produces the event
without a second seat. Adding them would count one registration twice; reading
either as the other asserts something nobody measured.

So every family carries both, side by side, labelled, with the source table
named. `sourceType` is now a required field on every dictionary entry —
`telemetry`, `durable_fact`, `derived`, `external` or `source_not_connected` —
and every durable metric's provenance names its exact table rather than "the
database".

## Start — behaviour only

The seven `next_step_*` events, as a **sequential** funnel:

```
opened → level_selected → intent_selected → recommendation_shown → destination_clicked
```

A stage counts for a session only when every earlier stage happened in that
session, no later. Dividing one event total by another is not a funnel: it
assumes an order the events do not carry. A restarted session emits
`next_step_opened` twice; a click that arrives without its funnel would report a
completed journey that never happened. Both are tested.

`next_step_clarification_selected` is **optional and never a denominator**. Not
every route asks, and making it mandatory would report every unambiguous path as
a drop-off. It is reported as a share of sessions that reached a recommendation.

Destinations are counted once per session and split internal/external. There is
no durable "next step" record, so nothing in this family is a business outcome —
stated in its limitations rather than implied.

## Events — both, and reconciled

Durable, from `event_registration`: registrations, registered, waitlisted,
cancelled, attended, no-show, distinct people, events with registrations,
registrations in window. Supply from `event`. Behaviour, from telemetry:
discovery → event viewed → registration started → registration completed, as a
sequential funnel.

**Attendance rate** divides attended by *seats taken* — registered, attended and
no-show. Cancelled gave the seat back; waitlisted never had one, and including
the waitlist would make a popular event look badly attended precisely because it
was popular.

**`event_metric` is read only to reconcile.** It is the organiser's daily
counter and has a `registration` metric of its own, so there are two independent
numbers for one concept. The difference between them is published as
`counterDiscrepancy` rather than resolved by preferring whichever looks better —
a gap is a data-health finding about the counters.

Never selected: `name`, `email`, `company`, `role`, `experienceLevel`.

## Academy — current state, and it says so

One row per user, overwritten in place. So the stage distribution is a
photograph of where everybody is now, **not** a conversion funnel: "60% are at
`landing`" invites the conclusion that 60% dropped out there, when it may mean
they arrived this morning.

Reported: learners, new learners in window, path-ready, completed, learners with
at least one lesson, learners who asked questions, median lessons done, and a
completion rate over learners with a progress row — which is the documented
definition of having started.

A historical progression funnel needs transition events. Academy emits none, so
that is a cross-section request rather than something approximated from a
snapshot.

Never read: `diagnostic` — five lists of answers about somebody's own experience
with money. Only the *length* of `lessons_done` is used, never its contents.

## Experts — a pipeline, not a funnel

`status` is overwritten as a booking moves and there is no transition history.
So the distribution is the **current pipeline**: a booking that went all the way
appears only under `completed`.

**No conversion rate is published.** Dividing completed by draft would compare
today's finished bookings against today's unstarted ones, and the number would
move whenever somebody opens a new draft — the opposite of what a conversion
rate should do.

Reported: bookings, people with a booking, open pipeline (draft, slot_held,
payment_pending, confirmed), and each terminal status separately, plus rating
counts and the mean rating.

Never selected: `briefEnc`, `summaryEnc`, `sharedContext`.

## Commerce — and why revenue is still absent

`purchase.status` separates `demo` from `paid`, and `demo` is documented in the
schema as an entitlement granted without money precisely so nothing counting
revenue picks it up. That is necessary and **not sufficient**.

A `paid` row is an *application record*, not a provider-confirmed transaction.
`externalRef` is the reconciliation hook and nothing populates it; no
reconciliation runs anywhere in this repository. Summing `amount_cents` where
status is `paid` would produce a number that looks like revenue, would be quoted
as revenue, and would be whatever the application happened to write.

So the sum is published as **`recordedPaidGrossCents`** — under a name that says
what it is — and `confirmedRevenue` stays `source_not_connected` with the
missing source named. `providerReconciledRecords` reports how many rows have ever
been reconciled, which is currently the evidence that the first number is not the
second.

Plan names are read from `PLAN_RANK` at runtime. A plan the entitlement model
does not recognise is labelled `(unrecognised)` rather than charted beside the
real ones. Nothing infers a successful renewal from `renewsAt`, which is an
intention.

## Saves — kind, never ref

`saved_object` holds `kind` and `ref` — "symbol" and "TSLA". The kind is a fact
about the product; the ref is a list of what somebody is watching, which is close
enough to what they hold. The application may query a ref because the person
asked it to; a dashboard has no such mandate.

Reported: objects, savers, repeat savers, saves in window, and a distribution by
kind. Collections as adoption only — count, owners, non-empty, mean items.
Names, descriptions, titles, subtitles and the encrypted note are never read.

## Wealth — adoption, and nothing else

The strictest boundary, kept structurally: **no encrypted column is referenced
anywhere in the family.** There is therefore no portfolio value, no assets under
management, no net worth and no liability total — not because they are hard, but
because a dashboard that aggregated them would have broken the product's promise
on everybody's behalf at once. A test asserts the file reads none of them.

`country` and `currency` are readable in the clear and are still not used: with a
small cohort they narrow a person down.

Assets are versioned — an update writes a new row and stamps `supersededAt` on
the old one. Current means `supersededAt is null`, so somebody who revised one
holding five times is one holder with one asset; the revisions are counted
separately as the activity they are.

With the flag off, adoption reports `feature_disabled` rather than zero.

Consent adoption — `voyager_context` granted and revoked — is the one figure here
about the product rather than about anybody's money.

## Accounts

Registered users, verified users, new registrations in window, and a per-day
trend. Three columns read from a table that also holds names, emails, images and
the encrypted data key.

**No registration is attributed to a feature.** That needs a reliable link across
the moment identity changes, and inventing one here would produce a number that
gets quoted for a year.

## Coverage, per family

Coverage now answers a question a single number cannot: **a durable table with
rows does not prove the behavioural funnel is instrumented, and an event does not
prove the outcome happened.** Each family reports both independently and a
verdict — `behaviour_and_facts`, `facts_only`, `behaviour_only`,
`awaiting_data`, `not_instrumented`.

Today `saves` is `facts_only`: rows exist, no save event has arrived, and the
table is not evidence about the funnel.

## Tests

`node scripts/verify-admin-metrics.mjs` — **166 checks, writes nothing.**
`--live` — **191 checks**, real app and database, explicit and announced. Last
run: 191/191, 14 rows cleaned up, sentinel left at zero.

Durable formulas are tested through pure semantics modules — seat statuses, open
pipeline, revenue-bearing statuses — rather than by writing rows into production
business tables, which the verification never does.

Three structural privacy tests guard the adapters: no `select *`, no
`schema.*.<sensitive column>` reference in any family, and a serialized walk of
five live API responses asserting no private key or value crossed the wire.

Two of those tests had to be sharpened during the phase, and the reason is worth
recording: the first versions flagged the honest prose. These files deliberately
*name* the fields they refuse to read, and a test that banned the words would
have forced the documentation out to protect a grep. They check column
references and exact field names now, so a private value is still caught and a
limitation that explains itself is not.

## Known gaps and requests

- **The seven Start orphans** — evidence gathered and a decision requested in
  [`start-orphans-request.md`](./start-orphans-request.md). `check:analytics`
  remains red at exactly those seven.
- **Academy transition events** do not exist, so no historical Academy funnel is
  possible. Cross-section request.
- **Expert booking transition history** does not exist, so no booking conversion
  rate is possible. Cross-section request.
- **Save-action telemetry** has no emitter, so `saves` is durable-only.
- **Voyager server truth** still deferred.
- No new index was needed. Every Phase 3 query is a grouped aggregate over a
  table small enough that the planner does a sequential scan either way, and
  asking for indexes that might help someday would be guessing.
