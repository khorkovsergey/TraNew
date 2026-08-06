import type { Horizon, Knowledge, Priority, StartAnswers } from './path';

/**
 * The plan a person's four answers produce.
 *
 * This replaces the static list that used to sit in the wizard's sidebar. That
 * list was the same five rows whatever anybody answered, beside a heading that
 * said "your suggested starting path" — a generic route wearing a personal
 * label, which is the exact thing the journey is meant to stop.
 *
 * Two properties hold the whole design together and both are tested:
 *
 *   Every step carries `why`, and every `why` quotes an answer the person
 *   actually gave. A step that cannot say which answer produced it has no
 *   business being in a personalised plan, and the check is mechanical rather
 *   than editorial — the builder cannot emit a step without one.
 *
 *   The step library is closed. A suggestion is something this product stands
 *   behind, so it is written and reviewed rather than assembled at runtime, and
 *   no step names a product, an amount or a ticker. Four questions cannot tell
 *   anybody what to buy.
 *
 * Dependency-free, so the rules can be tested without a browser.
 */

export type RiskComfort = 'low' | 'moderate' | 'high';

export type PlanStepId =
  | 'reserve'
  | 'basics-full'
  | 'basics-refresh'
  | 'compare-growth'
  | 'compare-income'
  | 'compare-cash'
  | 'practice'
  | 'save';

export type PlanAction =
  /** Opens a lesson or the path that contains it. */
  | { kind: 'learn'; slug?: string }
  /** Opens the comparison screen with these classes already chosen. */
  | { kind: 'compare'; assets: string[] }
  /** Opens the practice portfolio at a starting allocation. */
  | { kind: 'practice'; allocation: RiskComfort }
  /** Asks for an account, which is the only thing that needs one. */
  | { kind: 'save' };

export type PlanStep = {
  id: PlanStepId;
  title: string;
  text: string;
  /** Minutes, honestly estimated. Shown so nobody starts a step blind. */
  minutes: number;
  /** Which answer produced this step, quoted back. Never empty. */
  why: string;
  action: PlanAction;
};

/**
 * Risk comfort, derived rather than asked.
 *
 * The diagnostic has four questions and the mockup keeps it at four, so this is
 * inferred from the goal and the horizon instead of being a fifth. The profile
 * card says it was inferred — a number presented as something the person told
 * us, when they did not, is the kind of quiet fabrication this screen exists to
 * avoid.
 */
export function riskComfortOf(answers: StartAnswers): RiskComfort {
  const has = (key: Priority) => answers.priorities.includes(key);

  if (has('safety') || has('cash') || answers.horizon === 'short') return 'low';
  if (has('growth') && answers.horizon === 'long') return 'high';
  return 'moderate';
}

const ALLOCATION_LABEL: Record<RiskComfort, string> = {
  low: 'defensive',
  moderate: 'balanced',
  high: 'growth-tilted',
};

const GOAL_LABEL: Record<Priority, string> = {
  safety: 'Safety',
  growth: 'Growth',
  income: 'Regular income',
  cash: 'Access to cash',
  unsure: 'not sure yet',
};

const HORIZON_LABEL: Record<Horizon, string> = {
  short: 'within a year',
  medium: 'one to five years',
  long: 'more than five years',
  unsure: 'not decided yet',
};

const KNOWLEDGE_LABEL: Record<Knowledge, string> = {
  new: 'all of this is new',
  basics: 'you know the basics',
  investing: 'you already invest',
};

/** The plan, in order. Between three and five steps, depending on the answers. */
export function buildPlan(answers: StartAnswers): PlanStep[] {
  const steps: PlanStep[] = [];
  const has = (key: Priority) => answers.priorities.includes(key);
  const risk = riskComfortOf(answers);

  /*
   * A cash reserve comes first whenever safety, access to cash, a horizon under
   * a year or a low risk comfort is in play. Investing money that may be needed
   * next year is the most common way a beginner is hurt, and no other step is
   * worth taking before that one.
   */
  if (has('safety') || has('cash') || answers.horizon === 'short' || risk === 'low') {
    const reason = has('safety')
      ? 'You chose Safety, so the first job is money you cannot lose.'
      : has('cash')
        ? 'You chose Access to cash, which is what a reserve is for.'
        : answers.horizon === 'short'
          ? 'Your horizon is under a year, and money needed that soon should not be invested.'
          : 'Your answers point to a low tolerance for falls, and a reserve is what removes forced selling.';

    steps.push({
      id: 'reserve',
      title: 'Build a cash reserve',
      text: 'Enough set aside that an unexpected bill never forces you to sell something at the wrong moment.',
      minutes: 10,
      why: reason,
      action: { kind: 'learn', slug: 'cash' },
    });
  }

  if (answers.knowledge === 'new') {
    steps.push({
      id: 'basics-full',
      title: 'Work through the beginner path',
      text: 'Five short lessons, in the order they build on each other.',
      minutes: 30,
      why: `You said ${KNOWLEDGE_LABEL.new}, so the path starts at the beginning rather than in the middle.`,
      action: { kind: 'learn' },
    });
  } else {
    steps.push({
      id: 'basics-refresh',
      title: 'Refresh two ideas',
      text: 'Risk and return, and what diversification does and does not do.',
      minutes: 12,
      why: `You said ${KNOWLEDGE_LABEL[answers.knowledge ?? 'basics']}, so this is a refresher rather than a course.`,
      action: { kind: 'learn', slug: 'why-people-invest' },
    });
  }

  /*
   * The comparison follows the goal. Where two goals were chosen the first one
   * decides, because a plan that compares everything compares nothing.
   */
  if (has('income')) {
    steps.push({
      id: 'compare-income',
      title: 'Compare income options',
      text: 'Where regular payouts come from, and how reliable each source is.',
      minutes: 8,
      why: 'You chose Regular income, so the comparison is between the things that pay one.',
      action: { kind: 'compare', assets: ['bonds', 'stocks', 'property'] },
    });
  } else if (has('cash') || has('safety')) {
    steps.push({
      id: 'compare-cash',
      title: 'Compare savings and short-term options',
      text: 'What the steadiest choices pay, and what they cost you in inflation.',
      minutes: 8,
      why: `You chose ${has('cash') ? GOAL_LABEL.cash : GOAL_LABEL.safety}, so the comparison stays at the steady end.`,
      action: { kind: 'compare', assets: ['cash', 'bonds', 'etfs'] },
    });
  } else {
    steps.push({
      id: 'compare-growth',
      title: 'Compare ETFs and bonds for your horizon',
      text: 'The two most common long-horizon choices, side by side.',
      minutes: 8,
      why: has('growth')
        ? `You chose Growth and a horizon of ${HORIZON_LABEL[answers.horizon ?? 'unsure']}.`
        : `Your horizon is ${HORIZON_LABEL[answers.horizon ?? 'unsure']}, which is what this comparison is scaled to.`,
      action: { kind: 'compare', assets: ['etfs', 'bonds', 'cash'] },
    });
  }

  steps.push({
    id: 'practice',
    title: 'Try a practice portfolio',
    text: `Start from a ${ALLOCATION_LABEL[risk]} allocation and change it. Virtual money, real prices.`,
    minutes: 15,
    why: `Your answers point to a ${risk} tolerance for falls, so the simulator opens ${ALLOCATION_LABEL[risk]} rather than at a default.`,
    action: { kind: 'practice', allocation: risk },
  });

  steps.push({
    id: 'save',
    title: 'Save your plan',
    text: 'Keep the route and the progress, and pick it up on any device.',
    minutes: 1,
    why: 'Your four answers produced this route. Everything above works without an account — this is the one step that needs one.',
    action: { kind: 'save' },
  });

  return steps;
}

/** One line per answer, for the "How your answers shaped this" rail. */
export function shapedBy(answers: StartAnswers): string[] {
  const lines: string[] = [];

  if (answers.knowledge) {
    lines.push(`You said ${KNOWLEDGE_LABEL[answers.knowledge]} — that set where the learning starts.`);
  }
  if (answers.priorities.length) {
    const named = answers.priorities.map((key) => GOAL_LABEL[key]).join(' and ');
    lines.push(`You chose ${named} — that chose the comparison.`);
  }
  if (answers.horizon) {
    lines.push(
      `You may need the money ${HORIZON_LABEL[answers.horizon]} — that decided whether a reserve comes first.`
    );
  }
  lines.push(
    `From those, your tolerance for falls reads as ${riskComfortOf(answers)} — that set the starting allocation. It was inferred, not asked.`
  );

  return lines;
}

/** The investor profile, as four rows with an interpretation each. */
export function profileOf(answers: StartAnswers): Array<{ label: string; value: string; note: string }> {
  const risk = riskComfortOf(answers);

  return [
    {
      label: 'Goal',
      value: answers.priorities.map((key) => GOAL_LABEL[key]).join(', ') || 'Not chosen',
      note: 'What the plan is built around.',
    },
    {
      label: 'Horizon',
      value: answers.horizon ? HORIZON_LABEL[answers.horizon] : 'Not chosen',
      note: 'How long the money can be left alone.',
    },
    {
      label: 'Knowledge',
      value: answers.knowledge ? KNOWLEDGE_LABEL[answers.knowledge] : 'Not chosen',
      note: 'Where the reading starts.',
    },
    {
      label: 'Risk comfort',
      value: risk,
      note: 'Inferred from your goal and horizon, not asked.',
    },
  ];
}

/* ---------------------------------------------------------------- progress */

/**
 * Which steps are done.
 *
 * Stored as ids rather than indexes: a plan is rebuilt whenever answers change,
 * and an index would silently mark a different step complete.
 */
export function parseProgress(raw: unknown, steps: PlanStep[]): PlanStepId[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(steps.map((step) => step.id));
  const out: PlanStepId[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string' && known.has(entry as PlanStepId) && !out.includes(entry as PlanStepId)) {
      out.push(entry as PlanStepId);
    }
  }
  return out;
}

/** The first step not yet done — the one the page makes primary. */
export function nextStep(steps: PlanStep[], done: readonly PlanStepId[]): PlanStep | null {
  return steps.find((step) => !done.includes(step.id)) ?? null;
}

export function planProgress(steps: PlanStep[], done: readonly PlanStepId[]) {
  const completed = steps.filter((step) => done.includes(step.id)).length;
  return {
    completed,
    total: steps.length,
    // Never rounds up to 100 while something is outstanding.
    percent:
      completed === steps.length ? 100 : Math.min(99, Math.round((completed / steps.length) * 100)),
  };
}
