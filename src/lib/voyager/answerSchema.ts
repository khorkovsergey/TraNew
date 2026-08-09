import { STUDY_IDS, STUDY_PARAM_NAMES } from '../studies/registry';
import { VOYAGER_ACTION_IDS } from './actions';
import { CHART_KINDS } from './chart/spec';
import type { VoyagerContentType } from './types';

/**
 * The shape every model answer must take.
 *
 * In its own module for one reason: a schema the API rejects fails invisibly.
 * `askVoyager` catches the error, logs it and returns a scripted answer, so the
 * widget still replies and nothing on screen looks wrong — every answer on
 * production was scripted for an hour before a log line gave it away. Here it
 * can be checked by a test that runs on every commit, without a key and without
 * a running app.
 *
 * The rule that broke it: `additionalProperties` must be `false`, never a type.
 * An open map is a place for a key nobody planned for, and the API refuses it.
 */
/** The labels an answer may carry; the widget renders one on every reply. */
export const CONTENT_TYPES: VoyagerContentType[] = [
  'AI explanation',
  'AI analysis',
  'AI summary',
  'AI structured',
  'Academy context',
];

export const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    contentType: { type: 'string', enum: CONTENT_TYPES },
    text: { type: 'string' },
    bullets: { type: 'array', items: { type: 'string' } },
    sources: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          action: { type: 'string', enum: VOYAGER_ACTION_IDS },
        },
        required: ['label', 'action'],
        additionalProperties: false,
      },
    },
    followUps: { type: 'array', items: { type: 'string' } },
    /*
     * Optional, and deliberately narrow: an id from a closed set and named
     * numbers. There is no field here the model could put code in.
     *
     * Every parameter is listed rather than allowed as an open map — the API
     * rejects a schema whose `additionalProperties` is a type rather than
     * `false`, and it is right to: an open map is a place for a key nobody
     * planned for. The names come from the registry, so a study gaining a
     * parameter cannot leave the schema behind.
     */
    study: {
      type: 'object',
      properties: {
        id: { type: 'string', enum: STUDY_IDS },
        params: {
          type: 'object',
          properties: Object.fromEntries(
            STUDY_PARAM_NAMES.map((name) => [name, { type: 'number' }])
          ),
          additionalProperties: false,
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
    /*
     * How to draw the data a market tool already returned.
     *
     * Only a shape and a study list — never the numbers, which came from the
     * provider, and never a symbol, which came from the resolver. The model is
     * choosing a view of something that already exists, so there is nothing
     * here it could use to describe a chart that was never drawn.
     */
    chart: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: CHART_KINDS as unknown as string[],
          description:
            'line for a price over time, candles for day-to-day movement, area for the same as a filled line, performance for comparing instruments, drawdown for falls from each peak.',
        },
        studies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', enum: STUDY_IDS },
              params: {
                type: 'object',
                properties: Object.fromEntries(
                  STUDY_PARAM_NAMES.map((name) => [name, { type: 'number' }])
                ),
                additionalProperties: false,
              },
            },
            required: ['id'],
            additionalProperties: false,
          },
        },
      },
      required: ['kind'],
      additionalProperties: false,
    },
  },
  required: ['contentType', 'text', 'bullets', 'sources', 'confidence', 'actions', 'followUps'],
  additionalProperties: false,
} as const;
