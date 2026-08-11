import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

/**
 * The outcome telemetry, asserted rather than trusted.
 *
 * `superchart_study_toggled` fires when somebody presses Add and it stays that
 * way; it is the intent signal. These two events are the other half, and the
 * only thing that makes them worth having is that they are not allowed to claim
 * success. So the rules live in a pure module and are checked here: what counts
 * as applied, why a capability did not happen, and — the one a dashboard cannot
 * recover from — that a provider gap and a product boundary are never filed as
 * each other.
 *
 * Same seam as the rest of the section's unit coverage: compile the modules with
 * the TypeScript already in devDependencies and assert against the output. No
 * foreign test script is touched.
 */

const out = mkdtempSync(join(tmpdir(), 'tn-outcomes-'));
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
  execFileSync(
    'npx',
    [
      'tsc',
      'src/lib/superchart/telemetry/outcomes.ts',
      'src/lib/superchart/indicators/index.ts',
      'src/lib/superchart/chart-engine/panes.ts',
      'src/lib/studies/registry.ts',
      '--outDir',
      out,
      '--module',
      'esnext',
      '--target',
      'es2022',
      '--moduleResolution',
      'bundler',
      '--skipLibCheck',
    ],
    { stdio: 'inherit', shell: process.platform === 'win32' }
  );

  const find = (dir, name, wantedDir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        const hit = find(path, name, wantedDir);
        if (hit) return hit;
      } else if (entry.name === `${name}.js`) {
        if (!wantedDir || dir.endsWith(wantedDir)) return path;
      }
    }
    return null;
  };

  const load = (name, dir) => {
    const path = find(out, name, dir);
    if (!path) throw new Error(`compiled module ${dir ? dir + '/' : ''}${name}.js was not emitted`);
    return import(pathToFileURL(path).href);
  };

  // `moduleResolution: bundler` emits extensionless specifiers, which Node's ESM
  // loader will not resolve.
  const addExtensions = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        addExtensions(path);
      } else if (entry.name.endsWith('.js')) {
        const source = readFileSync(path, 'utf8');
        writeFileSync(
          path,
          source.replace(/(from '\.[^']*?)(')/g, (all, head, tail) => {
            if (head.endsWith('.js')) return all;
            const specifier = head.slice(head.indexOf("'") + 1);
            const target = join(dirname(path), specifier);
            const isDirectory = existsSync(target) && statSync(target).isDirectory();
            return isDirectory ? `${head}/index.js${tail}` : `${head}.js${tail}`;
          })
        );
      }
    }
  };

  addExtensions(out);

  const outcomes = await load('outcomes', 'telemetry');
  const indicators = await load('index', 'indicators');

  /* ------------------------------------------------------------- Fixtures */

  /** 240 deterministic bars with volume — enough history for an RSI to exist. */
  const bars = Array.from({ length: 240 }, (_, i) => {
    const base = 150 + Math.sin(i / 9) * 6 + i * 0.02;
    const close = base + Math.sin(i / 4) * 1.4;
    return {
      time: 1_700_000_000 + i * 86_400,
      open: base,
      close,
      high: Math.max(base, close) + 0.8,
      low: Math.min(base, close) - 0.8,
      volume: 4_000_000 + Math.round(Math.abs(Math.sin(i / 5)) * 30_000_000),
    };
  });

  /** The same series as the portal's own provider returns it: no volume field. */
  const withoutVolume = bars.map(({ volume: _volume, ...rest }) => rest);

  const make = (id, series = bars) => indicators.createIndicator(id, series);

  /**
   * A painted frame as the engine would report it.
   *
   * The engine records the panes it painted and the studies that put at least
   * one coordinate on the canvas. Building it by hand here is the point: these
   * tests are about what the rules make of that evidence.
   */
  const frame = (paneIds, studyIds) => ({ paneIds, studyIds });

  const report = (id, painted, series = bars) =>
    outcomes.studyReports({
      choices: [{ definitionId: id }],
      instances: [make(id, series)],
      frame: painted,
    })[0];

  /* ------------------------------------------------- A study that rendered */

  group('A study is applied when the frame proves it');

  check('RSI in its own pane is applied, and the placement is pane', () => {
    const one = report('rsi', frame(['main', 'rsi'], ['rsi']));

    assert.equal(one.outcome, 'fulfilled');
    assert.equal(one.placement, 'pane');
    assert.equal(one.study, 'rsi');
    assert.equal(one.capability, 'study:rsi');
    // The contract's own test: paneCount greater than one.
    assert.equal(outcomes.paneCountOf(frame(['main', 'rsi'], ['rsi'])), 2);
  });

  check('MACD and volume are panes too, because the frame says so', () => {
    for (const id of ['macd', 'volume']) {
      const one = report(id, frame(['main', id], [id]));
      assert.equal(one.outcome, 'fulfilled', id);
      assert.equal(one.placement, 'pane', id);
    }
  });

  check('an overlay is an overlay', () => {
    for (const id of ['sma', 'ema', 'bbands']) {
      const one = report(id, frame(['main'], [id]));
      assert.equal(one.outcome, 'fulfilled', id);
      assert.equal(one.placement, 'overlay', id);
    }
  });

  check('placement comes from the frame, not from the registry', () => {
    /*
     * The registry says RSI wants a pane. If the frame has no such pane then the
     * engine did not apply it, whatever the state believes — and the event must
     * not claim it rendered. This is the assertion that stops the two events
     * from becoming a second copy of the toggle.
     */
    const one = report('rsi', frame(['main'], ['rsi']));
    assert.equal(one.outcome, 'failure');
    assert.equal(one.placement, null);
  });

  check('a study the frame never drew is not applied', () => {
    const one = report('rsi', frame(['main', 'rsi'], []));
    assert.notEqual(one.outcome, 'fulfilled');
    assert.equal(one.placement, null);
  });

  check('and an engine that has painted nothing is a failure, not a gap', () => {
    // Data exists, the engine completed no frame: that is execution, not data.
    assert.equal(report('rsi', null).outcome, 'failure');
  });

  /* ---------------------------------------------------- Missing versus absent */

  group('A provider gap and a product boundary are never each other');

  check('a volume study on a series with no volume is no_data', () => {
    /*
     * The portal's provider returns daily closes with no volume field. The
     * capability exists and the pane is built; there is simply nothing to draw.
     * Filing this as `unsupported` would send somebody to build a volume pane
     * that has been there all along.
     */
    const one = report('volume', frame(['main', 'volume'], []), withoutVolume);

    assert.equal(one.outcome, 'no_data');
    assert.notEqual(one.outcome, 'unsupported');
    assert.equal(one.capability, 'study:volume');
  });

  check('and hasVolume is a property of the series, not of the chart', () => {
    // Volume present in the data, no volume study on the chart.
    assert.equal(outcomes.seriesHasVolume(bars), true);
    // Volume study requested, no volume in the data.
    assert.equal(outcomes.seriesHasVolume(withoutVolume), false);

    const applied = report('volume', frame(['main', 'volume'], ['volume']));
    assert.equal(applied.outcome, 'fulfilled');
    // The two facts do not read each other: one is about bars, one about panes.
    assert.equal(outcomes.seriesHasVolume(withoutVolume), false);
  });

  check('an RSI with too little history to compute is no_data', () => {
    const short = bars.slice(0, 6);
    const one = report('rsi', frame(['main', 'rsi'], []), short);
    assert.equal(one.outcome, 'no_data');
  });

  check('an interval the adapter declines is unsupported, not failure', () => {
    /*
     * A refused interval returns an empty series, so the order of the tests is
     * the whole substance of this event: ask about bars first and every product
     * boundary is filed as a provider gap.
     */
    const one = outcomes.intervalReport({
      interval: '1m',
      supportedIntervals: ['1D', '1W', '1M'],
      bars: 0,
    });

    assert.equal(one.outcome, 'unsupported');
    assert.notEqual(one.outcome, 'failure');
    assert.notEqual(one.outcome, 'no_data');
    assert.equal(one.capability, 'interval:1m');
  });

  check('a supported interval that came back empty is no_data', () => {
    const one = outcomes.intervalReport({
      interval: '1D',
      supportedIntervals: ['1D', '1W', '1M'],
      bars: 0,
    });
    assert.equal(one.outcome, 'no_data');
  });

  check('a request that came apart is a failure', () => {
    const one = outcomes.intervalReport({
      interval: '1D',
      supportedIntervals: ['1D', '1W', '1M'],
      bars: 0,
      threw: true,
    });
    assert.equal(one.outcome, 'failure');
  });

  check('and a supported interval that returned bars is fulfilled', () => {
    const one = outcomes.intervalReport({
      interval: '1D',
      supportedIntervals: ['1D', '1W', '1M'],
      bars: 240,
    });
    assert.equal(one.outcome, 'fulfilled');
  });

  check('a superseded response is not an outcome at all', () => {
    // A newer request replaced it. Reporting it would count a decision nobody
    // made, and file it against whichever interval was on the way out.
    assert.equal(
      outcomes.intervalReport({
        interval: '1D',
        supportedIntervals: ['1D'],
        bars: 0,
        superseded: true,
      }),
      null
    );
  });

  check('a study this build does not have is unsupported', () => {
    const stale = outcomes.studyReports({
      choices: [{ definitionId: 'ichimoku' }],
      instances: [],
      frame: frame(['main'], []),
    });

    assert.equal(stale.length, 1);
    assert.equal(stale[0].outcome, 'unsupported');
    assert.equal(stale[0].study, 'unknown');
  });

  /* ------------------------------------------------------------ No duplicates */

  group('One successful application is one completion');

  check('the same fulfilled frame reported twice emits once', () => {
    const seen = new Map();
    const reports = () =>
      outcomes.studyReports({
        choices: [{ definitionId: 'rsi' }],
        instances: [make('rsi')],
        frame: frame(['main', 'rsi'], ['rsi']),
      });

    assert.equal(outcomes.unreportedOutcomes(reports(), seen).length, 1);
    // Every repaint recomputes the studies; none of them is a new attempt.
    assert.equal(outcomes.unreportedOutcomes(reports(), seen).length, 0);
    assert.equal(outcomes.unreportedOutcomes(reports(), seen).length, 0);
  });

  check('a real change of outcome is not suppressed', () => {
    const seen = new Map();
    const absent = outcomes.studyReports({
      choices: [{ definitionId: 'volume' }],
      instances: [make('volume', withoutVolume)],
      frame: frame(['main', 'volume'], []),
    });
    const present = outcomes.studyReports({
      choices: [{ definitionId: 'volume' }],
      instances: [make('volume')],
      frame: frame(['main', 'volume'], ['volume']),
    });

    assert.equal(outcomes.unreportedOutcomes(absent, seen)[0].outcome, 'no_data');
    // Switching to a series that carries volume is a capability completing.
    assert.equal(outcomes.unreportedOutcomes(present, seen)[0].outcome, 'fulfilled');
    assert.equal(outcomes.unreportedOutcomes(present, seen).length, 0);
  });

  check('a study removed and added again is a new attempt', () => {
    const seen = new Map();
    const applied = outcomes.studyReports({
      choices: [{ definitionId: 'rsi' }],
      instances: [make('rsi')],
      frame: frame(['main', 'rsi'], ['rsi']),
    });

    assert.equal(outcomes.unreportedOutcomes(applied, seen).length, 1);
    // Taken off the chart: the cache forgets it.
    assert.equal(outcomes.unreportedOutcomes([], seen).length, 0);
    assert.equal(seen.size, 0);
    assert.equal(outcomes.unreportedOutcomes(applied, seen).length, 1);
  });

  check('several studies each report once', () => {
    const seen = new Map();
    const all = outcomes.studyReports({
      choices: [{ definitionId: 'volume' }, { definitionId: 'rsi' }, { definitionId: 'macd' }],
      instances: [make('volume'), make('rsi'), make('macd')],
      frame: frame(['main', 'volume', 'rsi', 'macd'], ['volume', 'rsi', 'macd']),
    });

    assert.equal(outcomes.unreportedOutcomes(all, seen).length, 3);
    assert.equal(outcomes.unreportedOutcomes(all, seen).length, 0);
  });

  /* ----------------------------------------------------------------- Privacy */

  group('Nothing about the instrument travels');

  check('a capability token can only come from a registry', () => {
    const vocabulary = outcomes.capabilityVocabulary();

    assert.ok(vocabulary.includes('study:rsi'));
    assert.ok(vocabulary.includes('interval:1m'));

    for (const token of vocabulary) {
      assert.ok(token.length <= 48, `${token} is longer than the contract allows`);
      // One colon: a namespace and a bounded id. Two is how a symbol gets in.
      assert.equal(token.split(':').length, 2, token);
    }
  });

  check('a poisoned study id becomes study:unknown rather than travelling', () => {
    /*
     * `study:rsi:TSLA` is a position somebody may hold. A stale saved layout can
     * carry any string — `parseStudies` accepts one — so the builder validates
     * against the registry instead of trusting its input.
     */
    assert.equal(outcomes.studyCapability('rsi:TSLA'), 'study:unknown');
    assert.equal(outcomes.studyCapability('rsi'), 'study:rsi');

    const poisoned = outcomes.studyReports({
      choices: [{ definitionId: 'rsi:NASDAQ:TSLA' }],
      instances: [],
      frame: frame(['main'], []),
    })[0];

    assert.equal(poisoned.capability, 'study:unknown');
    assert.equal(poisoned.study, 'unknown');
    assert.ok(!JSON.stringify(poisoned.capability).includes('TSLA'));
    assert.ok(!JSON.stringify(poisoned.study).includes('TSLA'));
  });

  check('an interval outside the table does not carry its own name through', () => {
    assert.equal(outcomes.intervalCapability('4H'), 'interval:4H');
    assert.equal(outcomes.intervalCapability('TSLA-daily'), 'interval:other');
  });

  check('the emitted properties are counts and tokens, and nothing else', () => {
    /*
     * Read off the callsites rather than described: the two `track()` calls may
     * only mention the properties the registry declares. A ticker reaches
     * telemetry by somebody adding a helpful field, not by a token being built
     * wrongly, so this looks at what is actually passed.
     */
    const source = readFileSync('src/components/superchart/SuperchartWorkspace.tsx', 'utf8');
    const allowed = {
      superchart_study_applied: ['study', 'placement', 'paneCount'],
      superchart_capability_completed: ['capability', 'outcome', 'hasVolume', 'paneCount'],
    };

    for (const [event, properties] of Object.entries(allowed)) {
      const calls = [...source.matchAll(new RegExp(`name: '${event}',([^}]*)\\}`, 'g'))];
      assert.ok(calls.length > 0, `${event} is not emitted anywhere`);

      for (const call of calls) {
        const keys = [...call[1].matchAll(/^\s*([a-zA-Z]+):/gm)].map((match) => match[1]);
        assert.ok(keys.length > 0, `${event} passes no properties`);

        for (const key of keys) {
          assert.ok(properties.includes(key), `${event} passes an undeclared "${key}"`);
        }
      }
    }

    for (const forbidden of ['symbol', 'symbolId', 'ticker', 'exchange', 'companyName', 'bars:']) {
      const calls = [
        ...source.matchAll(/name: 'superchart_(?:study_applied|capability_completed)',([^}]*)\}/g),
      ];
      for (const call of calls) {
        assert.ok(!call[1].includes(forbidden), `an outcome event mentions ${forbidden}`);
      }
    }
  });

  /* --------------------------------------------------- The intent event stays */

  group('The intent event is untouched and separate');

  check('superchart_study_toggled still fires in the toggle handler', () => {
    const source = readFileSync('src/components/superchart/SuperchartWorkspace.tsx', 'utf8');

    // Still in `toggleIndicator`, still with its own two properties, still
    // before anything has been applied. It is the intent signal and it is honest
    // about being one.
    const toggle = source.slice(source.indexOf('const toggleIndicator'));
    assert.match(toggle.slice(0, 400), /name: 'superchart_study_toggled'/);
    assert.match(toggle.slice(0, 400), /studyId: definitionId/);
  });

  check('and the outcome events are not emitted beside it', () => {
    /*
     * The failure this guards: someone "simplifying" by firing all three from
     * the click handler, which would make the outcome events a second copy of
     * the intent one and the fulfilment rate a rate of clicks again.
     */
    const source = readFileSync('src/components/superchart/SuperchartWorkspace.tsx', 'utf8');
    const toggle = source.slice(
      source.indexOf('const toggleIndicator'),
      source.indexOf('const onStagePointerDown')
    );

    assert.ok(!toggle.includes('superchart_study_applied'), 'applied fires from the click handler');
    assert.ok(
      !toggle.includes('superchart_capability_completed'),
      'the capability event fires from the click handler'
    );
  });

  check('the outcome events are emitted from a painted frame', () => {
    const source = readFileSync('src/components/superchart/SuperchartWorkspace.tsx', 'utf8');
    // From the cache down to the applied event — the interval emitter sits
    // earlier in the file, so anchoring on the capability event would slice
    // backwards and match nothing.
    const emitter = source.slice(
      source.indexOf('const reportedStudies'),
      source.indexOf("name: 'superchart_study_applied'")
    );
    assert.ok(emitter.length > 200, 'the study emitter was not found');

    // The evidence is the frame the engine finished, one animation frame after
    // the list was handed over.
    assert.match(emitter, /paintedFrame\(\)/);
    assert.match(emitter, /requestAnimationFrame/);
    assert.match(emitter, /!bars\.length/);
  });

  check('no handoff outcome exists anywhere in the section', () => {
    /*
     * Load-bearing. Supercharts has no TradingView handoff; the one that exists
     * belongs to Voyager. An `outcome: 'handoff'` here would put a number on a
     * dashboard for a boundary this product does not have.
     */
    const files = [
      'src/lib/superchart/telemetry/outcomes.ts',
      'src/components/superchart/SuperchartWorkspace.tsx',
    ];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      assert.ok(!/'handoff'/.test(source), `${file} mentions a handoff outcome`);
    }

    assert.deepEqual(
      [...new Set(['fulfilled', 'no_data', 'unsupported', 'failure'])].sort(),
      ['failure', 'fulfilled', 'no_data', 'unsupported']
    );
  });
} finally {
  rmSync(out, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
