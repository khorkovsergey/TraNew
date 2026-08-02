import { INDICATORS } from '../indicators';
import type { StudyChoice } from '../layouts/schema';

/**
 * Script Lab documents.
 *
 * A script is a document with a history, not a text box. The reason is the one
 * the design gives for a diff before every AI edit: the moment something can
 * rewrite your work, "what did it change" and "give me back what I had" stop
 * being conveniences.
 *
 * So a version is written on every meaningful change, the history is bounded,
 * and comparing two versions is a line diff computed here rather than a
 * description of a change written by whatever made it.
 *
 * Import-free beyond sibling modules, so the harness compiles it alone.
 */

export const SCRIPT_SCHEMA_VERSION = 1;

/** Versions kept per document. A lab is not an archive. */
export const MAX_VERSIONS = 30;

export const SCRIPT_STORAGE_KEY = 'tn_superchart_scripts_v1';

export type ScriptStatus = 'draft' | 'valid' | 'warning' | 'error' | 'applied';

export type ScriptVersion = {
  /** Monotonic within a document, so "v3" means the same thing to everyone. */
  number: number;
  source: string;
  createdAt: string;
  /** What produced this version — shown, never inferred from the text. */
  author: 'user' | 'voyager';
  note: string;
};

export type ScriptDocument = {
  id: string;
  name: string;
  source: string;
  status: ScriptStatus;
  versions: ScriptVersion[];
  createdAt: string;
  updatedAt: string;
};

function now(): string {
  return new Date().toISOString();
}

export function createDocument(input: {
  id: string;
  name: string;
  source: string;
  author?: 'user' | 'voyager';
  note?: string;
}): ScriptDocument {
  const at = now();

  return {
    id: input.id,
    name: input.name,
    source: input.source,
    status: 'draft',
    versions: [
      {
        number: 1,
        source: input.source,
        createdAt: at,
        author: input.author ?? 'user',
        note: input.note ?? 'Created',
      },
    ],
    createdAt: at,
    updatedAt: at,
  };
}

/**
 * A new version, unless nothing changed.
 *
 * Autosave calls this on a timer, and a version per keystroke pause would bury
 * the three that mattered under two hundred that did not. Identical source is
 * not a version.
 */
export function commitVersion(
  document: ScriptDocument,
  input: { source: string; author: 'user' | 'voyager'; note: string }
): ScriptDocument {
  const latest = document.versions[document.versions.length - 1];
  if (latest && latest.source === input.source) return document;

  const version: ScriptVersion = {
    number: (latest?.number ?? 0) + 1,
    source: input.source,
    createdAt: now(),
    author: input.author,
    note: input.note,
  };

  return {
    ...document,
    source: input.source,
    updatedAt: version.createdAt,
    // The oldest goes first. Numbers are never reused, so a dropped version
    // leaves a gap rather than making v4 mean two different things.
    versions: [...document.versions, version].slice(-MAX_VERSIONS),
  };
}

/** Source longer than this is refused rather than stored. */
export const MAX_SOURCE = 40_000;

/**
 * A stored document, or null.
 *
 * Same treatment as `parseLayout`: a document that left this application, sat
 * in a browser or a row, and came back is untrusted input whoever it belongs
 * to. A version with an unusable shape is dropped and the rest survives, but a
 * document with no usable version at all is refused — half a history is harder
 * to notice than none.
 */
export function parseDocument(input: unknown): ScriptDocument | null {
  if (!input || typeof input !== 'object') return null;

  const raw = input as Record<string, unknown>;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  if (typeof raw.source !== 'string' || raw.source.length > MAX_SOURCE) return null;

  const versions = Array.isArray(raw.versions) ? raw.versions : [];
  const clean: ScriptVersion[] = [];

  for (const candidate of versions) {
    if (!candidate || typeof candidate !== 'object') continue;
    const version = candidate as Record<string, unknown>;

    if (typeof version.source !== 'string' || version.source.length > MAX_SOURCE) continue;
    if (typeof version.number !== 'number' || !Number.isFinite(version.number)) continue;

    clean.push({
      number: Math.round(version.number),
      source: version.source,
      createdAt: typeof version.createdAt === 'string' ? version.createdAt : '',
      // Anything that is not a known author is treated as the person's own
      // work, which is the reading that never credits Voyager with something it
      // did not write.
      author: version.author === 'voyager' ? 'voyager' : 'user',
      note: typeof version.note === 'string' ? version.note.slice(0, 200) : '',
    });
  }

  if (!clean.length) return null;

  const statuses: ScriptStatus[] = ['draft', 'valid', 'warning', 'error', 'applied'];

  return {
    id: raw.id,
    name: raw.name.slice(0, 80),
    source: raw.source,
    status: statuses.includes(raw.status as ScriptStatus) ? (raw.status as ScriptStatus) : 'draft',
    versions: clean.slice(-MAX_VERSIONS),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
  };
}

export type DiffLine = {
  kind: 'same' | 'added' | 'removed';
  text: string;
  /** 1-based, in whichever side the line exists. */
  line: number;
};

/**
 * A line diff between two versions.
 *
 * The longest common subsequence, computed properly rather than by comparing
 * line N to line N: inserting one line at the top shifts everything, and a
 * naive comparison would then report the whole file as rewritten — which is
 * exactly the moment somebody stops reading the diff.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');

  // lengths[i][j] = LCS length of a[i:] and b[j:]
  const lengths: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lengths[i][j] =
        a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i], line: j + 1 });
      i += 1;
      j += 1;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      out.push({ kind: 'removed', text: a[i], line: i + 1 });
      i += 1;
    } else {
      out.push({ kind: 'added', text: b[j], line: j + 1 });
      j += 1;
    }
  }

  while (i < a.length) {
    out.push({ kind: 'removed', text: a[i], line: i + 1 });
    i += 1;
  }
  while (j < b.length) {
    out.push({ kind: 'added', text: b[j], line: j + 1 });
    j += 1;
  }

  return out;
}

/** How much of a diff is a change, for a one-line summary. */
export function diffSummary(diff: DiffLine[]): { added: number; removed: number } {
  return {
    added: diff.filter((line) => line.kind === 'added').length,
    removed: diff.filter((line) => line.kind === 'removed').length,
  };
}

/**
 * The Pine for the studies currently on the chart.
 *
 * Assembled from the same registry that draws them, so the script and the chart
 * cannot describe different studies. Each study keeps its own `//@version=6`
 * header in the registry; a combined document needs exactly one, so the headers
 * are stripped and a single one written at the top.
 */
export function pineForStudies(studies: StudyChoice[]): string {
  if (!studies.length) {
    return `//@version=6\nindicator("Empty study")\n// Nothing is on the chart yet, so there is nothing to describe.`;
  }

  const bodies = studies
    .map((choice) => {
      const definition = INDICATORS[choice.definitionId];
      if (!definition) return null;

      const params = { ...definition.defaults, ...choice.params };
      return definition
        .pine(params)
        .split('\n')
        .filter((line) => !line.startsWith('//@version='))
        .join('\n')
        .trim();
    })
    .filter((body): body is string => Boolean(body));

  if (!bodies.length) {
    return `//@version=6\nindicator("Empty study")\n// None of the studies on the chart have a Pine template.`;
  }

  // Two `indicator()` declarations will not compile in Pine. One document per
  // study is the honest shape; a combined one keeps the first and says so.
  const combined =
    bodies.length === 1
      ? bodies[0]
      : `${bodies[0]}\n\n// The remaining studies are separate indicators in Pine — one\n// indicator() declaration per script — so they are exported on their own.\n${bodies
          .slice(1)
          .map((body) =>
            body
              .split('\n')
              .map((line) => `// ${line}`)
              .join('\n')
          )
          .join('\n//\n')}`;

  return `//@version=6\n${combined}\n`;
}
