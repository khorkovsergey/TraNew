import { EMPTY_ANSWERS, parseDraft, type StartAnswers } from './path';

/**
 * The guest's wizard draft, as an external store.
 *
 * Local storage is not React state, and reading it in a `useState` initialiser
 * is the classic way to get a hydration mismatch: the server renders an empty
 * wizard, the browser's first render fills in the saved answers, and the two
 * trees disagree. `useSyncExternalStore` exists for exactly this — it takes a
 * server snapshot, uses it for hydration, and switches to the real value after,
 * with no mismatch and no flash of the wrong thing halfway.
 *
 * What is kept: four preference keys and nothing else. No name, no amount, no
 * holdings — a draft is worth carrying between visits, and it is not worth
 * putting anything sensitive in a place any script on the page can read.
 */

const KEY = 'tn.start.draft.v1';

/*
 * The snapshot is cached, not rebuilt.
 *
 * `useSyncExternalStore` compares snapshots by identity and re-renders whenever
 * they differ; a getter that parsed the JSON afresh each call would return a new
 * object every time and loop forever.
 */
let current: StartAnswers = EMPTY_ANSWERS;
let loaded = false;
const listeners = new Set<() => void>();

export function subscribeDraft(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function draftSnapshot(): StartAnswers {
  if (!loaded) {
    loaded = true;
    current = read();
  }
  return current;
}

/** What the server renders, and what the browser hydrates against. */
export function draftServerSnapshot(): StartAnswers {
  return EMPTY_ANSWERS;
}

export function setDraft(next: StartAnswers): void {
  current = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // A full or disabled store costs the draft, not the wizard.
  }
  listeners.forEach((listener) => listener());
}

export function clearDraft(): void {
  current = EMPTY_ANSWERS;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // As above.
  }
  listeners.forEach((listener) => listener());
}

function read(): StartAnswers {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_ANSWERS;
    // Anything on the page can write this key, so it is parsed, not trusted.
    return parseDraft(JSON.parse(raw)) ?? EMPTY_ANSWERS;
  } catch {
    return EMPTY_ANSWERS;
  }
}
