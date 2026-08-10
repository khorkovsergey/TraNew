/**
 * The telemetry registry — the one description of every event the portal emits.
 *
 * Import-free, so the unit harness can compile it alone and assert its
 * invariants without a database. Everything downstream derives from this file:
 * the ingest allowlist, the property validator, the coverage report, and the
 * metric catalogue. The brief's rule was "do not maintain two independent
 * lists", and the way that rule is kept is that there is nothing else to keep
 * in sync — `src/lib/events/analytics.ts` stays the product-facing *typed* API
 * that feature code calls, and a test asserts every member of that union
 * appears here.
 *
 * ## Why a property cannot be free text
 *
 * `PropertySpec` has four kinds — a closed enum, a bounded token, a bounded
 * integer, a boolean — and deliberately **no free-text kind at all**. There is
 * no way to declare "a string" here, so there is no way to declare a field that
 * could hold a question, an answer, a note, a brief or a search query. The
 * privacy rule stops being a review item and becomes a thing the type system
 * will not express.
 *
 * A token is not an escape hatch: it is matched against `TOKEN_PATTERN` below,
 * which admits identifiers and rejects whitespace-heavy prose, and it is capped.
 * `queryLength` is a number for exactly this reason and always will be.
 *
 * ## Why the caller checker had to change
 *
 * `scripts/check-analytics.mjs` decides an event has an emitter by looking for
 * its name as a string literal anywhere under `src/`. Every event name in the
 * product appears in this file, so without an exclusion this registry would
 * have made all seven orphaned plan events look emitted and turned a red gate
 * green while nothing emitted them. The checker now skips `src/lib/analytics/`,
 * and `scripts/verify-admin-metrics.mjs` asserts that a registry-only name is
 * still reported as an orphan.
 */

/* ---------------------------------------------------------- Property specs */

/** Identifiers, slugs, comma-joined id lists. Not prose: no long runs of words. */
export const TOKEN_PATTERN = /^[A-Za-z0-9_.:,|\-/]+$/;

export type PropertySpec =
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'token'; maxLength: number }
  | { kind: 'integer'; min: number; max: number }
  | { kind: 'boolean' };

export type PropertySchema = Readonly<Record<string, PropertySpec>>;

/**
 * Property names that may never exist, whatever their declared kind.
 *
 * The kind system already makes free text unrepresentable; this is the second
 * lock, against a field that is technically a bounded token and still the wrong
 * thing to keep — an `email` is short, an `ip` matches the token pattern, and a
 * `ticker` is a position somebody may hold.
 */
export const FORBIDDEN_PROPERTY_NAMES = [
  'email',
  'name',
  'fullname',
  'username',
  'prompt',
  'question',
  'questiontext',
  'answer',
  'answertext',
  'message',
  'text',
  'body',
  'content',
  'note',
  'notes',
  'brief',
  'summary',
  'title',
  'holdings',
  'portfolio',
  'portfoliovalue',
  'amount',
  'balance',
  'ip',
  'ipaddress',
  'rawip',
  'useragent',
  'useragentraw',
  'documentbody',
  'query',
  'querytext',
  'search',
  'searchtext',
  'referrer',
  'url',
  'ticker',
  'symbol',
  'instrument',
] as const;

/* ------------------------------------------------------------- Event shapes */

/** Where the event was produced. Server events cannot be spoofed by a browser. */
export type EventKind = 'client' | 'server' | 'operational';

/**
 * Whether the event describes the product today.
 *
 * `legacy` members stay declared so a historical query can name them, and are
 * excluded from every current KPI. Nothing emits them.
 */
export type Lifecycle = 'current' | 'legacy';

/**
 * How much the event says about a person.
 *
 * `shape` — counts, durations, outcomes; says nothing about who or what.
 * `product_area` — names a surface or a destination; a fact about the product.
 * `content_id` — names a public object, such as an event or an expert profile.
 */
export type PrivacyClass = 'shape' | 'product_area' | 'content_id';

export type EventDefinition = {
  name: string;
  schemaVersion: number;
  kind: EventKind;
  /** The surface registry key, or `portal` for the global backbone. */
  surface: string;
  lifecycle: Lifecycle;
  privacy: PrivacyClass;
  properties: PropertySchema;
  /**
   * A value-producing next step, per the meaningful-action taxonomy. A page
   * view is never one; a failed action is never one; an inert row cannot be
   * one, because "Coming soon" rows do not click.
   */
  meaningful?: boolean;
  /** Counts toward continuation, and whether it leaves the portal. */
  continuation?: 'internal' | 'external';
  /** Why an event is here, when the name does not carry it. */
  note?: string;
};

/* ------------------------------------------------------ Reusable shorthands */

const bool: PropertySpec = { kind: 'boolean' };
const smallCount: PropertySpec = { kind: 'integer', min: 0, max: 10_000 };
const id = (maxLength = 64): PropertySpec => ({ kind: 'token', maxLength });
const oneOf = (...values: string[]): PropertySpec => ({ kind: 'enum', values });

/* ----------------------------------------------------------- The registry */

export const EVENT_REGISTRY: readonly EventDefinition[] = [
  /* ------------------------------------------------------------ The portal
   *
   * The global backbone, and the only events this section emits itself. The
   * product had no session, page-view or navigation event of any kind before
   * this: every existing event was feature-local, so there was no denominator
   * to put any of them over.
   */
  {
    name: 'portal_session_started',
    schemaVersion: 1,
    kind: 'client',
    surface: 'portal',
    lifecycle: 'current',
    privacy: 'shape',
    properties: {
      entry: { kind: 'token', maxLength: 96 },
      acquisition: oneOf('direct', 'organic', 'referral', 'social', 'ai', 'partner', 'internal', 'unknown'),
      device: oneOf('mobile', 'tablet', 'desktop', 'unknown'),
    },
    note: 'Session-scoped. Never a cross-session visitor identity — see identity.ts.',
  },
  {
    name: 'portal_page_viewed',
    schemaVersion: 1,
    kind: 'client',
    surface: 'portal',
    lifecycle: 'current',
    privacy: 'product_area',
    properties: { route: { kind: 'token', maxLength: 96 }, area: id(48) },
    note: 'Route template only. A populated URL can carry a ticker, so it never travels.',
  },
  {
    name: 'portal_navigation_completed',
    schemaVersion: 1,
    kind: 'client',
    surface: 'portal',
    lifecycle: 'current',
    privacy: 'product_area',
    properties: { from: id(48), to: id(48), hop: smallCount },
  },
  {
    name: 'portal_engagement_checkpoint',
    schemaVersion: 1,
    kind: 'client',
    surface: 'portal',
    lifecycle: 'current',
    privacy: 'shape',
    properties: { seconds: { kind: 'integer', min: 0, max: 3600 }, area: id(48) },
    note: 'PMCR eligibility is a landing view plus three engaged seconds, so it depends on this.',
  },
  {
    name: 'portal_meaningful_action',
    schemaVersion: 1,
    kind: 'client',
    surface: 'portal',
    lifecycle: 'current',
    privacy: 'product_area',
    properties: { action: id(64), area: id(48), ordinal: smallCount },
    meaningful: true,
    continuation: 'internal',
  },
  {
    name: 'portal_external_continuation',
    schemaVersion: 1,
    kind: 'client',
    surface: 'portal',
    lifecycle: 'current',
    privacy: 'product_area',
    properties: { destination: id(48), area: id(48) },
    continuation: 'external',
    note: 'A TradingView handoff is a product boundary, not a failure. Shown beside internal, never inside it.',
  },

  /* ------------------------------------------------------------ Operational */
  {
    name: 'telemetry_ingest_rejected',
    schemaVersion: 1,
    kind: 'operational',
    surface: 'portal',
    lifecycle: 'current',
    privacy: 'shape',
    properties: {
      reason: oneOf(
        'unknown_event',
        'unknown_property',
        'bad_property_value',
        'batch_too_large',
        'payload_too_large',
        'bad_timestamp',
        'legacy_event',
        'malformed'
      ),
      eventName: id(64),
    },
    note: 'Ingest health. Counting rejections is how a silently broken emitter is noticed.',
  },
  {
    name: 'dashboard_query_failure',
    schemaVersion: 1,
    kind: 'operational',
    surface: 'portal',
    lifecycle: 'current',
    privacy: 'shape',
    properties: { endpoint: id(48), code: id(48) },
  },

  /* ------------------------------------------------------------------ Home */
  {
    name: 'intent_selected',
    schemaVersion: 1,
    kind: 'client',
    surface: 'home',
    lifecycle: 'current',
    privacy: 'product_area',
    properties: { intent: id(48) },
    meaningful: true,
    continuation: 'internal',
    note:
      'Current Home telemetry, emitted by components/home/IntentCards.tsx. Both v2 briefs filed it under the retired plan funnel; it is not legacy, and treating it as such would delete the only Home continuation signal there is.',
  },

  /* --------------------------------------------- Find my next step (/start) */
  { name: 'next_step_opened', schemaVersion: 1, kind: 'client', surface: 'start', lifecycle: 'current', privacy: 'shape', properties: {} },
  { name: 'next_step_level_selected', schemaVersion: 1, kind: 'client', surface: 'start', lifecycle: 'current', privacy: 'shape', properties: {}, note: 'Deliberately payload-free: what somebody says about their own money does not travel.' },
  { name: 'next_step_intent_selected', schemaVersion: 1, kind: 'client', surface: 'start', lifecycle: 'current', privacy: 'shape', properties: {} },
  { name: 'next_step_clarification_selected', schemaVersion: 1, kind: 'client', surface: 'start', lifecycle: 'current', privacy: 'shape', properties: {}, note: 'Optional in the router: not every path asks, so it is never required for funnel completion.' },
  { name: 'next_step_recommendation_shown', schemaVersion: 1, kind: 'client', surface: 'start', lifecycle: 'current', privacy: 'product_area', properties: { destination: id(48) } },
  { name: 'next_step_destination_clicked', schemaVersion: 1, kind: 'client', surface: 'start', lifecycle: 'current', privacy: 'product_area', properties: { destination: id(48), external: bool }, meaningful: true, continuation: 'internal' },
  { name: 'next_step_restarted', schemaVersion: 1, kind: 'client', surface: 'start', lifecycle: 'current', privacy: 'shape', properties: {} },

  /* ------------------------------------- The retired plan funnel — legacy */
  { name: 'diagnostic_completed', schemaVersion: 1, kind: 'client', surface: 'start', lifecycle: 'legacy', privacy: 'shape', properties: { steps: smallCount } },
  { name: 'plan_generated', schemaVersion: 1, kind: 'client', surface: 'start', lifecycle: 'legacy', privacy: 'shape', properties: { steps: smallCount, risk: id(24) } },
  { name: 'plan_step_started', schemaVersion: 1, kind: 'client', surface: 'start', lifecycle: 'legacy', privacy: 'shape', properties: { stepId: id(48), index: smallCount } },
  { name: 'plan_step_completed', schemaVersion: 1, kind: 'client', surface: 'start', lifecycle: 'legacy', privacy: 'shape', properties: { stepId: id(48), ofSteps: smallCount } },
  { name: 'save_prompt_viewed', schemaVersion: 1, kind: 'client', surface: 'start', lifecycle: 'legacy', privacy: 'product_area', properties: { surface: id(48) } },
  { name: 'registration_completed_from_plan', schemaVersion: 1, kind: 'client', surface: 'start', lifecycle: 'legacy', privacy: 'shape', properties: { steps: smallCount } },
  { name: 'plan_resumed', schemaVersion: 1, kind: 'client', surface: 'start', lifecycle: 'legacy', privacy: 'shape', properties: { surface: id(48), completed: smallCount, ofSteps: smallCount } },

  /* ---------------------------------------------------------------- Events */
  { name: 'events_discovery_viewed', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'shape', properties: { view: id(24), filterCount: smallCount, resultCount: smallCount } },
  { name: 'events_filter_applied', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'product_area', properties: { filter: id(32), valueCount: smallCount } },
  { name: 'events_search_performed', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'shape', properties: { queryLength: smallCount, resultCount: smallCount }, note: 'The length, never the query. This is the shape the whole file is built around.' },
  { name: 'events_view_mode_changed', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'shape', properties: { view: id(24) } },
  { name: 'event_viewed', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'content_id', properties: { eventId: id(96) } },
  { name: 'event_saved', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'content_id', properties: { eventId: id(96), saved: bool }, meaningful: true, continuation: 'internal' },
  { name: 'event_shared', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'content_id', properties: { eventId: id(96), channel: id(24) } },
  { name: 'event_registration_started', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'content_id', properties: { eventId: id(96) } },
  { name: 'event_registration_completed', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'content_id', properties: { eventId: id(96), waitlisted: bool }, meaningful: true, continuation: 'internal', note: 'Funnel sequencing only. Current registration counts come from event_registration rows, or the two would double-count.' },
  { name: 'event_registration_cancelled', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'content_id', properties: { eventId: id(96) } },
  { name: 'event_waitlist_joined', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'content_id', properties: { eventId: id(96), position: smallCount } },
  { name: 'event_external_link_clicked', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'content_id', properties: { eventId: id(96), domain: id(96), trusted: bool }, continuation: 'external' },
  { name: 'event_calendar_action', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'content_id', properties: { eventId: id(96), target: id(24) } },
  { name: 'event_creation_started', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'shape', properties: {} },
  { name: 'event_creation_step_completed', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'shape', properties: { step: smallCount } },
  { name: 'event_creation_submitted', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'content_id', properties: { eventId: id(96) }, meaningful: true, continuation: 'internal' },
  { name: 'event_reported', schemaVersion: 1, kind: 'client', surface: 'events', lifecycle: 'current', privacy: 'content_id', properties: { eventId: id(96), reason: id(32) } },

  /* ----------------------------------------------------------- Supercharts */
  { name: 'superchart_opened', schemaVersion: 1, kind: 'client', surface: 'supercharts', lifecycle: 'current', privacy: 'shape', properties: { interval: id(16), dataStatus: id(24) }, note: 'No symbol: a ticker somebody looks at is a position they may hold.' },
  { name: 'superchart_study_toggled', schemaVersion: 1, kind: 'client', surface: 'supercharts', lifecycle: 'current', privacy: 'product_area', properties: { studyId: id(48), on: bool }, meaningful: true, continuation: 'internal' },
  { name: 'superchart_drawing_created', schemaVersion: 1, kind: 'client', surface: 'supercharts', lifecycle: 'current', privacy: 'product_area', properties: { tool: id(32) }, meaningful: true, continuation: 'internal' },
  { name: 'superchart_layout_saved', schemaVersion: 1, kind: 'client', surface: 'supercharts', lifecycle: 'current', privacy: 'shape', properties: { destination: oneOf('browser', 'account') }, meaningful: true, continuation: 'internal' },
  { name: 'superchart_voyager_asked', schemaVersion: 1, kind: 'client', surface: 'supercharts', lifecycle: 'current', privacy: 'shape', properties: { mode: id(24), contextKb: smallCount, chipsRemoved: smallCount } },
  { name: 'superchart_plan_proposed', schemaVersion: 1, kind: 'client', surface: 'supercharts', lifecycle: 'current', privacy: 'shape', properties: { steps: smallCount, refusals: smallCount } },
  { name: 'superchart_plan_applied', schemaVersion: 1, kind: 'client', surface: 'supercharts', lifecycle: 'current', privacy: 'shape', properties: { steps: smallCount, ofSteps: smallCount }, meaningful: true, continuation: 'internal' },
  { name: 'superchart_undo', schemaVersion: 1, kind: 'client', surface: 'supercharts', lifecycle: 'current', privacy: 'shape', properties: { source: oneOf('keyboard', 'button', 'toast') } },
  { name: 'superchart_script_generated', schemaVersion: 1, kind: 'client', surface: 'supercharts', lifecycle: 'current', privacy: 'shape', properties: { studies: smallCount }, meaningful: true, continuation: 'internal' },
  { name: 'superchart_script_exported', schemaVersion: 1, kind: 'client', surface: 'supercharts', lifecycle: 'current', privacy: 'shape', properties: {}, note: 'Generated and exported, never "run" or "backtested" — the product does neither.' },
  { name: 'superchart_preview_run', schemaVersion: 1, kind: 'client', surface: 'supercharts', lifecycle: 'current', privacy: 'shape', properties: { outcome: oneOf('ok', 'failed', 'unavailable'), plots: smallCount } },

  /* -------------------------------------------------------------- Voyager */
  { name: 'voyager_opened', schemaVersion: 1, kind: 'client', surface: 'voyager', lifecycle: 'current', privacy: 'product_area', properties: { source: id(32), hasQuestion: bool } },
  { name: 'voyager_question_sent', schemaVersion: 1, kind: 'client', surface: 'voyager', lifecycle: 'current', privacy: 'shape', properties: { contextKind: id(24), mode: id(24), turns: smallCount }, meaningful: true, continuation: 'internal' },
  { name: 'voyager_tool_executed', schemaVersion: 1, kind: 'client', surface: 'voyager', lifecycle: 'current', privacy: 'shape', properties: { tool: id(48) }, note: 'A tool round is not a question. The quota charges once per intentional question, and this must never be counted as one.' },
  { name: 'voyager_limit_hit', schemaVersion: 1, kind: 'client', surface: 'voyager', lifecycle: 'current', privacy: 'shape', properties: { authenticated: bool } },
  { name: 'voyager_auth_gate_shown', schemaVersion: 1, kind: 'client', surface: 'voyager', lifecycle: 'current', privacy: 'shape', properties: { askedInDialog: smallCount } },
  { name: 'voyager_restored_after_auth', schemaVersion: 1, kind: 'client', surface: 'voyager', lifecycle: 'current', privacy: 'shape', properties: { turns: smallCount } },
  { name: 'voyager_action_clicked', schemaVersion: 1, kind: 'client', surface: 'voyager', lifecycle: 'current', privacy: 'product_area', properties: { action: id(48), authenticated: bool }, note: 'The press, not the outcome. A click is never counted as a completed action.' },
  { name: 'voyager_action_confirmed', schemaVersion: 1, kind: 'client', surface: 'voyager', lifecycle: 'current', privacy: 'product_area', properties: { action: id(48), execution: oneOf('mutate', 'prepare') }, meaningful: true, continuation: 'internal', note: 'A prepare success is not a completed end action, and the execution kind is kept so the dashboard cannot blur them.' },
  { name: 'voyager_action_failed', schemaVersion: 1, kind: 'client', surface: 'voyager', lifecycle: 'current', privacy: 'shape', properties: { action: id(48), code: id(48) } },
  { name: 'voyager_save_clicked', schemaVersion: 1, kind: 'client', surface: 'voyager', lifecycle: 'current', privacy: 'shape', properties: { authenticated: bool } },
  { name: 'voyager_auth_required_for_save', schemaVersion: 1, kind: 'client', surface: 'voyager', lifecycle: 'current', privacy: 'shape', properties: {} },
  { name: 'voyager_chat_saved', schemaVersion: 1, kind: 'client', surface: 'voyager', lifecycle: 'current', privacy: 'shape', properties: {}, meaningful: true, continuation: 'internal' },
  { name: 'voyager_new_chat', schemaVersion: 1, kind: 'client', surface: 'voyager', lifecycle: 'current', privacy: 'shape', properties: { chatCount: smallCount } },
  { name: 'voyager_message_sent', schemaVersion: 1, kind: 'client', surface: 'experts', lifecycle: 'current', privacy: 'shape', properties: { turns: smallCount }, note: 'The expert-services intake, not the Voyager chat. Named before the two diverged.' },

  /* -------------------------------------------------------------- Experts */
  { name: 'expert_brief_saved', schemaVersion: 1, kind: 'client', surface: 'experts', lifecycle: 'current', privacy: 'product_area', properties: { services: id(96) }, meaningful: true, continuation: 'internal', note: 'Which services, never the brief. The brief is encrypted at rest and is not readable here by design.' },
  { name: 'expert_selected', schemaVersion: 1, kind: 'client', surface: 'experts', lifecycle: 'current', privacy: 'content_id', properties: { expertId: id(64), tier: id(24) }, meaningful: true, continuation: 'internal' },
] as const;

/* -------------------------------------------------------------- Lookups */

export const EVENT_BY_NAME: ReadonlyMap<string, EventDefinition> = new Map(
  EVENT_REGISTRY.map((definition) => [definition.name, definition])
);

export function isRegistered(name: string): boolean {
  return EVENT_BY_NAME.has(name);
}

/** The ingest allowlist. Derived, never written out a second time. */
export const INGEST_ALLOWLIST: readonly string[] = EVENT_REGISTRY.filter(
  (definition) => definition.lifecycle === 'current'
).map((definition) => definition.name);

export const LEGACY_EVENT_NAMES: readonly string[] = EVENT_REGISTRY.filter(
  (definition) => definition.lifecycle === 'legacy'
).map((definition) => definition.name);

export const MEANINGFUL_EVENT_NAMES: readonly string[] = EVENT_REGISTRY.filter(
  (definition) => definition.meaningful === true
).map((definition) => definition.name);
