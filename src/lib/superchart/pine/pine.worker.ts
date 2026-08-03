import { runPine, type PineRunResult } from './evaluate';

/**
 * The preview runtime, off the main thread.
 *
 * A budget inside the interpreter stops a script that is merely enormous, with
 * a message and a line number. It cannot stop everything: a pathological input
 * that finds a slow path in the parser would still hold whichever thread it is
 * on. On the main thread that is a frozen tab with no way back. Here the page
 * stays responsive and the caller terminates the worker, which is the only
 * genuinely reliable stop.
 *
 * This runs an interpreter over an AST. It does not eval, does not construct
 * functions from text, and never turns the script into JavaScript.
 */

export type PineRequest = {
  id: number;
  source: string;
  bars: {
    open: number[];
    high: number[];
    low: number[];
    close: number[];
    volume: number[];
    time: number[];
  };
};

export type PineResponse =
  | { id: number; ok: true; result: PineRunResult }
  | { id: number; ok: false; message: string; line: number };

self.onmessage = (event: MessageEvent<PineRequest>) => {
  const { id, source, bars } = event.data;

  try {
    const result = runPine(source, bars);
    self.postMessage({ id, ok: true, result } satisfies PineResponse);
  } catch (error) {
    /*
     * Errors are reported, never thrown out of the worker. An uncaught error
     * here surfaces as a generic `error` event with no line number, which is
     * exactly the information somebody needs and would not get.
     */
    const line =
      error && typeof error === 'object' && 'line' in error && typeof error.line === 'number'
        ? error.line
        : 1;

    self.postMessage({
      id,
      ok: false,
      message: error instanceof Error ? error.message : 'The preview failed for an unknown reason.',
      line,
    } satisfies PineResponse);
  }
};
