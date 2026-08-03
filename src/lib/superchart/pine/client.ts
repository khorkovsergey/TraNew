import type { PineRunResult } from './evaluate';
import type { PineRequest, PineResponse } from './pine.worker';

/**
 * Talking to the preview worker.
 *
 * The worker is created per run and terminated after it, rather than kept warm.
 * A pooled worker is faster and wrong here: the interpreter holds no state
 * between runs, and a worker that survived a script which wedged it would carry
 * that into the next run. Starting one costs a few milliseconds against a
 * preview somebody pressed a button for.
 *
 * The wall-clock timeout is the real stop. The interpreter's own budget catches
 * a script that is enormous; only termination catches one that is pathological.
 */

export type PreviewOutcome =
  | { status: 'ok'; result: PineRunResult }
  | { status: 'failed'; message: string; line: number }
  | { status: 'unavailable'; message: string };

/** Long enough for a real script over five thousand bars, short enough to notice. */
export const PREVIEW_TIMEOUT_MS = 4_000;

export function runPreview(request: Omit<PineRequest, 'id'>): Promise<PreviewOutcome> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve({
      status: 'unavailable',
      message: 'This browser has no Web Workers, so the preview cannot run off the main thread.',
    });
  }

  return new Promise((resolve) => {
    let worker: Worker;

    try {
      // The URL form is what lets the bundler emit the worker as its own chunk.
      // A Blob URL would work too and would mean shipping the interpreter as a
      // string, which is the shape this project is avoiding.
      worker = new Worker(new URL('./pine.worker.ts', import.meta.url));
    } catch {
      resolve({
        status: 'unavailable',
        message: 'The preview runtime could not start in this browser.',
      });
      return;
    }

    let settled = false;

    const finish = (outcome: PreviewOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      resolve(outcome);
    };

    const timer = setTimeout(() => {
      finish({
        status: 'failed',
        message: `The preview was stopped after ${PREVIEW_TIMEOUT_MS / 1000} seconds. Export the script to run it without a time limit.`,
        line: 1,
      });
    }, PREVIEW_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<PineResponse>) => {
      const data = event.data;
      if (data.ok) finish({ status: 'ok', result: data.result });
      else finish({ status: 'failed', message: data.message, line: data.line });
    };

    worker.onerror = (event) => {
      finish({
        status: 'failed',
        message: event.message || 'The preview runtime stopped unexpectedly.',
        line: 1,
      });
    };

    worker.postMessage({ id: 1, ...request } satisfies PineRequest);
  });
}
