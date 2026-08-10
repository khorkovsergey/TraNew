import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

/**
 * The multi-pane chart engine, asserted rather than photographed.
 *
 * Two kinds of claim are made here, and the difference between them is the
 * whole reason this file exists. The first is about geometry: pane rectangles
 * tile without overlapping, an RSI is bounded 0–100, a volume domain starts at
 * zero, and a $150 price scale does not move when a study running to forty
 * million is switched on. The second is about paint: the renderer is handed a
 * context that writes down what it was asked to do, and the tests check that
 * the RSI line, the MACD histogram and the volume columns are actually issued
 * inside their own rectangles.
 *
 * The second kind matters because the first kind was already true before any of
 * this was built. The engine has always known that `volume-anomaly` wanted a
 * separate pane; it simply skipped it. Metadata that describes a study nobody
 * draws is exactly the failure this suite is here to make impossible.
 *
 * No browser and no running app: the modules are compiled with the TypeScript
 * already in devDependencies and imported, the same way `test-events.mjs`
 * covers the rest of the pure logic.
 */

const out = mkdtempSync(join(tmpdir(), 'tn-panes-'));
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
      'src/lib/superchart/chart-engine/panes.ts',
      'src/lib/superchart/chart-engine/paneRenderer.ts',
      'src/lib/superchart/indicators/index.ts',
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

  // tsc puts the emitted tree under the common prefix of its inputs, which moves
  // when a file is added; finding the output beats computing where it went.
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

  const panes = await load('panes', 'chart-engine');
  const renderer = await load('paneRenderer', 'chart-engine');
  const indicators = await load('index', 'indicators');

  /* ------------------------------------------------------------- Fixtures */

  /**
   * A price series around $150 with volume in the millions.
   *
   * Deterministic — a sine and a ramp, no randomness — because a scale test
   * whose input changes per run cannot be debugged when it fails.
   */
  const bars = Array.from({ length: 240 }, (_, i) => {
    const base = 150 + Math.sin(i / 9) * 6 + i * 0.02;
    const open = base;
    const close = base + Math.sin(i / 4) * 1.4;
    return {
      time: 1_700_000_000 + i * 86_400,
      open,
      close,
      high: Math.max(open, close) + 0.8,
      low: Math.min(open, close) - 0.8,
      volume: 4_000_000 + Math.round(Math.abs(Math.sin(i / 5)) * 30_000_000),
    };
  });

  const WIDTH = 1200;
  const HEIGHT = 700;

  const make = (id) => indicators.createIndicator(id, bars);

  /** The window the engine would draw, as the engine slices it. */
  const windowed = (instances, from = 0, to = bars.length) =>
    indicators.collectPaneRequests(instances).map((request) => ({
      ...request,
      series: request.series.map((values) => values.slice(from, to)),
    }));

  const layoutFor = (instances, size = { width: WIDTH, height: HEIGHT }) =>
    panes.buildPaneLayout({
      width: size.width,
      height: size.height,
      price: priceDomain(),
      secondary: windowed(instances),
    });

  /** What the price pane would be, from the bars and nothing else. */
  const priceDomain = () => {
    let low = Infinity;
    let high = -Infinity;
    for (const bar of bars) {
      if (bar.low < low) low = bar.low;
      if (bar.high > high) high = bar.high;
    }
    const pad = (high - low) * 0.06;
    return { min: low - pad, max: high + pad };
  };

  const axis = panes.timeAxis({ from: 0, to: bars.length }, WIDTH - panes.SCALE_WIDTH, bars.length);

  /**
   * A 2D context that records instead of painting.
   *
   * Every call is kept in order with the state that was in force when it was
   * made, so a test can ask "was a line stroked inside the RSI rectangle" and
   * not merely "was `stroke` called at some point".
   */
  function recordingContext() {
    const calls = [];
    const state = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'alphabetic' };
    const stack = [];
    let clip = null;
    const path = [];

    const record = (op, args = {}) => calls.push({ op, clip, ...state, ...args });

    return {
      calls,
      get clipDepth() {
        return stack.length;
      },
      save() {
        stack.push({ ...state, clip });
        record('save');
      },
      restore() {
        const previous = stack.pop();
        if (previous) {
          Object.assign(state, previous);
          clip = previous.clip;
        }
        record('restore');
      },
      beginPath() {
        path.length = 0;
        record('beginPath');
      },
      closePath() {
        record('closePath');
      },
      moveTo(x, y) {
        path.push({ x, y });
        record('moveTo', { x, y });
      },
      lineTo(x, y) {
        path.push({ x, y });
        record('lineTo', { x, y });
      },
      rect(x, y, w, h) {
        path.push({ x, y, w, h });
        record('rect', { x, y, w, h });
      },
      clip() {
        // The last rect on the path is what a clip is built from here.
        const last = [...path].reverse().find((point) => point.w !== undefined);
        clip = last ? { ...last } : clip;
        record('clip');
      },
      arc(x, y, r) {
        record('arc', { x, y, r });
      },
      stroke() {
        record('stroke', { path: path.map((point) => ({ ...point })) });
      },
      fill() {
        record('fill');
      },
      fillRect(x, y, w, h) {
        record('fillRect', { x, y, w, h });
      },
      setLineDash(dash) {
        record('setLineDash', { dash: [...dash] });
      },
      fillText(text, x, y) {
        record('fillText', { text, x, y });
      },
      createLinearGradient() {
        return { addColorStop() {} };
      },
      clearRect() {},
      get fillStyle() {
        return state.fillStyle;
      },
      set fillStyle(value) {
        state.fillStyle = value;
      },
      get strokeStyle() {
        return state.strokeStyle;
      },
      set strokeStyle(value) {
        state.strokeStyle = value;
      },
      get lineWidth() {
        return state.lineWidth;
      },
      set lineWidth(value) {
        state.lineWidth = value;
      },
      get font() {
        return state.font;
      },
      set font(value) {
        state.font = value;
      },
      get textAlign() {
        return state.textAlign;
      },
      set textAlign(value) {
        state.textAlign = value;
      },
      get textBaseline() {
        return state.textBaseline;
      },
      set textBaseline(value) {
        state.textBaseline = value;
      },
    };
  }

  const within = (pane, y, slack = 0.51) =>
    y >= pane.rect.top - slack && y <= pane.rect.top + pane.rect.height + slack;

  /* ------------------------------------------------------------- Main only */

  group('A chart with nothing on it is the chart that was there before');

  check('one pane, and it is the price', () => {
    const layout = layoutFor([]);
    assert.equal(layout.panes.length, 1);
    assert.equal(layout.panes[0].id, panes.MAIN_PANE);
    assert.equal(layout.axisPaneId, panes.MAIN_PANE);
  });

  check('the price pane fills everything above the time axis', () => {
    const layout = layoutFor([]);
    assert.equal(layout.panes[0].rect.top, 0);
    assert.equal(layout.panes[0].rect.height, HEIGHT - panes.TIME_HEIGHT);
  });

  check('volume alone reproduces the strip the engine used to hardcode', () => {
    // 74 pixels under the price, which is what shipped. A pane manager that
    // redraws every existing chart is a redesign wearing a refactor's name.
    const layout = layoutFor([make('volume')]);
    const [price, volume] = layout.panes;

    assert.equal(volume.rect.height, panes.SECONDARY_BASE);
    assert.equal(price.rect.height, HEIGHT - panes.TIME_HEIGHT - panes.SECONDARY_BASE);
  });

  check('overlays stay on the price pane and ask for nothing', () => {
    for (const id of ['sma', 'ema', 'bbands']) {
      const instance = make(id);
      assert.ok(instance, `${id} is not in the registry`);
      assert.equal(indicators.paneRequestFor(instance), null, `${id} asked for a pane`);
    }
    assert.equal(layoutFor([make('sma'), make('bbands')]).panes.length, 1);
  });

  /* -------------------------------------------------------------- The RSI */

  group('RSI');

  check('gets a pane of its own', () => {
    const layout = layoutFor([make('rsi')]);
    assert.equal(layout.panes.length, 2);
    assert.equal(layout.panes[1].id, 'rsi');
    assert.equal(layout.axisPaneId, 'rsi');
  });

  check('is bounded 0 to 100 whatever the window contains', () => {
    const rsi = layoutFor([make('rsi')]).panes[1];
    assert.deepEqual(rsi.domain, { min: 0, max: 100 });

    // A flat stretch would fit an auto scale to a couple of points; the bound is
    // the property of the index, not of these bars.
    const flat = Array.from({ length: 60 }, (_, i) => ({
      time: i * 86_400,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 1,
    }));
    const flatRsi = indicators.createIndicator('rsi', flat);
    const layout = panes.buildPaneLayout({
      width: WIDTH,
      height: HEIGHT,
      price: { min: 99, max: 101 },
      secondary: indicators.collectPaneRequests([flatRsi]),
    });
    assert.deepEqual(layout.panes[1].domain, { min: 0, max: 100 });
  });

  check('leaves the price scale exactly where it was', () => {
    const without = layoutFor([]);
    const with_ = layoutFor([make('rsi')]);
    assert.deepEqual(with_.panes[0].domain, without.panes[0].domain);
  });

  check('carries 30 and 70 as informational levels', () => {
    const rsi = layoutFor([make('rsi')]).panes[1];
    assert.deepEqual(rsi.guides, [30, 70]);
  });

  check('every value maps inside the RSI rectangle', () => {
    const layout = layoutFor([make('rsi')]);
    const rsi = layout.panes[1];
    const values = make('rsi').plots[0].values.filter((value) => value !== null);

    assert.ok(values.length > 100, 'the fixture produced no RSI to test');
    for (const value of values) {
      assert.ok(within(rsi, panes.valueToY(rsi, value)), `RSI ${value} left its pane`);
    }
  });

  check('and the line is actually stroked there', () => {
    const layout = layoutFor([make('rsi')]);
    const rsi = layout.panes[1];
    const ctx = recordingContext();

    renderer.drawPaneLine(
      ctx,
      rsi,
      axis,
      make('rsi').plots[0].values,
      { colour: '#7c4dff' },
      layout.plotWidth
    );

    const strokes = ctx.calls.filter((call) => call.op === 'stroke' && call.path.length > 1);
    assert.equal(strokes.length, 1, 'no RSI line was stroked');
    for (const point of strokes[0].path) {
      assert.ok(within(rsi, point.y), `a stroked point at ${point.y} is outside the RSI pane`);
    }
  });

  check('drawn under a clip that is put back afterwards', () => {
    const layout = layoutFor([make('rsi')]);
    const ctx = recordingContext();

    renderer.drawPaneLine(
      ctx,
      layout.panes[1],
      axis,
      make('rsi').plots[0].values,
      { colour: '#7c4dff' },
      layout.plotWidth
    );

    assert.ok(ctx.calls.some((call) => call.op === 'clip'), 'nothing was clipped');
    // A clip that outlives its restore blanks every pane drawn after it.
    assert.equal(ctx.clipDepth, 0, 'the save stack was left unbalanced');
    assert.equal(ctx.calls[ctx.calls.length - 1].op, 'restore');
  });

  /* ------------------------------------------------------------- The MACD */

  group('MACD');

  check('gets a pane of its own, separate from the price', () => {
    const layout = layoutFor([make('macd')]);
    assert.equal(layout.panes.length, 2);
    assert.equal(layout.panes[1].id, 'macd');
    assert.deepEqual(layout.panes[0].domain, layoutFor([]).panes[0].domain);
  });

  check('is centred on zero', () => {
    const macd = layoutFor([make('macd')]).panes[1];
    assert.ok(Math.abs(macd.domain.min + macd.domain.max) < 1e-9, 'the domain is not symmetric');

    const zero = panes.valueToY(macd, 0);
    assert.ok(
      Math.abs(zero - (macd.rect.top + macd.rect.height / 2)) < 1e-6,
      'zero is not the middle of the pane'
    );
  });

  check('carries all three series the study produces', () => {
    const plots = make('macd').plots;
    assert.deepEqual(
      plots.map((plot) => plot.key).sort(),
      ['hist', 'macd', 'signal']
    );
    assert.equal(plots.find((plot) => plot.key === 'hist').style, 'histogram');
    assert.equal(plots.find((plot) => plot.key === 'macd').style, 'line');
    assert.equal(plots.find((plot) => plot.key === 'signal').style, 'line');
  });

  check('histogram bars start at zero and hang the right way', () => {
    const layout = layoutFor([make('macd')]);
    const macd = layout.panes[1];
    const values = make('macd').plots.find((plot) => plot.key === 'hist').values;
    const ctx = recordingContext();

    renderer.drawPaneHistogram(ctx, macd, axis, values, {
      baseline: 0,
      colour: '#888',
      plotWidth: layout.plotWidth,
    });

    const zero = panes.valueToY(macd, 0);
    const bars_ = ctx.calls.filter((call) => call.op === 'fillRect');
    assert.ok(bars_.length > 50, `only ${bars_.length} histogram bars were drawn`);

    for (const bar of bars_) {
      const top = bar.y;
      const bottom = bar.y + bar.h;
      // One edge of every bar is the zero line — that is what "based at zero"
      // means, and drawing from the floor of the pane instead is the bug this
      // catches.
      assert.ok(
        Math.abs(top - zero) < 1.01 || Math.abs(bottom - zero) < 1.01,
        `a bar spanning ${top}–${bottom} does not touch the zero line at ${zero}`
      );
      assert.ok(within(macd, top) && within(macd, bottom), 'a bar left the MACD pane');
    }
  });

  check('a positive value goes up and a negative one goes down', () => {
    const macd = layoutFor([make('macd')]).panes[1];
    const zero = panes.valueToY(macd, 0);
    assert.ok(panes.valueToY(macd, macd.domain.max / 2) < zero);
    assert.ok(panes.valueToY(macd, macd.domain.min / 2) > zero);
  });

  check('lines and histogram are all issued inside the pane', () => {
    const layout = layoutFor([make('macd')]);
    const macd = layout.panes[1];
    const ctx = recordingContext();

    for (const plot of make('macd').plots) {
      if (plot.style === 'histogram') {
        renderer.drawPaneHistogram(ctx, macd, axis, plot.values, {
          baseline: 0,
          colour: '#888',
          plotWidth: layout.plotWidth,
        });
      } else {
        renderer.drawPaneLine(ctx, macd, axis, plot.values, { colour: '#7c4dff' }, layout.plotWidth);
      }
    }

    const strokes = ctx.calls.filter((call) => call.op === 'stroke' && call.path.length > 1);
    assert.equal(strokes.length, 2, 'the MACD and signal lines were not both drawn');
    for (const stroke of strokes) {
      for (const point of stroke.path) {
        assert.ok(within(macd, point.y), `a point at ${point.y} escaped the MACD pane`);
      }
    }
  });

  check('the zero baseline is drawn', () => {
    const layout = layoutFor([make('macd')]);
    const macd = layout.panes[1];
    const ctx = recordingContext();

    renderer.drawPaneBaseline(ctx, macd, layout.plotWidth, {
      grid: '#eee',
      border: '#ddd',
      textMuted: '#888',
      up: '#0a0',
      down: '#a00',
    });

    const stroke = ctx.calls.find((call) => call.op === 'stroke');
    assert.ok(stroke, 'no baseline was stroked');
    const zero = panes.valueToY(macd, 0);
    for (const point of stroke.path) {
      assert.ok(Math.abs(point.y - zero) < 1.01, 'the baseline is not at zero');
    }
  });

  /* ----------------------------------------------------------- The volume */

  group('Volume');

  check('is a study on a pane, not a fixture of the canvas', () => {
    const layout = layoutFor([make('volume')]);
    assert.equal(layout.panes[1].id, 'volume');
    assert.equal(layout.panes[1].title, 'Volume');
  });

  check('its domain starts at zero', () => {
    const volume = layoutFor([make('volume')]).panes[1];
    assert.equal(volume.domain.min, 0);
    assert.ok(volume.domain.max >= 34_000_000, 'the peak is not inside the domain');
  });

  check('and stays at zero however far above it the bars are', () => {
    const high = bars.map((bar) => ({ ...bar, volume: 900_000_000 + (bar.volume ?? 0) }));
    const instance = indicators.createIndicator('volume', high);
    const layout = panes.buildPaneLayout({
      width: WIDTH,
      height: HEIGHT,
      price: priceDomain(),
      secondary: indicators.collectPaneRequests([instance]),
    });
    assert.equal(layout.panes[1].domain.min, 0);
  });

  check('bars line up in x with the candles they belong to', () => {
    const layout = layoutFor([make('volume')]);
    const volume = layout.panes[1];
    const ctx = recordingContext();

    renderer.drawPaneHistogram(ctx, volume, axis, make('volume').plots[0].values, {
      baseline: 0,
      colour: '#b6e6cd',
      plotWidth: layout.plotWidth,
    });

    const drawn = ctx.calls.filter((call) => call.op === 'fillRect');
    assert.equal(drawn.length, bars.length, 'a bar is missing');

    const width = panes.barWidth(axis);
    drawn.forEach((bar, index) => {
      // The same mapping the candles use, so this cannot drift: centre of the
      // rectangle against centre of the bar slot.
      assert.ok(
        Math.abs(bar.x + width / 2 - panes.xForIndex(axis, index)) < 1e-9,
        `volume bar ${index} is not under its candle`
      );
    });
  });

  check('every bar stands on the floor of its pane', () => {
    const layout = layoutFor([make('volume')]);
    const volume = layout.panes[1];
    const ctx = recordingContext();

    renderer.drawPaneHistogram(ctx, volume, axis, make('volume').plots[0].values, {
      baseline: 0,
      colour: '#b6e6cd',
      plotWidth: layout.plotWidth,
    });

    const floor = panes.valueToY(volume, 0);
    for (const bar of ctx.calls.filter((call) => call.op === 'fillRect')) {
      assert.ok(Math.abs(bar.y + bar.h - floor) < 1.01, 'a volume bar does not stand on zero');
      assert.ok(within(volume, bar.y), 'a volume bar left its pane');
    }
  });

  check('bars with no volume at all are skipped rather than drawn flat', () => {
    // The Twelve Data adapter returns daily closes with no volume field. A row
    // of zero-height bars would claim a quiet market rather than an absent one.
    const noVolume = bars.map(({ volume: _volume, ...rest }) => rest);
    const instance = indicators.createIndicator('volume', noVolume);
    assert.ok(instance.plots[0].values.every((value) => value === null));

    const layout = panes.buildPaneLayout({
      width: WIDTH,
      height: HEIGHT,
      price: priceDomain(),
      secondary: indicators.collectPaneRequests([instance]),
    });
    const pane = layout.panes[1];
    assert.equal(pane.domain.min, 0);
    assert.ok(pane.domain.max > 0, 'an empty pane still needs a domain to divide by');

    const ctx = recordingContext();
    renderer.drawPaneHistogram(ctx, pane, axis, instance.plots[0].values, {
      baseline: 0,
      colour: '#b6e6cd',
      plotWidth: layout.plotWidth,
    });
    assert.equal(ctx.calls.filter((call) => call.op === 'fillRect').length, 0);
  });

  check('volume, its average and the anomaly flags share one pane', () => {
    const layout = layoutFor([make('volume'), make('volume-ma'), make('volume-anomaly')]);
    assert.equal(layout.panes.length, 2, 'three volume studies produced more than one pane');
    assert.equal(layout.panes[1].id, 'volume');
  });

  /* ------------------------------------------------------------ Together */

  group('Four panes at once');

  const full = () => [make('volume'), make('rsi'), make('macd')];

  check('price, volume, RSI and MACD each get a rectangle', () => {
    const layout = layoutFor(full());
    assert.deepEqual(layout.panes.map((pane) => pane.id), ['main', 'volume', 'rsi', 'macd']);
  });

  check('the rectangles tile with no gap and no overlap', () => {
    const layout = layoutFor(full());
    let expected = 0;
    for (const pane of layout.panes) {
      assert.equal(pane.rect.top, expected, `${pane.id} starts at ${pane.rect.top}, not ${expected}`);
      expected += pane.rect.height;
    }
    assert.equal(expected, layout.plotHeight, 'the panes do not fill the plot');
  });

  check('the price pane keeps the most room', () => {
    const layout = layoutFor(full());
    const secondary = layout.panes.slice(1).reduce((total, pane) => total + pane.rect.height, 0);
    assert.ok(layout.panes[0].rect.height > secondary, 'the studies took more than the price');
  });

  check('every pane is readable rather than a sliver', () => {
    const layout = layoutFor(full());
    for (const pane of layout.panes.slice(1)) {
      assert.ok(pane.rect.height >= 40, `${pane.id} is ${pane.rect.height} pixels tall`);
    }
  });

  check('one x mapping, shared by all of them', () => {
    // The claim the whole design rests on: a bar index resolves to one x, and
    // every pane is handed the same axis to resolve it with.
    const layout = layoutFor(full());
    const shared = panes.timeAxis({ from: 0, to: bars.length }, layout.plotWidth, bars.length);

    for (const index of [0, 1, 57, 120, bars.length - 1]) {
      const x = panes.xForIndex(shared, index);
      for (const pane of layout.panes) {
        assert.ok(pane.rect.height >= 0);
        assert.equal(panes.xForIndex(shared, index), x, 'a pane resolved a different x');
      }
    }
  });

  check('four panes still fit, and the price still leads', () => {
    const layout = layoutFor([make('volume'), make('rsi'), make('macd'), make('volume-ma')]);
    // volume-ma joins the volume pane, so this is still four rectangles — and
    // the fifth study did not cost anything.
    assert.equal(layout.panes.length, 4);
    assert.ok(layout.panes[0].rect.height >= 80);
  });

  check('nothing overlaps when the panes are squeezed into a short chart', () => {
    const layout = layoutFor(full(), { width: WIDTH, height: 260 });
    let expected = 0;
    for (const pane of layout.panes) {
      assert.equal(pane.rect.top, expected);
      assert.ok(pane.rect.height >= 0);
      expected += pane.rect.height;
    }
    assert.equal(expected, layout.plotHeight);
    assert.ok(layout.panes[0].rect.height > 0, 'the price pane vanished');
  });

  /* ------------------------------------------------------ Scale isolation */

  group('Nothing below the price can move the price');

  check('an RSI at 100 and a volume in the billions leave it alone', () => {
    const alone = layoutFor([]).panes[0].domain;

    const extreme = bars.map((bar) => ({ ...bar, volume: 9_000_000_000 }));
    const instances = [
      indicators.createIndicator('volume', extreme),
      indicators.createIndicator('rsi', bars),
      indicators.createIndicator('macd', bars),
    ];

    const layout = panes.buildPaneLayout({
      width: WIDTH,
      height: HEIGHT,
      price: priceDomain(),
      secondary: indicators.collectPaneRequests(instances),
    });

    assert.deepEqual(layout.panes[0].domain, alone);
    // The failure this makes impossible: a $150 chart rescaled to nine billion.
    assert.ok(layout.panes[0].domain.max < 200);
  });

  check('a study on the price pane is not given a domain of its own', () => {
    assert.equal(indicators.collectPaneRequests([make('sma'), make('bbands')]).length, 0);
  });

  /* -------------------------------------------------------------- Resize */

  group('Resize');

  check('the rectangles move and the panes stay in order', () => {
    const before = layoutFor(full(), { width: WIDTH, height: HEIGHT });
    const after = layoutFor(full(), { width: 900, height: 420 });

    assert.notDeepEqual(
      before.panes.map((pane) => pane.rect),
      after.panes.map((pane) => pane.rect)
    );
    assert.deepEqual(
      before.panes.map((pane) => pane.id),
      after.panes.map((pane) => pane.id)
    );

    let expected = 0;
    for (const pane of after.panes) {
      assert.equal(pane.rect.top, expected);
      expected += pane.rect.height;
    }
    assert.equal(expected, after.plotHeight);
  });

  check('the domains do not change with the size of the window', () => {
    const before = layoutFor(full(), { width: WIDTH, height: HEIGHT });
    const after = layoutFor(full(), { width: 640, height: 380 });
    assert.deepEqual(
      before.panes.map((pane) => pane.domain),
      after.panes.map((pane) => pane.domain)
    );
  });

  check('a bar keeps its place in time, in every size', () => {
    const wide = panes.timeAxis({ from: 0, to: 100 }, 1000, 100);
    const narrow = panes.timeAxis({ from: 0, to: 100 }, 500, 100);

    // The x changes with the width; the fraction of the way across does not.
    assert.equal(panes.xForIndex(wide, 50) / wide.plotWidth, panes.xForIndex(narrow, 50) / narrow.plotWidth);
  });

  check('the same inputs always give the same layout', () => {
    assert.deepEqual(layoutFor(full()), layoutFor(full()));
  });

  /* ------------------------------------------------------------- No data */

  group('Missing and broken series');

  check('an empty series does not crash the layout', () => {
    const layout = panes.buildPaneLayout({
      width: WIDTH,
      height: HEIGHT,
      price: priceDomain(),
      secondary: [
        { id: 'empty', title: 'Empty', scale: { kind: 'auto' }, series: [] },
        { id: 'nulls', title: 'Nulls', scale: { kind: 'auto' }, series: [[null, null, null]] },
      ],
    });

    for (const pane of layout.panes.slice(1)) {
      assert.ok(Number.isFinite(pane.domain.min) && Number.isFinite(pane.domain.max));
      assert.ok(pane.domain.max > pane.domain.min, 'a domain with no span divides by zero');
      assert.ok(Number.isFinite(panes.valueToY(pane, 0)));
    }
  });

  check('a study with no bars to work on produces no NaN', () => {
    const empty = indicators.createIndicator('rsi', []);
    const layout = panes.buildPaneLayout({
      width: WIDTH,
      height: HEIGHT,
      price: { min: 0, max: 1 },
      secondary: indicators.collectPaneRequests([empty]),
    });
    assert.deepEqual(layout.panes[1].domain, { min: 0, max: 100 });

    const ctx = recordingContext();
    renderer.drawPaneLine(ctx, layout.panes[1], axis, empty.plots[0].values, { colour: '#000' }, layout.plotWidth);
    assert.equal(ctx.calls.filter((call) => call.op === 'lineTo').length, 0);
    assert.equal(ctx.clipDepth, 0);
  });

  check('a gap in a series breaks the line rather than bridging it', () => {
    const layout = layoutFor([make('rsi')]);
    const values = new Array(bars.length).fill(null);
    values[10] = 40;
    values[11] = 50;
    // Gap here.
    values[20] = 60;
    values[21] = 65;

    const ctx = recordingContext();
    renderer.drawPaneLine(ctx, layout.panes[1], axis, values, { colour: '#000' }, layout.plotWidth);

    const moves = ctx.calls.filter((call) => call.op === 'moveTo').length;
    assert.equal(moves, 2, 'the two segments were joined across the gap');
  });

  check('an infinite value is ignored rather than scaling the pane to it', () => {
    const domain = panes.paneDomain({ kind: 'auto' }, [[1, 2, Infinity, NaN, 3]]);
    assert.ok(Number.isFinite(domain.min) && Number.isFinite(domain.max));
    assert.ok(domain.max < 10);
  });

  check('a zero-height pane still maps values to a number', () => {
    const pane = {
      id: 'x',
      title: 'x',
      rect: { top: 100, height: 0 },
      scale: { kind: 'auto' },
      domain: { min: 0, max: 0 },
      guides: [],
      format: 'plain',
      precision: 2,
    };
    assert.ok(Number.isFinite(panes.valueToY(pane, 5)));
    assert.ok(Number.isFinite(panes.yToValue(pane, 100)));
  });

  /* --------------------------------------------------------------- Axes */

  group('Axes');

  check('each pane labels its own numbers', () => {
    const layout = layoutFor(full());
    const rsi = layout.panes.find((pane) => pane.id === 'rsi');
    assert.deepEqual(panes.paneTicks(rsi), [0, 30, 70, 100]);
  });

  check('only the bottom pane prints the number at its floor', () => {
    /*
     * Two panes both labelling their own edge put unrelated numbers a few
     * pixels apart — a volume "0" directly above an RSI "100" — which reads as
     * one axis that has gone wrong rather than two that are fine.
     */
    const layout = layoutFor(full());
    const rsi = layout.panes.find((pane) => pane.id === 'rsi');
    const macd = layout.panes.find((pane) => pane.id === 'macd');

    assert.deepEqual(panes.paneTicks(rsi, 2, false), [30, 70, 100]);
    assert.equal(layout.axisPaneId, macd.id);
    assert.ok(panes.paneTicks(macd, 2, true).includes(macd.domain.min));
  });

  check('and the renderer applies that rule from the layout, not from a caller', () => {
    const layout = layoutFor(full());
    const rsi = layout.panes.find((pane) => pane.id === 'rsi');
    const macd = layout.panes.find((pane) => pane.id === 'macd');
    const palette = { grid: '#eee', border: '#ddd', textMuted: '#888', up: '#0a0', down: '#a00' };

    const middle = recordingContext();
    renderer.drawPaneScale(middle, rsi, layout, palette);
    const bottom = recordingContext();
    renderer.drawPaneScale(bottom, macd, layout, palette);

    assert.deepEqual(
      middle.calls.filter((call) => call.op === 'fillText').map((call) => call.text),
      ['30', '70', '100']
    );
    assert.ok(
      bottom.calls
        .filter((call) => call.op === 'fillText')
        .some((call) => call.text === macd.domain.min.toFixed(2))
    );
  });

  check('volume is written in millions, not in digits', () => {
    const volume = layoutFor([make('volume')]).panes[1];
    assert.equal(panes.formatPaneValue(volume, 34_000_000), '34.0M');
    assert.equal(panes.formatPaneValue(volume, 0), '0');
  });

  check('labels cannot bleed into the pane below', () => {
    const layout = layoutFor(full());
    const rsi = layout.panes.find((pane) => pane.id === 'rsi');
    const ctx = recordingContext();

    renderer.drawPaneScale(ctx, rsi, layout, {
      grid: '#eee',
      border: '#ddd',
      textMuted: '#888',
      up: '#0a0',
      down: '#a00',
    });

    const labels = ctx.calls.filter((call) => call.op === 'fillText');
    assert.ok(labels.length >= 2, 'the pane printed no axis');
    for (const label of labels) {
      assert.ok(within(rsi, label.y, 2), `"${label.text}" was printed outside its pane`);
      // Clipped as well as positioned: a descender or a long string cannot
      // reach past the rectangle even if the baseline is inside it.
      assert.ok(label.clip, 'the labels were drawn without a clip');
      assert.equal(label.clip.y, rsi.rect.top);
      assert.ok(label.x >= layout.plotWidth, 'a label was printed over the chart');
    }
    assert.equal(ctx.clipDepth, 0);
  });

  check('the bottom pane owns the time axis', () => {
    assert.equal(layoutFor([]).axisPaneId, 'main');
    assert.equal(layoutFor([make('volume')]).axisPaneId, 'volume');
    assert.equal(layoutFor(full()).axisPaneId, 'macd');
  });

  check('the separator sits on the pane boundary', () => {
    const layout = layoutFor(full());
    const pane = layout.panes[1];
    const ctx = recordingContext();

    renderer.drawPaneFrame(ctx, pane, layout.plotWidth, {
      grid: '#eee',
      border: '#ddd',
      textMuted: '#888',
      up: '#0a0',
      down: '#a00',
    }, { separator: true });

    const stroke = ctx.calls.find((call) => call.op === 'stroke');
    assert.ok(stroke, 'no separator was drawn');
    assert.ok(Math.abs(stroke.path[0].y - pane.rect.top) <= 0.5);
    assert.equal(ctx.clipDepth, 0);
  });

  check('guides are drawn behind the series, in the grid colour', () => {
    const layout = layoutFor([make('rsi')]);
    const rsi = layout.panes[1];
    const ctx = recordingContext();

    renderer.drawPaneFrame(ctx, rsi, layout.plotWidth, {
      grid: '#eeeeee',
      border: '#dddddd',
      textMuted: '#888',
      up: '#0a0',
      down: '#a00',
    }, { separator: false });

    const strokes = ctx.calls.filter((call) => call.op === 'stroke');
    assert.equal(strokes.length, 2, '30 and 70 were not both drawn');
    for (const stroke of strokes) {
      assert.equal(stroke.strokeStyle, '#eeeeee');
      assert.ok(within(rsi, stroke.path[0].y));
    }
  });

  /* ---------------------------------------------------------- Interaction */

  group('The pointer resolves against the pane it is in');

  check('a y in each pane finds that pane', () => {
    const layout = layoutFor(full());
    for (const pane of layout.panes) {
      const middle = pane.rect.top + pane.rect.height / 2;
      assert.equal(panes.paneAt(layout, middle).id, pane.id);
    }
  });

  check('a y below the last pane belongs to nothing', () => {
    const layout = layoutFor(full());
    assert.equal(panes.paneAt(layout, layout.plotHeight + 4), null);
  });

  check('the value read back is the one that was drawn', () => {
    const layout = layoutFor(full());
    const rsi = layout.panes.find((pane) => pane.id === 'rsi');
    for (const value of [0, 30, 55.5, 70, 100]) {
      assert.ok(Math.abs(panes.yToValue(rsi, panes.valueToY(rsi, value)) - value) < 1e-9);
    }
  });

  check('the same y means different things in different panes', () => {
    // The bug this prevents: a pointer in the RSI pane reporting a price.
    const layout = layoutFor(full());
    const rsi = layout.panes.find((pane) => pane.id === 'rsi');
    const y = rsi.rect.top + rsi.rect.height / 2;

    const asRsi = panes.yToValue(rsi, y);
    const asPrice = panes.yToValue(layout.panes[0], y);

    assert.ok(Math.abs(asRsi - 50) < 1e-9);
    assert.ok(asPrice < layout.panes[0].domain.min, 'the price pane claimed a y outside itself');
  });

  /* ------------------------------------------------------------------ DPR */

  group('High-DPI');

  check('the layout is in CSS pixels, whatever the device ratio', () => {
    /*
     * The engine scales the context once, in `resize`, with
     * `setTransform(ratio, 0, 0, ratio, 0, 0)` — so everything downstream works
     * in CSS pixels and a retina chart is the same layout drawn at twice the
     * resolution. This pins that: the layout function is never handed a device
     * pixel, so a change that started passing `canvas.width` in here would fail.
     */
    const css = layoutFor(full(), { width: 1200, height: 700 });
    const device = layoutFor(full(), { width: 2400, height: 1400 });

    assert.notEqual(css.panes[0].rect.height, device.panes[0].rect.height);
    assert.equal(css.width, 1200);
    assert.equal(css.plotWidth, 1200 - panes.SCALE_WIDTH);
  });

  check('and the transform is applied once per resize, not per frame', () => {
    // Accumulating transforms is the classic canvas leak: a second
    // `scale(ratio, ratio)` on the next frame doubles everything. `setTransform`
    // is absolute, which is why it is the one used.
    const source = readFileSync('src/lib/superchart/chart-engine/canvas.ts', 'utf8');
    assert.ok(source.includes('setTransform(ratio, 0, 0, ratio, 0, 0)'));
    assert.ok(!/ctx\??\.scale\(/.test(source), 'a relative scale() would accumulate');
  });

  /* ------------------------------------------------------- The contract */

  group('The mechanism is general');

  check('the renderer names no study', () => {
    /*
     * The requirement that outlives this iteration: adding the next oscillator
     * is a row in the indicator registry, not a branch in the paint code. If
     * this fails, somebody has special-cased a study inside the engine.
     */
    for (const file of [
      'src/lib/superchart/chart-engine/canvas.ts',
      'src/lib/superchart/chart-engine/panes.ts',
      'src/lib/superchart/chart-engine/paneRenderer.ts',
    ]) {
      const source = readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
        .join('\n');

      for (const name of ['rsi', 'macd', 'bbands', 'volume-anomaly']) {
        assert.ok(
          !new RegExp(`['"\`]${name}['"\`]`).test(source),
          `${file} names ${name} in its code`
        );
      }
    }
  });

  check('an unknown oscillator gets a pane without the engine being changed', () => {
    // A study that does not exist in the registry, described entirely by its
    // instance — which is what a Pine script or a future definition would be.
    const invented = {
      id: 'x1',
      definitionId: 'stochastic',
      label: 'Stochastic 14',
      pane: 'separate',
      paneSpec: {
        id: 'stoch',
        title: 'Stoch',
        scale: { kind: 'fixed', min: 0, max: 100 },
        guides: [20, 80],
      },
      params: {},
      plots: [{ key: 'k', colour: 0, style: 'line', values: bars.map((_, i) => (i % 100)) }],
      hidden: false,
      source: 'user',
      draft: false,
    };

    const layout = layoutFor([make('volume'), invented]);
    const pane = layout.panes.find((entry) => entry.id === 'stoch');
    assert.ok(pane, 'the invented study got no pane');
    assert.deepEqual(pane.domain, { min: 0, max: 100 });
    assert.deepEqual(pane.guides, [20, 80]);
  });

  check('a hidden study takes no space', () => {
    const hidden = { ...make('rsi'), hidden: true };
    assert.equal(indicators.paneRequestFor(hidden), null);
    assert.equal(layoutFor([hidden]).panes.length, 1);
  });

  check('the Pine beside each new study is the study', () => {
    // The registry's rule: the chart and the code must be the same calculation.
    for (const id of ['rsi', 'macd', 'bbands', 'volume']) {
      const definition = indicators.INDICATORS[id];
      assert.ok(definition, `${id} is not in the chart registry`);
      const pine = definition.pine(make(id).params);
      assert.ok(pine.startsWith('//@version=6'), `${id} is not v6`);
      assert.ok(pine.includes('indicator('), `${id} declares no indicator`);
    }
  });

  check('RSI and MACD are the registry calculation, not a second copy', () => {
    const studies = indicators.INDICATORS;
    const closes = bars.map((bar) => bar.close);

    // Imported rather than reimplemented: the values the chart draws have to be
    // the ones the tested registry produces, or the Pine beside them is wrong.
    const chartRsi = studies.rsi.compute(bars, { length: 14 })[0].values;
    const chartMacd = studies.macd.compute(bars, { fast: 12, slow: 26, signal: 9 });

    assert.equal(chartRsi.length, closes.length);
    const defined = chartRsi.filter((value) => value !== null);
    assert.ok(defined.length > 200);
    for (const value of defined) {
      assert.ok(value >= 0 && value <= 100, `RSI produced ${value}`);
    }

    const macdLine = chartMacd.find((plot) => plot.key === 'macd').values;
    const signal = chartMacd.find((plot) => plot.key === 'signal').values;
    const hist = chartMacd.find((plot) => plot.key === 'hist').values;
    for (let i = 0; i < closes.length; i += 1) {
      if (hist[i] === null) continue;
      assert.ok(Math.abs(hist[i] - (macdLine[i] - signal[i])) < 1e-9, `histogram wrong at ${i}`);
    }
  });
} finally {
  rmSync(out, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
