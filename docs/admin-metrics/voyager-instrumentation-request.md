# Request to the Voyager section — server telemetry for the Observatory

**From:** the `metrics` worker.
**To:** the `voyager` section owner.
**Scope:** two `recordServerEvent` calls in `src/app/api/voyager/route.ts` and one
in the tool loop. **No product behaviour changes.**

The Observatory can already show what a browser did — Voyager opened, question
submitted, action clicked. It cannot show what Voyager *did*: whether a model
answered or the scripted layer stood in, whether the quota charge was kept or
given back, how long it took, whether the tools worked. None of that is
observable from a client, and inferring it from a button press would report a
provider outage as engagement.

Everything below is read-only observation. **Do not change quota values, tier
logic, model selection, tools, answer content, chart capabilities, source
policy, fallback behaviour, copy or UI.**

---

## Before you start

```bash
cd ../worktrees/voyager
git fetch origin && git merge origin/main
```

The events are already declared and validated in
`src/lib/analytics/registry.ts`, which is on `main`. You do not need to add
them — if the names or properties below do not match what the registry accepts,
the ingest layer will drop the row silently in production and print a warning in
development. Copy the property names exactly.

---

## The helper

```ts
import { trackServerEvent } from '@/lib/analytics/server';
```

- **Never awaited.** It returns `void` and swallows every error, including a
  database failure. Telemetry must not be able to fail an answer.
- **Never inside a `try` you care about.** It has its own.
- It validates against the registry before writing, so an undeclared property is
  refused rather than stored.

---

## Event 1 — `voyager_request_completed`

One row per intentional question that reached the quota layer. Four call sites,
all in `src/app/api/voyager/route.ts`.

### Properties

| Property | Type | Value |
| --- | --- | --- |
| `screen` | token ≤24 | `context.screen` |
| `tier` | enum | `basic` \| `personal` \| `private` — the `tier` already resolved on line ~151 |
| `outcome` | enum | `real_answer` \| `simulated_fallback` \| `quota_refused` \| `server_failure` |
| `quotaDisposition` | enum | `charged` \| `released` \| `refused_released` \| `unmetered` |
| `modelConfigured` | boolean | `isModelConfigured()` — already imported on line 5 |
| `durationMs` | integer 0–600000 | server elapsed, see below |
| `sourceCount` | integer | `active.length` |
| `toolSteps` | integer | tool executions in this request, or `0` |
| `hasChart` | boolean | `Boolean(answer.chart)` |
| `hasStudy` | boolean | `Boolean(answer.study)` |
| `actionCount` | integer | `answer.actions?.length ?? 0` |

### Timing

At the top of `POST`, before anything else:

```ts
const startedAt = performance.now();
```

and at each emit: `durationMs: Math.round(performance.now() - startedAt)`.

Monotonic, so a clock adjustment mid-request cannot produce a negative or a wild
figure. A client timestamp must not be used — it includes the network and the
browser, and it is a clock we do not control.

### Call site A — quota refusal

**File:** `src/app/api/voyager/route.ts`
**Where:** inside `if (usage.quotaReached) { … }`, after the `releaseQuestion`
call on line ~176 and immediately before `return NextResponse.json(response)` on
line ~189.

```ts
trackServerEvent({
  name: 'voyager_request_completed',
  properties: {
    screen: context.screen,
    tier,
    outcome: 'quota_refused',
    quotaDisposition: 'refused_released',
    modelConfigured: isModelConfigured(),
    durationMs: Math.round(performance.now() - startedAt),
    sourceCount: 0,
    toolSteps: 0,
    hasChart: false,
    hasStudy: false,
    actionCount: 0,
  },
  userId: user?.id ?? null,
  entitlement: user?.plan ?? null,
  surface: 'voyager',
});
```

`sourceCount` is 0 because `sourcesFor` has not run at this point. That is
accurate rather than convenient — the request was refused before context was
resolved.

### Call sites B and C — real answer and simulated fallback

**Where:** after the `quotaDelta` decision and the conditional
`releaseQuestion` on lines ~240–248, before the response is built on line ~282.
One emit covers both, because the branch is already computed:

```ts
const simulated = answer.simulated === true;

trackServerEvent({
  name: 'voyager_request_completed',
  properties: {
    screen: context.screen,
    tier,
    outcome: simulated ? 'simulated_fallback' : 'real_answer',
    quotaDisposition: quota === null ? 'unmetered' : decision.charged ? 'charged' : 'released',
    modelConfigured: isModelConfigured(),
    durationMs: Math.round(performance.now() - startedAt),
    sourceCount: active.length,
    toolSteps: 0, // see "tool steps" below
    hasChart: Boolean(answer.chart),
    hasStudy: Boolean(answer.study),
    actionCount: answer.actions?.length ?? 0,
  },
  userId: user?.id ?? null,
  entitlement: user?.plan ?? null,
  surface: 'voyager',
});
```

`quotaDisposition` is read from `decision.charged`, which is what actually
happened — not from what should have happened. That matters: the Observatory
runs an integrity check asserting a simulated fallback is never left charged,
and it can only catch a broken refund if this reports the truth.

`quota === null` means an unmetered plan, where the counter is not used at all.
Reporting that as `released` would make every Premium question look like a
refund.

### Call site D — unexpected failure

Only where a request that already passed validation and entered execution then
throws outside the normal fallback path. Wrap the `askVoyager` call:

```ts
let answer;
try {
  answer = await askVoyager({ … });
} catch (error) {
  trackServerEvent({
    name: 'voyager_request_completed',
    properties: {
      screen: context.screen,
      tier,
      outcome: 'server_failure',
      quotaDisposition: 'released',
      modelConfigured: isModelConfigured(),
      durationMs: Math.round(performance.now() - startedAt),
      sourceCount: active.length,
      toolSteps: 0,
      hasChart: false,
      hasStudy: false,
      actionCount: 0,
    },
    userId: user?.id ?? null,
    entitlement: user?.plan ?? null,
    surface: 'voyager',
  });
  await releaseQuestion(user?.id ?? null, quota);
  throw error;
}
```

**Do not instrument ordinary 400 validation errors.** A malformed body is not an
AI failure, and counting it as one would make the fallback rate move with client
bugs.

Note the refund: a request that produced no answer must not stay charged, which
is the same rule the simulated path already follows. If you would rather not add
a refund in this pass, say so and emit `quotaDisposition: 'charged'` — the
Observatory will surface it as an integrity violation, which is the correct and
visible outcome.

### Tool steps

`toolSteps` can stay `0` in the first pass; the Observatory reads tool activity
from event 2 and does not depend on it. If it is cheap to thread a counter out
of `askVoyager`, pass the number of executed tool calls — it lets one card say
"tool-assisted answers" without a join.

---

## Event 2 — `voyager_tool_completed`

One row per tool execution.

**File:** `src/lib/voyager/tools/registry.ts`
**Where:** in `runToolCalls`, on each `ExecutedCall` before it is returned — or,
if simpler, in `src/lib/voyager/orchestrator.ts` at line ~563 where `executed` comes back:

```ts
for (const call of executed) {
  trackServerEvent({
    name: 'voyager_tool_completed',
    properties: {
      tool: call.trace.id,
      outcome: call.trace.ok ? 'success' : 'failure',
      code: call.trace.code ?? '',
      durationMs: 0, // or a real measurement if one is easy to take
      step,          // the tool-loop iteration, or 0
    },
    surface: 'voyager',
  });
}
```

`trace.id`, `trace.ok` and `trace.code` already exist and are exactly the safe
shape — a capability name and a bounded failure code.

### Never send `trace.call`

It is the call signature — `getBars(TSLA, 1D)` — and it carries a ticker. A
ticker is a position somebody may hold, and this product's telemetry rules
exclude it. The registry has no property for it and ingest would refuse the row,
but the rule is worth stating rather than relying on a validator to catch.

---

## What must never travel

Not in either event, not in a property, not in a code:

the question · the answer · any prompt · conversation history · a ticker or
symbol · holdings or portfolio values · any user text · a provider error body or
message · a search query · citations · a URL · source document contents · a
name or an email.

The registry cannot express a free-text property — there is no string spec
without a closed set or a bounded identifier pattern — so an attempt to add one
fails at the type level rather than in review. Please do not work around it.

---

## Identity

Pass `userId` and let the helper hash it. It derives the pseudonymous key with
`ANALYTICS_HMAC_SECRET` and never stores the application id.

**Do not pass the Voyager quota subject.** It is an HMAC of an IP address that
exists to rate-limit, and turning a rate limiter into a behavioural identity is
exactly what its own comment rules out.

---

## Tests

Keep it small — this is observation, not logic:

1. A quota-refused request emits exactly one `voyager_request_completed` with
   `outcome: 'quota_refused'`.
2. A simulated answer emits `outcome: 'simulated_fallback'` and a
   `quotaDisposition` that is not `charged`.
3. A telemetry failure does not fail the answer — throw from the tracker in a
   test double and assert the response is still returned.

`scripts/verify-voyager-chat.mjs` already drives the route; asserting the row
count in `product_telemetry_event` afterwards is enough.

---

## Handoff

Push only your branch:

```bash
npx tsc --noEmit && node scripts/test-events.mjs
git push -u origin feat/voyager
```

Tell the orchestrator which call sites landed. The Observatory needs no change
when they do: every Voyager card currently reads *not measurable — the emitter
has not landed*, and turns into a real number the moment the first row arrives.
