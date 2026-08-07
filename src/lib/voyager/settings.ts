/**
 * What Voyager is allowed to read, and how it should answer.
 *
 * All of it is per account and none of it exists for a guest: these are
 * decisions about somebody's private material, and there is nowhere to keep a
 * decision that has no owner.
 *
 * Everything here rides on the `preference` and `consent` tables that already
 * exist. Consent is separate from preference on purpose — turning on "use my
 * portfolio" is permission to read a wealth record, and permission is recorded
 * where permissions are recorded, not as a settings toggle among the others.
 *
 * No imports, on purpose: the unit harness compiles this file with bare `tsc`.
 */

/* ------------------------------------------------------------- The sources */

export type SourceKind =
  | 'market-data'
  | 'news'
  | 'filings'
  | 'company-ir'
  | 'research'
  | 'custom'
  | 'personal-files';

export type SourceOption = {
  id: SourceKind;
  label: string;
  /** What it actually is, so a toggle is not a guess. */
  detail: string;
  /** On unless somebody turns it off. */
  defaultOn: boolean;
};

export const SOURCE_OPTIONS: SourceOption[] = [
  {
    id: 'market-data',
    label: 'Market data',
    detail: 'Prices, volumes and fundamentals. Delayed on the free tier.',
    defaultOn: true,
  },
  {
    id: 'news',
    label: 'News sources',
    detail: 'Wire services and market reporting.',
    defaultOn: true,
  },
  {
    id: 'filings',
    label: 'Official filings',
    detail: 'What companies file with regulators. Slow, and the least arguable.',
    defaultOn: true,
  },
  {
    id: 'company-ir',
    label: 'Company IR',
    detail: 'Investor relations pages. The company describing itself.',
    defaultOn: true,
  },
  {
    id: 'research',
    label: 'Analyst research',
    detail: 'Published opinions and targets. Opinion, labelled as such.',
    defaultOn: false,
  },
  {
    id: 'custom',
    label: 'My own sources',
    detail: 'The domains you added below.',
    defaultOn: true,
  },
  {
    id: 'personal-files',
    label: 'My files',
    detail: 'Documents you uploaded, used as your standing context.',
    defaultOn: false,
  },
];

export const DEFAULT_SOURCES: SourceKind[] = SOURCE_OPTIONS.filter((s) => s.defaultOn).map(
  (s) => s.id
);

/* ------------------------------------------------------- Custom source URLs */

export type UrlVerdict =
  | { ok: true; domain: string }
  | { ok: false; reason: 'empty' | 'not-a-url' | 'not-https' | 'not-public' | 'duplicate' };

/**
 * A domain somebody wants Voyager to prefer.
 *
 * Stored as a host, not a full URL. A person adding a link to one article means
 * "look at this publication", and keeping the path would pin them to one page
 * that goes stale.
 *
 * `http://` is refused rather than upgraded. Silently rewriting what somebody
 * typed is how you end up fetching a different thing than they asked for.
 *
 * Private and loopback hosts are refused because the server does the fetching:
 * an allowlist entry of `localhost` or `169.254.169.254` is a request for our
 * own infrastructure, wearing the shape of a research preference.
 */
export function checkUrl(input: string, existing: string[]): UrlVerdict {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: 'empty' };

  let url: URL;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return { ok: false, reason: 'not-a-url' };
  }

  if (raw.includes('://') && url.protocol !== 'https:') return { ok: false, reason: 'not-https' };

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!host.includes('.') || host.endsWith('.local')) return { ok: false, reason: 'not-public' };

  if (
    host === 'localhost' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '::1'
  ) {
    return { ok: false, reason: 'not-public' };
  }

  if (existing.some((e) => e.toLowerCase() === host)) return { ok: false, reason: 'duplicate' };

  return { ok: true, domain: host };
}

export const URL_REFUSALS: Record<Exclude<UrlVerdict, { ok: true }>['reason'], string> = {
  empty: 'Enter a website address.',
  'not-a-url': 'That does not look like a web address.',
  'not-https': 'Only https addresses can be added.',
  'not-public': 'That address is not a public website.',
  duplicate: 'That domain is already on your list.',
};

/** More than this and the preference stops being a preference. */
export const MAX_CUSTOM_SOURCES = 20;

/* ----------------------------------------------------------- Personal files */

export type FileMode = 'always' | 'referenced' | 'off';

export const FILE_MODE_LABEL: Record<FileMode, string> = {
  always: 'Always use',
  referenced: 'Only when I mention it',
  off: 'Not in use',
};

/**
 * What can be uploaded.
 *
 * Only what can actually be read. Offering a format the server cannot parse
 * produces a file that sits in the list contributing nothing, and the person
 * has no way to tell it apart from one that works.
 */
export const ACCEPTED_FILES = [
  { ext: '.txt', label: 'Plain text' },
  { ext: '.md', label: 'Markdown' },
  { ext: '.csv', label: 'CSV' },
] as const;

/** 2 MB. These are notes and watchlists, not archives. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type FileVerdict = { ok: true } | { ok: false; reason: 'type' | 'size' | 'empty' };

export function checkFile(name: string, bytes: number): FileVerdict {
  if (bytes === 0) return { ok: false, reason: 'empty' };
  if (bytes > MAX_FILE_BYTES) return { ok: false, reason: 'size' };

  const lower = name.toLowerCase();
  if (!ACCEPTED_FILES.some((type) => lower.endsWith(type.ext))) return { ok: false, reason: 'type' };

  return { ok: true };
}

export const FILE_REFUSALS: Record<Exclude<FileVerdict, { ok: true }>['reason'], string> = {
  type: `Voyager can read ${ACCEPTED_FILES.map((f) => f.ext).join(', ')}. PDFs are not readable yet — pasting the text works.`,
  size: 'That file is over 2 MB. These are meant to be notes, not archives.',
  empty: 'That file is empty.',
};

/* ------------------------------------------------------- How it should answer */

export type AnswerDepth = 'concise' | 'balanced' | 'detailed';
export type CitationMode = 'always' | 'web-only' | 'minimal';

export const DEPTH_OPTIONS: { id: AnswerDepth; label: string; detail: string }[] = [
  { id: 'concise', label: 'Concise', detail: 'The answer and the catch, nothing else.' },
  { id: 'balanced', label: 'Balanced', detail: 'The answer, the reasoning and what to do next.' },
  { id: 'detailed', label: 'Detailed', detail: 'Working shown, with the numbers behind it.' },
];

export const CITATION_OPTIONS: { id: CitationMode; label: string; detail: string }[] = [
  { id: 'always', label: 'Always show sources', detail: 'Every answer names what it stands on.' },
  {
    id: 'web-only',
    label: 'Only for looked-up answers',
    detail: 'Shown when Voyager searched, hidden when it explained.',
  },
  {
    id: 'minimal',
    label: 'Keep them out of the way',
    detail: 'Collapsed into the Sources tab. Never removed.',
  },
];

/**
 * The settings a person actually has.
 *
 * `portfolio` and `watchlists` are absent from this shape on purpose: they are
 * consents, not preferences, and live in the consent record where they can be
 * audited and withdrawn.
 */
export type VoyagerSettings = {
  sources: SourceKind[];
  customSources: string[];
  depth: AnswerDepth;
  citations: CitationMode;
  /** Whether uploaded files are used without being asked for by name. */
  filesByDefault: boolean;
  /** Whether what is learned in one chat carries to the next. */
  remember: boolean;
};

export const DEFAULT_SETTINGS: VoyagerSettings = {
  sources: DEFAULT_SOURCES,
  customSources: [],
  depth: 'balanced',
  citations: 'always',
  filesByDefault: false,
  remember: true,
};

/**
 * Reads stored settings back, falling back per field rather than wholesale.
 *
 * A person who set their answer depth two releases ago should keep it even if a
 * field added since is missing or malformed. Throwing the record away over one
 * bad key silently resets choices somebody made deliberately.
 */
export function parseSettings(input: unknown): VoyagerSettings {
  if (!input || typeof input !== 'object') return DEFAULT_SETTINGS;
  const raw = input as Record<string, unknown>;

  const known = new Set(SOURCE_OPTIONS.map((option) => option.id));
  const sources = Array.isArray(raw.sources)
    ? (raw.sources.filter((id): id is SourceKind => typeof id === 'string' && known.has(id as SourceKind)))
    : DEFAULT_SETTINGS.sources;

  const custom = Array.isArray(raw.customSources)
    ? raw.customSources
        .filter((d): d is string => typeof d === 'string')
        .slice(0, MAX_CUSTOM_SOURCES)
    : [];

  const depth = DEPTH_OPTIONS.some((option) => option.id === raw.depth)
    ? (raw.depth as AnswerDepth)
    : DEFAULT_SETTINGS.depth;

  const citations = CITATION_OPTIONS.some((option) => option.id === raw.citations)
    ? (raw.citations as CitationMode)
    : DEFAULT_SETTINGS.citations;

  return {
    sources,
    customSources: custom,
    depth,
    citations,
    filesByDefault:
      typeof raw.filesByDefault === 'boolean'
        ? raw.filesByDefault
        : DEFAULT_SETTINGS.filesByDefault,
    remember: typeof raw.remember === 'boolean' ? raw.remember : DEFAULT_SETTINGS.remember,
  };
}
