import type { VoyagerModule } from './contract';

/**
 * What Voyager is allowed to change outside the canvas, and how.
 *
 * Three rules, and the type system carries all three.
 *
 * **Nothing without confirmation.** A mutating action produces a `Confirmation`
 * — what will change, where, and what it costs — and nothing happens until that
 * is accepted. The confirmation is built from the action, not written by
 * whatever proposed it, so a button cannot describe itself more kindly than it
 * behaves.
 *
 * **Everything is recorded.** Applying appends to the history, with the module
 * that proposed it and the time. A change nobody can find later is a change
 * nobody can question.
 *
 * **Everything is undoable.** Every entry carries the inverse. An action whose
 * inverse cannot be described is not accepted here at all — which is why
 * "open in Supercharts" is a navigation rather than a mutation, and why there
 * is no "delete" among these.
 *
 * The Superchart command bus already does this for chart objects and is reused
 * for them rather than reimplemented; this covers the wider set the workspace
 * touches — watchlists, monitoring rules, saved work.
 *
 * Import-free beyond the contract, so the harness compiles it alone.
 */

export type ActionTarget = 'chart' | 'watchlist' | 'monitoring' | 'workspace' | 'script';

export type WorkspaceAction = {
  id: string;
  target: ActionTarget;
  /** What it does, in the reader's terms. */
  title: string;
  /** Where the change lands, so nobody has to guess which part of the portal moved. */
  where: string;
  /** What it costs or risks — never only the benefit. */
  caveat: string;
  /** How to undo it, in words. Empty means it cannot be undone and is refused. */
  undo: string;
};

/**
 * The actions the workspace knows how to perform.
 *
 * A closed set, keyed by the action id a module declares. An action id that is
 * not here does nothing and says so — there is no path from a label a model
 * wrote to a change in somebody's account.
 */
export const ACTIONS: Record<string, WorkspaceAction> = {
  apply_chart: {
    id: 'apply_chart',
    target: 'chart',
    title: 'Add these studies to your chart',
    where: 'Supercharts, on the symbol this workspace is about',
    caveat:
      'Your existing studies stay. The chart opens with the new ones marked as Voyager’s, dashed until you accept them there too.',
    undo: 'One press of undo on the chart removes them.',
  },
  watchlist: {
    id: 'watchlist',
    target: 'watchlist',
    title: 'Create a watchlist from these names',
    where: 'My Workspace, as a new list',
    caveat: 'It is a new list, so nothing you already have is touched or reordered.',
    undo: 'Deleting the list removes it; nothing else changes.',
  },
  enable_rule: {
    id: 'enable_rule',
    target: 'monitoring',
    title: 'Create this monitoring rule',
    where: 'My Workspace, under monitoring',
    caveat:
      'It runs until you switch it off and can email you. It watches a valuation, which moves for reasons that have nothing to do with the company.',
    undo: 'Switching the rule off stops it immediately and keeps its history.',
  },
  save_workspace: {
    id: 'save_workspace',
    target: 'workspace',
    title: 'Save this workspace',
    where: 'Your workspace library',
    caveat: 'Saved under the name Voyager suggested until you rename it.',
    undo: 'Deleting it removes the saved copy; what is on screen stays.',
  },
  open_chart: {
    id: 'open_chart',
    target: 'chart',
    title: 'Open this in Supercharts',
    where: 'The chart workspace, on this symbol',
    caveat: 'Nothing is added or changed by opening it.',
    undo: 'Nothing to undo — this only navigates.',
  },
  grant: {
    id: 'grant',
    target: 'workspace',
    title: 'Share the scopes you ticked, for this analysis',
    where: 'Your Wealth Hub, read-only, for this workspace',
    caveat:
      'Only the scopes you ticked are read, only while this analysis runs, and the values stay in your account — this workspace sees the shape of the portfolio, not a copy of it.',
    undo: 'Revoking in the inspector stops it at once and nothing read is kept.',
  },
  decline: {
    id: 'decline',
    target: 'workspace',
    title: 'Continue without your data',
    where: 'Nowhere — nothing is read',
    caveat: 'The answer will be about markets in general rather than about what you hold.',
    undo: 'Nothing to undo — nothing was shared.',
  },
  open_lab: {
    id: 'open_lab',
    target: 'script',
    title: 'Open this script in Script Lab',
    where: 'Script Lab, in the chart workspace',
    caveat: 'Nothing is saved or run by opening it.',
    undo: 'Nothing to undo — this only navigates.',
  },
};

export type Confirmation = {
  action: WorkspaceAction;
  /** The module that proposed it, so the history can say where it came from. */
  moduleTitle: string;
};

/**
 * The confirmation for an action, or a refusal.
 *
 * A read-only action needs no confirmation and returns none; a mutating action
 * whose id is unknown returns a refusal rather than a shrug, because an action
 * that silently does nothing is indistinguishable from one that worked.
 */
export function confirmationFor(
  module: VoyagerModule,
  actionId: string
): { confirmation: Confirmation } | { refused: string } | { navigate: WorkspaceAction } {
  const declared = module.actions.find((item) => item.id === actionId);
  if (!declared) return { refused: `"${actionId}" is not an action this card offers.` };

  const known = ACTIONS[actionId];
  if (!known) {
    return {
      refused: `"${declared.label}" is not something this workspace knows how to do, so nothing happened.`,
    };
  }

  // Navigation is not a mutation and is not gated: making somebody confirm
  // before a link teaches them to click through confirmations.
  if (!declared.mutates) return { navigate: known };

  return { confirmation: { action: known, moduleTitle: module.title } };
}

export type HistoryEntry = {
  id: string;
  actionId: string;
  title: string;
  where: string;
  undo: string;
  moduleTitle: string;
  at: string;
  /** False once undone; the entry stays so the record is of what happened. */
  active: boolean;
};

/**
 * Applying, recorded.
 *
 * The entry is kept after an undo rather than removed. A history that deletes
 * what was reversed answers "what is true now" and loses "what did this thing
 * do", and the second is the question somebody asks when a chart looks wrong.
 */
export function applyAction(
  history: HistoryEntry[],
  confirmation: Confirmation,
  at: string
): HistoryEntry[] {
  return [
    {
      id: `act_${history.length + 1}`,
      actionId: confirmation.action.id,
      title: confirmation.action.title,
      where: confirmation.action.where,
      undo: confirmation.action.undo,
      moduleTitle: confirmation.moduleTitle,
      at,
      active: true,
    },
    ...history,
  ];
}

export function undoAction(history: HistoryEntry[], entryId: string): HistoryEntry[] {
  return history.map((entry) => (entry.id === entryId ? { ...entry, active: false } : entry));
}

/** What is currently in effect, for anything that needs the live picture. */
export function activeEntries(history: HistoryEntry[]): HistoryEntry[] {
  return history.filter((entry) => entry.active);
}
