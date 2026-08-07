/**
 * Many conversations instead of one.
 *
 * The workspace held a single conversation that began when the page loaded and
 * ended when it was closed. Asking a second unrelated question meant losing the
 * first, so nobody asked a second one.
 *
 * A chat is the unit that survives now: it has a title, a list of messages and
 * the last output the conversation produced. What it does *not* have is a home
 * on the server unless somebody signed in — see `SAVE_REQUIRES_ACCOUNT`.
 *
 * No imports, on purpose: the unit harness compiles this file with bare `tsc`,
 * which cannot resolve the `@/` alias.
 */

export const CHATS_SCHEMA_VERSION = 1;

/** Guest chats live here, and are gone when the tab is. */
export const CHATS_SESSION_KEY = 'tn_voyager_chats_v1';

/**
 * A guest can hold this many before the oldest is dropped.
 *
 * Session storage is a few megabytes and a chat carries its whole transcript.
 * Twenty is more than anybody accumulates before signing in, and the cap means
 * a long session degrades by forgetting the oldest rather than by failing to
 * write at all — a quota error would lose the chat somebody is *in*.
 */
export const MAX_GUEST_CHATS = 20;

/** Saving is account-only. Not a limit we chose to be strict; there is nowhere else to put it. */
export const SAVE_REQUIRES_ACCOUNT = true;

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  /** What was said. For an assistant turn this is the conversational reply. */
  text: string;
  at: string;
  /**
   * The structured result this turn produced, when it produced one.
   *
   * Held as unknown here and validated by `contract.parsePlan` at the edge: this
   * module owns the shape of a conversation, not the shape of an answer.
   */
  output?: unknown;
};

export type Chat = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  /**
   * True once the server has a copy. Guest chats are never saved, so this stays
   * false and the interface says "Unsaved" rather than implying otherwise.
   */
  saved: boolean;
};

export type StoredChats = {
  version: number;
  chats: Chat[];
};

/* ------------------------------------------------------------------ Titles */

export const UNTITLED = 'New chat';

/**
 * A title from the first thing somebody asked.
 *
 * Their own words, trimmed — not a summary. A generated title that paraphrases
 * badly is worse than a long one, because the person then cannot find the chat
 * they remember having.
 */
export function titleFor(question: string): string {
  const clean = question.replace(/\s+/g, ' ').trim();
  if (!clean) return UNTITLED;

  // Question marks and trailing punctuation add nothing in a narrow sidebar.
  const stripped = clean.replace(/[?!.]+$/, '');
  if (stripped.length <= 42) return stripped;

  // Cut on a word boundary rather than mid-word, then mark the cut.
  const cut = stripped.slice(0, 42);
  const space = cut.lastIndexOf(' ');
  return `${(space > 20 ? cut.slice(0, space) : cut).trim()}…`;
}

/* ------------------------------------------------------------- Constructing */

export function newChat(id: string, at: string): Chat {
  return { id, title: UNTITLED, createdAt: at, updatedAt: at, messages: [], saved: false };
}

/**
 * Adds a turn, and names the chat if this is the first thing said in it.
 *
 * Returns a new object rather than mutating: the caller holds this in React
 * state, and a mutated array is a render that does not happen.
 */
export function withMessage(chat: Chat, message: ChatMessage): Chat {
  const messages = [...chat.messages, message];
  const named =
    chat.title === UNTITLED && message.role === 'user' ? titleFor(message.text) : chat.title;

  return {
    ...chat,
    title: named,
    messages,
    updatedAt: message.at,
    // Any new turn makes a saved chat stale again — the copy on the server no
    // longer matches what is on screen, and the button has to say so.
    saved: false,
  };
}

/** An empty chat nobody typed into. Used to avoid stacking blank chats on New. */
export function isBlank(chat: Chat): boolean {
  return chat.messages.length === 0;
}

/* ---------------------------------------------------------------- Grouping */

export type ChatGroup = { label: string; chats: Chat[] };

const DAY = 86_400_000;

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

/**
 * Today / Yesterday / a date, newest first.
 *
 * `now` is passed in rather than read from the clock so the grouping is
 * testable and so the server and the browser cannot disagree about what day it
 * is during a render.
 */
export function groupByDay(chats: Chat[], now: Date): ChatGroup[] {
  const today = startOfDay(now);
  const groups: ChatGroup[] = [];
  const index = new Map<string, ChatGroup>();

  const sorted = [...chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  for (const chat of sorted) {
    const when = new Date(chat.updatedAt);
    const day = startOfDay(when);

    let label: string;
    if (day === today) label = 'Today';
    else if (day === today - DAY) label = 'Yesterday';
    else {
      label = when.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: when.getFullYear() === now.getFullYear() ? undefined : 'numeric',
      });
    }

    const group = index.get(label);
    if (group) group.chats.push(chat);
    else {
      const created = { label, chats: [chat] };
      index.set(label, created);
      groups.push(created);
    }
  }

  return groups;
}

/* ----------------------------------------------------------- Serialisation */

export function serializeChats(chats: Chat[]): StoredChats {
  return { version: CHATS_SCHEMA_VERSION, chats: chats.slice(0, MAX_GUEST_CHATS) };
}

function parseMessage(input: unknown): ChatMessage | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;

  const role = raw.role;
  if (role !== 'user' && role !== 'assistant') return null;
  if (typeof raw.id !== 'string' || typeof raw.text !== 'string') return null;
  if (typeof raw.at !== 'string') return null;

  const message: ChatMessage = { id: raw.id, role, text: raw.text, at: raw.at };
  if (raw.output !== undefined) message.output = raw.output;
  return message;
}

/**
 * Reads a stored library back, dropping anything malformed.
 *
 * Storage is writable by anything running on the origin and survives across
 * deployments, so what comes out is treated as input rather than as something
 * this code wrote. A single bad chat is dropped; it does not take the rest with
 * it, because losing every conversation over one broken record is the failure
 * people actually notice.
 */
export function parseChats(input: unknown): Chat[] | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (raw.version !== CHATS_SCHEMA_VERSION) return null;
  if (!Array.isArray(raw.chats)) return null;

  const chats: Chat[] = [];
  for (const entry of raw.chats) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;

    if (typeof item.id !== 'string' || typeof item.title !== 'string') continue;
    if (typeof item.createdAt !== 'string' || typeof item.updatedAt !== 'string') continue;
    if (!Array.isArray(item.messages)) continue;

    const messages = item.messages.map(parseMessage).filter((m): m is ChatMessage => m !== null);

    chats.push({
      id: item.id,
      title: item.title,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      messages,
      // Anything read out of guest storage is unsaved by definition, whatever
      // the record claims — the server has never seen it.
      saved: false,
    });
  }

  return chats;
}

/* --------------------------------------------------------------- The rules */

export type SaveVerdict =
  | { allowed: true }
  | { allowed: false; reason: 'no-account' | 'empty' };

/**
 * Whether Save can do anything, and why not when it cannot.
 *
 * Two refusals, and they are different things. A guest is asked to sign in and
 * the chat survives the trip. An empty chat has nothing to save and asking
 * somebody to make an account for it would be the worst version of this
 * product.
 */
export function canSave(chat: Chat | null, signedIn: boolean): SaveVerdict {
  if (!chat || isBlank(chat)) return { allowed: false, reason: 'empty' };
  if (!signedIn) return { allowed: false, reason: 'no-account' };
  return { allowed: true };
}
