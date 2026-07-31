'use server';

import { revalidatePath } from 'next/cache';
import { draftAlert } from '@/lib/data/alerts';
import { isSaved, toggleSaved, type SavedKind } from '@/lib/data/savedObjects';
import { getSession } from '@/lib/session';

/**
 * Server actions for saving things.
 *
 * Every one starts by reading the session on the server. The client passes what to
 * save, never who is saving — a form field naming a user id would be an invitation
 * to write into someone else's account.
 *
 * They return a status rather than redirecting so the calling button can show the
 * sign-in prompt in place, which is what the design does.
 */

export type SaveResult =
  | { status: 'saved' }
  | { status: 'removed' }
  | { status: 'sign_in_required' };

export async function toggleSavedAction(input: {
  kind: SavedKind;
  ref: string;
  title: string;
  subtitle?: string;
}): Promise<SaveResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  const nowSaved = await toggleSaved({ userId: session.user.id, ...input });

  // The workspace lists these, so it has to be re-rendered rather than served
  // from a cache that predates the change.
  revalidatePath('/en/account/workspace');

  return { status: nowSaved ? 'saved' : 'removed' };
}

export async function isSavedAction(kind: SavedKind, ref: string): Promise<boolean> {
  const session = await getSession();
  if (!session?.user) return false;
  return isSaved(session.user.id, kind, ref);
}

/**
 * Creates an alert as a draft.
 *
 * Drafting rather than activating is deliberate: this will interrupt someone
 * later, and the decision to let it should be made on the screen where they can
 * see the condition, not by pressing a button on a symbol page.
 */
export async function draftAlertAction(input: {
  ref: string;
  label: string;
  kind?: 'price' | 'percent_move' | 'indicator_release' | 'news' | 'earnings';
}): Promise<SaveResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  await draftAlert({
    userId: session.user.id,
    kind: input.kind ?? 'price',
    ref: input.ref,
    label: input.label,
  });

  revalidatePath('/en/account/workspace');
  return { status: 'saved' };
}
