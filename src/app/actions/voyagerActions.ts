'use server';

import { revalidatePath } from 'next/cache';
import { draftAlert } from '@/lib/data/alerts';
import { save } from '@/lib/data/savedObjects';
import { getSession } from '@/lib/session';
import { specFor, isVoyagerActionId, type VoyagerActionId } from '@/lib/voyager/actions';

/**
 * The actions Voyager actually performs.
 *
 * Before this there were none. The chat printed *Done — I added this to your
 * watchlist*, showed a `watchlist.add ✓` tool chip and navigated to the
 * workspace, where the thing was not, because nothing had ever been sent
 * anywhere. The confirmation card was real, the confirmation was real, and the
 * act it confirmed did not exist.
 *
 * So: one entry point, and the rule the chat is written against —
 *
 *   **A success line and a `✓` chip may only follow a result with `ok: true`.**
 *
 * Everything else is a typed failure with a code the interface can act on. Not
 * an exception: an unknown symbol, a missing account and an action nothing is
 * wired to are product states somebody has to be told about, and a stack trace
 * is not a way of telling them.
 *
 * The session is read here. The caller passes what to act on, never whose
 * account to act in — a field naming a user id would be an invitation to write
 * into somebody else's.
 */

export type VoyagerActionResult =
  | {
      ok: true;
      id: VoyagerActionId;
      /** `mutate` wrote something; `prepare` wrote a draft and nothing is running. */
      execution: 'mutate' | 'prepare';
      /** The past-tense sentence from the registry, never one written here. */
      done: string;
      where: string;
      undo: string;
      /** The tool signature, so the chip names the call that returned. */
      call: string;
    }
  | {
      ok: false;
      id: string;
      code: 'sign_in_required' | 'needs_symbol' | 'not_a_write' | 'unknown_action' | 'failed';
      message: string;
      /** True when trying again could work — a signed-out session, a missing symbol. */
      recoverable: boolean;
    };

/** Bounded before it reaches storage: this arrives from a browser. */
function tidy(value: string | undefined, max: number): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * A ticker as a reference, or nothing.
 *
 * Letters, digits and the separators real tickers use. A subject like "this
 * chart" is not a symbol and must not become one — `ref` is a key other parts of
 * the portal join on, and a row keyed by a sentence is a row nothing will ever
 * find again.
 */
function tickerOf(raw: string | undefined): string | null {
  const candidate = tidy(raw, 16).toUpperCase();
  return /^[A-Z0-9][A-Z0-9.\-:/]{0,15}$/.test(candidate) ? candidate : null;
}

export async function runVoyagerAction(input: {
  id: string;
  /** The instrument the answer was about, where it had one. */
  ticker?: string;
  /** What to call the saved thing — the person's own question, usually. */
  title?: string;
  /** The conversation, for the actions that keep one. */
  note?: string;
}): Promise<VoyagerActionResult> {
  const { id } = input;

  if (!isVoyagerActionId(id)) {
    return {
      ok: false,
      id,
      code: 'unknown_action',
      message: 'That is not something Voyager knows how to do, so nothing happened.',
      recoverable: false,
    };
  }

  const spec = specFor(id);

  /*
   * Navigation does not come through here, and saying so is not pedantry: a
   * caller that sent one would get an `ok: true` back and report a change that
   * never happened, which is the failure this whole file exists to end.
   */
  if (spec.execution !== 'mutate' && spec.execution !== 'prepare') {
    return {
      ok: false,
      id,
      code: 'not_a_write',
      message: `"${spec.label}" does not change anything, so there is nothing to run.`,
      recoverable: false,
    };
  }

  const session = await getSession();
  if (!session?.user) {
    return {
      ok: false,
      id,
      code: 'sign_in_required',
      message: 'That one needs an account. Sign in and it will be waiting.',
      recoverable: true,
    };
  }

  const userId = session.user.id;
  const ticker = tickerOf(input.ticker);

  if (spec.needsTicker && !ticker) {
    return {
      ok: false,
      id,
      code: 'needs_symbol',
      message: 'I need to know which instrument you mean before I can do that.',
      recoverable: true,
    };
  }

  const ok = (): VoyagerActionResult => {
    // The workspace lists all three of these, so it is re-rendered rather than
    // served from a cache that predates the change.
    revalidatePath('/en/account/workspace');
    return {
      ok: true,
      id,
      execution: spec.execution as 'mutate' | 'prepare',
      done: spec.done,
      where: spec.where,
      undo: spec.undo,
      call: spec.call,
    };
  };

  try {
    switch (id) {
      case 'add_to_watchlist': {
        // `save` rather than `toggleSaved`: a button labelled "Add" that removes
        // the row on a second press is a button that lies half the time.
        await save({
          userId,
          kind: 'symbol',
          ref: ticker!,
          title: ticker!,
          subtitle: 'Added from Voyager',
        });
        return ok();
      }

      case 'save_conversation': {
        const title = tidy(input.title, 120) || 'Voyager conversation';
        await save({
          userId,
          kind: 'research',
          /*
           * Keyed by the conversation's own title rather than by a timestamp.
           * `save` is idempotent on (user, kind, ref), so saving the same
           * conversation twice updates one row instead of filling the workspace
           * with near-identical copies.
           */
          ref: `voyager:${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`,
          title,
          subtitle: 'Saved from Voyager',
          // Sealed with the person's key on the way in, like every other note.
          note: tidy(input.note, 4000) || undefined,
        });
        return ok();
      }

      case 'create_alert': {
        await draftAlert({
          userId,
          kind: 'price',
          ref: ticker!,
          label: `${ticker} — drafted from Voyager`,
        });
        return ok();
      }

      default:
        /*
         * A write the registry declares and this switch does not implement.
         * Reported as a failure rather than falling through to `ok()`, because
         * the whole point is that success is evidence something happened.
         */
        return {
          ok: false,
          id,
          code: 'failed',
          message: `"${spec.label}" is not connected to anything yet, so nothing happened.`,
          recoverable: false,
        };
    }
  } catch (error) {
    console.error(`[voyager] action ${id} failed`, error);
    return {
      ok: false,
      id,
      code: 'failed',
      message: 'That did not go through. Nothing was changed.',
      recoverable: true,
    };
  }
}
