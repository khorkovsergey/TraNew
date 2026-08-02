# Licence audit — reference projects

Recorded 2 August 2026. Every project below was cloned to a temporary directory
outside the repository, read, and deleted. **No source file from any of them was
copied, adapted, or vendored into TradingNew.** What was taken is architectural:
the shape of a pipeline, the division of labour between code and model, the idea
of validating an analysis against its own evidence.

Where a project's approach was rejected, the reason is recorded too — that is
the part that stops a future contributor from "fixing" a deliberate difference.

## Summary

| Project | Licence | Code copied | Adapted files | Attribution required | Commercial use | Needs legal review |
|---|---|---|---|---|---|---|
| InvestSkill | MIT | No | None | Not required (nothing used) | Permitted | No |
| TradingAgents | Apache-2.0 | No | None | Not required (nothing used) | Permitted | No |
| FinRobot | Apache-2.0 | No | None | Not required (nothing used) | Permitted | No |
| maverick-mcp | MIT | No | None | Not required (nothing used) | Permitted | No |
| ai-hedge-fund | MIT | No | None | Not required (nothing used) | Permitted | No |
| OpenBB (core) | **AGPL-3.0** | **No — and must not be** | None | n/a | **Incompatible with a proprietary product** | **Yes, before any use** |
| openbb-ai | MIT | No | None | Not required (nothing used) | Permitted | No |

Attribution is listed as "not required" because nothing was used in the
copyright sense. MIT and Apache-2.0 attach conditions to *copies of the code*,
not to having read it. `THIRD_PARTY_REFERENCES.md` credits all of them anyway,
because reading someone's architecture and saying nothing about it is a poor way
to treat work that was published to be learned from.

## Per project

### InvestSkill — MIT

- URL: https://github.com/yennanliu/InvestSkill
- Commit: `cc12c65e8e7b5b81f03f098d3a00aafa99913770`
- Licence: MIT, © 2026 yennanliu

**Ideas studied.** A library of investment methods as separate, declarative
units rather than as one long prompt; each declaring the inputs it needs and the
shape of its result; a validator pass over a finished analysis.

**Adopted.** The unit-per-method structure, the declared-inputs idea, and the
separate validation step — which became `evidence/validateClaim`.

**Deliberately not adopted.** The prompts produce categorical BUY/HOLD/SELL
verdicts and model-stated confidence. Both are refused here: the stance
vocabulary has no imperative in it, and confidence is assembled in code from
named components (`CONFIDENCE_WEIGHTS`). A model asked how confident it is
answers with a number correlated to how fluent its output was.

**Code copied.** None. No prompt text was reused; the skill definitions here
were written for this engine.

### TradingAgents — Apache-2.0

- URL: https://github.com/TauricResearch/TradingAgents
- Commit: `a33fd4c0f134485a43553a2c23a63cb14adbd88f`

**Ideas studied.** Analysts split by role, a bull/bear research debate, a
research manager and a risk manager above them, structured agent state passed
between graph nodes.

**Adopted.** The role split, the debate, and a committee that reads the debate
rather than replacing it.

**Deliberately not adopted.** The project's purpose is an automated trading
decision. This engine produces an explainable assessment and never a trade: it
has no execution path, and the policy layer removes any sentence instructing a
transaction. The committee also weighs rather than averages — averaging lets
three agreeable readings outvote one properly evidenced objection.

**Code copied.** None. The graph here is a plain sequenced pipeline in
TypeScript; no LangGraph, no port of their node structure.

### FinRobot — Apache-2.0

- URL: https://github.com/AI4Finance-Foundation/FinRobot
- Commit: `01ed408326f1d4ec2460596dee10858faf0f69af`

**Ideas studied.** Separation of numeric work from model reasoning; producing
equity research from filings; evidence-backed output.

**Adopted.** The central principle, stated in the spec as *code calculates, the
model interprets, sources prove, the validator checks* — which is enforced
structurally here: there is no field in `AgentFinding` a model could put a
number into that is not already a `CalculationResult`.

**Code copied.** None.

### maverick-mcp — MIT

- URL: https://github.com/wshobson/maverick-mcp
- Commit: `b6379894880a91604f280abb13fed985fdad7ef3`
- README confirms MIT and states free commercial use.

**Ideas studied.** A tools layer separate from the agent; typed tool contracts;
transparent indicator implementations; caching and historical access.

**Adopted.** The separation of the calculation layer from anything that reasons
about it. MCP was not adopted as an internal transport — the engine's internal
boundaries are typed function calls, which is what the surrounding codebase
uses.

**Code copied.** None. The indicator implementations here were written against
published formulas and carry their own tests and formula versions.

### ai-hedge-fund — MIT

- URL: https://github.com/virattt/ai-hedge-fund
- Commit: `6c41ae8cf5fb4e30eb8cdb6a816eb56ff234989d`

**Ideas studied.** Several independent investment schools reaching separate
opinions; a portfolio manager and risk manager above them; point-in-time
correctness.

**Adopted.** Independent opinions and the point-in-time requirement, which
became `data/pointInTime.ts` and the lookahead tests.

**Deliberately not adopted.** That project names its agents after living and
historical investors. The roles here are neutral — Fundamental Analyst,
Valuation Analyst, Technical Analyst, Bull Case, Bear Case, Risk Analyst — as
the specification requires. Putting a real person's name on a generated opinion
attributes a view to someone who did not express it.

**Code copied.** None.

### OpenBB — AGPL-3.0 (core) and MIT (openbb-ai)

- Core: https://github.com/OpenBB-finance/OpenBB — **AGPL-3.0**, verified by
  fetching the licence file directly; not cloned.
- openbb-ai: https://github.com/OpenBB-finance/openbb-ai — MIT.

**Status: no OpenBB code is present in this repository, and none may be added
without a separate written decision.**

The AGPL's network clause is the issue, not the copyleft alone: serving a
modified AGPL work over a network obliges the operator to offer the
corresponding source of the whole work to its users. TradingNew is served over a
network. Linking OpenBB core into it would put that obligation on the entire
product, which is not a decision an implementation task can make.

**Ideas studied.** The provider-abstraction idea only, from public documentation
— a unified interface over several financial data vendors, which is
long-standing practice and not specific to OpenBB.

**Action required before any use:** legal review, recorded here, naming the
component and the intended linkage.

## What this audit does not cover

- Data **licences**, which are separate from code licences. Nothing in this
  build fetches vendor data — it runs on fictional fixtures — but a provider
  adapter will bring redistribution terms with it, and each needs its own entry
  in `DATA_PROVIDER_MATRIX.md` before it is enabled.
- Model provider terms.
- Patents. Apache-2.0 grants a patent licence; MIT does not mention patents.
  Since no code was taken under either, neither grant is being relied on.
