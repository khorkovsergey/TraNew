const KEY = 'tn_focus_search';

/**
 * "Research an asset" in the Symbols menu sends people home with the hero search
 * focused. A one-shot sessionStorage flag keeps the URL clean and the page static.
 */
export function requestSearchFocus() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Private mode / storage disabled — focusing is a nicety, not a requirement.
  }
}

export function consumeSearchFocus(): boolean {
  try {
    if (sessionStorage.getItem(KEY) !== '1') return false;
    sessionStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
