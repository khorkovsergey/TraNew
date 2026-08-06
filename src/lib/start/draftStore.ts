import { EMPTY_ANSWERS, parseDraft, type StartAnswers } from './path';
import { buildPlan, parseProgress, type PlanStep, type PlanStepId } from './plan';

/**
 * The guest's plan, as one external store.
 *
 * Three things live here and they have to agree: the four answers, the route
 * built from them, and which steps are done. Every surface that shows the plan —
 * the result page, the guest workspace, the resume strip — reads this and only
 * this. The alternative was each screen rebuilding the route for itself, which
 * works until two of them disagree about what step three is.
 *
 * The route is *derived*, not stored. Storing it would mean a copy that can go
 * stale the moment somebody edits an answer, and a stale route is worse than no
 * route because it still looks personal. Progress is stored, because it is not
 * derivable from anything.
 *
 * Local storage is not React state, and reading it in a `useState` initialiser
 * is the classic hydration mismatch — the server renders an empty plan and the
 * browser's first render fills it in. `useSyncExternalStore` exists for exactly
 * this: a server snapshot for hydration, the real value after, no mismatch and
 * no flash of the wrong thing halfway.
 *
 * What is kept: four preference keys and a list of step ids. No name, no
 * amount, no holdings — a draft is worth carrying between visits, and it is not
 * worth putting anything sensitive in a place any script on the page can read.
 */

const ANSWERS_KEY = 'tn.start.draft.v1';
const PROGRESS_KEY = 'tn.plan.progress.v1';

export type PlanState = {
  answers: StartAnswers;
  steps: PlanStep[];
  done: PlanStepId[];
};

const EMPTY: PlanState = { answers: EMPTY_ANSWERS, steps: [], done: [] };

/*
 * The snapshot is cached, not rebuilt.
 *
 * `useSyncExternalStore` compares snapshots by identity and re-renders whenever
 * they differ; a getter that parsed the JSON afresh each call would return a new
 * object every time and loop forever.
 */
let current: PlanState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeDraft(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function draftSnapshot(): PlanState {
  if (!loaded) {
    loaded = true;
    current = read();
  }
  return current;
}

/** What the server renders, and what the browser hydrates against. */
export function draftServerSnapshot(): PlanState {
  return EMPTY;
}

export function setAnswers(answers: StartAnswers): void {
  const steps = buildPlan(answers);
  current = {
    answers,
    steps,
    // Editing an answer can remove a step. Progress is filtered against the new
    // route rather than carried over blind — a done id that is no longer in the
    // plan would inflate the count against a plan that never contained it.
    done: parseProgress(current.done, steps),
  };
  write(ANSWERS_KEY, answers);
  write(PROGRESS_KEY, current.done);
  notify();
}

export function markStep(id: PlanStepId, done: boolean): void {
  const next = done
    ? current.done.includes(id)
      ? current.done
      : [...current.done, id]
    : current.done.filter((entry) => entry !== id);

  current = { ...current, done: parseProgress(next, current.steps) };
  write(PROGRESS_KEY, current.done);
  notify();
}

export function clearDraft(): void {
  current = EMPTY;
  remove(ANSWERS_KEY);
  remove(PROGRESS_KEY);
  notify();
}

function read(): PlanState {
  try {
    const rawAnswers = window.localStorage.getItem(ANSWERS_KEY);
    if (!rawAnswers) return EMPTY;

    // Anything on the page can write these keys, so they are parsed, not trusted.
    const answers = parseDraft(JSON.parse(rawAnswers));
    if (!answers) return EMPTY;

    const steps = buildPlan(answers);
    const rawProgress = window.localStorage.getItem(PROGRESS_KEY);
    const done = rawProgress ? parseProgress(JSON.parse(rawProgress), steps) : [];

    return { answers, steps, done };
  } catch {
    return EMPTY;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full or disabled store costs the draft, not the wizard.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // As above.
  }
}
