import type { DrawingInstance } from '../drawings/types';
import type { StudyChoice } from '../layouts/schema';

/**
 * Undo and redo, by transaction rather than by change.
 *
 * The reason this exists before the command bus that will use it: one Voyager
 * request produces several changes — add EMA 20, add EMA 50, mark the
 * crossovers, open the script. To the person that was **one thing they asked
 * for**, so it has to be one thing they can undo. A per-change history makes
 * them press undo four times and watch their chart come apart in stages, which
 * is worse than not offering undo.
 *
 * The state captured is deliberately small: the studies chosen and the drawings
 * present. Not the bars, not the visible range, not the crosshair. Undo should
 * put back what was changed, and scrolling somewhere else in between is not a
 * change to undo.
 */

export type UndoableState = {
  studies: StudyChoice[];
  drawings: DrawingInstance[];
};

export type Transaction = {
  id: string;
  /** What to show in the history and in a toast: "Added EMA 20 and EMA 50". */
  title: string;
  source: 'user' | 'voyager';
  before: UndoableState;
  after: UndoableState;
  createdAt: string;
};

export type History = {
  past: Transaction[];
  future: Transaction[];
};

export const EMPTY_HISTORY: History = { past: [], future: [] };

/** Beyond this the oldest are dropped; a session is not an archive. */
const MAX_DEPTH = 50;

export function record(
  history: History,
  transaction: Transaction
): History {
  return {
    past: [...history.past, transaction].slice(-MAX_DEPTH),
    // A new change discards the redo branch, because redoing after diverging
    // would apply a change to a state it was never computed against.
    future: [],
  };
}

export function undo(history: History): { history: History; state: UndoableState } | null {
  const transaction = history.past[history.past.length - 1];
  if (!transaction) return null;

  return {
    history: {
      past: history.past.slice(0, -1),
      future: [transaction, ...history.future],
    },
    state: transaction.before,
  };
}

export function redo(history: History): { history: History; state: UndoableState } | null {
  const transaction = history.future[0];
  if (!transaction) return null;

  return {
    history: {
      past: [...history.past, transaction],
      future: history.future.slice(1),
    },
    state: transaction.after,
  };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

/** What the last undoable action was, for the button's title and a toast. */
export function lastTitle(history: History): string | null {
  return history.past[history.past.length - 1]?.title ?? null;
}

/**
 * Describes a change in words, from what actually differs.
 *
 * Written from the diff rather than passed in by the caller, so the history
 * cannot describe something other than what happened — which is the failure a
 * hand-written label invites when a code path changes later.
 */
export function describe(before: UndoableState, after: UndoableState): string {
  const parts: string[] = [];

  const studiesAdded = after.studies.filter(
    (study) => !before.studies.some((old) => old.definitionId === study.definitionId)
  );
  const studiesRemoved = before.studies.filter(
    (study) => !after.studies.some((next) => next.definitionId === study.definitionId)
  );

  if (studiesAdded.length) parts.push(`added ${studiesAdded.length} study${studiesAdded.length > 1 ? 's' : ''}`);
  if (studiesRemoved.length) parts.push(`removed ${studiesRemoved.length} study${studiesRemoved.length > 1 ? 's' : ''}`);

  const drawingsAdded = after.drawings.length - before.drawings.length;
  if (drawingsAdded > 0) parts.push(`added ${drawingsAdded} drawing${drawingsAdded > 1 ? 's' : ''}`);
  if (drawingsAdded < 0) parts.push(`removed ${-drawingsAdded} drawing${drawingsAdded < -1 ? 's' : ''}`);

  if (!parts.length) {
    // Same counts, different contents — a move, a rename, a style change.
    const changed = after.drawings.some((drawing, index) => {
      const previous = before.drawings[index];
      return !previous || JSON.stringify(previous) !== JSON.stringify(drawing);
    });
    if (changed) parts.push('edited a drawing');
  }

  return parts.length ? capitalise(parts.join(' and ')) : 'No change';
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** True when nothing about the undoable state differs. */
export function unchanged(before: UndoableState, after: UndoableState): boolean {
  return JSON.stringify(before) === JSON.stringify(after);
}
