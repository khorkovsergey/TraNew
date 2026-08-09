import { PAGE_CAPABILITIES } from './pages';
import type { VoyagerContext, VoyagerScreen } from './types';

/**
 * Per-page context packages.
 *
 * A page states what it is about; nothing here guesses from the URL, and no
 * page sends HTML, a screenshot or anything unstructured. What Voyager knows on
 * any given screen is therefore something a person is entitled to be able to
 * check — which is the point of the whole arrangement.
 *
 * The table this file used to hold is now the page capability registry in
 * `pages.ts`, which says what each screen *is* — its subject, the facts it may
 * declare, the actions reachable from it, the tools worth using on it — as well
 * as what to ask it. There was no reason for two tables and one very good
 * reason against: a screen added to one of them is a screen missing from the
 * other, which is how `market` and `events` came to be screens the API refused.
 */

export function buildContext(
  screen: VoyagerScreen,
  subject?: string,
  facts?: Record<string, string>
): VoyagerContext {
  const page = PAGE_CAPABILITIES[screen];
  const name = subject ?? page.subject;

  return {
    screen,
    subject: name,
    prompt: subject ? `Ask about ${subject}` : page.prompt,
    quick: page.quick,
    facts,
  };
}

export const GENERIC_CONTEXT = buildContext('generic');
