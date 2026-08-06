import type { VoyagerAnswer } from '../types';

/**
 * A model's answer, rendered as a workspace plan.
 *
 * The workspace had its own engine of hand-written scenarios and never called
 * the model at all — a question it did not recognise fell through to the market
 * summary, which is how "What can you help me with?" was answered with where the
 * S&P closed. The scenarios are good at what they cover; the fallback was the
 * bug, and this is what replaces it.
 *
 * Everything here is a translation, not a decision. The model's text, bullets,
 * sources and follow-ups go into modules that the same `parsePlan` gate checks,
 * so an answer from a language model is held to the contract the scripted ones
 * are.
 */

const NOW_SOURCE = 'src_model';

/** The answer, as a plan the canvas can render. */
export function conversationalPlan(question: string, answer: VoyagerAnswer, at: string): unknown {
  const modules: unknown[] = [
    {
      id: 'm_asked',
      kind: 'text-insight',
      title: 'You asked',
      provenance: ['educational'],
      sourceIds: [],
      data: { body: question },
      actions: [],
    },
    {
      id: 'm_answer',
      kind: 'text-insight',
      title: 'Answer',
      /*
       * `inference` first, because that is what a model's prose is. It sits
       * beside the measured modules the scripted scenarios produce and must not
       * be mistaken for one of them.
       */
      provenance: answer.simulated ? ['educational'] : ['inference', 'educational'],
      sourceIds: [NOW_SOURCE],
      data: { body: answer.text },
      actions: [],
    },
  ];

  if (answer.bullets.length) {
    modules.push({
      id: 'm_points',
      kind: 'next-actions',
      title: 'Key points',
      provenance: ['inference'],
      sourceIds: [NOW_SOURCE],
      data: { items: answer.bullets.slice(0, 6) },
      actions: [],
    });
  }

  if (answer.followUps.length) {
    modules.push({
      id: 'm_next',
      kind: 'next-actions',
      title: 'Where to look next',
      provenance: ['educational'],
      sourceIds: [],
      data: { items: answer.followUps.slice(0, 4) },
      actions: [],
    });
  }

  return {
    mode: 'ask',
    because: 'you asked a question none of the built analyses answers, so this is the model speaking',
    steps: ['Read the request', 'Ask the model', 'Show what it rests on'],
    work: [{ id: 'w1', label: 'Asking the model', done: false }],
    sources: [
      {
        id: NOW_SOURCE,
        /*
         * Named for what it is. When no model is configured the platform answers
         * from a written script, and the label says so rather than letting a
         * fallback pass for a live answer.
         */
        kind: answer.simulated ? 'EDUCATIONAL' : 'MODEL',
        provider: answer.simulated ? 'TradingNew (written answer)' : 'Voyager',
        at,
        detail: answer.sources || 'No external data was used for this answer.',
      },
    ],
    assumptions: [],
    modules,
  };
}

/**
 * What the canvas shows when the model could not be reached.
 *
 * Explicitly an error, with the question preserved and a way to try again. The
 * one thing it must never be is a market dashboard: an integration failure
 * disguised as a valid market answer is worse than an outage, because nobody
 * finds out.
 */
export function failurePlan(question: string, at: string): unknown {
  return {
    mode: 'ask',
    because: 'the model could not be reached, and a made-up answer would be worse than none',
    steps: ['Read the request', 'Ask the model'],
    work: [{ id: 'w1', label: 'Asking the model', done: false }],
    sources: [],
    assumptions: [],
    modules: [
      {
        id: 'm_asked',
        kind: 'text-insight',
        title: 'You asked',
        provenance: ['educational'],
        sourceIds: [],
        data: { body: question },
        actions: [],
      },
      {
        id: 'm_error',
        kind: 'text-insight',
        title: 'Voyager is temporarily unavailable',
        provenance: ['educational'],
        sourceIds: [],
        data: {
          body:
            'Your question is kept and nothing was sent anywhere. Try again in a moment — the rest of the portal works normally, and the lessons, comparisons and market pages do not depend on this.',
        },
        actions: [],
      },
    ],
    // Rendered by the canvas as the reason the run stopped.
    at,
  };
}
