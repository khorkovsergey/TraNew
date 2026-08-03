/**
 * What Voyager is allowed to put on the canvas.
 *
 * The rule the handoff states first and the one this file exists to enforce:
 * **structured output only.** A response is `{mode, steps, work, modules,
 * sources, assumptions}` and the UI renders declared modules — it never parses
 * prose into interface or into an action. There is no path from a sentence a
 * model wrote to a button that does something.
 *
 * So this is a gate, not a type alias. Every module arriving from outside is
 * matched against a known kind and refused by name if it is not one; every
 * source must carry a provider and a timestamp or the module citing it is not
 * rendered; every card mixing data with inference must say which is which.
 *
 * Import-free, so the harness compiles it alone.
 */

/** How the request was read. Shown to the person, with the reason. */
export type WorkMode = 'ask' | 'analyse' | 'build' | 'screen' | 'monitor' | 'learn';

export const WORK_MODES: WorkMode[] = ['ask', 'analyse', 'build', 'screen', 'monitor', 'learn'];

/**
 * The lifecycle, exactly as the handoff specifies it.
 *
 * `partial` is a first-class state rather than a loading flag: modules appear
 * as they finish, useful ones first, and stopping keeps what is already there.
 */
export type Stage =
  | 'understanding'
  | 'planning'
  | 'working'
  | 'partial'
  | 'complete'
  | 'stopped'
  | 'failed';

/**
 * Where a claim came from.
 *
 * Four labels, and a card that mixes measurement with interpretation carries
 * both. The distinction between "the market did this" and "Voyager thinks this"
 * is the one a reader most needs and the one most easily lost.
 */
export type Provenance = 'market-data' | 'your-data' | 'inference' | 'educational';

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  'market-data': 'Market data',
  'your-data': 'Your data',
  inference: 'Voyager inference',
  educational: 'Educational',
};

export type Source = {
  id: string;
  /** MARKET DATA, FILINGS, ESTIMATES, YOUR DATA, EDUCATIONAL, DETECTION, CARRIED CONTEXT. */
  kind: string;
  provider: string;
  /** ISO 8601. An undated source is not a source. */
  at: string;
  detail?: string;
  /** Delayed data says so, here, so every citation of it inherits the label. */
  delayed?: boolean;
};

export type Assumption = {
  id: string;
  label: string;
  value: string;
  /** Editable ones re-run the result; the rest are stated but fixed. */
  editable: boolean;
};

/** One user-facing step. Never chain-of-thought — what was done, not how it was reasoned. */
export type WorkStep = {
  id: string;
  label: string;
  done: boolean;
};

export type ModuleKind =
  | 'text-insight'
  | 'metric-row'
  | 'chart'
  | 'heatmap'
  | 'ranked-rows'
  | 'comparison-table'
  | 'news-timeline'
  | 'interpreted-filters'
  | 'pine-editor'
  | 'permission-request'
  | 'monitoring-rule'
  | 'guided-questions'
  | 'next-actions'
  | 'error';

export const MODULE_KINDS: ModuleKind[] = [
  'text-insight',
  'metric-row',
  'chart',
  'heatmap',
  'ranked-rows',
  'comparison-table',
  'news-timeline',
  'interpreted-filters',
  'pine-editor',
  'permission-request',
  'monitoring-rule',
  'guided-questions',
  'next-actions',
  'error',
];

export type ModuleAction = {
  id: string;
  label: string;
  /**
   * Whether pressing this changes something outside the canvas.
   *
   * Mutating actions go through a confirmation and land in workspace history.
   * Declared here rather than inferred from the label, because inferring intent
   * from a string is exactly the prose-parsing this contract forbids.
   */
  mutates: boolean;
};

export type VoyagerModule = {
  id: string;
  kind: ModuleKind;
  title: string;
  subtitle?: string;
  tag?: string;
  /** Whatever that kind renders. Validated by the renderer, not here. */
  data: unknown;
  provenance: Provenance[];
  /** Ids into `sources`. A module citing nothing that exists is not rendered. */
  sourceIds: string[];
  actions: ModuleAction[];
};

export type VoyagerPlan = {
  mode: WorkMode;
  /** Why this mode and not another. Shown, never inferred by the reader. */
  because: string;
  steps: string[];
  work: WorkStep[];
  modules: VoyagerModule[];
  sources: Source[];
  assumptions: Assumption[];
};

/* ------------------------------------------------------------------ Parsing */

function str(value: unknown, max = 300): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export type ParseResult = { plan: VoyagerPlan; refusals: string[] };

/**
 * A response, cleaned into something the canvas may render.
 *
 * Refusals are collected rather than thrown. A plan where four modules are
 * sound and the fifth is nonsense should show four modules and say what it
 * dropped — silently rendering four is how somebody ends up trusting a canvas
 * that is missing the part they asked for.
 */
export function parsePlan(input: unknown): ParseResult | null {
  if (!input || typeof input !== 'object') return null;

  const raw = input as Record<string, unknown>;
  const refusals: string[] = [];

  const mode = WORK_MODES.includes(raw.mode as WorkMode) ? (raw.mode as WorkMode) : null;
  if (!mode) return null;

  /* Sources first: a module cannot be validated without them. */
  const sources: Source[] = [];
  for (const candidate of Array.isArray(raw.sources) ? raw.sources : []) {
    if (!candidate || typeof candidate !== 'object') continue;
    const value = candidate as Record<string, unknown>;

    const provider = str(value.provider, 80);
    if (!provider) {
      refusals.push('a source with no provider was dropped');
      continue;
    }

    if (!isIsoDate(value.at)) {
      // An undated source cannot be checked and cannot be aged. It is not a
      // source; it is an assertion with a name attached.
      refusals.push(`a source from ${provider} had no usable timestamp and was dropped`);
      continue;
    }

    sources.push({
      id: str(value.id, 60) || `src_${sources.length + 1}`,
      kind: str(value.kind, 40) || 'Source',
      provider,
      at: value.at,
      detail: str(value.detail, 200) || undefined,
      delayed: value.delayed === true,
    });
  }

  const sourceIds = new Set(sources.map((source) => source.id));

  const modules: VoyagerModule[] = [];
  for (const candidate of Array.isArray(raw.modules) ? raw.modules : []) {
    if (!candidate || typeof candidate !== 'object') continue;
    const value = candidate as Record<string, unknown>;

    if (!MODULE_KINDS.includes(value.kind as ModuleKind)) {
      refusals.push(`"${str(value.kind, 40)}" is not a module this canvas renders`);
      continue;
    }

    const title = str(value.title, 120);
    if (!title) {
      refusals.push('a module with no title was dropped');
      continue;
    }

    const cited = (Array.isArray(value.sourceIds) ? value.sourceIds : [])
      .map((id) => str(id, 60))
      .filter((id) => sourceIds.has(id));

    const declared = (Array.isArray(value.sourceIds) ? value.sourceIds : []).length;
    if (declared > 0 && cited.length === 0) {
      /*
       * A module that cites sources none of which exist is worse than one that
       * cites none: it looks evidenced. Refused by name.
       */
      refusals.push(`"${title}" cited sources that are not in the response and was dropped`);
      continue;
    }

    const provenance = (Array.isArray(value.provenance) ? value.provenance : []).filter(
      (label): label is Provenance => typeof label === 'string' && label in PROVENANCE_LABEL
    );

    if (!provenance.length) {
      refusals.push(`"${title}" did not say where its content came from and was dropped`);
      continue;
    }

    const actions = (Array.isArray(value.actions) ? value.actions : [])
      .filter((action) => action && typeof action === 'object')
      .map((action) => {
        const item = action as Record<string, unknown>;
        return {
          id: str(item.id, 60),
          label: str(item.label, 60),
          // Anything not explicitly marked non-mutating is treated as mutating,
          // so a missing flag costs a confirmation rather than skipping one.
          mutates: item.mutates !== false,
        };
      })
      .filter((action) => action.id && action.label);

    modules.push({
      id: str(value.id, 60) || `mod_${modules.length + 1}`,
      kind: value.kind as ModuleKind,
      title,
      subtitle: str(value.subtitle, 200) || undefined,
      tag: str(value.tag, 40) || undefined,
      data: value.data ?? null,
      provenance,
      sourceIds: cited,
      actions,
    });
  }

  const work: WorkStep[] = (Array.isArray(raw.work) ? raw.work : [])
    .map((item, index) => {
      const value = (item ?? {}) as Record<string, unknown>;
      return {
        id: str(value.id, 60) || `work_${index + 1}`,
        label: str(value.label, 120),
        done: value.done === true,
      };
    })
    .filter((step) => step.label);

  const assumptions: Assumption[] = (Array.isArray(raw.assumptions) ? raw.assumptions : [])
    .map((item, index) => {
      const value = (item ?? {}) as Record<string, unknown>;
      return {
        id: str(value.id, 60) || `asm_${index + 1}`,
        label: str(value.label, 120),
        value: str(value.value, 120),
        editable: value.editable === true,
      };
    })
    .filter((assumption) => assumption.label);

  return {
    plan: {
      mode,
      because: str(raw.because, 200),
      steps: (Array.isArray(raw.steps) ? raw.steps : []).map((step) => str(step, 120)).filter(Boolean),
      work,
      modules,
      sources,
      assumptions,
    },
    refusals,
  };
}

/** Which sources a module actually cites, for the card footer. */
export function sourcesFor(module: VoyagerModule, sources: Source[]): Source[] {
  return sources.filter((source) => module.sourceIds.includes(source.id));
}
