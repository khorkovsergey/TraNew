'use server';

import { getPreferences, setPreference } from '@/lib/data/profile';
import { getSession } from '@/lib/session';
import {
  checkUrl,
  DEFAULT_SETTINGS,
  MAX_CUSTOM_SOURCES,
  parseSettings,
  type VoyagerSettings,
} from '@/lib/voyager/settings';

/**
 * Voyager's settings, for people with an account.
 *
 * The session is read here; the client sends settings and never says whose they
 * are. Everything is keyed by the session user, so a request cannot reach
 * somebody else's preferences.
 *
 * Validated in both directions, and the custom-source list is re-checked on the
 * way in rather than trusted. The browser already refused a private host, but
 * the browser is where an attacker sits — and the server is what will later do
 * the fetching, which is the whole reason that check exists.
 */

const KEY = 'voyager.settings';

export type SettingsResult =
  | { status: 'saved'; settings: VoyagerSettings }
  | { status: 'sign_in_required' }
  | { status: 'invalid'; because: string };

export async function loadVoyagerSettings(): Promise<VoyagerSettings> {
  const session = await getSession();
  if (!session?.user) return DEFAULT_SETTINGS;

  const preferences = await getPreferences(session.user.id);
  return parseSettings(preferences[KEY]);
}

export async function saveVoyagerSettings(input: VoyagerSettings): Promise<SettingsResult> {
  const session = await getSession();
  if (!session?.user) return { status: 'sign_in_required' };

  // Through the parser first: the shape is whatever a browser chose to send.
  const settings = parseSettings(input);

  /*
   * Domains re-checked server-side.
   *
   * The form refuses a loopback or private host, and that refusal is a courtesy
   * to somebody typing — not a control. This one is the control, because it is
   * the last thing between a stored preference and the server making a request
   * to whatever it names.
   */
  const domains: string[] = [];
  for (const candidate of settings.customSources.slice(0, MAX_CUSTOM_SOURCES)) {
    const verdict = checkUrl(candidate, domains);
    if (verdict.ok) domains.push(verdict.domain);
  }

  const stored: VoyagerSettings = { ...settings, customSources: domains };
  await setPreference(session.user.id, KEY, stored as never);

  return { status: 'saved', settings: stored };
}
