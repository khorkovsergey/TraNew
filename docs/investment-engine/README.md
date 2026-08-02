# Voyager Investment Intelligence Engine (VIIE)

An explainable investment-analysis pipeline inside TradingNew. It reads the page
or chart a person is looking at, resolves what instrument that actually is,
computes every number in code, has specialists interpret those numbers, stages a
bull/bear disagreement, checks each resulting statement against its evidence,
and returns a structured assessment with the sources and their dates attached.

It does not execute trades, does not promise returns, and does not replace
professional advice.

## The rule the design exists to enforce

**Code calculates. The model interprets. Sources prove. The validator checks.**

A model asked for a price-to-earnings ratio will answer with a plausible number
whether or not it has the inputs, and that answer is indistinguishable from a
computed one afterwards. So there is no field anywhere in the domain model that
a model can put a number into: every figure is a `CalculationResult` that names
its formula, its version, its inputs, and the evidence those inputs came from.

## Status

A working vertical slice, running on frozen fixtures for a fictional company.

Built and verified:

- domain model, deterministic calculation engine, point-in-time guard
- evidence registry, claim validator, code-assembled confidence
- six agents, bull/bear debate, weighted committee
- streaming API, chart action plan
- 51 tests including lookahead-bias and prompt-injection cases

Not built: real data providers, the model interpretation layer, persistence of
runs, the remaining skills. See `LIMITATIONS.md`.

## Run it

The engine ships with the portal — no separate service, no extra infrastructure.

```bash
npm run dev
curl -X POST http://localhost:3000/api/investment/analyze \
  -H 'Content-Type: application/json' \
  -d '{"mode":"standard","page_context":{"page_type":"symbol"}}'
```

Streaming:

```bash
curl -N -X POST http://localhost:3000/api/investment/analyze \
  -H 'Content-Type: application/json' \
  -d '{"mode":"standard","stream":true,"page_context":{"page_type":"symbol"}}'
```

Tests: `npm run test` (the engine's cases run inside the repository suite).

## Environment

None required. The demo path uses fixtures and no API key. When providers are
added they follow the existing convention — environment variables read
server-side, never exposed to the browser.

## Documents

- `CURRENT_STATE.md` — what the repository looked like before this
- `ARCHITECTURE.md` — the pipeline, with diagrams
- `LICENSE_AUDIT.md` — the reference projects, licences, and what was and was not taken
- `THIRD_PARTY_REFERENCES.md` — credit for the ideas
- `POINT_IN_TIME.md` — why the guard exists and what it blocks
- `CALCULATION_CATALOG.md` — every formula, its version and its refusals
- `LIMITATIONS.md` — what this cannot do yet
