import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

/**
 * The market-data health emitter, checked at its riskiest points.
 *
 * `src/lib/market/client.ts` now reports how each call resolved, and the whole
 * value of that report is that it never costs a price. So the checks here are
 * about what must NOT have changed — the returned value, the null on failure,
 * the caller never waiting on a telemetry write — plus the two claims a
 * dashboard cannot verify for itself: that no symbol travels, and that a batch
 * counts once.
 *
 * The repository has no unit test runner, and `scripts/test-events.mjs` belongs
 * to the Events section, so this follows the same convention that file
 * established: compile the module with the TypeScript already in
 * devDependencies, then exercise it. Its three imports are rewritten in the
 * emitted JavaScript — `server-only` dropped, the analytics helper pointed at a
 * recorder, and the freshness helper left as the real one, because "the central
 * helper is used" is one of the things being proved.
 *
 * No network. The provider is a stub in every case.
 *
 *   node scripts/verify-markets-telemetry.mjs
 */

const out = mkdtempSync(join(tmpdir(), 'tn-market-telemetry-'));
let passed = 0;
let failed = 0;

process.on('uncaughtException', (error) => {
  console.error('\nThe test build failed:\n', error);
  rmSync(out, { recursive: true, force: true });
  process.exit(1);
});

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${error.message.split('\n')[0]}`);
  }
}

function group(title) {
  console.log(`\n${title}`);
}

try {
  /*
   * Compiled on its own, so tsc sees neither the project's `paths` nor its
   * ambient types and reports the imports and `process` as unresolved. Those
   * diagnostics are an artefact of compiling one file in isolation — the real
   * type gate is `npx tsc --noEmit`, which runs separately and is green — so
   * the exit code is ignored here and a missing output is what counts as a
   * failure.
   */
  try {
    execFileSync(
      'npx',
      [
        'tsc',
        'src/lib/market/client.ts',
        'src/lib/admin-metrics/freshness.ts',
        '--outDir',
        out,
        '--module',
        'esnext',
        '--target',
        'es2022',
        '--moduleResolution',
        'bundler',
        '--skipLibCheck',
        '--noResolve',
      ],
      { stdio: 'pipe', shell: process.platform === 'win32' }
    );
  } catch {
    /* Diagnostics only; the emit below is what matters. */
  }

  const find = (dir, name) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        const hit = find(path, name);
        if (hit) return hit;
      } else if (entry.name === `${name}.js`) {
        return path;
      }
    }
    return null;
  };

  const clientPath = find(out, 'client');
  const freshnessPath = find(out, 'freshness');
  if (!clientPath || !freshnessPath) throw new Error('the market client did not compile');

  /* ------------------------------------------------ the analytics recorder */

  const recorderPath = join(out, 'analytics-recorder.mjs');
  writeFileSync(
    recorderPath,
    `export const emitted = [];
     export let onTrack = () => {};
     export function setOnTrack(fn) { onTrack = fn; }
     export function trackServerEvent(input) {
       emitted.push(structuredClone(input));
       onTrack(input);
     }
    `,
    'utf8'
  );

  /*
   * tsc leaves import specifiers alone, so the emitted file still asks for
   * `@/…`, which Node's loader cannot answer. Rewriting them here — rather than
   * mapping them at compile time — keeps the real freshness module in the graph
   * instead of a copy of it.
   */
  const toSpecifier = (from, to) => {
    const path = relative(join(from, '..'), to).replace(/\\/g, '/');
    return path.startsWith('.') ? path : `./${path}`;
  };

  writeFileSync(
    clientPath,
    readFileSync(clientPath, 'utf8')
      .replace(/^import 'server-only';\s*$/m, '')
      .replace(
        /'@\/lib\/admin-metrics\/freshness'/g,
        `'${toSpecifier(clientPath, freshnessPath)}'`
      )
      .replace(
        /'@\/lib\/analytics\/server'/g,
        `'${toSpecifier(clientPath, recorderPath)}'`
      ),
    'utf8'
  );

  const client = await import(pathToFileURL(clientPath).href);
  const recorder = await import(pathToFileURL(recorderPath).href);
  const { freshnessOf } = await import(pathToFileURL(freshnessPath).href);

  /* --------------------------------------------------------------- harness */

  const KEYED = ['source', 'kind', 'outcome', 'delayed', 'durationMs', 'hasVolume', 'freshnessBucket'];

  /** Everything a stubbed run produced: the answer, and the rows it emitted. */
  async function run(fn, { quotesKey = 'test-quote-key', macroKey = 'test-macro-key', fetch } = {}) {
    recorder.emitted.length = 0;
    recorder.setOnTrack(() => {});

    if (quotesKey) process.env.TWELVE_DATA_API_KEY = quotesKey;
    else delete process.env.TWELVE_DATA_API_KEY;
    if (macroKey) process.env.FRED_API_KEY = macroKey;
    else delete process.env.FRED_API_KEY;

    globalThis.fetch = fetch ?? (() => { throw new Error('the test made no provider available'); });

    const result = await fn();
    return { result, events: recorder.emitted.map((event) => event) };
  }

  const ok = (body) => async () => ({ ok: true, json: async () => body });
  /*
   * A full ISO instant, deliberately. The vendor's own `datetime` is sometimes
   * `2026-08-11 12:34:56` with no zone, which Node reads as local time — so a
   * fixture in that shape would move the expected bucket by the offset of
   * whichever machine ran the test and prove nothing about the helper. The
   * helper accepts either shape; the test picks the unambiguous one.
   */
  const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

  const quotePayload = (datetime) => ({
    symbol: 'AAPL',
    name: 'Apple Inc',
    close: '231.40',
    change: '1.20',
    percent_change: '0.52',
    currency: 'USD',
    exchange: 'NASDAQ',
    datetime,
  });

  const barRows = (count) =>
    Array.from({ length: count }, (_, index) => {
      const day = new Date(Date.UTC(2026, 0, 5) + index * 86_400_000);
      return {
        datetime: day.toISOString().slice(0, 10),
        open: '10.0',
        high: '11.0',
        low: '9.0',
        close: '10.5',
        volume: '1000',
      };
    }).reverse();

  /* ------------------------------------- 1. a missing key is not a failure */

  group('A missing key says so, and still answers null');

  const noKey = await run(() => client.getQuote('AAPL'), { quotesKey: null });
  check('getQuote still returns null', () => assert.equal(noKey.result, null));
  check('and emits exactly one event', () => assert.equal(noKey.events.length, 1));
  check('classified not_configured', () =>
    assert.equal(noKey.events[0].properties.outcome, 'not_configured'));
  check('against the right provider and operation', () => {
    assert.equal(noKey.events[0].properties.source, 'twelve_data');
    assert.equal(noKey.events[0].properties.kind, 'quote');
  });
  check('with no observation to claim', () =>
    assert.equal(noKey.events[0].properties.freshnessBucket, 'unknown'));
  check('and no provider call was attempted', () =>
    assert.equal(noKey.events[0].name, 'market_data_request_completed'));

  const noMacroKey = await run(() => client.getMacroSeries('CPIAUCSL'), { macroKey: null });
  check('getMacroSeries too, against fred', () => {
    assert.equal(noMacroKey.result, null);
    assert.equal(noMacroKey.events.length, 1);
    assert.equal(noMacroKey.events[0].properties.source, 'fred');
    assert.equal(noMacroKey.events[0].properties.outcome, 'not_configured');
  });

  /* ---------------------------------------------- 2. the provider misbehaves */

  group('A provider failure keeps the existing product behaviour');

  const thrown = await run(() => client.getQuote('AAPL'), {
    fetch: async () => { throw new Error('ECONNRESET'); },
  });
  check('a thrown request still returns null', () => assert.equal(thrown.result, null));
  check('and emits provider_error', () =>
    assert.equal(thrown.events[0].properties.outcome, 'provider_error'));

  const notOk = await run(() => client.getQuote('AAPL'), {
    fetch: async () => ({ ok: false, status: 502, json: async () => ({}) }),
  });
  check('a non-OK response is provider_error as well', () => {
    assert.equal(notOk.result, null);
    assert.equal(notOk.events[0].properties.outcome, 'provider_error');
  });

  /*
   * The vendor answers 200 with a status field for both a spent rate limit and
   * an unknown ticker. Telling them apart would mean reading `data.message`,
   * which is a provider body — so one honest bucket, not two guessed ones.
   */
  const statusError = await run(() => client.getQuote('NOPE'), {
    fetch: ok({ status: 'error', code: 429, message: 'API credits exceeded' }),
  });
  check('a 200 with status:error is no_data, not provider_error', () => {
    assert.equal(statusError.result, null);
    assert.equal(statusError.events[0].properties.outcome, 'no_data');
  });
  check('and the vendor message is nowhere in the row', () =>
    assert.equal(JSON.stringify(statusError.events[0]).includes('credits'), false));

  const shortSeries = await run(() => client.getSeries('AAPL'), {
    fetch: ok({ meta: { symbol: 'AAPL' }, values: barRows(12) }),
  });
  check('too few bars to draw is no_data, not a success returning null', () => {
    assert.equal(shortSeries.result, null);
    assert.equal(shortSeries.events[0].properties.outcome, 'no_data');
  });

  /* ------------------------------------------ 3. success preserves the answer */

  group('A success is unchanged, and dated by the central helper');

  const datetime = minutesAgo(25);
  const success = await run(() => client.getQuote('AAPL'), {
    fetch: ok(quotePayload(datetime)),
  });

  check('the quote is exactly what it was before instrumentation', () =>
    assert.deepEqual(success.result, {
      symbol: 'AAPL',
      name: 'Apple Inc',
      price: 231.4,
      change: 1.2,
      changePercent: 0.52,
      currency: 'USD',
      exchange: 'NASDAQ',
      asOf: datetime,
      delayed: true,
    }));
  check('one event, outcome success', () => {
    assert.equal(success.events.length, 1);
    assert.equal(success.events[0].properties.outcome, 'success');
  });
  check('the delayed flag is the one the function already set', () =>
    assert.equal(success.events[0].properties.delayed, true));

  /*
   * Twenty-five minutes old is the discriminating case. `delayed_expected` is a
   * bucket no wall-clock threshold in this repository produces — it exists only
   * because `freshnessOf` knows the free tier's fifteen-minute delay is policy
   * rather than a fault. Reading it here is the proof that the shared helper,
   * and not a local subtraction, produced the value.
   */
  check('freshness is delayed_expected, which only freshnessOf produces', () =>
    assert.equal(success.events[0].properties.freshnessBucket, 'delayed_expected'));
  check('and it matches freshnessOf called directly', () =>
    assert.equal(
      success.events[0].properties.freshnessBucket,
      freshnessOf('quote', new Date(datetime), new Date())
    ));

  const fresh = await run(() => client.getQuote('AAPL'), {
    fetch: ok(quotePayload(minutesAgo(3))),
  });
  check('a three-minute-old quote is current', () =>
    assert.equal(fresh.events[0].properties.freshnessBucket, 'current'));

  check('durationMs is a non-negative integer', () => {
    const { durationMs } = success.events[0].properties;
    assert.equal(Number.isInteger(durationMs), true);
    assert.equal(durationMs >= 0, true);
  });

  /* ------------------------------------------------------- 4. bars and volume */

  group('Bars report whether a volume pane could be drawn');

  const withVolume = await run(() => client.getBars('AAPL'), {
    fetch: ok({ values: barRows(40) }),
  });
  check('the bars come back unchanged', () => {
    assert.equal(Array.isArray(withVolume.result), true);
    assert.equal(withVolume.result.length, 40);
    assert.equal(withVolume.result[0].volume, 1000);
  });
  check('hasVolume is true', () =>
    assert.equal(withVolume.events[0].properties.hasVolume, true));

  const withoutVolume = await run(() => client.getBars('AAPL'), {
    fetch: ok({ values: barRows(40).map(({ volume, ...row }) => row) }),
  });
  check('and false when the vendor sent none', () => {
    assert.equal(withoutVolume.result.length, 40);
    assert.equal(withoutVolume.events[0].properties.hasVolume, false);
  });
  check('a failed bars call reports hasVolume false without meaning failure', () => {
    assert.equal(withoutVolume.events[0].properties.outcome, 'success');
  });

  /* ------------------------------------------------------ 5. batch counts once */

  group('A batch is one observation, however many instruments it held');

  const symbols = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META'];
  const batch = await run(() => client.getQuotes(symbols), {
    fetch: ok(Object.fromEntries(symbols.map((s) => [s, quotePayload(minutesAgo(25))]))),
  });

  check('six symbols produce six quotes', () =>
    assert.equal(Object.keys(batch.result).length, 6));
  check('and exactly one event', () => assert.equal(batch.events.length, 1));
  check('of kind quotes_batch', () =>
    assert.equal(batch.events[0].properties.kind, 'quotes_batch'));
  check('the count is not multiplied by the instruments asked for', () =>
    assert.equal(batch.events.length < symbols.length, true));

  const emptyBatch = await run(() => client.getQuotes([]), { fetch: ok({}) });
  check('an empty list asks for nothing and reports nothing', () => {
    assert.deepEqual(emptyBatch.result, {});
    assert.equal(emptyBatch.events.length, 0);
  });

  const batchNoKey = await run(() => client.getQuotes(symbols), { quotesKey: null });
  check('but a missing key is still reported for a batch', () => {
    assert.deepEqual(batchNoKey.result, {});
    assert.equal(batchNoKey.events.length, 1);
    assert.equal(batchNoKey.events[0].properties.outcome, 'not_configured');
  });

  /* ------------------------------------------------------------- 6. macro */

  group('Macro claims no staleness, and never carries the series id');

  const macro = await run(() => client.getMacroSeries('CPIAUCSL'), {
    fetch: async (url) =>
      String(url).includes('/series/observations')
        ? { ok: true, json: async () => ({ observations: [
            { date: '2026-07-01', value: '324.1' },
            { date: '2026-06-01', value: '323.4' },
            { date: '2025-07-01', value: '315.0' },
          ] }) }
        : { ok: true, json: async () => ({ seriess: [
            { title: 'Consumer Price Index', units_short: 'Index', last_updated: '2026-08-10 08:31:02-05' },
          ] }) },
  });

  check('the series is returned', () => assert.equal(macro.result?.seriesId, 'CPIAUCSL'));
  check('one event, from fred', () => {
    assert.equal(macro.events.length, 1);
    assert.equal(macro.events[0].properties.source, 'fred');
    assert.equal(macro.events[0].properties.outcome, 'success');
  });
  /*
   * `not_applicable` rather than `unknown`: a monthly series is months old by
   * design. It is also the check that the observation date was passed and not
   * FRED's `last_updated`, which does not parse and would have downgraded this.
   */
  check('freshness is not_applicable, not unknown', () =>
    assert.equal(macro.events[0].properties.freshnessBucket, 'not_applicable'));

  /* ------------------------------------------------------------ 7. privacy */

  group('Nothing about the subject leaves the function');

  const rows = [
    ...noKey.events, ...noMacroKey.events, ...thrown.events, ...notOk.events,
    ...statusError.events, ...shortSeries.events, ...success.events, ...fresh.events,
    ...withVolume.events, ...withoutVolume.events, ...batch.events,
    ...batchNoKey.events, ...macro.events,
  ];

  check('every row declares exactly the seven registered properties', () => {
    for (const row of rows) {
      assert.deepEqual(Object.keys(row.properties).sort(), [...KEYED].sort());
    }
  });

  const serialised = JSON.stringify(rows);
  for (const secret of ['AAPL', 'MSFT', 'NVDA', 'NOPE', 'CPIAUCSL', 'Apple', 'NASDAQ',
                        'test-quote-key', 'test-macro-key', 'twelvedata', 'stlouisfed',
                        'Consumer Price Index', 'credits', '231.4']) {
    check(`no row carries "${secret}"`, () =>
      assert.equal(serialised.includes(secret), false));
  }

  check('and no row carries a symbol list or a URL', () => {
    assert.equal(/https?:\/\//.test(serialised), false);
    assert.equal(serialised.includes('symbol'), false);
  });

  /* -------------------------------------------- 8. telemetry costs nothing */

  group('Telemetry never reaches the caller');

  /*
   * The §12 clause that is easiest to break by accident: a tracker that is
   * awaited would make every price wait on a metrics write. This one never
   * settles, so if the client awaited it the call below would hang rather than
   * fail.
   */
  recorder.emitted.length = 0;
  process.env.TWELVE_DATA_API_KEY = 'test-quote-key';
  globalThis.fetch = ok(quotePayload(minutesAgo(3)));
  recorder.setOnTrack(() => new Promise(() => {}));

  const raced = await Promise.race([
    client.getQuote('AAPL'),
    new Promise((resolve) => setTimeout(() => resolve('TIMED_OUT'), 2000)),
  ]);
  recorder.setOnTrack(() => {});

  check('a tracker that never settles does not hold up the quote', () =>
    assert.notEqual(raced, 'TIMED_OUT'));
  check('and the quote is still the real one', () =>
    assert.equal(raced?.price, 231.4));
} finally {
  rmSync(out, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}
