# Voyager as a research workspace — audit and plan

The brief (38 sections) turns Voyager from an assistant into a product area. Its
own §39 asks for an audit before any code. This is that audit, the plan it
produced, and the three decisions that are not ours to make.

## What already exists and is reused

| Piece | State | Used for |
| --- | --- | --- |
| `/voyager` workspace | two columns: conversation rail + module canvas | becomes the middle and right columns |
| Answer routing | 18 written answers → 31 concepts → 10 scenarios → live Claude | unchanged; the model is live in production |
| `contract.ts` | plan/module schema, validated, carries provenance and sources | **is** the Output panel's data contract |
| `voyagerWorkspace` table | one row per user, a serialised library | extends to chats |
| `voyagerMemory` table | encrypted long-term memory, soft-deleted | the persistent-context store |
| `chartScript` table | versioned Pine documents per user | the Pine Script tab's storage |
| `preference`, `consent`, `dataAccessLog` | working | Voyager Settings, and the audit trail behind them |
| better-auth + `next=` return path | working | §28 auth flow, already correct |
| `credits.ts` | guest 100 messages / 3,000 tokens | the guest ceiling |

Roughly half the brief's foundation is already in the database. The gap is
mostly interface and one genuinely missing capability.

## What does not exist

- **A third column.** The workspace is two.
- **More than one conversation.** A chat began on page load and ended on close.
- **Web retrieval.** Nothing. No search provider, no connector, no allowlist.
- **File upload or storage.** No multipart handler, no object store, no parser.
- **Chart execution.** `SUPERCHART_ENABLED` is off and there is no Pine engine.
- **Voyager Settings.** The route exists; preferred sources, custom URLs and
  files do not.
- **Analytics.** One of the thirteen events in §36 is emitted (`voyager_opened`).

## Phases

**1. Chats.** The model, the sidebar, Save/New, auth gating, guest session
drafts. Everything else hangs off this. *(model landed, tested)*

**2. The three-column shell.** Left history, middle dialogue, right Output with
Summary / Chart / Pine Script / Sources tabs driven by the existing contract.

**3. Persistence.** A `voyager_chat` table, explicit Save, and the auth flow
carrying the conversation through sign-in unbroken.

**4. Voyager Settings.** Preferred sources, custom source URLs, answer depth,
citation preference, portfolio and watchlist context toggles — all on
`preference` and `consent`, which exist.

**5. Pine Script tab.** Generation is already a scenario; the tab, copy/export
and `chartScript` storage are the work.

**6. Web retrieval.** See below — blocked on a decision.

**7. Personal context files.** Blocked on storage.

## Three decisions that are not ours

**Web retrieval (§11–13).** The brief forbids frontend scraping and asks for a
backend-mediated source-aware layer. The clean route is the Anthropic API's
server-side web search tool: retrieval happens on Anthropic's infrastructure,
sources come back attached to the answer, and nothing is scraped from the
browser. It bills per search on top of tokens. Nobody should switch that on
without the person paying for it saying so.

**Personal context files (§20C, §22).** Needs somewhere to put a PDF and
something to read it with — a Railway volume or object storage, plus a parser.
Both are new dependencies and the files are, by the brief's own §35, private.
Storing them in Postgres would work and is the wrong shape for documents.

**Chart execution (§15).** We cannot run Pine Script. That engine is
TradingView's, and copying it is out of bounds for this project by an explicit
rule. The brief agrees — §15 says not to fake execution. So the Chart tab shows
what our own data can honestly draw, beside the generated code, labelled as a
preview of what the script is meant to produce rather than its output. That is a
product limitation to state on screen, not a bug to hide.

## The rule that shapes the rest

Saving requires an account. Not as a growth tactic — there is nowhere else to
put a conversation that outlives a tab. Guests get everything except
persistence: chats, answers, Pine, outputs, and a session-length history that
says plainly it is not saved. `SAVE_REQUIRES_ACCOUNT` is a constant rather than
a comment so the rule is greppable from the interface that enforces it.
