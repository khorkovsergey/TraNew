import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

/**
 * Product Observatory verification.
 *
 * Two halves, because two different kinds of claim are being made.
 *
 * The **unit** half compiles the dependency-free telemetry modules with the
 * TypeScript compiler already in devDependencies and asserts the rules: what a
 * property may contain, what the queue drops, where a session ends, what a
 * metric returns when there is nothing to return. This is the repository's
 * existing convention — see `scripts/test-events.mjs` — and it adds no
 * dependency.
 *
 * The **live** half runs against a running app and the real database. It proves
 * the path that matters: a real `track()` call, through the real transport, to
 * the real route, past the real validator, into `product_telemetry_event`, and
 * back out through the real query. Anything less would be testing a drawing of
 * a pipeline.
 *
 *   node scripts/verify-admin-metrics.mjs            unit only — writes nothing
 *   node scripts/verify-admin-metrics.mjs --unit     the same, said explicitly
 *   node scripts/verify-admin-metrics.mjs --live     adds the real app and database
 *
 * ## Why the live half is opt-in
 *
 * Every worktree in this project shares one database, and it is the production
 * one. So the live half is **not** the default: running the verification the
 * obvious way must never mutate production telemetry, however carefully it
 * cleans up afterwards. A cleanup in `finally` protects against a failing
 * assertion; it does not protect against somebody running a command they
 * thought was read-only.
 *
 * With `--live`, the rows go under a single fixed sentinel session —
 * `s_deadbeef…` — and exactly that session is deleted at the end, whatever
 * happened in between. Nothing else is touched, and a real session id is 32
 * random hex characters, so the sentinel cannot collide with one. The mode
 * announces itself before it writes anything.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3414';
const LIVE = process.argv.includes('--live');
const SENTINEL_SESSION = `s_${'deadbeef'.repeat(4)}`;

/** Kept in step with QUEUE_LIMITS.flushIntervalMs, which the browser test waits out. */
const QUEUE_INTERVAL_MS = 10_000;

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  try {
    const result = fn();
    if (result === false) throw new Error('returned false');
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL ${name}`);
    console.log(`       ${String(error.message ?? error).split('\n')[0]}`);
  }
}

async function checkAsync(name, fn) {
  try {
    const result = await fn();
    if (result === false) throw new Error('returned false');
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL ${name}`);
    console.log(`       ${String(error.message ?? error).split('\n')[0]}`);
  }
}

function group(title) {
  console.log(`\n${title}`);
}

const out = mkdtempSync(join(tmpdir(), 'tn-metrics-'));

process.on('uncaughtException', (error) => {
  console.error('\nThe verification build failed:\n', error);
  rmSync(out, { recursive: true, force: true });
  process.exit(1);
});

/* ------------------------------------------------------------------ Build */

/**
 * The dependency-free modules, compiled and loaded.
 *
 * A project tsconfig is written into the temp directory rather than passing
 * flags, for one reason: these modules use the `@/…` path alias across
 * directories, as the rest of the codebase does, and `tsc` has no CLI flag for
 * `paths`. Rewriting the sources to relative imports to suit the harness would
 * be the test dictating the shape of the code.
 */
const PURE_MODULES = [
  'analytics/states',
  'analytics/registry',
  'analytics/validate',
  'analytics/identity',
  'analytics/surfaces',
  'analytics/queue',
  'admin-metrics/eligibility',
  'admin-metrics/meaningful',
  'admin-metrics/sessions',
  'admin-metrics/retention',
  'admin-metrics/journeys',
  'admin-metrics/dictionary',
  'admin-metrics/range',
];

const repo = process.cwd();
const harnessConfig = join(out, 'tsconfig.harness.json');

writeFileSync(
  harnessConfig,
  JSON.stringify({
    compilerOptions: {
      target: 'es2022',
      module: 'esnext',
      moduleResolution: 'bundler',
      /*
       * The project's tsconfig is `strict`, and without it a discriminated
       * union does not narrow — `validate.ts` once compiled clean under the
       * real build and failed under this one, which would have meant the
       * harness was checking a different language from the one that ships.
       */
      strict: true,
      skipLibCheck: true,
      outDir: out,
      rootDir: join(repo, 'src/lib'),
      baseUrl: repo,
      paths: { '@/*': ['src/*'] },
    },
    files: PURE_MODULES.map((name) => join(repo, 'src/lib', `${name}.ts`)),
  })
);

execFileSync('npx', ['tsc', '-p', harnessConfig], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

/*
 * `tsc` emits import specifiers exactly as they were written — it resolves
 * `@/…` and extensionless relative paths, and rewrites neither. The Node ESM
 * loader accepts neither. So the emitted tree is made loadable: a
 * `package.json` to declare it as ESM, `@/lib/x` turned into a real relative
 * path, and `.js` appended. `test-events.mjs` never needed this because the
 * modules it compiles are leaves in one directory.
 */
writeFileSync(join(out, 'package.json'), '{"type":"module"}');

function emitted(dir = out, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? emitted(join(dir, entry.name), `${prefix}${entry.name}/`)
      : entry.name.endsWith('.js')
        ? [`${prefix}${entry.name}`]
        : []
  );
}

for (const relative of emitted()) {
  const path = join(out, relative);
  const depth = relative.split('/').length - 1;
  const upToRoot = depth === 0 ? './' : '../'.repeat(depth);

  const source = readFileSync(path, 'utf8')
    .replace(/from '@\/lib\/([^']+)'/g, (_match, rest) => `from '${upToRoot}${rest}.js'`)
    .replace(/from '(\.\.?\/[^']+)'/g, (match, specifier) =>
      specifier.endsWith('.js') ? match : `from '${specifier}.js'`
    );

  writeFileSync(path, source);
}

const load = (name) => import(pathToFileURL(join(out, `${name}.js`)).href);

const states = await load('analytics/states');
const registry = await load('analytics/registry');
const validate = await load('analytics/validate');
const identity = await load('analytics/identity');
const surfaces = await load('analytics/surfaces');
const queue = await load('analytics/queue');
const eligibility = await load('admin-metrics/eligibility');
const meaningful = await load('admin-metrics/meaningful');
const sessionsLib = await load('admin-metrics/sessions');
const retentionLib = await load('admin-metrics/retention');
const journeysLib = await load('admin-metrics/journeys');
const dictionary = await load('admin-metrics/dictionary');

const NOW = new Date('2026-08-10T12:00:00.000Z');
const at = { source: 'test', metricId: 'test', queriedAt: NOW.toISOString() };

try {
  /* ------------------------------------------------------- Privacy by type */

  group('Privacy is a property of the type, not of the review');

  check('no property spec kind admits free text', () => {
    /*
     * The structural claim the whole privacy story rests on. Every declared
     * property is an enum, a bounded token, a bounded integer or a boolean —
     * there is no way to say "a string" — so there is no way to declare a field
     * that could hold a question, an answer or a search query.
     */
    const kinds = new Set();
    for (const definition of registry.EVENT_REGISTRY) {
      for (const spec of Object.values(definition.properties)) kinds.add(spec.kind);
    }
    assert.deepEqual([...kinds].sort(), ['boolean', 'enum', 'integer', 'token']);
  });

  check('the registry declares no forbidden property name', () => {
    const problems = validate.auditRegistry(registry.EVENT_REGISTRY);
    assert.deepEqual(problems, [], JSON.stringify(problems));
  });

  check('a token rejects prose', () => {
    const spec = { kind: 'token', maxLength: 64 };
    assert.equal(validate.checkProperty(spec, 'symbol_open'), null);
    assert.notEqual(validate.checkProperty(spec, 'how do I retire at 50'), null);
    assert.notEqual(validate.checkProperty(spec, 'a b'), null);
  });

  check('a token is bounded', () => {
    assert.notEqual(validate.checkProperty({ kind: 'token', maxLength: 8 }, 'x'.repeat(9)), null);
  });

  for (const forbidden of ['email', 'prompt', 'question', 'answer', 'note', 'brief', 'holdings', 'ip', 'userAgent', 'ticker']) {
    check(`a schema declaring "${forbidden}" would be caught`, () => {
      const problems = validate.auditRegistry([
        { name: 'made_up', schemaVersion: 1, kind: 'client', surface: 'portal', lifecycle: 'current', privacy: 'shape', properties: { [forbidden]: { kind: 'token', maxLength: 64 } } },
      ]);
      assert.equal(problems.length, 1, `${forbidden} was allowed through`);
    });
  }

  /* ------------------------------------------------------------ Validation */

  group('Ingest validation is an allowlist, not a cleanup');

  check('an unknown event is rejected', () => {
    const result = validate.validateEvent({ name: 'not_a_real_event', occurredAt: NOW.toISOString(), properties: {} }, NOW);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unknown_event');
  });

  check('an unknown property is rejected, not dropped', () => {
    const result = validate.validateEvent(
      { name: 'voyager_opened', occurredAt: NOW.toISOString(), properties: { source: 'home', hasQuestion: true, questionText: 'should I sell' } },
      NOW
    );
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unknown_property');
  });

  check('a legacy event is refused and named as legacy', () => {
    const result = validate.validateEvent({ name: 'plan_generated', occurredAt: NOW.toISOString(), properties: { steps: 3, risk: 'low' } }, NOW);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'legacy_event');
  });

  check('a server event cannot be posted by a browser', () => {
    const result = validate.validateEvent({ name: 'telemetry_ingest_rejected', occurredAt: NOW.toISOString(), properties: { reason: 'malformed', eventName: 'x' } }, NOW);
    assert.equal(result.ok, false);
  });

  check('a good event passes with its declared shape', () => {
    const result = validate.validateEvent(
      { name: 'voyager_opened', occurredAt: NOW.toISOString(), properties: { source: 'home', hasQuestion: true } },
      NOW
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.properties, { source: 'home', hasQuestion: true });
  });

  check('a missing declared property is rejected', () => {
    const result = validate.validateEvent({ name: 'voyager_opened', occurredAt: NOW.toISOString(), properties: { source: 'home' } }, NOW);
    assert.equal(result.ok, false);
  });

  check('a future timestamp beyond the skew window is rejected', () => {
    const future = new Date(NOW.getTime() + 10 * 60_000).toISOString();
    const result = validate.validateEvent({ name: 'next_step_opened', occurredAt: future, properties: {} }, NOW);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'bad_timestamp');
  });

  check('an oversized batch is rejected whole', () => {
    const events = Array.from({ length: validate.LIMITS.maxBatch + 1 }, () => ({ name: 'next_step_opened', occurredAt: NOW.toISOString(), properties: {} }));
    const result = validate.validateBatch(events, NOW);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'batch_too_large');
  });

  check('one bad event does not discard the batch', () => {
    const result = validate.validateBatch(
      [
        { name: 'next_step_opened', occurredAt: NOW.toISOString(), properties: {} },
        { name: 'nonsense', occurredAt: NOW.toISOString(), properties: {} },
        { name: 'next_step_restarted', occurredAt: NOW.toISOString(), properties: {} },
      ],
      NOW
    );
    assert.equal(result.accepted.length, 2);
    assert.equal(result.rejected.length, 1);
  });

  /* -------------------------------------------------- Server telemetry path */

  group('Server telemetry obeys the same contract as the browser');

  /*
   * The gap these close. `recordServerEvent` used to check that an event
   * existed and was of a server kind, then pass its properties through unread —
   * so a feature-local call site could have written a prompt, a message or a
   * provider's error body straight into the table. The registry's inability to
   * declare free text was no protection, because nothing was consulting the
   * registry on that path.
   *
   * `SERVER_KINDS` is the argument the server tracker passes, so these run the
   * same function, with the same argument, that persistence now depends on.
   */
  const asServer = (raw) => validate.validateEvent(raw, NOW, validate.SERVER_KINDS);
  const serverEvent = (properties) => ({
    name: 'telemetry_ingest_rejected',
    occurredAt: NOW.toISOString(),
    properties,
  });

  check('a server event with an unknown property is refused', () => {
    const result = asServer(serverEvent({ reason: 'malformed', eventName: 'x', extra: 'y' }));
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unknown_property');
  });

  for (const [field, value] of [
    ['prompt', 'what should I do with my pension'],
    ['message', 'the user said they hold 400 shares'],
    ['answer', 'sell half'],
    ['note', 'private'],
    ['brief', 'retire early'],
    ['body', 'provider returned: {"error":"context: user asked about TSLA"}'],
  ]) {
    check(`a server event carrying "${field}" never reaches persistence`, () => {
      const result = asServer(serverEvent({ reason: 'malformed', eventName: 'x', [field]: value }));
      assert.equal(result.ok, false, `${field} was accepted`);
      assert.equal(result.reason, 'unknown_property');
    });
  }

  check('a raw provider error body cannot be squeezed into a declared token', () => {
    // The realistic mistake: reusing a declared field to carry an error string.
    const result = asServer(
      serverEvent({ reason: 'malformed', eventName: 'upstream said: user asked about TSLA' })
    );
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'bad_property_value');
  });

  check('a server event with a wrong property type is refused', () => {
    const result = asServer(serverEvent({ reason: 42, eventName: 'x' }));
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'bad_property_value');
  });

  check('a server event outside its declared enum is refused', () => {
    const result = asServer(serverEvent({ reason: 'because_i_said_so', eventName: 'x' }));
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'bad_property_value');
  });

  check('a correctly shaped server event is accepted with exactly its properties', () => {
    const result = asServer(serverEvent({ reason: 'unknown_event', eventName: 'made_up' }));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(result.properties, { reason: 'unknown_event', eventName: 'made_up' });
    assert.equal(result.definition.kind, 'operational');
  });

  check('an unknown server event is dropped', () => {
    const result = asServer({ name: 'no_such_server_event', occurredAt: NOW.toISOString(), properties: {} });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unknown_event');
  });

  check('a client event cannot be injected through the server tracker', () => {
    const result = asServer({
      name: 'voyager_opened',
      occurredAt: NOW.toISOString(),
      properties: { source: 'home', hasQuestion: true },
    });
    assert.equal(result.ok, false, 'a client event was writable from the server');
    assert.equal(result.reason, 'unknown_event');
  });

  check('a server event cannot be posted by a browser either', () => {
    // The same boundary from the other side, so neither direction is one-way.
    const result = validate.validateEvent(serverEvent({ reason: 'malformed', eventName: 'x' }), NOW);
    assert.equal(result.ok, false);
  });

  check('validation never throws, whatever it is handed', () => {
    /*
     * The property that keeps analytics from failing the thing it measures. The
     * tracker wraps this in a try, but a validator that throws on odd input
     * would still be a validator nobody could call from a hot path with
     * confidence.
     */
    for (const nonsense of [null, undefined, 42, 'string', [], { name: 42 }, { name: 'x', properties: [] }, { name: 'telemetry_ingest_rejected', properties: null }]) {
      assert.doesNotThrow(() => asServer(nonsense), `threw on ${JSON.stringify(nonsense)}`);
    }
  });

  group('Persistence itself refuses an undeclared row');

  check('a hand-assembled row with an undeclared property does not conform', () => {
    /*
     * The last line, checked at the point of writing rather than at either
     * entry point — so a call site added later, by somebody who never heard of
     * the validator, still cannot put an undeclared field in the table.
     */
    assert.equal(
      validate.conformsToRegistry('telemetry_ingest_rejected', { reason: 'malformed', eventName: 'x' }),
      true
    );
    assert.equal(
      validate.conformsToRegistry('telemetry_ingest_rejected', { reason: 'malformed', eventName: 'x', prompt: 'private' }),
      false
    );
    assert.equal(validate.conformsToRegistry('not_an_event', {}), false);
    assert.equal(validate.conformsToRegistry('telemetry_ingest_rejected', { reason: 'nope', eventName: 'x' }), false);
  });

  check('persistence consults the registry rather than trusting its caller', () => {
    // A source assertion, kept to one line: the defence above is only a defence
    // while `persistEvents` actually calls it.
    const source = readFileSync('src/lib/analytics/server.ts', 'utf8');
    assert.match(source, /conformsToRegistry/, 'persistEvents no longer checks rows against the registry');
    assert.match(source, /validateEvent\(/, 'recordServerEvent no longer validates through the shared validator');
  });

  /* -------------------------------------------------------------- Identity */

  group('Identity is session-scoped, and says so');

  check('a session continues inside the idle window', () => {
    const previous = { id: 's_1', startedAt: 0, lastSeenAt: 0 };
    const { started } = identity.advanceSession(previous, identity.SESSION_IDLE_MS - 1, () => 's_2');
    assert.equal(started, false);
  });

  check('a session ends after the idle window', () => {
    const previous = { id: 's_1', startedAt: 0, lastSeenAt: 0 };
    const { started, session } = identity.advanceSession(previous, identity.SESSION_IDLE_MS, () => 's_2');
    assert.equal(started, true);
    assert.equal(session.id, 's_2');
  });

  check('a session is cut at the maximum length even while active', () => {
    const previous = { id: 's_1', startedAt: 0, lastSeenAt: identity.SESSION_MAX_MS };
    const { started } = identity.advanceSession(previous, identity.SESSION_MAX_MS, () => 's_2');
    assert.equal(started, true);
  });

  check('a referrer is reduced to a bucket, never kept', () => {
    assert.equal(identity.bucketAcquisition(null, 'tradingnew.space'), 'direct');
    assert.equal(identity.bucketAcquisition('www.google.com', 'tradingnew.space'), 'organic');
    assert.equal(identity.bucketAcquisition('chatgpt.com', 'tradingnew.space'), 'ai');
    assert.equal(identity.bucketAcquisition('tradingnew.space', 'tradingnew.space'), 'internal');
    assert.equal(identity.bucketAcquisition('example.org', 'tradingnew.space'), 'referral');
  });

  check('device class comes from the viewport, not the user agent', () => {
    assert.equal(identity.deviceClass(390), 'mobile');
    assert.equal(identity.deviceClass(820), 'tablet');
    assert.equal(identity.deviceClass(1440), 'desktop');
    assert.equal(identity.deviceClass(0), 'unknown');
  });

  check('automated traffic is excluded', () => {
    assert.equal(identity.looksAutomated('Mozilla/5.0 ... Googlebot/2.1'), true);
    assert.equal(identity.looksAutomated(null), true);
    assert.equal(identity.looksAutomated('Mozilla/5.0 (Macintosh) Safari/605'), false);
  });

  check('a raw application id is not a valid analytics key', () => {
    assert.equal(identity.isPseudonymousUserKey('usr_01J2X'), false);
    assert.equal(identity.isPseudonymousUserKey(`u_${'a'.repeat(32)}`), true);
  });

  /* -------------------------------------------------------------- Surfaces */

  group('A route template is not a URL');

  check('a populated path loses its contents', () => {
    assert.equal(surfaces.routeTemplateFor('/en/symbols/TSLA'), '/symbols/[ticker]');
    assert.equal(surfaces.routeTemplateFor('/en/markets/us-stocks/news'), '/markets/[market]/news');
    assert.equal(surfaces.routeTemplateFor('/en'), '/');
  });

  check('an unrecognised path becomes unknown rather than passing through', () => {
    assert.equal(surfaces.routeTemplateFor('/en/whatever/9f3a-secret'), 'unknown');
  });

  check('a flagged-off surface is disabled, not empty', () => {
    const off = { superchartEnabled: false, wealthHubEnabled: true, alertsEnabled: false };
    assert.equal(surfaces.featureStateFor('supercharts', off), 'disabled');
    assert.equal(surfaces.featureStateFor('supercharts', { ...off, superchartEnabled: true }), 'live');
  });

  check('a disabled surface leaves the measurable set', () => {
    const off = { superchartEnabled: false, wealthHubEnabled: true, alertsEnabled: false };
    const keys = surfaces.measurableSurfaces(off).map((s) => s.key);
    assert.equal(keys.includes('supercharts'), false);
    assert.equal(keys.includes('markets'), true);
  });

  check('the dashboard itself is never in a denominator', () => {
    const flags = { superchartEnabled: true, wealthHubEnabled: true, alertsEnabled: true };
    assert.equal(surfaces.measurableSurfaces(flags).some((s) => s.key === 'observatory'), false);
  });

  /* ----------------------------------------------------------------- Queue */

  group('The queue is bounded in every direction');

  check('a full queue drops the oldest, not the newest', () => {
    const q = new queue.TelemetryQueue({ ...queue.QUEUE_LIMITS, maxQueued: 3 });
    for (let i = 0; i < 5; i += 1) q.add({ name: `e${i}`, occurredAt: '', properties: {} });
    assert.equal(q.size, 3);
    assert.equal(q.dropped, 2);
  });

  check('a page hide flushes a part-filled batch', () => {
    const q = new queue.TelemetryQueue();
    q.add({ name: 'e', occurredAt: '', properties: {} });
    assert.equal(q.shouldFlush(0, false), false);
    assert.equal(q.shouldFlush(0, true), true);
  });

  check('a queued event is due before the interval elapses again', () => {
    /*
     * The regression this guards. The transport armed a short fixed timer and
     * re-asked `shouldFlush` when it fired; the interval had not elapsed, so the
     * answer was no, the timer had already cleared itself, and the event sat in
     * the queue until something else was enqueued. A page that emitted a session
     * start and a page view sent one and kept the other.
     */
    const q = new queue.TelemetryQueue();
    const start = Date.now();
    q.add({ name: 'e', occurredAt: '', properties: {} });

    const wait = q.msUntilDue(start);
    assert.ok(wait > 0, 'a fresh queue claimed to be due immediately');
    assert.ok(wait <= queue.QUEUE_LIMITS.flushIntervalMs);
    assert.equal(q.shouldFlush(start + wait), true, 'the queue was not due when its own timer said it would be');
  });

  check('the first event of a page is not flushed alone', () => {
    // `lastFlushAt` used to start at zero, so the very first event was always
    // already past the interval and went out as a batch of one.
    const q = new queue.TelemetryQueue();
    q.add({ name: 'e', occurredAt: '', properties: {} });
    assert.equal(q.shouldFlush(Date.now()), false);
  });

  check('retries are bounded and then the batch is abandoned', () => {
    const q = new queue.TelemetryQueue();
    const batch = [{ name: 'e', occurredAt: '', properties: {} }];
    assert.equal(q.requeue(batch), true);
    assert.equal(q.requeue(batch), true);
    assert.equal(q.requeue(batch), false);
  });

  /* ---------------------------------------------------------------- States */

  group('A missing number is never a zero');

  check('a zero denominator is insufficient sample, not 0%', () => {
    const metric = states.rate(0, 0, at, { threshold: 200 });
    assert.equal(metric.state, 'insufficient_sample');
    assert.equal('value' in metric, false);
  });

  check('a sample under the threshold withholds the rate', () => {
    const metric = states.rate(5, 10, at, { threshold: 200 });
    assert.equal(metric.state, 'insufficient_sample');
    assert.equal(metric.sample, 10);
  });

  check('a missing source carries what is missing', () => {
    const metric = states.sourceNotConnected('payment provider', at);
    assert.equal(states.isNumeric(metric), false);
    assert.match(states.explain(metric), /payment provider/);
  });

  check('a not-measurable metric says what would be required', () => {
    const metric = states.notMeasurable('no cross-session anonymous identity', 'a consent surface', at);
    assert.equal(metric.wouldRequire, 'a consent surface');
  });

  check('a stale value stops being a value', () => {
    const fresh = states.count(10, at, 'live');
    const old = new Date(NOW.getTime() - 60 * 60 * 1000);
    const metric = states.withFreshness(fresh, old, 900, NOW);
    assert.equal(metric.state, 'stale');
    assert.equal('value' in metric, false);
  });

  check('every state has an explanation except the numeric ones', () => {
    for (const state of states.METRIC_STATES) {
      const numeric = states.NUMERIC_STATES.includes(state);
      const sample = numeric
        ? states.count(1, at, state)
        : { state, sample: 0, threshold: 1, missingSource: 'x', feature: 'x', destination: 'x', retiredWhat: 'x', freshestAt: 'x', budgetSeconds: 1, reason: 'x', wouldRequire: 'x', ...at };
      assert.equal(states.explain(sample) === '', numeric, state);
    }
  });

  /* -------------------------------------------------------------- Registry */

  group('One registry, and it matches the product union');

  check('every declared product event appears in the registry', () => {
    const union = readFileSync('src/lib/events/analytics.ts', 'utf8');
    const declared = [...union.matchAll(/\| \{ name: '([a-z_]+)'/g)].map((m) => m[1]);
    const missing = declared.filter((name) => !registry.isRegistered(name));
    assert.deepEqual(missing, [], `not in the registry: ${missing.join(', ')}`);
  });

  check('intent_selected is current Home telemetry, not legacy', () => {
    /*
     * Both v2 briefs filed this under the retired plan funnel. It is emitted by
     * components/home/IntentCards.tsx today, and classifying it as legacy would
     * have deleted the only continuation signal Home has.
     */
    assert.equal(registry.EVENT_BY_NAME.get('intent_selected').lifecycle, 'current');
    assert.equal(registry.EVENT_BY_NAME.get('intent_selected').surface, 'home');
  });

  check('the seven retired plan events are marked legacy', () => {
    const expected = ['diagnostic_completed', 'plan_generated', 'plan_step_started', 'plan_step_completed', 'save_prompt_viewed', 'registration_completed_from_plan', 'plan_resumed'];
    assert.deepEqual([...registry.LEGACY_EVENT_NAMES].sort(), [...expected].sort());
  });

  check('no legacy event is in the ingest allowlist', () => {
    const leaked = registry.LEGACY_EVENT_NAMES.filter((n) => registry.INGEST_ALLOWLIST.includes(n));
    assert.deepEqual(leaked, []);
  });

  check('a page view is never a meaningful action', () => {
    assert.equal(registry.MEANINGFUL_EVENT_NAMES.includes('portal_page_viewed'), false);
    assert.equal(registry.MEANINGFUL_EVENT_NAMES.includes('voyager_action_clicked'), false);
    assert.equal(registry.MEANINGFUL_EVENT_NAMES.includes('voyager_action_confirmed'), true);
  });

  check('a failed action is not a meaningful action', () => {
    assert.equal(registry.MEANINGFUL_EVENT_NAMES.includes('voyager_action_failed'), false);
  });

  /* ================================================== Phase 2 — the metrics */

  /*
   * Fixtures rather than live data. A metric formula that is only ever checked
   * against whatever happened to be in the database is not checked at all: the
   * interesting cases — a bounce, a duplicate, a clock that went backwards, a
   * cohort too young to have returned — are exactly the ones production has not
   * produced yet.
   */
  const T0 = Date.parse('2026-08-10T10:00:00.000Z');
  const FLAGS = { superchartEnabled: true, wealthHubEnabled: true, alertsEnabled: false };
  const lookup = (key) => {
    const definition = surfaces.SURFACE_BY_KEY.get(key);
    if (!definition) return null;
    return {
      pmcrEligible: definition.pmcrEligible,
      featureState: surfaces.featureStateFor(key, FLAGS),
    };
  };

  const point = (sessionId, eventName, seconds, extra = {}) => ({
    sessionId,
    eventName,
    occurredAt: T0 + seconds * 1000,
    surface: extra.surface ?? 'home',
    routeTemplate: extra.route ?? '/',
    featureState: 'live',
    authState: extra.authState ?? 'anonymous',
    userKeyHash: extra.userKeyHash ?? null,
    acquisitionSource: extra.acquisition ?? 'direct',
    deviceClass: extra.device ?? 'desktop',
    entitlement: extra.entitlement ?? null,
    properties: extra.properties ?? {},
  });

  /** A landed, engaged session on `area`, plus whatever else is passed. */
  const session = (id, area = 'home', rest = [], options = {}) => [
    point(id, 'portal_session_started', 0, { surface: 'portal', ...options }),
    point(id, 'portal_page_viewed', 0, { surface: 'portal', properties: { route: '/', area }, ...options }),
    ...(options.bounced
      ? []
      : [point(id, 'portal_engagement_checkpoint', 3, { surface: 'portal', properties: { seconds: 3, area }, ...options })]),
    ...rest,
  ];

  const provenance = (metricId) => ({ metricId, source: 'test', queriedAt: NOW.toISOString() });
  const opts = { threshold: 1, state: 'live' };
  const factsOf = (points) => sessionsLib.sessionFactsFrom(points, lookup);

  const save = (id, seconds, eventId = 'e1') =>
    point(id, 'event_saved', seconds, {
      surface: 'events',
      properties: { eventId, saved: true },
    });

  const ask = (id, seconds, turns = 1) =>
    point(id, 'voyager_question_sent', seconds, {
      surface: 'voyager',
      properties: { contextKind: 'home', mode: 'chat', turns },
    });

  group('PMCR — the denominator is a population, not a row count');

  check('an engaged landing with an action continues', () => {
    const facts = factsOf(session('s1', 'home', [save('s1', 10)]));
    assert.equal(facts[0].excludedBecause, null);
    const result = sessionsLib.continuationRate(facts, provenance, opts);
    assert.equal(result.eligibleSessions, 1);
    assert.equal(result.overall.value, 1);
  });

  check('an engaged landing with no action is eligible and did not continue', () => {
    const result = sessionsLib.continuationRate(factsOf(session('s1')), provenance, opts);
    assert.equal(result.eligibleSessions, 1);
    assert.equal(result.overall.value, 0);
  });

  check('a bounce leaves the denominator rather than failing in it', () => {
    const facts = factsOf(session('s1', 'home', [], { bounced: true }));
    assert.equal(facts[0].excludedBecause, 'below_engagement_threshold');
    assert.equal(sessionsLib.continuationRate(facts, provenance, opts).eligibleSessions, 0);
  });

  check('a fast action beats the engagement timer and still counts', () => {
    // Acting is stronger evidence of engagement than a three-second timer, and
    // a session excluded for succeeding too quickly would be absurd.
    const facts = factsOf(session('s1', 'home', [save('s1', 1)], { bounced: true }));
    assert.equal(facts[0].excludedBecause, null);
  });

  check('the Observatory never enters a product denominator', () => {
    const facts = factsOf(session('s1', 'observatory', [save('s1', 10)]));
    assert.equal(facts[0].excludedBecause, 'observatory');
    assert.equal(sessionsLib.continuationRate(facts, provenance, opts).eligibleSessions, 0);
  });

  check('sign-in plumbing is not a landing', () => {
    assert.equal(factsOf(session('s1', 'auth'))[0].excludedBecause, 'auth_plumbing');
  });

  check('account housekeeping is not a landing', () => {
    assert.equal(factsOf(session('s1', 'account'))[0].excludedBecause, 'not_a_landing_surface');
  });

  check('a landing on an unrecognised surface is excluded, not guessed', () => {
    assert.equal(factsOf(session('s1', 'nonsense'))[0].excludedBecause, 'unknown_surface');
  });

  check('a landing on a flagged-off surface is excluded rather than counted as a failure', () => {
    const off = (key) => {
      const definition = surfaces.SURFACE_BY_KEY.get(key);
      if (!definition) return null;
      return {
        pmcrEligible: definition.pmcrEligible,
        featureState: surfaces.featureStateFor(key, { ...FLAGS, superchartEnabled: false }),
      };
    };
    const facts = sessionsLib.sessionFactsFrom(session('s1', 'supercharts'), off);
    assert.equal(facts[0].excludedBecause, 'surface_not_live');
  });

  check('telemetry with no page view is not a session anybody had', () => {
    assert.equal(factsOf([point('s1', 'portal_session_started', 0)])[0].excludedBecause, 'no_page_view');
  });

  check('automated traffic has a named exclusion and is dropped at ingest', () => {
    assert.equal(eligibility.EXCLUSION_REASONS.includes('automated'), true);
    assert.equal(identity.looksAutomated('Mozilla/5.0 compatible; Googlebot/2.1'), true);
  });

  check('external continuation is decomposed, never folded in', () => {
    const external = point('s2', 'event_external_link_clicked', 12, {
      surface: 'events',
      properties: { eventId: 'e1', domain: 'tradingview.com', trusted: true },
    });
    const facts = factsOf([...session('s1', 'home', [save('s1', 10)]), ...session('s2', 'events', [external])]);
    const result = sessionsLib.continuationRate(facts, provenance, opts);

    assert.equal(result.eligibleSessions, 2);
    assert.equal(result.overall.value, 1, 'both sessions continued');
    assert.equal(result.internal.value, 0.5);
    assert.equal(result.external.value, 0.5);
  });

  check('the decomposition shares the headline denominator', () => {
    const facts = factsOf(session('s1', 'home', [save('s1', 10)]));
    const result = sessionsLib.continuationRate(facts, provenance, opts);
    assert.equal(result.internal.sample, result.overall.sample);
    assert.equal(result.external.sample, result.overall.sample);
  });

  check('no eligible sessions is an insufficient sample, not 0%', () => {
    const result = sessionsLib.continuationRate([], provenance, { threshold: 200, state: 'live' });
    assert.equal(result.overall.state, 'insufficient_sample');
    assert.equal('value' in result.overall, false);
  });

  check('a page view is not continuation, however many there are', () => {
    const extraViews = [
      point('s1', 'portal_page_viewed', 5, { surface: 'portal', properties: { route: '/explore', area: 'explore' } }),
      point('s1', 'portal_navigation_completed', 5, { surface: 'portal', properties: { from: 'home', to: 'explore', hop: 1 } }),
    ];
    const result = sessionsLib.continuationRate(factsOf(session('s1', 'home', extraViews)), provenance, opts);
    assert.equal(result.overall.value, 0, 'navigation manufactured a continuation');
  });

  group('TTFA — measured only where there is something to measure');

  check('the median is the middle duration', () => {
    const points = [
      ...session('a', 'home', [save('a', 10)]),
      ...session('b', 'home', [save('b', 20)]),
      ...session('c', 'home', [save('c', 60)]),
    ];
    const result = sessionsLib.timeToFirstAction(factsOf(points), provenance, opts);
    assert.equal(result.median.value, 20);
    assert.equal(result.sample, 3);
  });

  check('p75 and p90 are nearest-rank, so every value is one somebody had', () => {
    const points = Array.from({ length: 10 }, (_, index) =>
      session(`s${index}`, 'home', [save(`s${index}`, (index + 1) * 10)])
    ).flat();
    const result = sessionsLib.timeToFirstAction(factsOf(points), provenance, opts);
    assert.equal(result.p75.value, 80);
    assert.equal(result.p90.value, 90);
  });

  check('a session with no action gets no TTFA and is counted separately', () => {
    const points = [...session('a', 'home', [save('a', 10)]), ...session('b')];
    const result = sessionsLib.timeToFirstAction(factsOf(points), provenance, opts);
    assert.equal(result.sample, 1, 'a session without an action contributed a duration');
    assert.equal(result.withoutAction.value, 1);
  });

  check('out-of-order arrival does not change the answer', () => {
    const forwards = session('s1', 'home', [save('s1', 30), ask('s1', 10)]);
    const backwards = [...forwards].reverse();
    const a = sessionsLib.timeToFirstAction(factsOf(forwards), provenance, opts);
    const b = sessionsLib.timeToFirstAction(factsOf(backwards), provenance, opts);
    assert.equal(a.median.value, 10);
    assert.equal(b.median.value, a.median.value);
  });

  check('a duplicate delivery does not move the first action', () => {
    const duplicated = session('s1', 'home', [save('s1', 30), save('s1', 10), save('s1', 10)]);
    const facts = factsOf(duplicated);
    assert.equal(facts[0].actions.length, 1, 'the same save counted more than once');
    assert.equal(facts[0].timeToFirstAction, 10_000);
  });

  check('a clock that went backwards cannot produce a negative duration', () => {
    const facts = factsOf([
      point('s1', 'portal_page_viewed', 30, { surface: 'portal', properties: { route: '/', area: 'home' } }),
      point('s1', 'portal_engagement_checkpoint', 33, { surface: 'portal', properties: { seconds: 3, area: 'home' } }),
      save('s1', 5),
    ]);
    assert.ok(facts[0].timeToFirstAction >= 0, 'a negative duration escaped');
    assert.equal(facts[0].timeToFirstAction, 0);
  });

  check('too few durations withholds the percentile', () => {
    const result = sessionsLib.timeToFirstAction(
      factsOf(session('a', 'home', [save('a', 10)])),
      provenance,
      { threshold: 200, state: 'live' }
    );
    assert.equal(result.median.state, 'insufficient_sample');
  });

  group('Second meaningful action');

  check('no actions is an empty denominator, not 0%', () => {
    const result = sessionsLib.secondActionRate(factsOf(session('s1')), provenance, { threshold: 1, state: 'live' });
    assert.equal(result.denominator, 0);
    assert.equal(result.rate.state, 'insufficient_sample');
  });

  check('one action is a denominator of one and a numerator of zero', () => {
    const result = sessionsLib.secondActionRate(factsOf(session('s1', 'home', [save('s1', 10)])), provenance, opts);
    assert.equal(result.denominator, 1);
    assert.equal(result.numerator, 0);
    assert.equal(result.rate.value, 0);
  });

  check('two distinct actions count as two', () => {
    const points = session('s1', 'home', [save('s1', 10), ask('s1', 20)]);
    const result = sessionsLib.secondActionRate(factsOf(points), provenance, opts);
    assert.equal(result.numerator, 1);
    assert.equal(result.rate.value, 1);
  });

  check('the same action twice is one action', () => {
    const points = session('s1', 'home', [save('s1', 10), save('s1', 20)]);
    assert.equal(factsOf(points)[0].actions.length, 1);
    assert.equal(sessionsLib.secondActionRate(factsOf(points), provenance, opts).numerator, 0);
  });

  check('saving two different events is two actions', () => {
    const points = session('s1', 'home', [save('s1', 10, 'e1'), save('s1', 20, 'e2')]);
    assert.equal(factsOf(points)[0].actions.length, 2);
  });

  check('a repeatable action is not deduplicated', () => {
    // Two Voyager questions are two questions, whatever their payload looks
    // like — shapes and counts cannot tell them apart, which is why the
    // registry marks the event repeatable rather than relying on properties.
    const points = session('s1', 'home', [ask('s1', 10), ask('s1', 20)]);
    assert.equal(factsOf(points)[0].actions.length, 2);
  });

  check('PMCR and the second-action rate share one taxonomy', () => {
    const points = session('s1', 'home', [save('s1', 10), ask('s1', 20)]);
    const facts = factsOf(points);
    const pmcr = sessionsLib.continuationRate(facts, provenance, opts);
    const second = sessionsLib.secondActionRate(facts, provenance, opts);
    assert.equal(pmcr.continuedSessions, second.denominator);
  });

  group('Retention — authenticated, cumulative windows, no invented history');

  const userDay = (userKeyHash, day, extra = {}) => ({
    userKeyHash,
    day,
    eligible: extra.eligible ?? true,
    meaningful: extra.meaningful ?? false,
  });

  const retentionOf = (rows, options = {}) =>
    retentionLib.cohortRetention(rows, {
      today: new Date(options.today ?? '2026-09-30T00:00:00.000Z'),
      telemetryStartedOn: options.telemetryStartedOn ?? '2026-08-01',
      minimumCohort: options.minimumCohort ?? 1,
      provenance,
      state: 'instrumented_going_forward',
    });

  check('a return the next day satisfies D1, D7 and D30', () => {
    const report = retentionOf([userDay('u_a', '2026-08-10'), userDay('u_a', '2026-08-11')]);
    for (const horizon of report.horizons) assert.equal(horizon.returned.value, 1, `D${horizon.horizon}`);
  });

  check('a return on day five satisfies D7 and D30 but not D1', () => {
    const report = retentionOf([userDay('u_a', '2026-08-10'), userDay('u_a', '2026-08-15')]);
    const byHorizon = Object.fromEntries(report.horizons.map((h) => [h.horizon, h.returned.value]));
    assert.equal(byHorizon[1], 0);
    assert.equal(byHorizon[7], 1);
    assert.equal(byHorizon[30], 1);
  });

  check('the window is inclusive at its edge and exclusive past it', () => {
    const onTheDay = retentionOf([userDay('u_a', '2026-08-10'), userDay('u_a', '2026-08-17')]);
    const dayAfter = retentionOf([userDay('u_b', '2026-08-10'), userDay('u_b', '2026-08-18')]);
    assert.equal(onTheDay.horizons.find((h) => h.horizon === 7).returned.value, 1, 'day 7 was excluded');
    assert.equal(dayAfter.horizons.find((h) => h.horizon === 7).returned.value, 0, 'day 8 was included');
  });

  check('the first day is not a return', () => {
    // Otherwise every cohort retains 100% by definition.
    const report = retentionOf([userDay('u_a', '2026-08-10')]);
    assert.equal(report.horizons[0].returned.value, 0);
  });

  check('the windows are cumulative, so D1 never exceeds D7', () => {
    const rows = [
      userDay('u_a', '2026-08-10'), userDay('u_a', '2026-08-11'),
      userDay('u_b', '2026-08-10'), userDay('u_b', '2026-08-16'),
      userDay('u_c', '2026-08-10'),
    ];
    const report = retentionOf(rows);
    const [d1, d7, d30] = report.horizons.map((h) => h.returned.value);
    assert.ok(d1 <= d7 && d7 <= d30, `${d1} ${d7} ${d30}`);
  });

  check('users are grouped by the pseudonymous key, never by anything else', () => {
    const report = retentionOf([
      userDay('u_a', '2026-08-10'), userDay('u_a', '2026-08-11'),
      userDay('u_b', '2026-08-10'),
    ]);
    assert.equal(report.totalAuthenticatedUsers, 2);
    assert.equal(report.horizons[0].returned.value, 0.5);
  });

  check('a cohort younger than the window is excluded, not counted as churn', () => {
    const report = retentionOf([userDay('u_a', '2026-09-29')], { today: '2026-09-30T00:00:00.000Z' });
    const d7 = report.horizons.find((h) => h.horizon === 7);
    assert.equal(d7.cohortSize, 0, 'an immature cohort was measured');
    assert.equal(d7.immatureUsers, 1);
    assert.equal(d7.returned.state, 'insufficient_sample');
  });

  check('a cohort formed before telemetry existed is not counted as churn', () => {
    const report = retentionOf([userDay('u_a', '2026-07-01')], { telemetryStartedOn: '2026-08-01' });
    assert.equal(report.horizons[0].cohortSize, 0, 'a pre-telemetry cohort was measured');
    assert.equal(report.horizons[0].immatureUsers, 1);
  });

  check('a cohort under the minimum withholds its rate', () => {
    const report = retentionOf([userDay('u_a', '2026-08-10'), userDay('u_a', '2026-08-11')], {
      minimumCohort: 50,
    });
    assert.equal(report.horizons[0].returned.state, 'insufficient_sample');
    assert.equal(report.horizons[0].returned.threshold, 50);
  });

  check('returning and doing something is reported apart from returning', () => {
    const report = retentionOf([
      userDay('u_a', '2026-08-10'),
      userDay('u_a', '2026-08-11', { meaningful: false }),
      userDay('u_b', '2026-08-10'),
      userDay('u_b', '2026-08-11', { meaningful: true }),
    ]);
    assert.equal(report.horizons[0].returned.value, 1);
    assert.equal(report.horizons[0].returnedMeaningfully.value, 0.5);
  });

  check('anonymous retention is not measurable and says what it would take', () => {
    const report = retentionOf([]);
    assert.equal(report.anonymous.state, 'not_measurable');
    assert.match(report.anonymous.wouldRequire, /consent/);
    assert.equal('value' in report.anonymous, false);
  });

  group('Journeys — aggregate only, and small groups withhold their rate');

  check('sessions are grouped by landing surface with their rate', () => {
    const points = [
      ...session('a', 'home', [save('a', 10)]),
      ...session('b', 'home'),
      ...session('c', 'explore', [save('c', 10)]),
    ];
    const report = journeysLib.journeyReport(factsOf(points), {}, 1);
    const home = report.byLandingSurface.find((row) => row.key === 'home');
    assert.equal(home.sessions, 2);
    assert.equal(home.continued, 1);
    assert.equal(home.rate, 0.5);
  });

  check('a group below the threshold reports its count and withholds its rate', () => {
    const report = journeysLib.journeyReport(factsOf(session('a', 'home', [save('a', 10)])), {}, 25);
    const home = report.byLandingSurface.find((row) => row.key === 'home');
    assert.equal(home.sessions, 1);
    assert.equal(home.rate, null, 'a rate over one session was published');
    assert.equal(home.suppressed, true);
  });

  check('the first action taken is aggregated, never listed per session', () => {
    const points = [...session('a', 'home', [save('a', 10)]), ...session('b', 'home', [ask('b', 10)])];
    const report = journeysLib.journeyReport(factsOf(points), {}, 1);
    assert.equal(report.firstAction.length, 2);
    const serialised = JSON.stringify(report);
    assert.equal(serialised.includes('"a"'), false, 'a session id reached the report');
    assert.equal(serialised.includes('sessionId'), false);
  });

  check('internal and external continuation are counted apart', () => {
    const external = point('b', 'event_external_link_clicked', 12, {
      surface: 'events',
      properties: { eventId: 'e1', domain: 'tradingview.com', trusted: true },
    });
    const points = [...session('a', 'home', [save('a', 10)]), ...session('b', 'events', [external]), ...session('c')];
    const report = journeysLib.journeyReport(factsOf(points), {}, 1);
    assert.deepEqual(report.internalVsExternal, { internalOnly: 1, externalOnly: 1, both: 0, neither: 1 });
  });

  check('exclusions are reported rather than silently shrinking the denominator', () => {
    const facts = factsOf([...session('a', 'home', [save('a', 10)]), ...session('b', 'observatory')]);
    const report = journeysLib.journeyReport(facts, sessionsLib.exclusionBreakdown(facts), 1);
    assert.equal(report.eligibleSessions, 1);
    assert.equal(report.exclusions.observatory, 1);
  });

  group('Navigation cannot manufacture continuation');

  check('a route transition, a page view and a feature event are one continuation', () => {
    /*
     * The concrete risk §13 names: one click produces a navigation event, a page
     * view and the feature's own event. Only the last is meaningful, so the
     * session continues exactly once however many signals the click emitted.
     */
    const click = [
      point('s1', 'portal_navigation_completed', 10, { surface: 'portal', properties: { from: 'home', to: 'events', hop: 1 } }),
      point('s1', 'portal_page_viewed', 10, { surface: 'portal', properties: { route: '/events', area: 'events' } }),
      save('s1', 10),
    ];
    const facts = factsOf(session('s1', 'home', click));
    assert.equal(facts[0].actions.length, 1, 'one click produced more than one action');
  });

  check('neither backbone navigation event is meaningful', () => {
    assert.equal(meaningful.isMeaningful('portal_navigation_completed'), false);
    assert.equal(meaningful.isMeaningful('portal_page_viewed'), false);
    assert.equal(meaningful.isMeaningful('portal_session_started'), false);
    assert.equal(meaningful.isMeaningful('portal_engagement_checkpoint'), false);
  });

  check('a full reload and a client transition are told apart by the client', () => {
    /*
     * A hard navigation never reaches the router hook — it re-runs the whole
     * instrumentation module, which emits its own session start and page view.
     * The hook is for client-side transitions and the source says so; making a
     * reload look like an SPA transition would invent a navigation the product
     * never performed.
     */
    const source = readFileSync('src/instrumentation-client.ts', 'utf8');
    assert.match(source, /export function onRouterTransitionStart\(url: string\)/);
    assert.match(source, /new URL\(url, location\.origin\)/, 'the hook still reads location instead of its argument');
    assert.match(source, /if \(route === lastRoute\) return;/, 'a repeated route can emit a second page view');
  });

  group('The dictionary is the definition, and the code is the same one');

  check('every Phase 2 metric has a dictionary entry', () => {
    for (const id of ['pmcr', 'pmcr_internal', 'pmcr_external', 'ttfa_median', 'second_action_rate', 'retention_d1', 'retention_d7', 'retention_d30', 'retention_anonymous']) {
      assert.ok(dictionary.DICTIONARY_BY_ID.get(id), `${id} has no definition`);
    }
  });

  check('a definition states its population, exclusions and limitations', () => {
    for (const entry of dictionary.METRIC_DICTIONARY) {
      assert.ok(entry.formula, `${entry.id} has no formula`);
      assert.ok(entry.eligiblePopulation, `${entry.id} has no population`);
      assert.ok(entry.limitations.length > 0, `${entry.id} claims no limitations`);
      assert.ok(entry.timeSemantics, `${entry.id} does not say which clock it trusts`);
    }
  });

  check('the dictionary quotes the threshold the code applies', () => {
    assert.match(
      dictionary.DICTIONARY_BY_ID.get('pmcr').eligiblePopulation,
      new RegExp(`${eligibility.ENGAGEMENT_THRESHOLD_SECONDS} seconds`)
    );
  });

  check('the meaningful taxonomy is derived, not written twice', () => {
    const declared = registry.EVENT_REGISTRY.filter((e) => e.meaningful && e.lifecycle === 'current').map((e) => e.name);
    assert.deepEqual([...meaningful.MEANINGFUL_EVENTS].sort(), declared.sort());
  });

  check('no legacy event can be meaningful', () => {
    for (const name of meaningful.MEANINGFUL_EVENTS) {
      assert.equal(registry.EVENT_BY_NAME.get(name).lifecycle, 'current', name);
    }
  });

  /* ------------------------------------ The checker cannot be self-defeated */

  group('The caller checker survives the registry that names every event');

  check('a registry-only event is still reported as an orphan', () => {
    /*
     * Proof point 14, and the reason `check-analytics.mjs` changed at all.
     * `plan_generated` appears as a string literal in registry.ts. If the
     * checker counted that as an emitter, this gate would be green and would
     * mean nothing ever again.
     */
    let output = '';
    try {
      output = execFileSync('node', ['scripts/check-analytics.mjs'], { encoding: 'utf8', shell: process.platform === 'win32' });
    } catch (error) {
      output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    }
    assert.match(output, /plan_generated/, 'the registry silently satisfied the caller check');
    assert.match(output, /inherited/, 'inherited orphans are not separated from new ones');
  });

  check('the checker skips the telemetry layer and nothing else', () => {
    const script = readFileSync('scripts/check-analytics.mjs', 'utf8');
    assert.match(script, /src[\\/]+lib[\\/]+analytics/);
  });

  /* ------------------------------------------------------------------ Live */

  if (!LIVE) {
    console.log('\nLive checks skipped.');
    console.log('  They exercise the real app and write to the configured database.');
    console.log('  Run them deliberately:  node scripts/verify-admin-metrics.mjs --live');
  } else {
    group(`Live — real transport, real route, real table (${BASE})`);

    /*
     * Said out loud before anything is written. DATABASE_URL in every worktree
     * of this project points at the production database, and somebody running
     * this should see that before the first insert rather than afterwards.
     */
    const host = (process.env.DATABASE_URL ?? '').replace(/^.*@/, '').replace(/[:/].*$/, '') || 'unset';
    console.log(`  NOTICE  this writes to the configured database (${host}).`);
    console.log(`          Rows go under session ${SENTINEL_SESSION} and that session is deleted at the end.`);

    const reachable = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) })
      .then((r) => r.ok)
      .catch(() => false);

    if (!reachable) {
      failed += 1;
      failures.push('the app is not running');
      console.log(`  FAIL the app is not running at ${BASE}`);
      console.log(`       start it with:  npm run dev -- -p 3414`);
    } else {
      const postBatch = (events, extra = {}) =>
        fetch(`${BASE}/api/admin-metrics/ingest`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 (Macintosh) Safari/605' },
          body: JSON.stringify({
            sessionId: SENTINEL_SESSION,
            device: 'desktop',
            acquisition: 'direct',
            route: '/voyager',
            events,
            ...extra,
          }),
        });

      await checkAsync('a valid event is accepted and stored', async () => {
        const response = await postBatch([
          { name: 'voyager_opened', occurredAt: new Date().toISOString(), properties: { source: 'verify', hasQuestion: false } },
        ]);
        const body = await response.json();
        assert.equal(response.status, 202);
        assert.equal(body.stored, 1, JSON.stringify(body));
      });

      await checkAsync('an unknown event is rejected by the live route', async () => {
        const response = await postBatch([{ name: 'totally_made_up', occurredAt: new Date().toISOString(), properties: {} }]);
        const body = await response.json();
        assert.equal(body.stored, 0);
        assert.equal(body.rejected, 1);
      });

      await checkAsync('an unknown property is rejected by the live route', async () => {
        const response = await postBatch([
          { name: 'voyager_opened', occurredAt: new Date().toISOString(), properties: { source: 'verify', hasQuestion: false, prompt: 'should I sell everything' } },
        ]);
        const body = await response.json();
        assert.equal(body.stored, 0);
        assert.equal(body.rejected, 1);
      });

      await checkAsync('an oversized batch is rejected by the live route', async () => {
        const events = Array.from({ length: 80 }, () => ({ name: 'next_step_opened', occurredAt: new Date().toISOString(), properties: {} }));
        const response = await postBatch(events);
        const body = await response.json();
        assert.equal(body.stored, 0);
      });

      await checkAsync('an oversized payload is refused before parsing', async () => {
        const response = await fetch(`${BASE}/api/admin-metrics/ingest`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId: SENTINEL_SESSION, events: [], padding: 'x'.repeat(40_000) }),
        });
        assert.equal(response.status, 413);
      });

      await checkAsync('server-owned fields cannot be spoofed', async () => {
        await postBatch(
          [{ name: 'next_step_opened', occurredAt: new Date().toISOString(), properties: {} }],
          { entitlement: 'ai_private', authState: 'registered', userKeyHash: `u_${'f'.repeat(32)}` }
        );

        const rows = await readSentinel();
        const forged = rows.filter((row) => row.entitlement !== null || row.auth_state !== 'anonymous' || row.user_key_hash !== null);
        assert.equal(forged.length, 0, `${forged.length} rows took the browser's word for identity`);
      });

      await checkAsync('the stored row carries server-derived truth', async () => {
        const rows = await readSentinel();
        const row = rows.find((candidate) => candidate.event_name === 'voyager_opened');
        assert.ok(row, 'no stored row found');
        assert.equal(row.auth_state, 'anonymous');
        assert.match(row.visitor_key_hash, /^v_[0-9a-f]{32}$/);
        assert.ok(row.received_at, 'received_at was not filled by the application default');
        assert.equal(row.surface, 'voyager');
      });

      await checkAsync('no stored property is outside its declared schema', async () => {
        const rows = await readSentinel();
        for (const row of rows) {
          const declared = registry.EVENT_BY_NAME.get(row.event_name);
          assert.ok(declared, `${row.event_name} is not registered`);
          for (const key of Object.keys(row.properties ?? {})) {
            assert.ok(declared.properties[key], `${row.event_name}.${key} was stored and is not declared`);
          }
        }
      });

      await checkAsync('a real server event is persisted through the real tracker', async () => {
        /*
         * The server path, end to end and not in a harness: rejecting a batch
         * makes the ingest route call `recordServerEvent`, which validates
         * against the registry and writes. The row proves the whole chain —
         * that the tracker persists at all, that it stores the operational
         * kind, and that what lands is exactly the declared property set.
         */
        await postBatch([{ name: 'definitely_not_registered', occurredAt: new Date().toISOString(), properties: {} }]);

        // The tracker is fire-and-forget, so the write trails the response.
        await new Promise((resolve) => setTimeout(resolve, 1_500));

        const rows = await readSentinel();
        const written = rows.find((row) => row.event_name === 'telemetry_ingest_rejected');

        assert.ok(written, 'the server tracker persisted nothing');
        assert.equal(written.event_kind, 'operational');
        assert.deepEqual(
          Object.keys(written.properties ?? {}).sort(),
          ['eventName', 'reason'],
          'the stored server event carried something undeclared'
        );
        assert.equal(written.properties.reason, 'unknown_event');
        assert.equal(written.user_key_hash, null);
      });

      await checkAsync('the metrics API refuses an unauthorized request', async () => {
        for (const path of ['/api/admin-metrics/overview', '/api/admin-metrics/coverage']) {
          const response = await fetch(`${BASE}${path}`);
          assert.equal(response.status, 401, `${path} answered ${response.status}`);
        }
      });

      await checkAsync('the page renders no data without authorization', async () => {
        const response = await fetch(`${BASE}/en/admin_admin_metrics`);
        const html = await response.text();
        assert.equal(response.status, 200);
        assert.equal(html.includes('Instrumentation coverage'), false, 'the shell leaked dashboard content');
        assert.match(html, /Not available/);
      });

      await checkAsync('the fragment secret mints a short-lived cookie', async () => {
        if (!process.env.METRICS_ACCESS_SECRET) {
          throw new Error('METRICS_ACCESS_SECRET is not set in this environment — cannot verify the demo path');
        }

        const wrong = await fetch(`${BASE}/api/admin-metrics/access`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ secret: 'not-the-secret' }),
        });
        assert.equal(wrong.status, 401);

        const right = await fetch(`${BASE}/api/admin-metrics/access`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ secret: process.env.METRICS_ACCESS_SECRET }),
        });
        assert.equal(right.status, 200);

        const cookie = right.headers.get('set-cookie') ?? '';
        assert.match(cookie, /tn_metrics_access=/);
        assert.match(cookie, /HttpOnly/i);
        assert.match(cookie, /SameSite=strict/i);
        assert.equal(cookie.includes(process.env.METRICS_ACCESS_SECRET), false, 'the raw secret was put in the cookie');

        const token = /tn_metrics_access=([^;]+)/.exec(cookie)[1];
        const authorized = await fetch(`${BASE}/api/admin-metrics/overview`, {
          headers: { cookie: `tn_metrics_access=${token}` },
        });
        assert.equal(authorized.status, 200);

        const body = await authorized.json();
        assert.equal(body.confirmedRevenue.state, 'source_not_connected', 'revenue was not reported as unconnected');
        assert.equal(body.anonymousReturn.state, 'not_measurable', 'anonymous retention was claimed');
        assert.equal('value' in body.confirmedRevenue, false, 'a missing source carried a number');
      });

      await checkAsync('coverage separates unexposed from unused', async () => {
        const token = await mintToken();
        const response = await fetch(`${BASE}/api/admin-metrics/coverage`, { headers: { cookie: `tn_metrics_access=${token}` } });
        const body = await response.json();
        assert.equal(response.status, 200);

        const superchart = body.rows.find((row) => row.event === 'superchart_opened');
        assert.ok(superchart);
        assert.equal(['observed', 'unexposed', 'unused', 'awaiting_first_event'].includes(superchart.status), true);

        const legacy = body.rows.find((row) => row.event === 'plan_generated');
        assert.equal(legacy.lifecycle, 'legacy');
        assert.equal(legacy.status, 'legacy_silent');
      });

      await checkAsync('every Phase 2 endpoint authorizes for itself', async () => {
        for (const endpoint of ['journeys', 'retention', 'dictionary']) {
          const response = await fetch(`${BASE}/api/admin-metrics/${endpoint}`);
          assert.equal(response.status, 401, `${endpoint} answered ${response.status} unauthenticated`);
        }
      });

      await checkAsync('journeys reports its exclusions rather than a shrunken rate', async () => {
        const token = await mintToken();
        const response = await fetch(`${BASE}/api/admin-metrics/journeys`, {
          headers: { cookie: `tn_metrics_access=${token}` },
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.ok(body.journeys, 'no journey report');
        assert.equal(typeof body.journeys.exclusions, 'object');
        assert.equal(body.truncated, false);

        // Aggregate only: nothing in the payload may name a session.
        const serialised = JSON.stringify(body);
        assert.equal(serialised.includes('sessionId'), false, 'a session id reached the journey payload');
        assert.equal(/s_[0-9a-f]{32}/.test(serialised), false, 'a session key reached the journey payload');
      });

      await checkAsync('retention refuses to invent history it does not have', async () => {
        const token = await mintToken();
        const response = await fetch(`${BASE}/api/admin-metrics/retention`, {
          headers: { cookie: `tn_metrics_access=${token}` },
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.anonymous.state, 'not_measurable');

        for (const horizon of body.horizons) {
          // Telemetry began days ago, so every cohort is either immature or
          // below the minimum. Neither may be reported as a percentage.
          assert.equal(
            ['insufficient_sample', 'instrumented_going_forward'].includes(horizon.returned.state),
            true,
            `D${horizon.horizon} claimed ${horizon.returned.state}`
          );
        }
      });

      await checkAsync('the dictionary is served rather than restated in the page', async () => {
        const token = await mintToken();
        const response = await fetch(`${BASE}/api/admin-metrics/dictionary`, {
          headers: { cookie: `tn_metrics_access=${token}` },
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.ok(body.metrics.length >= 9);
        assert.ok(body.metrics.every((entry) => entry.formula && entry.limitations.length));
      });

      await checkAsync('the route is absent from the sitemap', async () => {
        const response = await fetch(`${BASE}/sitemap.xml`);
        const xml = await response.text();
        assert.equal(xml.includes('admin_admin_metrics'), false);
      });

      await checkAsync('robots.txt does not advertise the route', async () => {
        const response = await fetch(`${BASE}/robots.txt`);
        const text = await response.text();
        assert.equal(text.includes('admin_admin_metrics'), false, 'a disallow line published the path');
      });

      /*
       * The one claim the HTTP tests above cannot make: that the *browser* half
       * works. Everything else posts to the route directly, which proves the
       * route and proves nothing about `setAnalyticsSink`, the queue, the page
       * hide flush, or whether `instrumentation-client.ts` runs at all.
       */
      let browserSession = null;

      await checkAsync('a real page load reaches ingest through the production sink', async () => {
        const { chromium } = await import('playwright');
        const browser = await chromium.launch();
        /*
         * A headless browser announces itself as `HeadlessChrome`, and the
         * ingest route drops automated traffic before it is stored — correctly,
         * and the bot filter has its own unit test above. What is under test
         * here is the transport, so the page presents an ordinary user agent.
         */
        const page = await browser.newPage({
          viewport: { width: 1440, height: 900 },
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
        });
        const posted = [];

        page.on('request', (request) => {
          if (request.url().includes('/api/admin-metrics/ingest')) {
            try {
              posted.push(JSON.parse(request.postData() ?? '{}'));
            } catch {
              posted.push({ unparseable: true });
            }
          }
        });

        try {
          await page.goto(`${BASE}/en`, { waitUntil: 'networkidle' });

          /*
           * Long enough for the batch interval to come due on its own. The
           * queue deliberately does not send the first event immediately — a
           * batch of one is the behaviour the seeded `lastFlushAt` removed — so
           * this waits for the timer the transport actually arms rather than
           * for a flush that a shorter wait used to get by accident.
           */
          await page.waitForTimeout(QUEUE_INTERVAL_MS + 2_000);

          // Then away, which fires a real `pagehide` and flushes whatever the
          // interval did not. A synthetic `visibilitychange` does not work here:
          // it leaves `document.visibilityState` as it was.
          await page.goto(`${BASE}/en/explore`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(2_000);

          assert.ok(posted.length > 0, 'the sink never posted — setAnalyticsSink is not wired');

          const envelope = posted[0];
          browserSession = envelope.sessionId;

          assert.match(envelope.sessionId, /^s_[0-9a-f]{32}$/, 'the session id is not the declared shape');
          assert.equal(envelope.route, '/', 'the route was not reduced to a template');

          const names = posted.flatMap((e) => (e.events ?? []).map((event) => event.name));
          assert.ok(names.includes('portal_session_started'), `no session event: ${names.join(', ')}`);
          assert.ok(names.includes('portal_page_viewed'), `no page view: ${names.join(', ')}`);

          // Nothing identifying may be anywhere in what the browser sent.
          const serialised = JSON.stringify(posted);
          for (const forbidden of ['Mozilla', 'referrer', 'http://', 'https://']) {
            assert.equal(serialised.includes(forbidden), false, `the envelope carried "${forbidden}"`);
          }
        } finally {
          await browser.close();
        }
      });

      await checkAsync('the browser session is persisted and readable back', async () => {
        assert.ok(browserSession, 'no session was captured from the browser');

        const rows = await withSql(
          (sql) => sql`select * from product_telemetry_event where session_id = ${browserSession}`
        );

        assert.ok(rows.length > 0, 'nothing from the browser reached the table');
        assert.ok(
          rows.some((row) => row.event_name === 'portal_page_viewed'),
          'the page view was not stored'
        );
        assert.equal(rows[0].auth_state, 'anonymous');
        assert.match(rows[0].visitor_key_hash, /^v_[0-9a-f]{32}$/);
        assert.equal(rows[0].user_key_hash, null);

        await withSql(
          (sql) => sql`delete from product_telemetry_event where session_id = ${browserSession}`
        );
      });

      await checkAsync('a telemetry write failure does not fail the product action', async () => {
        /*
         * The route answers 202 even when it stored nothing, so a browser never
         * learns that analytics is broken and never retries into a wall. That
         * is the observable half of "measuring must not break the measured".
         */
        const response = await postBatch([{ name: 'nonsense_event', occurredAt: new Date().toISOString(), properties: {} }]);
        assert.equal(response.status, 202);
      });
    }
  }
} catch (error) {
  failed += 1;
  console.log(`\n  FAIL the run stopped early — ${String(error).split('\n')[0]}`);
} finally {
  // Only the live mode can have written anything, so only it cleans up.
  if (LIVE) await cleanupSentinel();

  try {
    rmSync(out, { recursive: true, force: true });
  } catch {
    /* Windows keeps an ESM handle on the temp files; it is not a test result. */
  }

  if (failures.length) console.log(`\nfailed: ${failures.join(', ')}`);
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed === 0 ? 0 : 1);
}

/* ------------------------------------------------------------- Live helpers */

async function withSql(fn) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: 'require' });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function readSentinel() {
  return withSql(
    (sql) => sql`select * from product_telemetry_event where session_id = ${SENTINEL_SESSION}`
  );
}

/**
 * Removes everything this run wrote.
 *
 * Runs in `finally`, so a failed assertion still cleans up. The table is
 * append-only by application behaviour and this is the one exception: a
 * verification that leaves synthetic rows in a production telemetry table would
 * corrupt the very numbers it exists to prove.
 */
async function cleanupSentinel() {
  try {
    const removed = await withSql(
      (sql) => sql`delete from product_telemetry_event where session_id = ${SENTINEL_SESSION} returning id`
    );
    if (removed.length) console.log(`\n  cleaned up ${removed.length} verification rows`);
  } catch (error) {
    console.log(`\n  WARNING could not clean up verification rows: ${String(error.message ?? error).split('\n')[0]}`);
    console.log(`          remove them with: delete from product_telemetry_event where session_id = '${SENTINEL_SESSION}';`);
  }
}

async function mintToken() {
  const response = await fetch(`${BASE}/api/admin-metrics/access`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: process.env.METRICS_ACCESS_SECRET ?? '' }),
  });
  const cookie = response.headers.get('set-cookie') ?? '';
  const match = /tn_metrics_access=([^;]+)/.exec(cookie);
  if (!match) throw new Error('no access cookie was issued');
  return match[1];
}
