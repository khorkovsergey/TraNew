/**
 * When Voyager is allowed to go and look something up.
 *
 * Web search runs on Anthropic's infrastructure and is billed per search on top
 * of tokens. Every question is not a research question: "what is a drawdown" is
 * answered from a table written in this repository, and paying to search the
 * open web for it would be spending somebody's money to get a worse answer.
 *
 * So the gate is narrow and deliberate. It opens for questions that turn on
 * something that happened — a price, a filing, a forecast, a date — and stays
 * shut for questions about how things work, which do not change.
 *
 * No imports, on purpose: the unit harness compiles this file with bare `tsc`.
 */

/** How many searches one answer may run. A ceiling on the bill, per question. */
export const MAX_SEARCHES = 4;

/**
 * Words that mean "something that happened", as opposed to "how something
 * works".
 *
 * Deliberately about recency and specificity rather than about topic. "Tesla"
 * alone is not a research question; "what do analysts forecast for Tesla" is.
 */
const FRESH = [
  'today', 'yesterday', 'this week', 'this month', 'this quarter', 'this year',
  'latest', 'recent', 'recently', 'current', 'currently', 'now', 'so far',
  'news', 'headline', 'headlines', 'announced', 'announcement', 'reported',
  'earnings', 'results', 'guidance', 'filing', 'filings', 'sec', 'quarterly',
  'forecast', 'forecasts', 'outlook', 'analyst', 'analysts', 'consensus',
  'price target', 'upgrade', 'downgrade', 'rating',
  'closed', 'close', 'session', 'rally', 'selloff', 'sell-off', 'plunge',
  'happened', 'happening', 'why did', 'why has', 'why is',
];

/**
 * Questions that are about the shape of an idea, not about an event.
 *
 * Checked after the fresh words and beats them, because "what is the current
 * ratio" is still a definition question wearing the word "current".
 */
const TIMELESS = [
  ' what is ', ' what are ', ' what does ', ' explain ', ' definition ',
  ' how does ', ' how do ', ' difference between ', ' meaning of ',
];

function pad(question: string): string {
  return ` ${question.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

/**
 * Whether this question is worth a search.
 *
 * `enabled` is the operator's switch and comes first: a feature that bills per
 * use needs a way to stop that does not require a deploy.
 */
export function wantsSearch(question: string, enabled: boolean): boolean {
  if (!enabled) return false;

  const padded = pad(question);
  if (TIMELESS.some((opener) => padded.includes(opener))) return false;

  return FRESH.some((word) => padded.includes(` ${word.replace(/[^a-z0-9]+/g, ' ')} `));
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
