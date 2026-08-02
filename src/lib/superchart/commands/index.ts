import type { ChartInterval, ChartType } from '../chart-engine/types';
import { TOOL_POINTS, type DrawingInstance, type DrawingTool } from '../drawings/types';
import { INDICATORS } from '../indicators';
import type { StudyChoice } from '../layouts/schema';

/**
 * The command bus — where anything Voyager proposes crosses into the chart.
 *
 * One entry point, and it is a gate rather than a pipe. A command arriving here
 * is untrusted whatever produced it: a model, a scripted planner, or a future
 * request from somewhere else. So every command is parsed into a known shape,
 * every id checked against a registry, every number pulled into range, and
 * anything unrecognised refused by name rather than repaired into a guess.
 *
 * The lifecycle is proposed → validated → previewed → confirmed → applied. The
 * point of the middle is that nothing reaches the saved chart without a person
 * seeing what it would do first, and that undo puts the whole plan back in one
 * press — a plan is one thing somebody asked for, so it is one thing to undo.
 *
 * Hand-written validation rather than a schema library. The project has
 * eighteen dependencies and none of them validate schemas; `parseLayout` set
 * this precedent for stored layouts, and this is the same problem — a shape
 * from outside, checked field by field, refused rather than coerced.
 *
 * Import-free beyond sibling modules, so the harness compiles it alone.
 */

export type ChartCommand =
  | { kind: 'add_study'; definitionId: string; params: Record<string, number> }
  | { kind: 'remove_study'; definitionId: string }
  | { kind: 'set_interval'; interval: ChartInterval }
  | { kind: 'set_chart_type'; chartType: ChartType }
  | { kind: 'add_drawing'; tool: DrawingTool; points: Array<{ barIndex: number; price: number }> }
  | { kind: 'remove_drawing'; id: string };

export type CommandStatus = 'proposed' | 'validated' | 'previewed' | 'applied' | 'refused';

/** What a command will do, in words, before it does it. */
export type PlanStep = {
  command: ChartCommand;
  title: string;
  detail: string;
  /** Off means "Apply selected" leaves this one out. */
  selected: boolean;
};

export type CommandPlan = {
  id: string;
  question: string;
  title: string;
  /** Why this plan and not another — shown, never inferred. */
  because: string;
  steps: PlanStep[];
  status: CommandStatus;
  /**
   * What was asked for and could not be done. Present in the plan rather than
   * dropped, because silently doing four of five things asked for is how
   * somebody ends up trusting a chart that is missing the part they wanted.
   */
  refusals: string[];
};

/** The slice of workspace state a command can change. */
export type CommandState = {
  studies: StudyChoice[];
  drawings: DrawingInstance[];
  interval: ChartInterval;
  chartType: ChartType;
};

const INTERVALS: ChartInterval[] = ['1m', '5m', '15m', '1H', '4H', '1D', '1W', '1M'];

const CHART_TYPES: ChartType[] = [
  'candles',
  'bars',
  'line',
  'area',
  'baseline',
  'hollow',
  'heikin',
];

/*
 * Read off `TOOL_POINTS` rather than listed again.
 *
 * A second hand-written list of the same union is a list that will be one tool
 * behind the day a tool is added — and the failure is silent: a command naming
 * the new tool would be refused as unknown.
 */
const DRAWING_TOOLS = Object.keys(TOOL_POINTS) as DrawingTool[];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * A command, or a reason it is not one.
 *
 * Returns the reason rather than null so the panel can say what was refused.
 * "Voyager proposed something invalid" is not a message anybody can act on.
 */
export function parseCommand(input: unknown): { command: ChartCommand } | { refused: string } {
  if (!input || typeof input !== 'object') return { refused: 'not a command' };

  const raw = input as Record<string, unknown>;

  switch (raw.kind) {
    case 'add_study': {
      const definitionId = raw.definitionId;
      if (typeof definitionId !== 'string' || !INDICATORS[definitionId]) {
        return { refused: `there is no study called "${String(definitionId)}"` };
      }

      const definition = INDICATORS[definitionId];
      const params: Record<string, number> = { ...definition.defaults };
      const source = raw.params && typeof raw.params === 'object' ? raw.params : {};

      for (const [name, value] of Object.entries(source as Record<string, unknown>)) {
        // A parameter the study does not have is dropped rather than carried:
        // it would sit in the saved layout meaning nothing.
        const range = definition.ranges[name];
        if (!range || !isFiniteNumber(value)) continue;
        params[name] = Math.min(range.max, Math.max(range.min, Math.round(value)));
      }

      return { command: { kind: 'add_study', definitionId, params } };
    }

    case 'remove_study': {
      if (typeof raw.definitionId !== 'string') return { refused: 'no study named' };
      return { command: { kind: 'remove_study', definitionId: raw.definitionId } };
    }

    case 'set_interval': {
      const interval = raw.interval as ChartInterval;
      if (!INTERVALS.includes(interval)) {
        return { refused: `"${String(raw.interval)}" is not an interval this chart serves` };
      }
      return { command: { kind: 'set_interval', interval } };
    }

    case 'set_chart_type': {
      const chartType = raw.chartType as ChartType;
      if (!CHART_TYPES.includes(chartType)) {
        return { refused: `"${String(raw.chartType)}" is not a chart type` };
      }
      return { command: { kind: 'set_chart_type', chartType } };
    }

    case 'add_drawing': {
      const tool = raw.tool as DrawingTool;
      if (!DRAWING_TOOLS.includes(tool)) {
        return { refused: `"${String(raw.tool)}" is not a drawing tool` };
      }

      const points = Array.isArray(raw.points) ? raw.points : [];
      const clean = points
        .filter(
          (point): point is { barIndex: number; price: number } =>
            Boolean(point) &&
            typeof point === 'object' &&
            isFiniteNumber((point as { barIndex: unknown }).barIndex) &&
            isFiniteNumber((point as { price: unknown }).price)
        )
        .map((point) => ({ barIndex: Math.round(point.barIndex), price: point.price }));

      if (clean.length < 1) return { refused: 'that drawing has no usable points' };
      return { command: { kind: 'add_drawing', tool, points: clean } };
    }

    case 'remove_drawing': {
      if (typeof raw.id !== 'string') return { refused: 'no drawing named' };
      return { command: { kind: 'remove_drawing', id: raw.id } };
    }

    default:
      return { refused: `"${String(raw.kind)}" is not something this chart can do` };
  }
}

/** What a command will do, for the plan card. */
export function describeCommand(command: ChartCommand): { title: string; detail: string } {
  switch (command.kind) {
    case 'add_study': {
      const definition = INDICATORS[command.definitionId];
      return {
        title: `Add ${definition?.name ?? command.definitionId}`,
        detail: definition ? definition.label(command.params) : '',
      };
    }
    case 'remove_study':
      return {
        title: `Remove ${INDICATORS[command.definitionId]?.name ?? command.definitionId}`,
        detail: 'The study comes off the chart. Nothing else changes.',
      };
    case 'set_interval':
      return { title: `Switch to ${command.interval}`, detail: 'Reloads the series at that interval.' };
    case 'set_chart_type':
      return { title: `Draw as ${command.chartType}`, detail: 'The same data, drawn differently.' };
    case 'add_drawing':
      return {
        title: `Draw a ${command.tool}`,
        detail: `${command.points.length} point${command.points.length === 1 ? '' : 's'}, marked as Voyager's.`,
      };
    case 'remove_drawing':
      return { title: 'Remove a drawing', detail: 'Reversible with undo.' };
  }
}

/**
 * Applies commands to a state, returning a new one.
 *
 * Pure, so the same function produces the preview and the applied result. Two
 * code paths — one that draws the proposal and one that performs it — is how a
 * preview ends up showing something other than what apply does, which is worse
 * than having no preview at all.
 */
export function applyCommands(
  state: CommandState,
  commands: ChartCommand[],
  options: { draft: boolean }
): CommandState {
  let next: CommandState = { ...state, studies: [...state.studies], drawings: [...state.drawings] };

  for (const command of commands) {
    switch (command.kind) {
      case 'add_study': {
        const existing = next.studies.findIndex(
          (study) => study.definitionId === command.definitionId
        );
        const choice: StudyChoice = {
          definitionId: command.definitionId,
          params: command.params,
        };
        // Asking for a study already present changes its parameters rather than
        // stacking a second copy of the same lines on the chart.
        if (existing >= 0) next.studies[existing] = choice;
        else next.studies = [...next.studies, choice];
        break;
      }

      case 'remove_study':
        next.studies = next.studies.filter(
          (study) => study.definitionId !== command.definitionId
        );
        break;

      case 'set_interval':
        next = { ...next, interval: command.interval };
        break;

      case 'set_chart_type':
        next = { ...next, chartType: command.chartType };
        break;

      case 'add_drawing': {
        const now = new Date().toISOString();
        next.drawings = [
          ...next.drawings,
          {
            id: `v_${command.tool}_${next.drawings.length + 1}`,
            tool: command.tool,
            points: command.points,
            style: { colour: '#7c4dff', width: 1.6, dashed: options.draft },
            locked: false,
            hidden: false,
            // Marked as Voyager's for as long as it exists, not just while it is
            // a proposal — whose idea an object was outlives the proposal.
            source: 'voyager',
            createdAt: now,
            updatedAt: now,
            draft: options.draft,
          },
        ];
        break;
      }

      case 'remove_drawing':
        next.drawings = next.drawings.filter((drawing) => drawing.id !== command.id);
        break;
    }
  }

  return next;
}

export type DiffRow = { label: string; before: string; after: string; changed: boolean };

/** The Before/After rows, computed from the two states rather than narrated. */
export function diffStates(before: CommandState, after: CommandState): DiffRow[] {
  const studyLabel = (state: CommandState) =>
    state.studies.length
      ? state.studies
          .map((study) => INDICATORS[study.definitionId]?.label(study.params) ?? study.definitionId)
          .join(', ')
      : 'none';

  const rows: DiffRow[] = [
    {
      label: 'Studies',
      before: studyLabel(before),
      after: studyLabel(after),
      changed: studyLabel(before) !== studyLabel(after),
    },
    {
      label: 'Drawings',
      before: String(before.drawings.length),
      after: String(after.drawings.length),
      changed: before.drawings.length !== after.drawings.length,
    },
    {
      label: 'Interval',
      before: before.interval,
      after: after.interval,
      changed: before.interval !== after.interval,
    },
    {
      label: 'Chart type',
      before: before.chartType,
      after: after.chartType,
      changed: before.chartType !== after.chartType,
    },
  ];

  return rows;
}

/** A plan from a list of proposed commands, with anything refused kept visible. */
export function buildPlan(input: {
  id: string;
  question: string;
  title: string;
  because: string;
  proposed: unknown[];
}): CommandPlan {
  const steps: PlanStep[] = [];
  const refusals: string[] = [];

  for (const candidate of input.proposed) {
    const result = parseCommand(candidate);

    if ('refused' in result) {
      refusals.push(result.refused);
      continue;
    }

    const { title, detail } = describeCommand(result.command);
    steps.push({ command: result.command, title, detail, selected: true });
  }

  return {
    id: input.id,
    question: input.question,
    title: input.title,
    because: input.because,
    steps,
    status: steps.length ? 'validated' : 'refused',
    refusals,
  };
}

/** The commands a person has left switched on. */
export function selectedCommands(plan: CommandPlan): ChartCommand[] {
  return plan.steps.filter((step) => step.selected).map((step) => step.command);
}
