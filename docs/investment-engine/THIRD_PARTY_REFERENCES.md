# Third-party references

These projects were read while designing the engine. No code from any of them is
present in this repository — see `LICENSE_AUDIT.md` for the commit-level record.
They are credited here because they were published to be learned from, and the
engine is better for them.

- **InvestSkill** (MIT) — https://github.com/yennanliu/InvestSkill
  For treating investment methods as declarative units with declared inputs, and
  for the idea of validating a finished analysis rather than trusting it.

- **TradingAgents** (Apache-2.0) — https://github.com/TauricResearch/TradingAgents
  For analysts split by role and for a structured bull/bear debate above them.

- **FinRobot** (Apache-2.0) — https://github.com/AI4Finance-Foundation/FinRobot
  For the separation of numeric work from model reasoning, which became this
  engine's central constraint.

- **maverick-mcp** (MIT) — https://github.com/wshobson/maverick-mcp
  For a financial tools layer that is independent of anything that reasons about
  it.

- **ai-hedge-fund** (MIT) — https://github.com/virattt/ai-hedge-fund
  For independent investment opinions reaching a committee, and for taking
  point-in-time correctness seriously.

- **OpenBB** (AGPL-3.0 core; MIT for openbb-ai) — https://github.com/OpenBB-finance/OpenBB
  For the provider-abstraction idea, from public documentation only. **No OpenBB
  code may enter this repository without a recorded legal decision** — the AGPL's
  network clause would extend to the whole product.
