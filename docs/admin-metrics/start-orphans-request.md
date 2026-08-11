# Request — retire the seven plan-funnel analytics declarations

**To:** the `start` section owner, and the orchestrator to apply.
**From:** the `metrics` worker, Phase 3.
**Blocking:** nothing. `check:analytics` stays red at exactly these seven until
it is resolved, and no other work waits on it.

`src/lib/events/analytics.ts` is a `shared` file under an append-only protocol
whose third rule is *never delete another section's entry*. So this section
cannot remove them and is not asking to — it is presenting the evidence and
asking the owner to confirm.

## The seven

```
diagnostic_completed
plan_generated
plan_step_started
plan_step_completed
save_prompt_viewed
registration_completed_from_plan
plan_resumed
```

## Evidence, gathered at `d1312b7`

**1. None of the seven has any occurrence anywhere in `src/`** outside the union
that declares them and the metrics registry that classifies them:

```
$ for e in diagnostic_completed plan_generated plan_step_started \
           plan_step_completed save_prompt_viewed \
           registration_completed_from_plan plan_resumed; do
    grep -rl "$e" src --include=*.ts --include=*.tsx \
      | grep -v 'lib/events/analytics.ts' | grep -v 'lib/analytics/'
  done
# no output
```

**2. The screen the funnel ended on no longer exists.**
`src/app/[locale]/start/plan/page.tsx` is a redirect, and its own comment says
so: *"gone and so is its result; what remains is this redirect, because links to
it…"*.

**3. Current Start emits a different family.**
`src/components/start/NextStepRouter.tsx` emits all seven `next_step_*` events
and none of the seven above.

**4. The residual plan code emits nothing.**
`src/app/actions/startPlan.ts` and `src/lib/start/plan.ts` are still present and
still called — `buildPlan` is read by `src/components/account/AccountSections.tsx`
so the account screen can show plans that were already saved, and
`savePlanAction` in `src/app/actions/strategy.ts` is reachable from
`src/components/shared/KeepThis.tsx`. Neither path contains a `track()` call of
any kind.

So the *feature* has residual reachable code; the *telemetry* has no emitter.
Those are different facts and the second is the one this request is about.

## What is being asked

**Confirm one of two things.**

**(a) The plan funnel is retired.** Then the orchestrator removes these seven
union members from `src/lib/events/analytics.ts` in the integration tree, and
`check:analytics` goes green with no other change.

**(b) The plan funnel is still a product and should be measured.** Then the
declarations stay and the `start` owner adds the emitters, and this section
reclassifies them from `legacy` to `current` in the registry. In that case
please say which of the seven are wanted, because
`registration_completed_from_plan` in particular describes a flow whose screen
is now a redirect.

Given the evidence, (a) looks right — but the reachable `savePlanAction` path is
why this is a question rather than an assertion.

## What Metrics will do either way

**The legacy definitions stay in the metrics registry**, marked
`lifecycle: 'legacy'`, whichever way this goes. They are how a row already in
`product_telemetry_event` gets identified if one ever appears, and removing them
would leave historical telemetry undescribable. They are excluded from the
ingest allowlist, so nothing can write them, and from every current KPI —
`scripts/verify-admin-metrics.mjs` asserts both.

Removing them from the *shared union* and keeping them in the *metrics registry*
are therefore compatible, and that combination is what option (a) means.

## Gate behaviour

`scripts/check-analytics.mjs` reports these as `inherited` and anything else as
`NEW`, and exits 1 either way. It has never been softened to hide them. When the
declarations are removed the gate becomes green with no further change here.
