import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

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
/*
 * A recognisable prefix and a per-run suffix.
 *
 * The prefix is what makes cleanup safe to express and safe to read. The suffix
 * is why runs no longer interfere: the ingest route keeps an in-memory flood
 * guard per session for a minute, so two runs close together under one fixed id
 * exhausted the second one's budget and the route returned before recording
 * anything — a test failing on a rerun for a reason that had nothing to do with
 * what it was testing.
 *
 * A real session id is 32 random hex characters, so the chance of one beginning
 * `deadbeef` is about one in four billion, and even then the delete only ever
 * touches telemetry rows.
 */
const SENTINEL_PREFIX = 's_deadbeef';
const SENTINEL_SESSION = `${SENTINEL_PREFIX}${randomUUID().replace(/-/g, '').slice(0, 24)}`;

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
  'admin-metrics/families/startFunnel',
  'admin-metrics/families/semantics',
  'admin-metrics/families/voyagerMetrics',
  'admin-metrics/families/supercharts',
  'admin-metrics/freshness',
  'admin-metrics/webVitals',
  'admin-metrics/conclusions',
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
const startLib = await load('admin-metrics/families/startFunnel');
const semantics = await load('admin-metrics/families/semantics');
const voyagerLib = await load('admin-metrics/families/voyagerMetrics');
const charts = await load('admin-metrics/families/supercharts');
const fresh = await load('admin-metrics/freshness');
const vitals = await load('admin-metrics/webVitals');
const conclusions = await load('admin-metrics/conclusions');

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
    assert.equal(report.usersWithEligiblePortalDay, 2);
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

  /*
   * Cohort membership. Every one of these was wrong in the first
   * implementation, which dated a cohort from the earliest telemetry row of any
   * kind — so a person who produced a server event on Monday and first visited
   * on Tuesday was measured as having failed to return on a day they had not
   * yet arrived.
   */
  check('a cohort starts on the first eligible portal day, not the first row', () => {
    const report = retentionOf([
      userDay('u_a', '2026-08-10', { eligible: false, meaningful: true }),
      userDay('u_a', '2026-08-11'),
      userDay('u_a', '2026-08-12'),
    ]);
    const d1 = report.horizons.find((h) => h.horizon === 1);
    assert.equal(d1.cohortSize, 1);
    assert.equal(d1.returned.value, 1, 'the 12th was not counted as a D1 return from the 11th');
  });

  check('a user who never had an eligible portal day is not in the population', () => {
    const report = retentionOf([
      userDay('u_a', '2026-08-10', { eligible: false, meaningful: true }),
      userDay('u_a', '2026-08-12', { eligible: false, meaningful: true }),
    ]);
    assert.equal(report.usersWithEligiblePortalDay, 0, 'a user with no portal visit started a cohort');
    for (const horizon of report.horizons) assert.equal(horizon.cohortSize, 0);
  });

  check('an Observatory visit does not start a cohort', () => {
    // The exclusion is upstream, in the query predicate: an Observatory page
    // view never sets `eligible`. Here that is the day carrying eligible=false.
    const report = retentionOf([
      userDay('u_a', '2026-08-10', { eligible: false }),
      userDay('u_a', '2026-08-11'),
      userDay('u_a', '2026-08-12'),
    ]);
    assert.equal(report.horizons.find((h) => h.horizon === 1).returned.value, 1);
  });

  check('sign-in plumbing does not start a cohort', () => {
    const report = retentionOf([
      userDay('u_a', '2026-08-09', { eligible: false }),
      userDay('u_a', '2026-08-11'),
      userDay('u_a', '2026-08-18'),
    ]);
    const byHorizon = Object.fromEntries(report.horizons.map((h) => [h.horizon, h.returned.value]));
    // Seven days after the 11th, not nine after the 9th.
    assert.equal(byHorizon[7], 1);
    assert.equal(byHorizon[1], 0);
  });

  check('a meaningful event on a non-visit day is neither kind of return', () => {
    const report = retentionOf([
      userDay('u_a', '2026-08-10'),
      userDay('u_a', '2026-08-11', { eligible: false, meaningful: true }),
    ]);
    const d1 = report.horizons.find((h) => h.horizon === 1);
    assert.equal(d1.returned.value, 0, 'a server event counted as a visit');
    assert.equal(d1.returnedMeaningfully.value, 0, 'a meaningful action without a visit counted as retained');
  });

  check('an eligible day that is also meaningful counts in both', () => {
    const report = retentionOf([
      userDay('u_a', '2026-08-10'),
      userDay('u_a', '2026-08-11', { eligible: true, meaningful: true }),
    ]);
    const d1 = report.horizons.find((h) => h.horizon === 1);
    assert.equal(d1.returned.value, 1);
    assert.equal(d1.returnedMeaningfully.value, 1);
  });

  check('meaningful return can never exceed primary return', () => {
    const report = retentionOf([
      userDay('u_a', '2026-08-10'), userDay('u_a', '2026-08-11', { meaningful: true }),
      userDay('u_b', '2026-08-10'), userDay('u_b', '2026-08-11'),
      userDay('u_c', '2026-08-10'), userDay('u_c', '2026-08-11', { eligible: false, meaningful: true }),
    ]);
    for (const horizon of report.horizons) {
      assert.ok(
        horizon.returnedMeaningfully.value <= horizon.returned.value,
        `D${horizon.horizon}: meaningful ${horizon.returnedMeaningfully.value} > returned ${horizon.returned.value}`
      );
    }
  });

  check('the retention day predicate reads the area, not the surface column', () => {
    /*
     * The bug this guards. Ingest stamps `surface` from the event's registry
     * entry, and `portal_page_viewed` is registered under `portal` — so every
     * page view row carries `surface = 'portal'` whatever page it described,
     * and the original `surface <> 'observatory'` test excluded nothing at all.
     * The page is in `properties.area`.
     */
    const source = readFileSync('src/lib/admin-metrics/telemetryQuery.ts', 'utf8');
    assert.match(source, /->> 'area'/, 'the predicate no longer reads properties.area');
    assert.equal(
      /coalesce\(\$\{schema\.productTelemetryEvent\.surface\}[^)]*\) <> 'observatory'/.test(source),
      false,
      'the predicate is back to testing the surface column'
    );
  });

  check('a customer area is a return and a technical one is not', () => {
    assert.equal(eligibility.isCustomerPortalArea('home'), true);
    assert.equal(eligibility.isCustomerPortalArea('account'), true, 'checking your own account is a return');
    assert.equal(eligibility.isCustomerPortalArea('wealth'), true);
    assert.equal(eligibility.isCustomerPortalArea('observatory'), false);
    assert.equal(eligibility.isCustomerPortalArea('auth'), false);
    assert.equal(eligibility.isCustomerPortalArea('portal'), false);
    assert.equal(eligibility.isCustomerPortalArea('unknown'), false);
    assert.equal(eligibility.isCustomerPortalArea(null), false);
  });

  check('retention and PMCR eligibility differ only where it is intended', () => {
    // `account` is a return but not a landing. That asymmetry is the whole
    // documented difference, and it is asserted rather than described.
    assert.equal(eligibility.isCustomerPortalArea('account'), true);
    assert.equal(surfaces.SURFACE_BY_KEY.get('account').pmcrEligible, false);
    assert.equal(dictionary.DICTIONARY_BY_ID.get('retention_d7').eligiblePopulation.includes('FIRST ELIGIBLE PORTAL DAY'), true);
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

  /* ============================================ Phase 3 — product families */

  group('The Start funnel is sequential, not a division of totals');

  const S0 = Date.parse('2026-08-11T09:00:00.000Z');
  const step = (sessionId, eventName, seconds, properties = {}) => ({
    sessionId,
    eventName,
    occurredAt: S0 + seconds * 1000,
    properties,
  });

  const fullPath = (id, offset = 0) => [
    step(id, 'next_step_opened', offset + 0),
    step(id, 'next_step_level_selected', offset + 5),
    step(id, 'next_step_intent_selected', offset + 10),
    step(id, 'next_step_recommendation_shown', offset + 15, { destination: 'markets' }),
    step(id, 'next_step_destination_clicked', offset + 20, { destination: 'markets', external: false }),
  ];

  const stageOf = (funnel, name) => funnel.stages.find((stage) => stage.stage === name);

  check('a complete path reaches every stage', () => {
    const funnel = startLib.startFunnel(fullPath('a'), 1);
    for (const stage of funnel.stages) assert.equal(stage.sessions, 1, stage.stage);
    assert.equal(stageOf(funnel, 'destination_clicked').ofPrevious, 1);
  });

  check('an optional clarification does not become a required stage', () => {
    const withClarification = [
      ...fullPath('a').slice(0, 3),
      step('a', 'next_step_clarification_selected', 12),
      ...fullPath('a').slice(3),
    ];
    const funnel = startLib.startFunnel([...withClarification, ...fullPath('b')], 1);

    assert.equal(stageOf(funnel, 'destination_clicked').sessions, 2, 'the unclarified path was dropped');
    assert.equal(funnel.clarifiedSessions, 1);
    assert.equal(funnel.clarificationShare, 0.5);
    assert.equal(
      funnel.stages.some((stage) => stage.stage.includes('clarification')),
      false,
      'clarification became a mandatory stage'
    );
  });

  check('a recommendation nobody clicked stops at the recommendation', () => {
    const funnel = startLib.startFunnel(fullPath('a').slice(0, 4), 1);
    assert.equal(stageOf(funnel, 'recommendation_shown').sessions, 1);
    assert.equal(stageOf(funnel, 'destination_clicked').sessions, 0);
    assert.equal(stageOf(funnel, 'destination_clicked').ofPrevious, 0);
  });

  check('early steps alone cannot fake a completion', () => {
    /*
     * The failure a totals-based funnel produces: the click exists in the data
     * but the steps before it do not, and dividing one total by another would
     * report a completed journey that never happened.
     */
    const funnel = startLib.startFunnel(
      [step('a', 'next_step_opened', 0), step('a', 'next_step_destination_clicked', 5, { destination: 'markets', external: false })],
      1
    );
    assert.equal(stageOf(funnel, 'level_selected').sessions, 0);
    assert.equal(stageOf(funnel, 'destination_clicked').sessions, 0, 'a click without its funnel counted as a completion');
  });

  check('out-of-order events break the chain rather than being reordered into it', () => {
    // The intent arrives before the level. Nothing further is claimed, because
    // nothing further is evidenced.
    const funnel = startLib.startFunnel(
      [
        step('a', 'next_step_opened', 0),
        step('a', 'next_step_intent_selected', 5),
        step('a', 'next_step_level_selected', 10),
        step('a', 'next_step_recommendation_shown', 15, {}),
      ],
      1
    );
    assert.equal(stageOf(funnel, 'level_selected').sessions, 1);
    assert.equal(stageOf(funnel, 'intent_selected').sessions, 0, 'an out-of-order step was silently accepted');
  });

  check('arrival order in the array does not matter', () => {
    const shuffled = [...fullPath('a')].reverse();
    const funnel = startLib.startFunnel(shuffled, 1);
    assert.equal(stageOf(funnel, 'destination_clicked').sessions, 1);
  });

  check('a duplicate step is still one step', () => {
    const funnel = startLib.startFunnel([...fullPath('a'), ...fullPath('a')], 1);
    for (const stage of funnel.stages) assert.equal(stage.sessions, 1, `${stage.stage} was double counted`);
  });

  check('a restart is counted and does not inflate starts', () => {
    const funnel = startLib.startFunnel(
      [...fullPath('a'), step('a', 'next_step_restarted', 30), step('a', 'next_step_opened', 31)],
      1
    );
    assert.equal(stageOf(funnel, 'opened').sessions, 1, 'reopening counted as a second start');
    assert.equal(funnel.restartedSessions, 1);
    assert.equal(funnel.restartShare, 1);
  });

  check('destinations are counted once per session and split by direction', () => {
    const funnel = startLib.startFunnel(
      [
        ...fullPath('a'),
        step('a', 'next_step_destination_clicked', 25, { destination: 'markets', external: false }),
        step('a', 'next_step_destination_clicked', 26, { destination: 'community', external: true }),
      ],
      1
    );
    const markets = funnel.destinations.find((row) => row.destination === 'markets');
    assert.equal(markets.sessions, 1, 'the same destination counted twice for one session');
    assert.equal(funnel.internalClicks, 2);
    assert.equal(funnel.externalClicks, 1);
  });

  check('one session reaching a recommendation does not qualify another', () => {
    /*
     * The bug this guards, and it was subtle: the clarification test asked
     * `reached.recommendation_shown > 0`, which is the count across *every*
     * session. Once one session had legitimately got there, any other session
     * that emitted a clarification counted too — a funnel described as
     * sequential within a session consulting a global.
     *
     * Session `a` walks the whole chain. Session `b` emits a clarification and
     * a recommendation with no level selection behind them.
     */
    const funnel = startLib.startFunnel(
      [
        ...fullPath('a'),
        step('b', 'next_step_opened', 0),
        step('b', 'next_step_intent_selected', 5),
        step('b', 'next_step_clarification_selected', 8),
        step('b', 'next_step_recommendation_shown', 10),
      ],
      1
    );
    assert.equal(funnel.clarifiedSessions, 0, "another session's progress qualified an incomplete one");
    assert.equal(stageOf(funnel, 'recommendation_shown').sessions, 1);
  });

  check('a clarification before the intent it clarifies does not count', () => {
    const path = [
      step('a', 'next_step_opened', 0),
      step('a', 'next_step_level_selected', 5),
      step('a', 'next_step_clarification_selected', 7),
      step('a', 'next_step_intent_selected', 10),
      step('a', 'next_step_recommendation_shown', 15),
    ];
    const funnel = startLib.startFunnel(path, 1);
    assert.equal(stageOf(funnel, 'recommendation_shown').sessions, 1, 'the chain itself broke');
    assert.equal(funnel.clarifiedSessions, 0, 'a clarification that preceded its intent counted');
  });

  check('a clarification after the recommendation it should have shaped does not count', () => {
    const path = [...fullPath('a').slice(0, 4), step('a', 'next_step_clarification_selected', 18)];
    assert.equal(startLib.startFunnel(path, 1).clarifiedSessions, 0);
  });

  check('a valid optional clarification counts exactly once', () => {
    const path = [
      ...fullPath('a').slice(0, 3),
      step('a', 'next_step_clarification_selected', 12),
      ...fullPath('a').slice(3),
    ];
    assert.equal(startLib.startFunnel(path, 1).clarifiedSessions, 1);
  });

  check('a session that clarified three times clarified once', () => {
    const path = [
      ...fullPath('a').slice(0, 3),
      step('a', 'next_step_clarification_selected', 11),
      step('a', 'next_step_clarification_selected', 12),
      step('a', 'next_step_clarification_selected', 13),
      ...fullPath('a').slice(3),
    ];
    assert.equal(startLib.startFunnel(path, 1).clarifiedSessions, 1, 'repeats inflated the count');
  });

  check('a rate is withheld below the minimum but the count is not', () => {
    const funnel = startLib.startFunnel(fullPath('a'), 25);
    assert.equal(stageOf(funnel, 'level_selected').sessions, 1);
    assert.equal(stageOf(funnel, 'level_selected').ofPrevious, null);
  });

  check('the generic funnel enforces the same order rule', () => {
    const chain = ['events_discovery_viewed', 'event_viewed', 'event_registration_started'];
    const ordered = startLib.sequentialFunnel(
      [
        step('a', 'events_discovery_viewed', 0),
        step('a', 'event_viewed', 5),
        step('a', 'event_registration_started', 10),
      ],
      chain,
      1
    );
    assert.equal(ordered.stages[2].sessions, 1);

    const backwards = startLib.sequentialFunnel(
      [step('b', 'event_viewed', 0), step('b', 'events_discovery_viewed', 5)],
      chain,
      1
    );
    assert.equal(backwards.stages[1].sessions, 0, 'a later first step still satisfied the chain');
  });

  group('Durable status semantics');

  const SEATS = { registered: 10, waitlisted: 40, cancelled: 5, attended: 6, no_show: 4 };

  check('a waitlisted or cancelled person never held a seat', () => {
    assert.equal(semantics.heldSeats(SEATS), 20, 'seats nobody held were counted');
    assert.equal(semantics.SEAT_STATUSES.includes('waitlisted'), false);
    assert.equal(semantics.SEAT_STATUSES.includes('cancelled'), false);
  });

  check('attendance is measured over resolved seats only', () => {
    /*
     * The correction. `registered` means "holds a seat", which covers a talk
     * next month as much as one last week nobody marked up. In the denominator
     * it made every future event drag the rate down before attendance was
     * knowable.
     */
    assert.equal(semantics.attendanceResolvedSeats(SEATS), 10, 'unresolved seats reached the denominator');
    assert.equal(semantics.ATTENDANCE_RESOLVED_STATUSES.includes('registered'), false);
    assert.equal(semantics.attendanceUnresolvedSeats(SEATS), 10);
  });

  check('scheduling more events cannot lower the attendance rate', () => {
    const before = semantics.attendanceResolvedSeats(SEATS);
    const afterScheduling = semantics.attendanceResolvedSeats({ ...SEATS, registered: SEATS.registered + 500 });
    assert.equal(afterScheduling, before, 'future seats changed the denominator');
  });

  check('an unresolved seat is not a non-attendance', () => {
    const allUnresolved = { registered: 100, attended: 0, no_show: 0 };
    assert.equal(semantics.attendanceResolvedSeats(allUnresolved), 0, 'unmarked seats were treated as outcomes');
    assert.equal(semantics.heldSeats(allUnresolved), 100);
  });

  check('marking coverage and the rate answer different questions', () => {
    // Perfect attendance over 3% coverage is a different claim from perfect
    // attendance over 90%, and only both numbers together say which.
    const thin = { registered: 970, attended: 30, no_show: 0 };
    assert.equal(semantics.attendanceResolvedSeats(thin), 30);
    assert.equal(semantics.heldSeats(thin), 1000);
  });

  check('the open pipeline is work outstanding, not a conversion stage', () => {
    const counts = { draft: 3, slot_held: 2, payment_pending: 1, confirmed: 4, completed: 9, cancelled: 2, refunded: 1 };
    assert.equal(semantics.openPipeline(counts), 10);
    assert.equal(semantics.OPEN_BOOKING_STATUSES.includes('completed'), false, 'a finished booking counted as open');
  });

  check('every declared booking status is known to the semantics', () => {
    for (const status of ['draft', 'slot_held', 'payment_pending', 'confirmed', 'completed', 'cancelled', 'refunded', 'no_show', 'disputed']) {
      assert.equal(semantics.BOOKING_STATUSES.includes(status), true, status);
    }
  });

  check('a demo purchase can never be revenue-bearing', () => {
    assert.equal(semantics.isRevenueBearing('demo'), false);
    assert.equal(semantics.isRevenueBearing('pending'), false);
    assert.equal(semantics.isRevenueBearing('failed'), false);
    assert.equal(semantics.isRevenueBearing('refunded'), false);
    assert.equal(semantics.isRevenueBearing('paid'), true);
    assert.equal(semantics.POTENTIALLY_MONETARY_STATUSES.includes('demo'), false);
  });

  check('revenue is not confirmable while nothing has been reconciled', () => {
    assert.equal(semantics.revenueIsConfirmable(0), false);
    assert.equal(semantics.revenueIsConfirmable(1), true);
  });

  group('A signed difference is not a count');

  const deltaAt = {
    metricId: 'events_seat_counter_delta',
    source: 'event.registration_count vs event_registration',
    sourceType: 'derived',
    queriedAt: NOW.toISOString(),
  };

  check('a positive delta carries its comparable population as evidence', () => {
    const metric = states.delta(5, 200, deltaAt);
    assert.equal(metric.value, 5);
    assert.equal(metric.sample, 200, 'the sample became the difference');
  });

  check('a zero delta is still a measurement, not an absence', () => {
    const metric = states.delta(0, 200, deltaAt);
    assert.equal(metric.state, 'derived');
    assert.equal(metric.value, 0);
    assert.equal(metric.sample, 200);
  });

  check('a negative delta never produces a negative sample', () => {
    /*
     * The defect. Passing a signed delta through `count` gave
     * `{ value: -5, sample: -5 }` — a claim that minus five observations were
     * made. A count's sample is its value; a difference's is the population the
     * two sides were computed over.
     */
    const metric = states.delta(-5, 200, deltaAt);
    assert.equal(metric.value, -5);
    assert.equal(metric.sample, 200);
    assert.ok(metric.sample >= 0);
  });

  check('a nonsensical evidence count is floored rather than published', () => {
    assert.equal(states.delta(-5, -200, deltaAt).sample, 0);
  });

  check('a delta declares itself derived from both sides', () => {
    const metric = states.delta(-5, 200, deltaAt);
    assert.equal(metric.sourceType, 'derived');
    assert.match(metric.source, /event\.registration_count/);
    assert.match(metric.source, /event_registration/);
  });

  check('the events family compares the counter that is actually maintained', () => {
    /*
     * `event_metric` looked like a second opinion on registrations and is not
     * one: only `external_click` is ever written to it. Subtracting a durable
     * total from a metric that does not exist reported minus every registration
     * in the product and called it a discrepancy.
     */
    const source = readFileSync('src/lib/admin-metrics/families/events.ts', 'utf8');
    assert.match(source, /schema\.event\.registrationCount/, 'the comparable counter is not read');
    assert.equal(
      /eventMetric/.test(source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/'[^']*'/g, '')),
      false,
      'event_metric is still being queried'
    );
    assert.match(source, /seatCounterDelta: delta\(/);
  });

  group('Durable adapters cannot quietly widen');

  const ADAPTERS = [
    'src/lib/admin-metrics/families/events.ts',
    'src/lib/admin-metrics/families/academy.ts',
    'src/lib/admin-metrics/families/experts.ts',
    'src/lib/admin-metrics/families/commerce.ts',
    'src/lib/admin-metrics/families/saves.ts',
    'src/lib/admin-metrics/families/wealth.ts',
    'src/lib/admin-metrics/families/accounts.ts',
  ];

  check('no adapter selects a whole row', () => {
    /*
     * `select()` with no argument is Drizzle's `select *`. Several of these
     * tables hold an email, a name, an encrypted brief or a monetary value a
     * column away from what we want, and a widened select is how one reaches a
     * JSON response without anybody deciding it should.
     */
    for (const path of ADAPTERS) {
      const source = readFileSync(path, 'utf8');
      assert.equal(/\.select\(\s*\)/.test(source), false, `${path} selects whole rows`);
    }
  });

  /*
   * Checked as *column references*, not as mentions. These files deliberately
   * name the fields they refuse to read — that prose is the point, and a test
   * that banned the words would have forced the documentation out to protect a
   * grep. What must never appear is `schema.<table>.<column>`, which is the
   * only form that can actually put a value in a query.
   */
  const FORBIDDEN_COLUMNS = [
    'nameEnc', 'valueEnc', 'detailsEnc', 'balanceEnc', 'termsEnc', 'targetEnc', 'metaEnc',
    'briefEnc', 'summaryEnc', 'noteEnc', 'sharedContext', 'diagnostic',
    'email', 'name', 'company', 'role', 'experienceLevel', 'dataKeyEnc', 'image',
    'description', 'title', 'subtitle', 'ref',
  ];

  for (const path of ADAPTERS) {
    check(`${path.split('/').pop()} references no sensitive column`, () => {
      const source = readFileSync(path, 'utf8');
      for (const column of FORBIDDEN_COLUMNS) {
        const reference = new RegExp(`schema\.\w+\.${column}\b`);
        assert.equal(reference.test(source), false, `${path} reads schema.*.${column}`);
      }
    });
  }

  check('the Wealth family reads no encrypted column', () => {
    // The strictest boundary. Nothing here selects a value, so nothing here can
    // decrypt one — the prose above the code names them precisely so a reader
    // can confirm that at a glance.
    const source = readFileSync('src/lib/admin-metrics/families/wealth.ts', 'utf8');
    for (const column of ['nameEnc', 'valueEnc', 'balanceEnc', 'targetEnc', 'detailsEnc', 'metaEnc', 'termsEnc']) {
      assert.equal(
        new RegExp(`schema\.\w+\.${column}\b`).test(source),
        false,
        `wealth.ts reads ${column}`
      );
    }
  });

  check('current wealth assets exclude superseded revisions', () => {
    const source = readFileSync('src/lib/admin-metrics/families/wealth.ts', 'utf8');
    assert.match(source, /isNull\(schema\.wealthAsset\.supersededAt\)/);
    assert.match(source, /supersededAt\} is not null/);
  });

  check('commerce never sums a demo amount into a paid figure', () => {
    const source = readFileSync('src/lib/admin-metrics/families/commerce.ts', 'utf8');
    assert.match(source, /filter \(where \$\{schema\.purchase\.status\} = 'paid'\)/);
    assert.match(source, /filter \(where \$\{schema\.purchase\.status\} = 'demo'\)/);
    assert.equal(source.includes('recordedPaidGrossCents'), true, 'the paid sum lost its honest name');
    assert.equal(/revenue:\s*durableCount/.test(source), false, 'a durable count was named revenue');
  });

  check('commerce reads the plan lineup rather than listing it', () => {
    const source = readFileSync('src/lib/admin-metrics/families/commerce.ts', 'utf8');
    assert.match(source, /PLAN_RANK/);
    for (const stale of ["'plus'", "'pro'", "'private'", "'essential'", "'ultimate'"]) {
      assert.equal(source.includes(stale), false, `commerce.ts hardcodes ${stale}`);
    }
  });

  group('Phase 3 definitions say which kind of source they are');

  check('every dictionary entry declares a source type', () => {
    for (const entry of dictionary.METRIC_DICTIONARY_ALL) {
      assert.ok(entry.sourceType, `${entry.id} has no source type`);
      assert.equal(states.SOURCE_TYPES.includes(entry.sourceType), true, `${entry.id}: ${entry.sourceType}`);
    }
  });

  check('the durable families are declared as facts, not as behaviour', () => {
    for (const id of ['events_attendance_rate', 'academy_completion_rate', 'experts_pipeline', 'wealth_adoption']) {
      assert.equal(dictionary.DICTIONARY_BY_ID.get(id).sourceType, 'durable_fact', id);
    }
    assert.equal(dictionary.DICTIONARY_BY_ID.get('start_funnel').sourceType, 'telemetry');
    assert.equal(dictionary.DICTIONARY_BY_ID.get('confirmed_revenue').sourceType, 'source_not_connected');
  });

  check('a current-state family says it is not a historical funnel', () => {
    for (const id of ['academy_completion_rate', 'experts_pipeline']) {
      const entry = dictionary.DICTIONARY_BY_ID.get(id);
      assert.match(entry.timeSemantics, /[Cc]urrent state/, `${id} does not say it is current state`);
    }
    assert.match(
      dictionary.DICTIONARY_BY_ID.get('experts_pipeline').limitations.join(' '),
      /No conversion rate is published/
    );
  });

  check('the seven retired plan events are absent from every Phase 3 definition', () => {
    const serialised = JSON.stringify(dictionary.METRIC_DICTIONARY_ALL);
    for (const legacy of registry.LEGACY_EVENT_NAMES) {
      assert.equal(serialised.includes(legacy), false, `${legacy} is cited by a live metric`);
    }
  });

  /* ============================================ Phase 4 — Voyager operations */

  group('A scripted fallback is not a model answer');

  const request = (overrides = {}) => ({
    outcome: 'real_answer',
    quotaDisposition: 'charged',
    modelConfigured: true,
    durationMs: 1_000,
    screen: 'generic',
    tier: 'basic',
    sourceCount: 1,
    toolSteps: 0,
    hasChart: false,
    hasStudy: false,
    actionCount: 0,
    ...overrides,
  });

  const refused = request({ outcome: 'quota_refused', quotaDisposition: 'refused_released', durationMs: 20 });
  const fallback = request({ outcome: 'simulated_fallback', quotaDisposition: 'released', durationMs: 5_000 });

  check('the three outcomes are counted apart', () => {
    const counts = voyagerLib.countRequests([request(), fallback, refused]);
    assert.equal(counts.realAnswers, 1);
    assert.equal(counts.simulatedFallbacks, 1);
    assert.equal(counts.quotaRefusals, 1);
    assert.equal(counts.requests, 3);
  });

  check('a refusal never reached the model and leaves the executed population', () => {
    /*
     * Otherwise the real-answer rate falls as more people hit their daily
     * limit, which says nothing at all about whether the AI is working.
     */
    const counts = voyagerLib.countRequests([request(), fallback, refused, refused]);
    assert.equal(counts.executed, 2);
  });

  check('a fallback is never counted as a real answer', () => {
    const counts = voyagerLib.countRequests([fallback, fallback]);
    assert.equal(counts.realAnswers, 0, 'a scripted fallback was counted as a model answer');
    assert.equal(counts.simulatedFallbacks, 2);
  });

  check('a fallback while a model was configured is separable', () => {
    const counts = voyagerLib.countRequests([
      fallback,
      request({ outcome: 'simulated_fallback', quotaDisposition: 'released', modelConfigured: false }),
    ]);
    assert.equal(counts.fallbacksWithModel, 1, 'the two kinds of fallback were merged');
  });

  group('Quota integrity is a check, not a rate');

  check('the contract-honouring shapes pass', () => {
    const report = voyagerLib.quotaIntegrity([request(), fallback, refused]);
    assert.equal(report.violations, 0, JSON.stringify(report.detail));
    assert.equal(report.checked, 3);
  });

  check('a simulated fallback that stayed charged is flagged', () => {
    /*
     * The refund did not run, so somebody paid for an answer they never
     * received. Reported with its shape rather than averaged into anything.
     */
    const report = voyagerLib.quotaIntegrity([
      request({ outcome: 'simulated_fallback', quotaDisposition: 'charged' }),
    ]);
    assert.equal(report.violations, 1);
    assert.equal(report.detail[0].outcome, 'simulated_fallback');
    assert.equal(report.detail[0].disposition, 'charged');
  });

  check('a real answer that was not charged is also a violation', () => {
    assert.equal(voyagerLib.quotaIntegrity([request({ quotaDisposition: 'released' })]).violations, 1);
  });

  check('an unmetered plan is not a violation', () => {
    // A Premium question is not counted at all; reporting it as a refund would
    // make every unmetered answer look like a broken charge.
    assert.equal(voyagerLib.quotaIntegrity([request({ quotaDisposition: 'unmetered' })]).violations, 0);
  });

  group('Latency measures answers, not rejections');

  check('quota refusals are excluded from the latency population', () => {
    const rows = [request({ durationMs: 1000 }), request({ durationMs: 3000 }), refused];
    const summary = voyagerLib.latency(voyagerLib.executedRequests(rows), 1);
    assert.equal(summary.sample, 2, 'a refusal reached the latency population');
    // Nearest-rank over two values takes the lower, which is the documented
    // method: every reported figure is a duration somebody actually had.
    assert.equal(summary.median, 1000);
    assert.equal(summary.p90, 3000);
  });

  check('percentiles are nearest-rank over a deterministic fixture', () => {
    const rows = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((durationMs) =>
      request({ durationMs })
    );
    const summary = voyagerLib.latency(rows, 1);
    assert.equal(summary.median, 500);
    assert.equal(summary.p75, 800);
    assert.equal(summary.p90, 900);
  });

  check('a small sample withholds the percentile rather than guessing', () => {
    assert.equal(voyagerLib.latency([request()], 50).median, null);
  });

  group('Tools report capability, never content');

  const toolRow = (overrides = {}) => ({
    tool: 'market_data',
    outcome: 'success',
    code: '',
    durationMs: 100,
    ...overrides,
  });

  check('successes and failures aggregate per tool', () => {
    const summary = voyagerLib.summariseTools(
      [toolRow(), toolRow({ outcome: 'failure', code: 'not_permitted' }), toolRow({ tool: 'navigation' })],
      1
    );
    assert.equal(summary.executions, 3);
    assert.equal(summary.successes, 2);
    assert.equal(summary.failures, 1);
    assert.equal(summary.byTool[0].tool, 'market_data');
    assert.equal(summary.byTool[0].failures, 1);
    assert.equal(summary.topFailureCodes[0].code, 'not_permitted');
  });

  check('the tool telemetry shape has nowhere to put input or output', () => {
    const definition = registry.EVENT_BY_NAME.get('voyager_tool_completed');
    assert.deepEqual(Object.keys(definition.properties).sort(), ['code', 'durationMs', 'outcome', 'step', 'tool']);
    assert.equal(definition.kind, 'server');
  });

  group('The Voyager contract cannot carry a question');

  check('neither Voyager server event declares a free-text property', () => {
    for (const name of ['voyager_request_completed', 'voyager_tool_completed']) {
      const definition = registry.EVENT_BY_NAME.get(name);
      assert.ok(definition, `${name} is not registered`);
      for (const [key, spec] of Object.entries(definition.properties)) {
        assert.ok(['enum', 'token', 'integer', 'boolean'].includes(spec.kind), `${name}.${key} is ${spec.kind}`);
      }
    }
  });

  for (const forbidden of ['question', 'answer', 'prompt', 'message', 'history', 'query', 'ticker', 'symbol', 'holdings', 'note', 'citations', 'url', 'input', 'output']) {
    check(`the Voyager contract has no "${forbidden}" property`, () => {
      for (const name of ['voyager_request_completed', 'voyager_tool_completed']) {
        const keys = Object.keys(registry.EVENT_BY_NAME.get(name).properties).map((key) => key.toLowerCase());
        assert.equal(keys.includes(forbidden), false, `${name} declares ${forbidden}`);
      }
    });
  }

  check('a Voyager event carrying a question is refused by the validator', () => {
    const result = validate.validateEvent(
      {
        name: 'voyager_request_completed',
        occurredAt: NOW.toISOString(),
        properties: { screen: 'chart', question: 'should I sell TSLA' },
      },
      NOW,
      validate.SERVER_KINDS
    );
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unknown_property');
  });

  check('a browser cannot forge a Voyager server outcome', () => {
    const result = validate.validateEvent(
      { name: 'voyager_request_completed', occurredAt: NOW.toISOString(), properties: {} },
      NOW
    );
    assert.equal(result.ok, false, 'a client could claim the model answered');
  });

  check('the dictionary refuses to call a fallback a success', () => {
    const entry = dictionary.DICTIONARY_BY_ID.get('voyager_fallback_rate');
    assert.ok(entry, 'no definition for the fallback rate');
    assert.match([entry.formula, ...entry.limitations].join(' '), /NOT a success/);
    assert.equal(entry.sourceType, 'telemetry');
  });

  check('an absent emitter is not zero usage', () => {
    /*
     * The demo-critical distinction. Before the Voyager section ships the
     * emitters there is no mechanism, not an absence of usage — and a card
     * reading "0 requests" would assert that nobody uses the product's headline
     * feature.
     */
    const source = readFileSync('src/lib/admin-metrics/families/voyager.ts', 'utf8');
    assert.match(source, /awaitingEmitter/);
    assert.match(source, /this is not an absence of usage/);
  });

  /* ================================ Phase 5 — reliability, data health, charts */

  group('Web Vitals carry two units in one column');

  check('CLS survives the round trip and the others stay milliseconds', () => {
    /*
     * The mistake this guards: CLS is a unitless ratio around 0.1, and storing
     * it raw in an integer column rounds every real score to zero. It is scaled
     * by 1000 on the way in and divided on the way out, in one place.
     */
    assert.equal(vitals.toStoredValue('cls', 0.083), 83);
    assert.equal(vitals.fromStoredValue('cls', 83), 0.083);
    assert.equal(vitals.toStoredValue('lcp', 2410.7), 2411);
    assert.equal(vitals.fromStoredValue('lcp', 2411), 2411);
  });

  check('a real CLS score does not round to zero', () => {
    assert.notEqual(vitals.toStoredValue('cls', 0.04), 0);
  });

  check('formatting reads the stored value back in its own unit', () => {
    assert.equal(vitals.formatVital('cls', 83), '0.083');
    assert.equal(vitals.formatVital('lcp', 2400), '2.40 s');
    assert.equal(vitals.formatVital('ttfb', 420), '420 ms');
  });

  check('only the five declared vitals are accepted', () => {
    for (const name of ['lcp', 'inp', 'cls', 'fcp', 'ttfb']) assert.equal(vitals.isWebVital(name), true);
    for (const name of ['fid', 'tbt', 'anything']) assert.equal(vitals.isWebVital(name), false);
  });

  check('ratings use the published thresholds', () => {
    assert.equal(vitals.rate('lcp', 2000), 'good');
    assert.equal(vitals.rate('lcp', 3000), 'needs_improvement');
    assert.equal(vitals.rate('lcp', 5000), 'poor');
    assert.equal(vitals.rate('cls', 0.05), 'good');
    assert.equal(vitals.rate('cls', 0.3), 'poor');
  });

  check('p75 is nearest-rank and is the headline', () => {
    const samples = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((value) => ({
      metric: 'lcp',
      value,
      rating: 'good',
      area: 'home',
    }));
    const lcp = vitals.summariseVitals(samples, 1).find((row) => row.metric === 'lcp');
    assert.equal(lcp.p50, 500);
    assert.equal(lcp.p75, 800);
    assert.equal(lcp.p90, 900);
    assert.equal(lcp.sample, 10);
  });

  check('a small sample withholds every percentile rather than looking healthy', () => {
    const lcp = vitals
      .summariseVitals([{ metric: 'lcp', value: 100, rating: 'good', area: 'home' }], 50)
      .find((row) => row.metric === 'lcp');
    assert.equal(lcp.p75, null, 'a p75 over one page load was published');
    assert.equal(lcp.poorShare, null);
    assert.equal(lcp.sample, 1, 'the count is still reported');
  });

  group('Runtime failures are classes, never messages');

  check('the failure contract admits only closed classes', () => {
    const definition = registry.EVENT_BY_NAME.get('client_runtime_failure');
    assert.deepEqual(Object.keys(definition.properties).sort(), ['area', 'class', 'phase']);
    assert.deepEqual(definition.properties.class.values, ['unhandled_error', 'unhandled_rejection', 'resource']);
  });

  for (const forbidden of ['message', 'stack', 'url', 'useragent', 'query', 'props', 'reason']) {
    check(`a runtime failure cannot carry "${forbidden}"`, () => {
      const keys = Object.keys(registry.EVENT_BY_NAME.get('client_runtime_failure').properties).map((key) =>
        key.toLowerCase()
      );
      assert.equal(keys.includes(forbidden), false);
    });
  }

  check('an error message is refused by the validator', () => {
    const result = validate.validateEvent(
      {
        name: 'client_runtime_failure',
        occurredAt: NOW.toISOString(),
        properties: { class: 'unhandled_error', phase: 'runtime', area: 'home', message: 'TypeError: x' },
      },
      NOW
    );
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unknown_property');
  });

  check('nothing in the client instrumentation monkeypatches the browser', () => {
    const source = readFileSync('src/instrumentation-client.ts', 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const forbidden of ['window.fetch =', 'console.error =', 'XMLHttpRequest.prototype']) {
      assert.equal(code.includes(forbidden), false, `instrumentation patches ${forbidden}`);
    }
    assert.match(code, /addEventListener\(\s*'unhandledrejection'/);
  });

  group('Freshness is judged against the cadence of the data');

  const MONDAY = new Date('2026-08-10T15:00:00.000Z');

  check('a quote inside the delay is current, and just past it is expected', () => {
    assert.equal(fresh.freshnessOf('quote', new Date('2026-08-10T14:52:00.000Z'), MONDAY), 'current');
    assert.equal(fresh.freshnessOf('quote', new Date('2026-08-10T14:30:00.000Z'), MONDAY), 'delayed_expected');
  });

  check("Friday's close is not stale on a Sunday", () => {
    /*
     * The failure a wall-clock rule produces: 48 hours have passed and the
     * market has produced nothing newer, so the product would have reported
     * itself broken every weekend.
     */
    const sunday = new Date('2026-08-16T12:00:00.000Z');
    const fridayClose = new Date('2026-08-14T20:00:00.000Z');
    assert.equal(fresh.tradingDaysBetween(fridayClose, sunday), 0);
    assert.equal(fresh.freshnessOf('quote', fridayClose, sunday), 'current');
    assert.equal(fresh.freshnessOf('series', fridayClose, sunday), 'current');
  });

  check('a genuinely old quote is bucketed by trading days', () => {
    const later = new Date('2026-08-20T15:00:00.000Z');
    assert.equal(fresh.freshnessOf('quote', new Date('2026-08-19T15:00:00.000Z'), later), 'stale_1d');
    assert.equal(fresh.freshnessOf('quote', new Date('2026-08-17T15:00:00.000Z'), later), 'stale_3d');
    assert.equal(fresh.freshnessOf('series', new Date('2026-08-03T15:00:00.000Z'), later), 'stale_7d_plus');
  });

  check('macro is never judged by a quote threshold', () => {
    // Monthly data is months old by design, and this product has no cadence
    // metadata to judge it against — so it claims nothing rather than guessing.
    const old = new Date('2026-05-01T00:00:00.000Z');
    assert.equal(fresh.freshnessOf('macro', old, MONDAY), 'not_applicable');
    assert.notEqual(fresh.freshnessOf('quote', old, MONDAY), 'not_applicable');
  });

  check('an absent observation is unknown, not fresh', () => {
    assert.equal(fresh.freshnessOf('quote', null, MONDAY), 'unknown');
  });

  check('a source with no expected cadence is never called stale', () => {
    /*
     * "Last seen three days ago" and "stale" are different claims. Web Vitals
     * only exist when a page loads; silence means nobody visited.
     */
    const webVitals = fresh.SOURCE_CADENCE.find((row) => row.source === 'web vitals');
    const portal = fresh.SOURCE_CADENCE.find((row) => row.source === 'portal telemetry');
    const longAgo = new Date('2026-08-01T00:00:00.000Z');

    assert.equal(webVitals.budgetHours, null);
    assert.equal(fresh.sourceIsStale(webVitals, longAgo, MONDAY), false);
    assert.equal(fresh.sourceIsStale(portal, longAgo, MONDAY), true);
  });

  group('Supercharts: overlay, pane, and no handoff that does not exist');

  check('placement comes from the canonical registry', () => {
    assert.equal(charts.placementOf('sma'), 'overlay');
    assert.equal(charts.placementOf('ema'), 'overlay');
    assert.equal(charts.placementOf('rsi'), 'pane');
    assert.equal(charts.placementOf('macd'), 'pane');
    assert.equal(charts.placementOf('volume'), 'pane');
    assert.equal(charts.placementOf('nonsense'), 'unknown');
  });

  check('RSI, MACD and Volume are native panes, not handoffs', () => {
    for (const study of charts.NATIVE_PANE_STUDIES) {
      assert.equal(charts.placementOf(study), 'pane', `${study} is not classified native`);
    }
  });

  check('the capability contract declares no handoff outcome', () => {
    /*
     * Supercharts has none — the audit found the handoff belongs to Voyager.
     * Declaring an outcome nothing can emit would leave a permanent zero that
     * reads as a product decision.
     */
    const outcomes = registry.EVENT_BY_NAME.get('superchart_capability_completed').properties.outcome.values;
    assert.equal(outcomes.includes('handoff'), false);
    assert.deepEqual([...outcomes].sort(), ['failure', 'fulfilled', 'no_data', 'unsupported']);
  });

  check('missing data and unsupported are separate outcomes', () => {
    const summary = charts.summariseSupercharts([
      { sessionId: 'a', eventName: 'superchart_capability_completed', properties: { outcome: 'no_data' } },
      { sessionId: 'a', eventName: 'superchart_capability_completed', properties: { outcome: 'unsupported' } },
      { sessionId: 'a', eventName: 'superchart_capability_completed', properties: { outcome: 'unsupported' } },
    ]);
    const byOutcome = Object.fromEntries(summary.capability.map((row) => [row.outcome, row.count]));
    assert.equal(byOutcome.no_data, 1);
    assert.equal(byOutcome.unsupported, 2);
  });

  check('requests count switching a study on, not off', () => {
    const summary = charts.summariseSupercharts([
      { sessionId: 'a', eventName: 'superchart_study_toggled', properties: { studyId: 'rsi', on: true } },
      { sessionId: 'a', eventName: 'superchart_study_toggled', properties: { studyId: 'rsi', on: false } },
      { sessionId: 'a', eventName: 'superchart_study_toggled', properties: { studyId: 'sma', on: true } },
    ]);
    assert.equal(summary.studyRequests, 2, 'a toggle-off counted as a request');
    assert.equal(summary.sessionsRequestingStudy, 1);

    // And none of it is a render: the engine has not reported painting anything.
    assert.equal(summary.paneActivations, 0, 'a toggle produced a render');
    assert.equal(summary.overlayActivations, 0);
    assert.equal(summary.sessionsWithStudy, 0);
  });

  check('Pine is generated, exported and previewed — never executed', () => {
    const source = readFileSync('src/components/admin-metrics/ReliabilityPanel.tsx', 'utf8');
    assert.match(source, /never executed or backtested/);
    for (const forbidden of ['scriptsRun', 'backtested:', 'scriptsExecuted']) {
      assert.equal(source.includes(forbidden), false, `the panel claims Pine is ${forbidden}`);
    }
  });

  group('Supercharts intent is never added to rendered');

  const chartEvent = (eventName, properties, sessionId = 'a') => ({ sessionId, eventName, properties });

  check('one toggle plus one applied is one request and one render', () => {
    /*
     * The defect this replaces: both events were written into the same
     * counters, so a study that was requested and then painted arrived as two
     * activations. Six applied rows became seven.
     */
    const summary = charts.summariseSupercharts([
      chartEvent('superchart_study_toggled', { studyId: 'rsi', on: true }),
      chartEvent('superchart_study_applied', { study: 'rsi', placement: 'pane', paneCount: 2 }),
    ]);

    assert.equal(summary.studyRequests, 1);
    assert.equal(summary.paneActivations, 1, 'a toggle was counted as a render');
    assert.equal(summary.overlayActivations, 0);
    assert.equal(summary.studyMix.reduce((sum, row) => sum + row.activations, 0), 1);
  });

  check('six applied rows are six renders, whatever the toggles did', () => {
    const events = [];
    for (let index = 0; index < 6; index += 1) {
      events.push(chartEvent('superchart_study_toggled', { studyId: 'rsi', on: true }, `s${index}`));
      events.push(chartEvent('superchart_study_applied', { study: 'rsi', placement: 'pane', paneCount: 2 }, `s${index}`));
    }
    events.push(chartEvent('superchart_study_toggled', { studyId: 'macd', on: true }, 's6'));

    const summary = charts.summariseSupercharts(events);
    assert.equal(summary.paneActivations, 6, 'renders did not equal applied rows');
    assert.equal(summary.studyRequests, 7, 'requests lost or gained a toggle');
  });

  check('sessions rendering a study come from the applied event alone', () => {
    const summary = charts.summariseSupercharts([
      chartEvent('superchart_study_toggled', { studyId: 'rsi', on: true }, 'asked-only'),
      chartEvent('superchart_study_applied', { study: 'sma', placement: 'overlay', paneCount: 1 }, 'rendered'),
    ]);

    assert.equal(summary.sessionsWithStudy, 1, 'a session that only asked counted as rendering');
    assert.equal(summary.sessionsRequestingStudy, 1);
    assert.equal(summary.overlayActivations, 1);
    assert.equal(summary.paneActivations, 0);
  });

  check('a toggle-off is neither a request nor a render', () => {
    const summary = charts.summariseSupercharts([
      chartEvent('superchart_study_toggled', { studyId: 'rsi', on: false }),
    ]);
    assert.equal(summary.studyRequests, 0);
    assert.equal(summary.sessionsWithStudy, 0);
  });

  check('intent stays observable in its own mix', () => {
    const summary = charts.summariseSupercharts([
      chartEvent('superchart_study_toggled', { studyId: 'macd', on: true }),
      chartEvent('superchart_study_toggled', { studyId: 'macd', on: true }),
      chartEvent('superchart_study_applied', { study: 'macd', placement: 'pane', paneCount: 2 }),
    ]);
    assert.deepEqual(summary.requestedStudyMix, [{ study: 'macd', placement: 'pane', requests: 2 }]);
    assert.deepEqual(summary.studyMix, [{ study: 'macd', placement: 'pane', activations: 1 }]);
  });

  check('the engine placement wins over the catalogue', () => {
    // They should agree; where they do not, what the engine painted is the truth.
    const summary = charts.summariseSupercharts([
      chartEvent('superchart_study_applied', { study: 'rsi', placement: 'overlay', paneCount: 1 }),
    ]);
    assert.equal(summary.overlayActivations, 1);
    assert.equal(summary.paneActivations, 0);
  });

  check('the rendered cards cite the applied event', () => {
    const panel = readFileSync('src/components/admin-metrics/ReliabilityPanel.tsx', 'utf8');
    for (const metricId of ['supercharts_study_sessions', 'supercharts_pane_activations', 'supercharts_overlay_activations']) {
      const at = panel.indexOf(`metricId: '${metricId}'`);
      assert.ok(at > -1, `${metricId} is missing`);
      const card = panel.slice(at, panel.indexOf('}}', at));
      assert.match(card, /superchart_study_applied/, `${metricId} still cites the toggle`);
    }

    const requestCard = panel.slice(
      panel.indexOf("metricId: 'supercharts_study_requests'"),
      panel.indexOf('}}', panel.indexOf("metricId: 'supercharts_study_requests'"))
    );
    assert.match(requestCard, /superchart_study_toggled/, 'the intent card lost its own source');
  });

  check('the conclusion talks about renders and states intent beside them', () => {
    const line = conclusions.superchartsConclusion({
      opens: 9,
      sessionsRenderingStudy: 4,
      paneRenders: 6,
      studyRequests: 7,
      awaitingCapabilityEmitter: false,
    });
    assert.match(line, /4 sessions where a study rendered/);
    assert.match(line, /6 renders on a separate pane/);
    assert.match(line, /7 study requests counted separately/);
    assert.match(line, /a toggle is not a render/);
  });

  check('renders are not backfilled from historical toggles', () => {
    const panel = readFileSync('src/components/admin-metrics/ReliabilityPanel.tsx', 'utf8');
    assert.match(panel, /not backfilled as rendered activity/);
  });

  group('Provenance, and the Voyager scope limitation');

  check('a missing cross-section emitter is not zero', () => {
    for (const [path, marker] of [
      ['src/lib/admin-metrics/families/reliability.ts', /this is not an absence of failures/],
      ['src/lib/admin-metrics/families/voyager.ts', /this is not an absence of usage/],
    ]) {
      assert.match(readFileSync(path, 'utf8'), marker, `${path} lost its awaiting-emitter wording`);
    }
  });

  check('the Voyager dictionary states what serverRequests does not count', () => {
    for (const id of ['voyager_real_answer_rate', 'voyager_fallback_rate', 'voyager_refusal_rate']) {
      const entry = dictionary.DICTIONARY_BY_ID.get(id);
      assert.match(
        entry.limitations.join(' '),
        /voyager\/research workspace answers some scripted scenarios locally/,
        `${id} does not state the server-request scope`
      );
    }
  });

  check('the Voyager panel says it on the page, not only in the dictionary', () => {
    const source = readFileSync('src/components/admin-metrics/VoyagerPanel.tsx', 'utf8');
    assert.match(source, /voyager\/research/);
    assert.match(source, /not a count of every/);
  });

  check('the new Phase 5 events declare no free-text property', () => {
    for (const name of [
      'web_vital_measured',
      'client_runtime_failure',
      'market_data_request_completed',
      'superchart_study_applied',
      'superchart_capability_completed',
    ]) {
      const definition = registry.EVENT_BY_NAME.get(name);
      assert.ok(definition, `${name} is not registered`);
      for (const [key, spec] of Object.entries(definition.properties)) {
        assert.ok(['enum', 'token', 'integer', 'boolean'].includes(spec.kind), `${name}.${key} is ${spec.kind}`);
      }
    }
  });

  for (const forbidden of ['symbol', 'ticker', 'instrument', 'url', 'query', 'body', 'message']) {
    check(`no Phase 5 event declares "${forbidden}"`, () => {
      for (const name of ['market_data_request_completed', 'superchart_study_applied', 'superchart_capability_completed', 'web_vital_measured']) {
        const keys = Object.keys(registry.EVENT_BY_NAME.get(name).properties).map((key) => key.toLowerCase());
        assert.equal(keys.includes(forbidden), false, `${name} declares ${forbidden}`);
      }
    });
  }

  group('The two cross-section contracts are complete and honest');

  check('both Supercharts outcome events are in the shared typed union', () => {
    /*
     * A track() call cannot be written type-safely against a union member that
     * does not exist, so these are declared before their emitters — which is
     * why check:analytics reports them as callerless until the Superchart
     * branch lands.
     */
    const union = readFileSync('src/lib/events/analytics.ts', 'utf8');
    for (const name of ['superchart_study_applied', 'superchart_capability_completed']) {
      assert.match(union, new RegExp(`name: '${name}'`), `${name} is missing from AnalyticsEvent`);
    }
  });

  check('the checker sees both declarations and no longer calls them orphans', () => {
    /*
     * The regex matches a union member on one line, so a multi-line one is
     * invisible to it — both of these were, until they were written on one line
     * like the rest. That part still matters and is still asserted.
     *
     * What changed is the expected result: the Supercharts emitter branch has
     * landed, so the two events now have real callers. Only the seven inherited
     * Start declarations remain.
     */
    let output = '';
    try {
      output = execFileSync('node', ['scripts/check-analytics.mjs'], { encoding: 'utf8', shell: process.platform === 'win32' });
    } catch (error) {
      output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    }

    assert.match(output, /61 events declared/, 'the checker is not seeing the two declarations');

    const newBlock = output.split('NEW')[1] ?? '';
    for (const name of ['superchart_study_applied', 'superchart_capability_completed']) {
      assert.equal(newBlock.includes(name), false, `${name} is still reported as unemitted`);
    }

    assert.match(output, /7 inherited/, 'the inherited baseline changed');
  });

  check('the reading layer is not counted as an emitter', () => {
    // The Observatory aggregates by name — `case 'superchart_study_applied':` —
    // and those case labels were satisfying the caller check.
    const script = readFileSync('scripts/check-analytics.mjs', 'utf8');
    assert.match(script, /admin-metrics/, 'the reading layer is still counted as a caller');
  });

  check('the union payload and the registry shape agree', () => {
    for (const [name, expected] of [
      ['superchart_study_applied', ['paneCount', 'placement', 'study']],
      ['superchart_capability_completed', ['capability', 'hasVolume', 'outcome', 'paneCount']],
    ]) {
      const definition = registry.EVENT_BY_NAME.get(name);
      assert.ok(definition, `${name} is not registered`);
      assert.deepEqual(Object.keys(definition.properties).sort(), expected, name);
    }

    const union = readFileSync('src/lib/events/analytics.ts', 'utf8');
    assert.match(union, /'fulfilled' \| 'no_data' \| 'unsupported' \| 'failure'/);
    assert.equal(union.includes("'handoff'"), false, 'a handoff outcome reappeared in the union');
  });

  check('market copy claims a resolution, never an upstream request count', () => {
    /*
     * The client fetches through Next's data cache and cache resolution is
     * transparent at that layer, so it cannot know whether anything left the
     * machine. An earlier draft told Markets not to emit on a cache hit, which
     * was impossible to implement.
     */
    const panel = readFileSync('src/components/admin-metrics/ReliabilityPanel.tsx', 'utf8');
    assert.match(panel, /Market data resolutions/);
    assert.match(panel, /Successful resolutions/);
    assert.equal(/label="Provider requests"/.test(panel), false, 'the panel still claims provider requests');

    const definition = registry.EVENT_BY_NAME.get('market_data_request_completed');
    assert.match(definition.note, /NOT proof that a request reached the provider/);
  });

  check('the Markets request documents the transparent cache and withdraws the old rule', () => {
    const request = readFileSync('docs/admin-metrics/market-data-instrumentation-request.md', 'utf8');
    assert.match(request, /Emit once per invocation, always/);
    assert.match(request, /cache resolution is\s*\n?transparent/);
    assert.equal(
      request.includes('If a cached value is returned without a provider call, **do not emit**'),
      false,
      'the impossible cache requirement is still in the document'
    );
    assert.match(request, /client resolution latency at this call site/);
  });

  check('the Markets request follows the code rather than an idealised parser', () => {
    const request = readFileSync('docs/admin-metrics/market-data-instrumentation-request.md', 'utf8');
    // asOf has a fallback, so a missing datetime was never a no-data condition.
    assert.match(request, /`asOf` is never missing/);
    assert.match(request, /data\?\.status === 'error'/);
    assert.equal(request.includes('a missing `datetime`, a response the parser rejects'), false);
    assert.match(request, /Do not invent `rate_limited`/);
  });

  check('both requests state the sequencing rather than creating a branch dependency', () => {
    for (const path of [
      'docs/admin-metrics/market-data-instrumentation-request.md',
      'docs/admin-metrics/supercharts-instrumentation-request.md',
    ]) {
      const request = readFileSync(path, 'utf8');
      assert.match(request, /only after Metrics Phase 5 is on `main`/, `${path} has no sequencing`);
      assert.match(request, /Do not merge `feat\/metrics` into your branch/, `${path} invites a cross-branch merge`);
    }
    assert.match(
      readFileSync('docs/admin-metrics/supercharts-instrumentation-request.md', 'utf8'),
      /do not edit either\s*\n?file/,
      'the Supercharts request does not say to leave the Metrics files alone'
    );
  });

  /* ================================== Phase 6 — presentation, not new numbers */

  group('Conclusions restate a number and never explain it');

  check('the pulse line says what happened, with the rate when there is one', () => {
    const line = conclusions.pulseConclusion({
      eligibleSessions: { state: 'live', value: 412, sample: 412 },
      pmcr: { state: 'derived', value: 0.184, sample: 412 },
      collectingSince: '2026-08-10T00:00:00.000Z',
    });
    assert.match(line, /412 eligible sessions/);
    assert.match(line, /18\.4%/);
  });

  check('a below-threshold rate produces a count and an explanation, never 0%', () => {
    const line = conclusions.pulseConclusion({
      eligibleSessions: { state: 'live', value: 6, sample: 6 },
      pmcr: { state: 'insufficient_sample', sample: 6 },
      collectingSince: '2026-08-10T00:00:00.000Z',
    });
    assert.match(line, /below the threshold/);
    assert.equal(line.includes('0%'), false, 'an insufficient sample was rendered as a percentage');
  });

  check('no telemetry at all says so rather than reporting nothing', () => {
    const line = conclusions.pulseConclusion({
      eligibleSessions: { state: 'live', value: 0, sample: 0 },
      pmcr: { state: 'insufficient_sample', sample: 0 },
      collectingSince: null,
    });
    assert.match(line, /No telemetry has arrived yet/);
  });

  check('a missing Voyager emitter reads as an unfinished hand-off, not an unused feature', () => {
    const line = conclusions.voyagerConclusion({
      awaitingEmitter: true,
      requests: { state: 'not_measurable' },
      realAnswerRate: { state: 'not_measurable' },
      realAnswers: { state: 'not_measurable' },
      simulatedFallbacks: { state: 'not_measurable' },
      integrityViolations: 0,
    });
    assert.match(line, /not an unused feature/);
  });

  check('a quota integrity failure outranks every other Voyager sentence', () => {
    const line = conclusions.voyagerConclusion({
      awaitingEmitter: false,
      requests: { state: 'live', value: 100, sample: 100 },
      realAnswerRate: { state: 'derived', value: 0.9, sample: 100 },
      realAnswers: { state: 'live', value: 90, sample: 90 },
      simulatedFallbacks: { state: 'live', value: 10, sample: 10 },
      integrityViolations: 3,
    });
    assert.match(line, /Quota integrity failure/);
    assert.equal(line.includes('90.0%'), false, 'a rate was published above a contract violation');
  });

  check('the market line never claims an upstream request count', () => {
    const line = conclusions.marketConclusion({
      quotesConfigured: true,
      macroConfigured: true,
      awaitingEmitter: false,
      requests: { state: 'live', value: 40, sample: 40 },
      providerErrors: { state: 'live', value: 2, sample: 2 },
    });
    assert.match(line, /40 resolutions/);
    for (const forbidden of ['network request', 'provider request', 'upstream request']) {
      assert.equal(line.includes(forbidden), false, `the conclusion says "${forbidden}"`);
    }
  });

  check('Supercharts never describes a toggle as a render', () => {
    const awaiting = conclusions.superchartsConclusion({
      opens: 12,
      sessionsRenderingStudy: 4,
      paneRenders: 3,
      studyRequests: 5,
      awaitingCapabilityEmitter: true,
    });
    assert.match(awaiting, /a toggle is not a render/);
    assert.match(awaiting, /Capability outcomes are instrumented going forward/);

    const landed = conclusions.superchartsConclusion({
      opens: 12,
      sessionsRenderingStudy: 4,
      paneRenders: 3,
      studyRequests: 5,
      awaitingCapabilityEmitter: false,
    });
    assert.match(landed, /4 sessions where a study rendered/);
    assert.equal(landed.includes('Capability outcomes'), false);
  });

  check('the monetization line pluralises a noun, not a phrase', () => {
    const many = conclusions.monetizationConclusion({
      paidRecords: { state: 'live', value: 20, sample: 20 },
      demoRecords: { state: 'live', value: 4, sample: 4 },
      reconciled: { state: 'live', value: 16, sample: 16 },
    });
    assert.equal(many.includes('a providers'), false, `ungrammatical: ${many}`);
    assert.match(many, /16 records reconciled against a payment provider/);

    const one = conclusions.monetizationConclusion({
      paidRecords: { state: 'live', value: 1, sample: 1 },
      demoRecords: { state: 'live', value: 1, sample: 1 },
      reconciled: { state: 'live', value: 1, sample: 1 },
    });
    assert.match(one, /1 record reconciled against a payment provider/);
    assert.equal(one.includes('1 records'), false);
  });

  check('monetization never calls a paid row revenue', () => {
    const line = conclusions.monetizationConclusion({
      paidRecords: { state: 'live', value: 7, sample: 7 },
      demoRecords: { state: 'live', value: 21, sample: 21 },
      reconciled: { state: 'live', value: 0, sample: 0 },
    });
    assert.match(line, /confirmed revenue has no source/);
    assert.match(line, /7 paid-status records/);
  });

  check('the coverage line distinguishes a bad number from no measurement', () => {
    const line = conclusions.coverageConclusion([
      { state: 'not_measurable', metrics: 3 },
      { state: 'insufficient_sample', metrics: 5 },
      { state: 'live', metrics: 9 },
    ]);
    assert.match(line, /3 not measurable/);
    assert.match(line, /5 below sample threshold/);
    assert.match(line, /None of these is a zero/);
  });

  check('a section with nothing to say says nothing', () => {
    assert.equal(conclusions.coverageConclusion([{ state: 'live', metrics: 9 }]), null);
    assert.equal(conclusions.journeyConclusion({ byLandingSurface: [], exclusions: {}, eligibleSessions: 0 }), null);
  });

  check('no conclusion speculates about a cause', () => {
    /*
     * The line this file is not allowed to cross. Every sentence restates a
     * number; none of them explains one.
     */
    const lines = [
      conclusions.pulseConclusion({
        eligibleSessions: { state: 'live', value: 412, sample: 412 },
        pmcr: { state: 'derived', value: 0.184, sample: 412 },
        collectingSince: '2026-08-10T00:00:00.000Z',
      }),
      conclusions.voyagerConclusion({
        awaitingEmitter: false,
        requests: { state: 'live', value: 100, sample: 100 },
        realAnswerRate: { state: 'derived', value: 0.72, sample: 100 },
        realAnswers: { state: 'live', value: 72, sample: 72 },
        simulatedFallbacks: { state: 'live', value: 28, sample: 28 },
        integrityViolations: 0,
      }),
      conclusions.marketConclusion({
        quotesConfigured: true,
        macroConfigured: false,
        awaitingEmitter: true,
        requests: { state: 'not_measurable' },
        providerErrors: { state: 'not_measurable' },
      }),
    ].join(' ');

    for (const speculation of ['because', 'suggests', 'likely', 'probably', 'users love', 'improved', 'due to']) {
      assert.equal(lines.toLowerCase().includes(speculation), false, `a conclusion says "${speculation}"`);
    }
  });

  group('Presentation mode is a lens, not a second dashboard');

  check('the shell toggles an attribute and never touches a value', () => {
    const shell = readFileSync('src/components/admin-metrics/ObservatoryShell.tsx', 'utf8');
    assert.match(shell, /data-mode=\{presenting \? 'presentation' : 'detail'\}/);
    // A lens with no access to the numbers cannot flatter them.
    assert.equal(/metric/i.test(shell.replace(/\/\*[\s\S]*?\*\//g, '')), false, 'the shell reads metric values');
  });

  check('presentation mode is keyboard-exitable', () => {
    const shell = readFileSync('src/components/admin-metrics/ObservatoryShell.tsx', 'utf8');
    assert.match(shell, /event\.key === 'Escape'/);
    assert.match(shell, /aria-pressed=\{presenting\}/);
  });

  check('presentation mode hides detail without hiding a limitation', () => {
    const css = readFileSync('src/components/admin-metrics/Observatory.module.css', 'utf8');
    assert.match(css, /\.shell\[data-mode='presentation'\] \.detail \{\s*display: none/);
    // The reason a number is absent must survive at full size.
    assert.match(css, /\.shell\[data-mode='presentation'\] \.cardAbsent/);
    assert.equal(
      /\.shell\[data-mode='presentation'\] \.cardAbsent \{\s*display: none/.test(css),
      false,
      'presentation mode hides the reason a metric is missing'
    );
  });

  check('there is one dashboard, not two', () => {
    // A presentation variant that re-queried would eventually disagree with the
    // detail view about the same number.
    const page = readFileSync('src/app/[locale]/admin_admin_metrics/page.tsx', 'utf8');
    assert.equal((page.match(/await Promise\.all\(/g) ?? []).length, 1, 'the page fetches more than once');
    assert.match(page, /<ObservatoryShell/);
  });

  group('The page tells a product story before a database story');

  check('sections appear in the agreed order', () => {
    const page = readFileSync('src/app/[locale]/admin_admin_metrics/page.tsx', 'utf8');
    const order = ['"pulse"', '"journeys"', '"surfaces"', '"voyager"', '"supercharts"', '"market-data"', '"reliability"', '"monetization"', '"coverage"'];
    let cursor = 0;
    for (const id of order) {
      const at = page.indexOf(`id=${id}`, cursor);
      assert.ok(at > -1, `section ${id} is missing`);
      cursor = at;
    }
  });

  check('the headline row carries no metric whose source is unconnected', () => {
    const page = readFileSync('src/app/[locale]/admin_admin_metrics/page.tsx', 'utf8');
    const headline = page.slice(page.indexOf('styles.headline'), page.indexOf('</Section>'));
    assert.equal(headline.includes('confirmedRevenue'), false, 'revenue reached the headline without a source');
  });

  check('every rate on the page names its denominator', () => {
    const page = readFileSync('src/app/[locale]/admin_admin_metrics/page.tsx', 'utf8');
    for (const [start, end] of [...page.matchAll(/<MetricCard[\s\S]*?\/>/g)].map((m) => [m.index, m.index + m[0].length])) {
      const card = page.slice(start, end);
      if (!card.includes('format="percent"')) continue;
      assert.match(card, /\bof=/, `a percentage card has no denominator: ${card.slice(0, 80)}`);
    }
  });

  check('no decorative period-over-period delta was invented', () => {
    const page = readFileSync('src/app/[locale]/admin_admin_metrics/page.tsx', 'utf8');
    const shell = readFileSync('src/components/admin-metrics/ObservatoryShell.tsx', 'utf8');
    assert.match(shell, /no previous-period comparison exists/);
    for (const fake of ['vs previous', 'vs last', '+12%', 'trend up', 'trendUp']) {
      assert.equal(page.includes(fake), false, `the page shows "${fake}"`);
    }
  });

  check('the obsolete five-plan vocabulary appears nowhere', () => {
    /*
     * The subscriptions lineup is Free / Plus / Pro / Private now, and the
     * Observatory reads entitlements from the server model at runtime rather
     * than naming any of them.
     */
    for (const path of [
      'src/app/[locale]/admin_admin_metrics/page.tsx',
      'src/components/admin-metrics/ReliabilityPanel.tsx',
      'src/components/admin-metrics/VoyagerPanel.tsx',
      'src/lib/admin-metrics/conclusions.ts',
    ]) {
      const source = readFileSync(path, 'utf8');
      for (const stale of ['Essential', 'Ultimate', 'Voyager Private plan']) {
        assert.equal(source.includes(stale), false, `${path} mentions ${stale}`);
      }
    }
  });

  check('cards state their meaning in words, not by colour alone', () => {
    const card = readFileSync('src/components/admin-metrics/MetricCard.tsx', 'utf8');
    assert.match(card, /metric\.state\.replace/, 'the state is not spelled out on the card');
    const css = readFileSync('src/components/admin-metrics/Observatory.module.css', 'utf8');
    // Absent states also differ by border style, so colour is never the only cue.
    assert.match(css, /border-style: dashed/);
  });

  check('the Voyager scope limitation survives into presentation mode', () => {
    const panel = readFileSync('src/components/admin-metrics/VoyagerPanel.tsx', 'utf8');
    assert.match(panel, /voyager\/research/);
    // It is a note, and notes are quieted rather than hidden.
    const css = readFileSync('src/components/admin-metrics/Observatory.module.css', 'utf8');
    assert.equal(
      /\.shell\[data-mode='presentation'\] \.note \{[^}]*display: none/.test(css),
      false,
      'presentation mode hides section notes'
    );
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

        /*
         * Polled, not slept. The tracker is fire-and-forget, so the write trails
         * the response by an unknown amount — and a fixed wait made this fail
         * once and pass on a rerun, which teaches people to rerun rather than to
         * read. Waiting for the row is both faster in the common case and
         * honest in the slow one.
         */
        const written = await until(
          async () => (await readSentinel()).find((row) => row.event_name === 'telemetry_ingest_rejected'),
          10_000
        );

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

      await checkAsync('the product families endpoint keeps behaviour and facts apart', async () => {
        const token = await mintToken();
        const response = await fetch(`${BASE}/api/admin-metrics/products`, {
          headers: { cookie: `tn_metrics_access=${token}` },
        });
        const body = await response.json();

        assert.equal(response.status, 200);

        // Behaviour is a funnel; facts are tables. Both present, neither merged.
        assert.equal(body.start.sourceType, 'telemetry');
        assert.ok(Array.isArray(body.start.funnel.stages));
        assert.deepEqual(body.events.sources, ['event_registration', 'event']);
        assert.ok(body.events.funnel, 'the Events family lost its behavioural funnel');

        // Every durable metric names its own table, never "the database".
        for (const family of ['events', 'academy', 'experts', 'saves', 'commerce', 'accounts']) {
          for (const [key, metric] of Object.entries(body[family].metrics)) {
            assert.ok(metric.source, `${family}.${key} has no source`);
            assert.notEqual(metric.source, 'database', `${family}.${key} is vague about its source`);
          }
        }

        assert.equal(body.commerce.metrics.confirmedRevenue.state, 'source_not_connected');
        assert.equal('value' in body.commerce.metrics.confirmedRevenue, false);
      });

      await checkAsync('every serialized metric says what kind of evidence produced it', async () => {
        /*
         * The type now requires `sourceType`, but a required field only proves
         * the code compiles. This proves it survived serialization on every
         * endpoint — a metric reaching the Observatory without saying whether it
         * is behaviour, a business fact or a calculation is the thing the
         * contract exists to prevent.
         */
        const token = await mintToken();
        const bodies = await Promise.all(
          ['products', 'journeys', 'retention', 'overview'].map((endpoint) =>
            fetch(`${BASE}/api/admin-metrics/${endpoint}`, {
              headers: { cookie: `tn_metrics_access=${token}` },
            }).then((response) => response.json())
          )
        );

        const offenders = [];
        const walk = (node, path) => {
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node)) return node.forEach((item, index) => walk(item, `${path}[${index}]`));

          /* A MetricValue is recognisable: a state, a source and a metric id. */
          const looksLikeMetric =
            typeof node.state === 'string' &&
            typeof node.source === 'string' &&
            typeof node.metricId === 'string';

          if (looksLikeMetric && !node.sourceType) offenders.push(`${path} (${node.metricId})`);

          for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`);
        };

        bodies.forEach((body, index) => walk(body, ['products', 'journeys', 'retention', 'overview'][index]));

        assert.deepEqual(offenders, [], `metrics without a source type: ${offenders.join(', ')}`);
      });

      await checkAsync('no serialized product payload carries a private field', async () => {
        /*
         * The check that matters, and the reason it is here rather than in the
         * unit half: a TypeScript declaration says what a function intends to
         * return, and this says what actually crossed the wire. Every one of
         * these lives a column away from something the Observatory does read.
         */
        const token = await mintToken();
        const bodies = await Promise.all(
          ['products', 'journeys', 'retention', 'overview', 'coverage'].map((endpoint) =>
            fetch(`${BASE}/api/admin-metrics/${endpoint}`, {
              headers: { cookie: `tn_metrics_access=${token}` },
            }).then((response) => response.json())
          )
        );

        /*
         * Field names and data values, not documentation.
         *
         * These payloads deliberately carry prose that *names* the fields they
         * refuse to read — "name, email, company … are never selected" — and a
         * naive substring scan over the raw text flags exactly the sentence
         * that proves the rule is being kept. So the walk skips the explanatory
         * keys and checks everything else: a private value or a private field
         * name is still caught, an honest limitation is not.
         */
        const DOCUMENTATION_KEYS = new Set([
          'limitations',
          'note',
          'timeSemantics',
          'eligiblePopulation',
          'exclusions',
          'formula',
          'numerator',
          'denominator',
          'reason',
          'wouldRequire',
          'missingSource',
        ]);

        const keys = [];
        const values = [];
        const walk = (node) => {
          if (node === null || node === undefined) return;
          if (Array.isArray(node)) return node.forEach(walk);
          if (typeof node === 'object') {
            for (const [key, value] of Object.entries(node)) {
              keys.push(key);
              if (!DOCUMENTATION_KEYS.has(key)) walk(value);
            }
            return;
          }
          if (typeof node === 'string') values.push(node);
        };

        bodies.forEach(walk);

        /*
         * A few words are only dangerous as a field name. `diagnostic` is an
         * Academy *stage* — `landing | diagnostic | path | …` — so it is a
         * legitimate distribution value, while a key called `diagnostic` would
         * be the answers themselves.
         */
        const exactKeys = new Set(keys.map((key) => key.toLowerCase()));

        for (const forbidden of [
          'diagnostic', 'answers', 'ref', 'title', 'subtitle', 'description', 'name', 'email',
        ]) {
          /*
           * Exact, not substring. `refunded` and `subscriptionsWithProviderRef`
           * are legitimate and would both trip a `includes('ref')` test — and a
           * privacy check that cries wolf is one somebody eventually loosens
           * until it stops catching anything.
           */
          assert.equal(exactKeys.has(forbidden), false, `a response exposed a "${forbidden}" field`);
        }

        const payload = [...keys, ...values].join('\n');

        for (const forbidden of [
          'email', 'attendee', 'company', 'experienceLevel', 'briefEnc', 'brief_enc',
          'summaryEnc', 'summary_enc', 'noteEnc', 'note_enc', 'nameEnc', 'name_enc',
          'valueEnc', 'value_enc', 'balanceEnc', 'balance_enc', 'targetEnc', 'target_enc',
          'detailsEnc', 'metaEnc', 'termsEnc', 'dataKeyEnc', 'ipAddress', 'ip_address',
          'userAgent', 'user_agent', 'meetingUrl', 'joinUrl',
          'netWorth', 'portfolioValue', 'sharedContext',
        ]) {
          assert.equal(payload.includes(forbidden), false, `a response carried "${forbidden}"`);
        }

        // No raw identifier of any kind: not a user id, not a session id.
        assert.equal(/"userId"/.test(payload), false, 'a response carried a user id');
        assert.equal(/s_[0-9a-f]{32}/.test(payload), false, 'a response carried a session id');
        assert.equal(/u_[0-9a-f]{32}/.test(payload), false, 'a response carried a user key');
      });

      await checkAsync('coverage separates behaviour from durable facts per family', async () => {
        const token = await mintToken();
        const response = await fetch(`${BASE}/api/admin-metrics/coverage`, {
          headers: { cookie: `tn_metrics_access=${token}` },
        });
        const body = await response.json();

        assert.ok(body.families.length >= 8);

        const wealth = body.families.find((family) => family.family === 'wealth');
        assert.ok(wealth.durableSources.includes('wealth_asset'));

        // A durable source is not evidence that the funnel is instrumented.
        const saves = body.families.find((family) => family.family === 'saves');
        assert.equal(saves.telemetryEvents, 0);
        assert.equal(saves.verdict, 'facts_only');
      });

      await checkAsync('the dictionary is served rather than restated in the page', async () => {
        const token = await mintToken();
        const response = await fetch(`${BASE}/api/admin-metrics/dictionary`, {
          headers: { cookie: `tn_metrics_access=${token}` },
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.ok(body.metrics.length >= 15);
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

/**
 * Waits for something to become true, rather than guessing how long it takes.
 *
 * Returns the first truthy result, or undefined once the budget is spent — the
 * caller asserts on it, so a genuine failure still fails and a slow write does
 * not.
 */
async function until(probe, budgetMs, everyMs = 250) {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const result = await probe();
    if (result) return result;
    if (Date.now() >= deadline) return undefined;
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
}

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
    // By prefix, not by this run's id: an interrupted earlier run may have left
    // rows behind, and leaving them would corrupt the numbers this dashboard
    // exists to prove.
    const removed = await withSql(
      (sql) => sql`delete from product_telemetry_event where session_id like ${`${SENTINEL_PREFIX}%`} returning id`
    );
    if (removed.length) console.log(`\n  cleaned up ${removed.length} verification rows`);
  } catch (error) {
    console.log(`\n  WARNING could not clean up verification rows: ${String(error.message ?? error).split('\n')[0]}`);
    console.log(`          remove them with: delete from product_telemetry_event where session_id like '${SENTINEL_PREFIX}%';`);
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
