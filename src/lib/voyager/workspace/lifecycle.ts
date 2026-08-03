import type { Stage, VoyagerPlan } from './contract';

/**
 * The execution lifecycle, as a state machine rather than a set of booleans.
 *
 * understanding → planning → working → partial → complete, with Stop available
 * at any point and failure as a first-class state that names its cause.
 *
 * Two decisions here matter more than the sequencing.
 *
 * **Stop keeps what is already built.** Not "cancel and discard" — the modules
 * that finished are real work, and throwing them away because somebody stopped
 * the rest is the difference between a tool that respects the time it spent and
 * one that punishes impatience.
 *
 * **Steps are user-facing.** "Screening 4 218 companies", not the reasoning
 * that chose to screen. The handoff is explicit and the reason is not modesty:
 * showing reasoning invites somebody to audit a chain that is not evidence,
 * while showing work invites them to check a claim that is.
 *
 * Import-free beyond the contract, so the harness compiles it alone.
 */

export type Run = {
  stage: Stage;
  /** How many of the plan's modules are on the canvas so far. */
  revealed: number;
  /** Which work item is in progress; -1 once none is. */
  workIndex: number;
  /** Set when the run failed, and always with a way forward. */
  failure: Failure | null;
};

export type Failure = {
  /** What went wrong, in the reader's terms. */
  cause: string;
  /** What they can do about it. A named cause with no recovery leaves them stuck. */
  recovery: string;
  /** Which recovery the interface should offer as a button. */
  action: 'retry' | 'narrow' | 'connect' | 'sign-in';
};

export const START: Run = { stage: 'understanding', revealed: 0, workIndex: -1, failure: null };

/**
 * Three failures the workspace can actually hit, each naming its cause.
 *
 * Written out rather than generated from an error string: an error message from
 * a vendor is not a sentence anybody can act on, and "something went wrong" is
 * not one either.
 */
export const FAILURES: Record<string, Failure> = {
  provider: {
    cause: 'The market data provider did not answer in time.',
    recovery: 'Nothing was changed. Trying again usually works — the free tier rate-limits bursts.',
    action: 'retry',
  },
  tooBroad: {
    cause: 'That screen matches more than 4 000 companies, which is not a result anybody can read.',
    recovery: 'Add a constraint — a market, a size, or a profitability test — and it runs again.',
    action: 'narrow',
  },
  noPermission: {
    cause: 'This needs your Wealth Hub, and it has not been connected.',
    recovery: 'Connect it and choose which scopes to share. Nothing is read before you do.',
    action: 'connect',
  },
};

/** Whether the run is still doing something, for the Stop button and the spinner. */
export function isRunning(run: Run): boolean {
  return run.stage === 'understanding' || run.stage === 'planning' || run.stage === 'working' || run.stage === 'partial';
}

/**
 * The next state.
 *
 * A pure step function so the sequence can be tested without a timer — the
 * component supplies the clock, and the rules live here.
 */
export function advance(run: Run, plan: VoyagerPlan): Run {
  switch (run.stage) {
    case 'understanding':
      return { ...run, stage: 'planning' };

    case 'planning':
      return { ...run, stage: 'working', workIndex: 0 };

    case 'working': {
      const next = run.workIndex + 1;
      // Work finishes before modules start appearing, so the first card lands
      // on a canvas whose plan is already visible rather than beside a
      // checklist still moving.
      if (next < plan.work.length) return { ...run, workIndex: next };
      return { ...run, stage: 'partial', workIndex: -1 };
    }

    case 'partial': {
      const revealed = run.revealed + 1;
      if (revealed >= plan.modules.length) return { ...run, stage: 'complete', revealed };
      return { ...run, revealed };
    }

    default:
      return run;
  }
}

/**
 * Stop, keeping everything already built.
 *
 * The modules on screen stay on screen. `stopped` is a distinct stage from
 * `complete` because the answer is genuinely partial and saying otherwise would
 * be claiming work that was never done.
 */
export function stop(run: Run): Run {
  return { ...run, stage: 'stopped', workIndex: -1 };
}

export function fail(run: Run, failure: Failure): Run {
  // A failure keeps whatever was revealed: half an answer with an explanation
  // beats an empty canvas with the same explanation.
  return { ...run, stage: 'failed', workIndex: -1, failure };
}

/** What the status line says at each stage. */
export function statusFor(run: Run, plan: VoyagerPlan): string {
  switch (run.stage) {
    case 'understanding':
      return 'Understanding your request…';
    case 'planning':
      return 'Planning the work…';
    case 'working':
      return plan.work[run.workIndex]?.label ?? 'Working…';
    case 'partial':
      return `Building — ${run.revealed} of ${plan.modules.length} ready`;
    case 'complete':
      return 'Complete';
    case 'stopped':
      return `Stopped — ${run.revealed} of ${plan.modules.length} kept`;
    case 'failed':
      return 'Did not finish';
  }
}
