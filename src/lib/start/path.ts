/**
 * The Start Investing wizard: what is asked, and what the answers suggest.
 *
 * Deliberately dependency-free so the rules can be tested without a browser.
 * Nothing here knows about React, routes or styling — it takes four answers and
 * returns a list of steps, and every step it can ever return is in `STEP_LIBRARY`
 * below. That closed list is the point: a suggestion is a thing this product
 * stands behind, so it cannot be assembled out of fragments at runtime.
 *
 * What it does not do, on purpose: it does not recommend an amount, a product,
 * a ticker or a broker. It orders education. A four-question form is nowhere near
 * enough to tell somebody what to do with their money, and pretending otherwise
 * would be the exact failure this screen is meant to avoid.
 */

export type Knowledge = 'new' | 'basics' | 'investing';
export type Priority = 'safety' | 'growth' | 'income' | 'cash' | 'unsure';
export type Horizon = 'short' | 'medium' | 'long' | 'unsure';
export type LearningStyle = 'reading' | 'examples' | 'practice' | 'questions';

export type StartAnswers = {
  knowledge: Knowledge | null;
  /** Up to two. The wizard drops the oldest rather than refusing the third. */
  priorities: Priority[];
  horizon: Horizon | null;
  learning: LearningStyle | null;
};

export const EMPTY_ANSWERS: StartAnswers = {
  knowledge: null,
  priorities: [],
  horizon: null,
  learning: null,
};

export const MAX_PRIORITIES = 2;

/**
 * Choosing a third priority replaces the oldest, rather than being ignored.
 *
 * A limit that silently refuses a click reads as a broken button; a limit that
 * shows the swap reads as a limit.
 */
export function togglePriority(current: Priority[], key: Priority): Priority[] {
  if (current.includes(key)) return current.filter((entry) => entry !== key);
  if (current.length >= MAX_PRIORITIES) return [...current.slice(1), key];
  return [...current, key];
}

export type PathStepId =
  | 'reserve'
  | 'basics'
  | 'risk'
  | 'compare-safe'
  | 'compare-growth'
  | 'compare-income'
  | 'practice'
  | 'inflation'
  | 'plan';

export type PathStep = {
  id: PathStepId;
  title: string;
  text: string;
  /** Which accent the row takes — the same closed vocabulary the rest of the redesign uses. */
  accent: 'green' | 'lime' | 'blue' | 'purple' | 'cyan' | 'amber';
};

const STEP_LIBRARY: Record<PathStepId, PathStep> = {
  reserve: {
    id: 'reserve',
    title: 'Build a cash reserve',
    text: 'Create a small safety net to handle life’s surprises.',
    accent: 'green',
  },
  basics: {
    id: 'basics',
    title: 'Learn investing basics',
    text: 'Understand key concepts and how markets work.',
    accent: 'lime',
  },
  risk: {
    id: 'risk',
    title: 'Understand risk and diversification',
    text: 'See why spreading money around changes the odds.',
    accent: 'amber',
  },
  'compare-safe': {
    id: 'compare-safe',
    title: 'Compare deposits and bonds',
    text: 'Look at the options that move least, and what they cost you.',
    accent: 'blue',
  },
  'compare-growth': {
    id: 'compare-growth',
    title: 'Compare ETFs and stocks',
    text: 'Explore simple, diversified options that fit a long horizon.',
    accent: 'blue',
  },
  'compare-income': {
    id: 'compare-income',
    title: 'Compare income options',
    text: 'See where regular payouts come from, and how reliable they are.',
    accent: 'blue',
  },
  practice: {
    id: 'practice',
    title: 'Try a practice portfolio',
    text: 'Practise with virtual money and build confidence.',
    accent: 'purple',
  },
  inflation: {
    id: 'inflation',
    title: 'See what inflation does to savings',
    text: 'Understand why money left alone loses ground.',
    accent: 'amber',
  },
  plan: {
    id: 'plan',
    title: 'Save your plan',
    text: 'Keep your plan and track your progress over time.',
    accent: 'cyan',
  },
};

/**
 * The suggested starting path.
 *
 * Rules, in order, so the reason for every row can be named:
 *
 *  1. A cash reserve comes first whenever safety, access to cash, or a horizon
 *     under a year is in play. Investing money you may need next year is the
 *     single most common way a beginner gets hurt, and no other suggestion is
 *     worth making before that one.
 *  2. Someone new to this learns the basics before comparing anything. Someone
 *     who already invests skips straight to the comparison.
 *  3. The comparison follows the priorities, not the fashion.
 *  4. Practice appears for anyone who said they learn by doing, and for anyone
 *     still unsure — it is the cheapest way to find out.
 *  5. Saving the plan is always last, because it is the step that needs the
 *     other four to exist.
 *
 * The result is capped at five: a list long enough to be a plan and short enough
 * to be started today.
 */
export const PATH_LIMIT = 5;

export function suggestPath(answers: StartAnswers): PathStep[] {
  const ids: PathStepId[] = [];
  const has = (key: Priority) => answers.priorities.includes(key);

  if (has('safety') || has('cash') || answers.horizon === 'short') {
    ids.push('reserve');
  }

  if (answers.knowledge !== 'investing') {
    ids.push('basics');
  }

  if (has('growth') || answers.horizon === 'long') {
    ids.push('compare-growth');
  }
  if (has('income')) {
    ids.push('compare-income');
  }
  if (has('safety') || has('cash')) {
    ids.push('compare-safe');
  }

  // Someone who named no priority at all still needs something to compare.
  if (!ids.some((id) => id.startsWith('compare'))) {
    ids.push('compare-growth');
  }

  if (has('safety') || has('cash')) {
    // The counterweight to a reserve: safety has a cost, and it is not zero.
    ids.push('inflation');
  }

  if (answers.knowledge === 'investing' || answers.priorities.length > 0) {
    ids.push('risk');
  }

  if (answers.learning === 'practice' || has('unsure') || answers.horizon === 'unsure') {
    ids.push('practice');
  }

  ids.push('plan');

  const seen = new Set<PathStepId>();
  const ordered: PathStep[] = [];

  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(STEP_LIBRARY[id]);
  }

  // "Save your plan" is the closing step, so it survives the cap.
  if (ordered.length <= PATH_LIMIT) return ordered;

  const closing = ordered[ordered.length - 1];
  return [...ordered.slice(0, PATH_LIMIT - 1), closing];
}

/** Every question answered. The wizard uses this to decide whether Continue moves on. */
export function isComplete(answers: StartAnswers): boolean {
  return (
    answers.knowledge !== null &&
    answers.priorities.length > 0 &&
    answers.horizon !== null &&
    answers.learning !== null
  );
}

/** Which step a returning draft should open on: the first one still unanswered. */
export function firstUnanswered(answers: StartAnswers): number {
  if (answers.knowledge === null) return 0;
  if (answers.priorities.length === 0) return 1;
  if (answers.horizon === null) return 2;
  if (answers.learning === null) return 3;
  return 3;
}

/**
 * A stored draft, checked rather than trusted.
 *
 * It comes from this browser's local storage, which anything running on the
 * page can write. Every field is validated against the closed sets above, and a
 * draft that fails any check is discarded whole rather than half-restored — a
 * half-restored draft would put someone on step 4 with answers they never gave.
 */
export function parseDraft(raw: unknown): StartAnswers | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;

  const knowledge = oneOf<Knowledge>(value.knowledge, ['new', 'basics', 'investing']);
  const horizon = oneOf<Horizon>(value.horizon, ['short', 'medium', 'long', 'unsure']);
  const learning = oneOf<LearningStyle>(value.learning, [
    'reading',
    'examples',
    'practice',
    'questions',
  ]);

  if (value.knowledge !== undefined && value.knowledge !== null && knowledge === null) return null;
  if (value.horizon !== undefined && value.horizon !== null && horizon === null) return null;
  if (value.learning !== undefined && value.learning !== null && learning === null) return null;

  const rawPriorities = value.priorities;
  if (rawPriorities !== undefined && !Array.isArray(rawPriorities)) return null;

  const priorities: Priority[] = [];
  for (const entry of (rawPriorities ?? []) as unknown[]) {
    const key = oneOf<Priority>(entry, ['safety', 'growth', 'income', 'cash', 'unsure']);
    if (key === null) return null;
    if (!priorities.includes(key)) priorities.push(key);
  }
  if (priorities.length > MAX_PRIORITIES) return null;

  return { knowledge, priorities, horizon, learning };
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}
