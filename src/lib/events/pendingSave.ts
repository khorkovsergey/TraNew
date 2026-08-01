const KEY = 'tn_pending_event_save';

/**
 * The event someone tried to save before being asked to sign in.
 *
 * One id, in sessionStorage, consumed once. It is deliberately not a queue and
 * deliberately not persistent: restoring one intent from the last few minutes is
 * helpful, while replaying a list of saves from a previous session would be the
 * product doing something nobody asked for.
 */

export function rememberPendingSave(eventId: string): void {
  try {
    sessionStorage.setItem(KEY, eventId);
  } catch {
    // Private mode or storage disabled. Restoring the save is a courtesy.
  }
}

export function consumePendingSave(): string | null {
  try {
    const value = sessionStorage.getItem(KEY);
    if (value) sessionStorage.removeItem(KEY);
    return value;
  } catch {
    return null;
  }
}
