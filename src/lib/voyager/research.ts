/**
 * What bounds a web search, now that the planner decides when to run one.
 *
 * There used to be a keyword gate here: a list of English words that meant
 * "something that happened" — *today*, *earnings*, *why did* — checked against
 * the question before the model ever saw it. It kept definitions from costing
 * money, which was the point, and it also meant «почему сегодня упала Tesla»
 * was answered from memory while its English twin was researched. A gate that
 * only works in one language is not a gate; it is a bias with a budget
 * justification.
 *
 * So the decision moved to the planner, which can read any language, and the
 * spend is bounded by things that do not depend on one:
 *
 * - **Billing is per search actually run**, not per search offered, so opening
 *   the door costs nothing on its own.
 * - **`MAX_SEARCHES` caps one answer**, so no single question can run away
 *   with the bill.
 * - **`VOYAGER_WEB_SEARCH=off` stops it without a deploy.** A feature that
 *   spends money per use needs a stop that is not a git push.
 *
 * The instruction not to search definitions still exists — it is in the tool
 * brief, where it applies to every language rather than to a word list.
 *
 * No imports, on purpose: the unit harness compiles this file with bare `tsc`.
 */

/** How many searches one answer may run. A ceiling on the bill, per question. */
export const MAX_SEARCHES = 4;

function pad(question: string): string {
  return ` ${question.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

/**
 * What the person is told when they ask Voyager to run Pine Script.
 *
 * Voyager writes Pine and cannot run it. The engine that executes it belongs to
 * TradingView, and reimplementing or copying it is out of bounds for this
 * project — so the limit is real and permanent rather than a phase that has not
 * shipped yet.
 *
 * Said in the answer, not buried in a footnote. Somebody who believes the code
 * was tested against live data before they saw it is somebody who will trade on
 * an untested script.
 */
export const PINE_NOT_EXECUTED =
  'I can write and explain Pine Script, but I cannot run it. Executing it needs TradingView’s own engine, which is not something this platform reimplements — so treat anything I write as a draft to review and test on a chart yourself, not as a script that has already been checked against live data.';

/** Whether an answer is about Pine, and therefore owes the person that sentence. */
export function mentionsPine(question: string): boolean {
  const padded = pad(question);
  return [' pine ', ' pinescript ', ' pine script ', ' indicator ', ' strategy script '].some(
    (word) => padded.includes(word)
  );
}
