# Limitations

Written plainly, because an engine that produces investment assessments should
be clearest about what it cannot do.

## Data

- **There is no market data.** Everything runs on frozen fixtures for a
  fictional company, Northwind Instruments. This is stated in every assessment's
  `limitations` array and on screen. No provider adapter is implemented, so
  nothing here can be mistaken for a statement about a real listed company.
- No news, macro, peer or estimate data. The macro state is reported as
  `not_assessed` rather than inferred from nothing.

## Interpretation

- **The agents are deterministic, not model-driven.** They read the
  calculations and produce a reading of them in code.

  This was the deliberate first step rather than a placeholder: it makes the
  pipeline, the evidence contract and the validator testable without a model in
  the loop. A version that started with the model would have no way to tell an
  engine bug from a bad generation. `agents/index.ts` is where the model layer
  plugs in, and nothing around it changes when it does.

- Consequently the language is narrower than a model would produce, and the
  findings are shaped by what the calculations cover.

## Coverage against the specification

- Six agents of the twelve listed. No news, macro, portfolio-fit, moat or
  management agents.
- Three skills declared, of twenty-seven.
- No persistence: runs are not stored, so they are not reproducible after the
  response is sent.
- No caching, no runtime budget enforcement, no OpenTelemetry spans.
- One instrument. The resolver returns the fixture — but the
  `InstrumentIdentity` contract everything downstream depends on is real, so
  replacing it is contained rather than structural.
- No evaluation framework, no Docker (the engine ships with the portal).

## A weakness in the confidence model worth watching

Confidence is assembled from seven components, and on the demo fixture it comes
out in the 80s because the fixture is complete, primary-sourced and current.
That is arithmetically correct and still worth flagging: a complete data set
about a company nobody has examined closely is not the same thing as a
well-understood company.

`signalConsistency` is the only component that reflects the quality of the
analysis rather than the quality of the data, and it carries 10%. Before this is
used on real companies that balance should be revisited.

## What was found while building this

A fixture marked a spot price as an annual period. `point` sorted after
`FY2025`, became the latest reporting year, and nine of seventeen calculations
silently returned null — the assessment reported `not_assessed` for business
quality and valuation with nothing failing anywhere.

Every unit test passed throughout, because they exercise the formulas directly
and the break was in the wiring between the fixtures and the calculation stage.

The pipeline-level test added afterwards asserts that a complete run produces a
number for every calculation. That is the shape of assertion that catches this
class of fault, and it is the reason the suite now runs the whole graph rather
than only its parts.
