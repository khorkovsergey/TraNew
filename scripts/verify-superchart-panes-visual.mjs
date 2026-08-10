import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

/**
 * The panes, in a real browser, read off the pixels.
 *
 * `verify-superchart-panes.mjs` proves the geometry and the draw calls without
 * a DOM. What it cannot prove is that any of it reaches the screen — that the
 * canvas is the size the layout thinks it is, that a study switched on in the
 * object tree ends up painted, and that turning three of them on does not move
 * the price scale. So this reads the canvas back and counts.
 *
 * Nothing here trusts a label. The pane bands are predicted from the layout
 * rules in `panes.ts` — 74 pixels a secondary pane, 24 for the time axis — and
 * then the pixels are asked whether that prediction is what was painted: a rule
 * across the plot exactly on each predicted boundary, and coloured pixels
 * inside each band. A test that checked for the word "RSI" in the object tree
 * would have passed for the entire time RSI was not being drawn at all.
 *
 * Predicting the boundaries rather than discovering them also avoids a trap:
 * the price grid draws full-width rules in the same colour as the separators,
 * so a suite that looked for "a line across the chart" would count five of them
 * before it found a pane.
 *
 * The workspace is behind a flag, so this needs a dev server started with it:
 *
 *   SUPERCHART_ENABLED=true npm run dev -- -p 3413
 *   BASE_URL=http://localhost:3413 node scripts/verify-superchart-panes-visual.mjs
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3413';
const SHOTS = process.env.SHOT_DIR ?? null;

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? `  — ${detail}` : ''}`);
  }
}

function group(title) {
  console.log(`\n${title}`);
}

if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

/**
 * What the canvas actually contains, in CSS pixels.
 *
 * Everything is computed in the page because getting a million pixels across
 * the bridge for each of six states is slower than the whole rest of the suite.
 */
async function readCanvas() {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const dpr = canvas.width / canvas.getBoundingClientRect().width;
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;

    // The right-hand gutter is the scale column; the plot is everything left of
    // it. 66 CSS pixels, from `panes.ts`.
    const plotWidth = Math.round((canvas.getBoundingClientRect().width - 66) * dpr);
    const timeHeight = Math.round(24 * dpr);

    const at = (x, y) => {
      const i = (y * width + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };

    const surface = at(2, Math.round(height / 2) - 1);
    const isSurface = ([r, g, b]) =>
      Math.abs(r - surface[0]) < 6 && Math.abs(g - surface[1]) < 6 && Math.abs(b - surface[2]) < 6;
    /*
     * Candles, study lines and volume columns are coloured; grid, separators,
     * axis text and the crosshair are grey. Saturation tells them apart without
     * hard-coding a palette the stylesheet owns — the threshold is low because
     * the volume tints are deliberately pale.
     */
    const isColoured = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b) > 12;
    /*
     * A study line, as opposed to a candle.
     *
     * Counting "coloured pixels" cannot tell an overlay from the bars it is
     * drawn over — a moving average painted across a candle replaces one
     * coloured pixel with another and the total barely moves. The study palette
     * is violet where candles are only ever green or red, so blue leading the
     * other two channels is the one thing a candle can never be.
     */
    const isStudy = ([r, g, b]) => b > 120 && b - Math.max(r, g) > 30;

    const rows = [];
    for (let y = 0; y < height; y += 1) {
      let ink = 0;
      let coloured = 0;
      let study = 0;
      let uniform = 0;
      const first = at(0, y);

      for (let x = 0; x < plotWidth; x += 1) {
        const pixel = at(x, y);
        if (!isSurface(pixel)) ink += 1;
        if (isColoured(pixel)) coloured += 1;
        if (!isSurface(pixel) && isStudy(pixel)) study += 1;
        if (
          Math.abs(pixel[0] - first[0]) < 4 &&
          Math.abs(pixel[1] - first[1]) < 4 &&
          Math.abs(pixel[2] - first[2]) < 4 &&
          !isSurface(pixel)
        ) {
          uniform += 1;
        }
      }

      rows.push({ ink, coloured, study, uniform });
    }

    /** Rows that are one colour the whole way across: a grid line or a separator. */
    const fullWidth = rows
      .map((row, y) => ({ y, ...row }))
      .filter((row) => row.uniform > plotWidth * 0.94)
      .map((row) => row.y);

    return {
      dpr,
      cssHeight: canvas.getBoundingClientRect().height,
      width,
      height,
      plotWidth,
      plotHeight: height - timeHeight,
      rows,
      fullWidth,
    };
  });
}

/**
 * Where the panes must be, from the rules rather than from the picture.
 *
 * `panes.ts` gives a secondary pane 74 CSS pixels and the time axis 24, and the
 * price pane takes what is left. Predicting it here means the assertions below
 * are about whether the engine painted where it said it would.
 */
function expectedBands(frame, secondaryCount) {
  const plot = frame.cssHeight - 24;
  const main = plot - secondaryCount * 74;
  const bands = [{ id: 'main', from: 0, to: main }];

  for (let i = 0; i < secondaryCount; i += 1) {
    bands.push({ id: `secondary-${i}`, from: main + i * 74, to: main + (i + 1) * 74 });
  }

  // Back into device pixels, which is what the canvas was read in.
  return bands.map((band) => ({
    ...band,
    from: band.from * frame.dpr,
    to: band.to * frame.dpr,
  }));
}

/** Was a rule drawn across the plot at this boundary? */
function ruleAt(frame, y) {
  return frame.fullWidth.some((row) => Math.abs(row - y) <= Math.ceil(frame.dpr) + 1);
}

/** Coloured pixels inside a band — candles, columns, study lines. */
function inkIn(frame, from, to, kind = 'coloured') {
  let total = 0;
  for (let y = Math.max(0, Math.round(from)); y < Math.min(frame.height, Math.round(to)); y += 1) {
    total += frame.rows[y][kind];
  }
  return total;
}

/** The first row of the plot carrying a coloured pixel — the highest wick. */
function firstColouredRow(frame, from, to) {
  for (let y = Math.max(0, Math.round(from)); y < Math.min(frame.height, Math.round(to)); y += 1) {
    if (frame.rows[y].coloured > 0) return y;
  }
  return -1;
}

const studyButton = (name) => page.getByRole('button', { name: new RegExp(`^${name} (On|Add)$`) });

async function setStudy(name, on) {
  const button = studyButton(name);
  const isOn = (await button.getAttribute('aria-pressed')) === 'true';
  if (isOn !== on) {
    await button.click();
    await page.waitForTimeout(120);
  }
}

async function state(label, studies) {
  for (const [name, on] of Object.entries(studies)) await setStudy(name, on);
  await page.waitForTimeout(260);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}.png` });
  return readCanvas();
}

try {
  await page.goto(`${BASE}/en/supercharts`, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas');
  // Bars arrive from the datafeed after mount; the first frame is empty.
  await page.waitForTimeout(1200);

  group('The workspace opens as it always did');

  check('the chart is on the page', (await page.locator('canvas').count()) === 1);
  check('volume is on by default', (await studyButton('Volume').getAttribute('aria-pressed')) === 'true');

  const ALL_OFF = {
    Volume: false,
    RSI: false,
    MACD: false,
    'Bollinger Bands': false,
    'Moving averages': false,
    'Volume moving average': false,
    'Anomalous volume': false,
  };

  /* --------------------------------------------------------------- States */

  const candles = await state('01-candles-only', ALL_OFF);

  group('Candles only');

  const bare = expectedBands(candles, 0);
  check('one pane, filling the chart', inkIn(candles, 0, candles.plotHeight) > 1000);
  check(
    'and no separator anywhere near the bottom of it',
    !ruleAt(candles, candles.plotHeight - 74 * candles.dpr),
    'something was drawn where a secondary pane would start'
  );
  const candleTop = firstColouredRow(candles, 0, bare[0].to);
  check('there are candles to look at', candleTop >= 0, `first coloured row ${candleTop}`);

  const withMa = await state('02-candles-sma-bollinger', {
    'Moving averages': true,
    'Bollinger Bands': true,
  });

  group('Candles with the overlays that were already supported');

  check(
    'the overlays add no pane',
    !ruleAt(withMa, withMa.plotHeight - 74 * withMa.dpr),
    'an overlay was given a pane of its own'
  );
  check(
    'the moving average is drawn over the candles',
    inkIn(withMa, 0, withMa.plotHeight, 'study') > 500 &&
      inkIn(candles, 0, candles.plotHeight, 'study') === 0,
    `${inkIn(withMa, 0, withMa.plotHeight, 'study')} study pixels, against ${inkIn(
      candles,
      0,
      candles.plotHeight,
      'study'
    )} with the overlays off`
  );

  /** One secondary study: assert the boundary, the paint and the price scale. */
  async function single(label, name) {
    const frame = await state(label, { ...ALL_OFF, [name]: true });
    const [price, pane] = expectedBands(frame, 1);

    check(`${name}: a pane boundary is drawn where the layout puts it`, ruleAt(frame, pane.from));
    check(
      `${name}: the series is painted inside that pane`,
      inkIn(frame, pane.from + 3, pane.to) > 200,
      `${inkIn(frame, pane.from + 3, pane.to)} coloured pixels`
    );
    check(
      `${name}: the price pane keeps most of the chart`,
      price.to - price.from > (pane.to - pane.from) * 3
    );

    return frame;
  }

  group('Candles and RSI');
  await single('03-candles-rsi', 'RSI');

  group('Candles and MACD');
  await single('04-candles-macd', 'MACD');

  group('Candles and volume');
  await single('05-candles-volume', 'Volume');

  const everything = await state('06-candles-rsi-macd-volume', {
    Volume: true,
    RSI: true,
    MACD: true,
  });

  group('All three at once');

  const bands = expectedBands(everything, 3);

  check(
    'three pane boundaries, each where the layout puts it',
    bands.slice(1).every((band) => ruleAt(everything, band.from)),
    bands.slice(1).map((band) => Math.round(band.from / everything.dpr)).join(', ')
  );
  check(
    'every pane has its series in it',
    bands.every((band) => inkIn(everything, band.from + 3, band.to) > 100),
    bands.map((band) => inkIn(everything, band.from + 3, band.to)).join(', ')
  );
  check(
    'none of them is a sliver',
    bands.every((band) => band.to - band.from >= 40 * everything.dpr),
    bands.map((band) => Math.round((band.to - band.from) / everything.dpr)).join(', ')
  );
  check(
    'the price pane still has the most room',
    bands[0].to - bands[0].from > everything.plotHeight - bands[0].to
  );

  group('The price scale is not moved by what is below it');

  /*
   * The failure this exists for: an RSI running 0–100 pulling a $150 chart's
   * scale with it. The candles are drawn between the same two fractions of the
   * price pane in both states — 6% of padding at each end — so the topmost wick
   * sits at the same relative height whether or not three studies are open.
   */
  const bareRatio = candleTop / (bare[0].to - bare[0].from);
  const fullRatio = firstColouredRow(everything, 0, bands[0].to) / (bands[0].to - bands[0].from);

  check(
    'the highest wick sits at the same fraction of the price pane',
    Math.abs(bareRatio - fullRatio) < 0.02,
    `${bareRatio.toFixed(4)} against ${fullRatio.toFixed(4)}`
  );

  group('Resize');

  await page.setViewportSize({ width: 1100, height: 700 });
  await page.waitForTimeout(500);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/07-resized.png` });
  const resized = await readCanvas();
  const resizedBands = expectedBands(resized, 3);

  check('the canvas followed the window', resized.width < everything.width);
  check(
    'the panes were recalculated to the new height',
    resizedBands[0].to < bands[0].to && resizedBands.slice(1).every((band) => ruleAt(resized, band.from)),
    resizedBands.map((band) => Math.round((band.to - band.from) / resized.dpr)).join(', ')
  );
  check(
    'and every pane still has its series in it',
    resizedBands.every((band) => inkIn(resized, band.from + 3, band.to) > 60),
    resizedBands.map((band) => inkIn(resized, band.from + 3, band.to)).join(', ')
  );

  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(400);

  group('The crosshair crosses every pane');

  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.25);
  await page.waitForTimeout(200);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/08-crosshair.png` });

  const withCrosshair = await readCanvas();
  const column = Math.round(box.width * 0.4 * withCrosshair.dpr);

  const dashesBelow = await page.evaluate((x) => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const bottom = canvas.height - Math.round(24 * dpr);
    // The last thirty rows above the time axis are in the bottom-most pane; the
    // vertical crosshair has to reach them.
    const strip = ctx.getImageData(x - 1, bottom - 30, 3, 28).data;
    const surface = [strip[0], strip[1], strip[2]];
    let differing = 0;
    for (let i = 0; i < strip.length; i += 4) {
      if (
        Math.abs(strip[i] - surface[0]) > 8 ||
        Math.abs(strip[i + 1] - surface[1]) > 8 ||
        Math.abs(strip[i + 2] - surface[2]) > 8
      ) {
        differing += 1;
      }
    }
    return differing;
  }, column);

  check('the vertical line reaches the bottom pane', dashesBelow > 4, `${dashesBelow} pixels`);
} catch (error) {
  failed += 1;
  console.log(`\n  FAIL the suite did not finish — ${error.message}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
