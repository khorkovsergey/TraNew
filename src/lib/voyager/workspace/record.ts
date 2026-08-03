/**
 * A saved workspace.
 *
 * What is stored is the *request and the response*, not a screenshot of the
 * canvas. Reopening replays the same structured plan through the same renderer,
 * so a workspace saved before a module gained a body still opens — with that
 * module rendered properly rather than as whatever it looked like in June.
 *
 * Everything read back goes through `parseWorkspace`, like every other stored
 * thing in this project: a version from the future is refused rather than
 * guessed at, and a field that is unusable costs that field rather than the
 * whole record.
 *
 * Import-free, so the harness compiles it alone.
 */

export const WORKSPACE_SCHEMA_VERSION = 1;
export const WORKSPACE_STORAGE_KEY = 'tn_voyager_workspaces_v1';

/** Kept per browser and per account; a library is not an archive. */
export const MAX_WORKSPACES = 60;

const MAX_NAME = 80;
const MAX_REQUEST = 500;

export type WorkspaceKind = 'chart' | 'screener' | 'script' | 'wealth' | 'research';

export const WORKSPACE_KINDS: WorkspaceKind[] = [
  'chart',
  'screener',
  'script',
  'wealth',
  'research',
];

export const KIND_LABEL: Record<WorkspaceKind, string> = {
  chart: 'Charts',
  screener: 'Screeners',
  script: 'Scripts',
  wealth: 'Wealth',
  research: 'Research',
};

export type SavedWorkspace = {
  id: string;
  name: string;
  /**
   * True until somebody renames it.
   *
   * The badge exists so a list of thirty workspaces does not read as thirty
   * decisions a person made. A name they chose and a name Voyager suggested are
   * different kinds of thing and the list says which is which.
   */
  autoNamed: boolean;
  kind: WorkspaceKind;
  /** The request, so reopening replays rather than restores a picture. */
  request: string;
  /** One line for the row: what is in it. */
  summary: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoredLibrary = {
  schemaVersion: number;
  workspaces: SavedWorkspace[];
};

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max).trim() : '';
}

/**
 * A name Voyager suggests for a piece of work.
 *
 * Built from the request rather than generated, and title-cased so it reads as
 * a name rather than as the sentence somebody typed. Long requests are cut at a
 * word rather than mid-syllable — a library of truncated fragments is a library
 * nobody scans.
 */
export function suggestName(request: string): string {
  const words = request
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !['what', 'is', 'are', 'the', 'a', 'an', 'my', 'me', 'in', 'of', 'and', 'to'].includes(word.toLowerCase()))
    .slice(0, 5);

  if (!words.length) return 'New workspace';

  const name = words.join(' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function serializeLibrary(workspaces: SavedWorkspace[]): StoredLibrary {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    // Pinned first, then most recent. The cap drops the oldest unpinned work,
    // never something somebody deliberately kept.
    workspaces: [...workspaces]
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_WORKSPACES),
  };
}

export function parseWorkspace(input: unknown): SavedWorkspace | null {
  if (!input || typeof input !== 'object') return null;

  const raw = input as Record<string, unknown>;
  const id = str(raw.id, 60);
  const request = str(raw.request, MAX_REQUEST);

  // Without a request there is nothing to replay, and a row that opens to
  // nothing is worse than a row that is not there.
  if (!id || !request) return null;

  return {
    id,
    name: str(raw.name, MAX_NAME) || suggestName(request),
    autoNamed: raw.autoNamed !== false,
    kind: WORKSPACE_KINDS.includes(raw.kind as WorkspaceKind)
      ? (raw.kind as WorkspaceKind)
      : 'research',
    request,
    summary: str(raw.summary, 200),
    pinned: raw.pinned === true,
    createdAt: str(raw.createdAt, 40),
    updatedAt: str(raw.updatedAt, 40),
  };
}

export function parseLibrary(input: unknown): SavedWorkspace[] | null {
  if (!input || typeof input !== 'object') return null;

  const raw = input as Record<string, unknown>;
  if (typeof raw.schemaVersion !== 'number' || raw.schemaVersion > WORKSPACE_SCHEMA_VERSION) {
    return null;
  }

  const list = Array.isArray(raw.workspaces) ? raw.workspaces : [];
  const clean: SavedWorkspace[] = [];
  const seen = new Set<string>();

  for (const candidate of list) {
    const workspace = parseWorkspace(candidate);
    if (!workspace) continue;

    // Two rows with one id collide in the list and one silently wins.
    if (seen.has(workspace.id)) continue;
    seen.add(workspace.id);

    clean.push(workspace);
  }

  return clean;
}

/* --------------------------------------------------------------- Operations */

export function upsert(list: SavedWorkspace[], workspace: SavedWorkspace): SavedWorkspace[] {
  const without = list.filter((item) => item.id !== workspace.id);
  return [workspace, ...without];
}

export function rename(list: SavedWorkspace[], id: string, name: string): SavedWorkspace[] {
  const clean = name.slice(0, MAX_NAME).trim();
  if (!clean) return list;

  // Renaming is what takes the suggestion off: the name is now somebody's
  // choice, and the badge would be claiming otherwise.
  return list.map((item) =>
    item.id === id ? { ...item, name: clean, autoNamed: false } : item
  );
}

export function togglePin(list: SavedWorkspace[], id: string): SavedWorkspace[] {
  return list.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item));
}

export function duplicate(list: SavedWorkspace[], id: string, at: string): SavedWorkspace[] {
  const original = list.find((item) => item.id === id);
  if (!original) return list;

  return [
    {
      ...original,
      id: `${original.id}_copy_${list.length + 1}`,
      name: `${original.name} (copy)`.slice(0, MAX_NAME),
      // A copy is never pinned: pinning is about what somebody is working on,
      // and duplicating pins would fill the top of the list with duplicates.
      pinned: false,
      createdAt: at,
      updatedAt: at,
    },
    ...list,
  ];
}

export function remove(list: SavedWorkspace[], id: string): SavedWorkspace[] {
  return list.filter((item) => item.id !== id);
}

/** Search and filter, as one function so the row count always matches the list. */
export function filterWorkspaces(
  list: SavedWorkspace[],
  query: string,
  kind: WorkspaceKind | 'all' | 'pinned'
): SavedWorkspace[] {
  const needle = query.trim().toLowerCase();

  return list
    .filter((item) => {
      if (kind === 'pinned') return item.pinned;
      if (kind !== 'all' && item.kind !== kind) return false;
      return true;
    })
    .filter((item) => {
      if (!needle) return true;
      // The request is searched as well as the name: somebody looking for the
      // gold workspace remembers what they asked, not what it was called.
      return (
        item.name.toLowerCase().includes(needle) ||
        item.request.toLowerCase().includes(needle) ||
        item.summary.toLowerCase().includes(needle)
      );
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
}

/** A shareable, plain-text export of a workspace. Never the account it came from. */
export function exportWorkspace(workspace: SavedWorkspace): string {
  return [
    `# ${workspace.name}`,
    '',
    `Asked: ${workspace.request}`,
    `Kind: ${KIND_LABEL[workspace.kind]}`,
    `Saved: ${workspace.createdAt || 'unknown'}`,
    '',
    workspace.summary,
    '',
    'Exported from TradingNew. This is educational analysis, not personalised advice.',
  ].join('\n');
}
