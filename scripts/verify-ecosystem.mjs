import { chromium } from 'playwright';

/**
 * The carousel and the header, checked by driving them rather than reading the code.
 *
 * Everything interesting here is positional: whether a wrap leaves a seam, whether
 * a dot moves the track, whether the header is still on screen after a scroll. None
 * of that is visible in the source, so every assertion below reads the rendered
 * transform or a bounding box after a real click.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const HOME = `${BASE}/en`;

const PITCH = 806;
const OFFSET = 390;

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** The x translation currently applied to the track, in pixels. */
async function trackX(page) {
  return page.evaluate(() => {
    const track = document.querySelector('[aria-roledescription="carousel"] > div');
    const matrix = new DOMMatrixReadOnly(getComputedStyle(track).transform);
    return matrix.m41;
  });
}

/** Which slot on the strip is centred, read from the position of the track. */
function posFrom(x) {
  return Math.round((-x - OFFSET) / PITCH);
}

/** The real card behind that slot — the strip is padded with two clones in front. */
const LEAD = 2;
function cardFrom(x) {
  return posFrom(x) - LEAD;
}

async function activeTitle(page) {
  return page.locator('[role="tab"][aria-selected="true"]').innerText();
}

async function settle(page) {
  await page.waitForTimeout(900);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(HOME, { waitUntil: 'networkidle' });

  console.log('\nSection');
  check('carousel is present', await page.locator('[aria-roledescription="carousel"]').isVisible());
  check(
    'heading is the v5 one',
    (await page.locator('#ecosystem-title').innerText()) ===
      'One platform, seven ways it works for you'
  );
  check('seven titles', (await page.locator('[role="tab"]').count()) === 7);
  check('seven dots', (await page.locator('[aria-current]').count()) === 7);
  check(
    'eleven cards on the track (seven plus two clones each side)',
    (await page.locator('[aria-roledescription="carousel"] > div > div').count()) === 11
  );

  /*
   * The property the whole wrap rests on, and the one that was broken: the strip
   * either side of a reset must be identical three cards wide, not one. If only
   * the centre matches, the reset swaps what peeks from the left and right edges
   * and reads as a jolt even though nothing moved.
   */
  console.log('\nThe seam');
  const strip = await page
    .locator('[aria-roledescription="carousel"] > div > div h3')
    .allInnerTexts();
  const window3 = (i) => strip.slice(i - 1, i + 2).join(' | ');
  check(
    'forward reset keeps all three visible cards',
    window3(9) === window3(2),
    `${window3(9)}  ≠  ${window3(2)}`
  );
  check(
    'backward reset keeps all three visible cards',
    window3(1) === window3(8),
    `${window3(1)}  ≠  ${window3(8)}`
  );

  console.log('\nThe three replaced blocks are gone');
  const body = await page.locator('body').innerText();
  check('no "Already know what you need?"', !body.includes('Already know what you need'));
  check('no Supercharts showcase pair', !body.includes('Professional charting and market analysis'));
  check('no principles strip', !body.includes('Reliable, real-time data from 150+'));
  check('no demo-integrations banner', !body.includes('Demo integrations'));

  console.log('\nNext');
  const start = await trackX(page);
  check('starts on card 1', cardFrom(start) === 0, `card ${cardFrom(start)}`);
  await page.getByLabel('Next', { exact: true }).click();
  await settle(page);
  check('next moves one card', cardFrom(await trackX(page)) === 1);
  check('title follows', (await activeTitle(page)) === 'Market Intelligence');

  console.log('\nPrev');
  await page.getByLabel('Previous', { exact: true }).click();
  await settle(page);
  check('prev moves back', cardFrom(await trackX(page)) === 0);
  check('title follows back', (await activeTitle(page)) === 'AI Voyager');

  console.log('\nDots and titles');
  await page.getByRole('tab', { name: 'Wealth Hub' }).click();
  await settle(page);
  check('a title jumps to its card', cardFrom(await trackX(page)) === 4);
  await page.locator('[aria-label="Show Academy"][aria-current]').click();
  await settle(page);
  check('a dot jumps to its card', cardFrom(await trackX(page)) === 5);
  check('active dot is wide', (await page.locator('[aria-current="true"]').boundingBox()).width > 20);

  console.log('\nClicking a neighbour');
  await page.locator('[aria-roledescription="carousel"] > div > div').nth(8).click();
  await settle(page);
  check('an off-centre card centres itself', cardFrom(await trackX(page)) === 6);
  check('and its title follows', (await activeTitle(page)) === 'Marketplace');

  console.log('\nWrap forwards');
  check('sitting on the last card', (await activeTitle(page)) === 'Marketplace');
  /*
   * Sampled rather than snapshotted, because the failure worth catching is a
   * reset that fires while the slide is still running: the final position would
   * be correct either way, and only the timing of the jump gives it away.
   */
  const slide = await page.evaluate(() => {
    const track = document.querySelector('[aria-roledescription="carousel"] > div');
    return parseFloat(getComputedStyle(track).transitionDuration) * 1000;
  });

  const samples = [];
  const started = Date.now();
  await page.getByLabel('Next', { exact: true }).click();
  while (Date.now() - started < 1400) {
    samples.push({ at: Date.now() - started, x: await trackX(page) });
  }

  // The reset is the one moment the track jumps back toward the start.
  const resetAt = samples.findIndex((s, i) => i > 0 && s.x - samples[i - 1].x > PITCH / 2);
  const reset = samples[resetAt];

  // Read from the rendered transform, so this is where the slide actually
  // arrived, not where it was aimed.
  const arrived = resetAt > 0 ? posFrom(samples[resetAt - 1].x) : null;
  check('the slide arrives on the clone', arrived === LEAD + 7, `slot ${arrived}`);

  check(
    'the reset waits for the slide to finish',
    reset && reset.at >= slide,
    reset ? `reset at ${reset.at}ms, slide is ${slide}ms` : 'no reset seen'
  );
  check('lands silently back on card 1', cardFrom(await trackX(page)) === 0);
  check('title is card 1', (await activeTitle(page)) === 'AI Voyager');
  check(
    'transition is live again after the reset',
    await page.evaluate(() => {
      const track = document.querySelector('[aria-roledescription="carousel"] > div');
      return getComputedStyle(track).transitionDuration !== '0s';
    })
  );

  /*
   * And the check that actually answers the question, by looking at the screen
   * rather than at the numbers behind it: nothing visible may change once the
   * slide has finished.
   *
   * Compared at an eighth scale on purpose. A byte comparison fails on every
   * run, because moving the track 5,642px makes the compositor re-rasterise and
   * the text antialiasing lands a fraction differently — 69% of pixels identical,
   * the rest ±1 to 3 along glyph edges, invisible at 1×. Downscaling averages
   * that away while leaving any real change, such as a neighbouring card
   * swapping for a different one, plainly visible.
   */
  console.log('\nThe reset is invisible');
  await page.getByRole('tab', { name: 'Marketplace' }).click();
  await settle(page);
  const view = page.locator('[aria-roledescription="carousel"]');
  await view.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const frames = [];
  const from = Date.now();
  await page.getByLabel('Next', { exact: true }).click();
  while (Date.now() - from < 1300) {
    const at = Date.now() - from;
    if (at > slide + 20) frames.push((await view.screenshot()).toString('base64'));
  }

  const drift = async (a, b) =>
    page.evaluate(async ([one, two]) => {
      const load = (b64) =>
        new Promise((done) => {
          const img = new Image();
          img.onload = () => done(img);
          img.src = `data:image/png;base64,${b64}`;
        });
      const [first, second] = await Promise.all([load(one), load(two)]);
      const small = (img) => {
        const c = document.createElement('canvas');
        c.width = Math.ceil(img.width / 8);
        c.height = Math.ceil(img.height / 8);
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, c.width, c.height);
        return ctx.getImageData(0, 0, c.width, c.height).data;
      };
      const [x, y] = [small(first), small(second)];
      let total = 0;
      for (let i = 0; i < x.length; i += 4) {
        total += Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]);
      }
      return total / (x.length / 4);
    }, [a, b]);

  let worst = 0;
  for (let i = 1; i < frames.length; i += 1) {
    worst = Math.max(worst, await drift(frames[i - 1], frames[i]));
  }
  check(
    'no frame changes after the slide ends',
    frames.length >= 3 && worst < 1,
    `${frames.length} frames, worst drift ${worst.toFixed(2)}`
  );
  console.log(`       (${frames.length} frames, worst drift ${worst.toFixed(2)})`);

  // The same measure against a genuinely different card, so a threshold of 1
  // is known to mean something rather than being unfalsifiable.
  await page.getByRole('tab', { name: 'Wealth Hub' }).click();
  await settle(page);
  const elsewhere = (await view.screenshot()).toString('base64');
  const real = await drift(frames[0], elsewhere);
  check('a real change would register', real > 10, `drift ${real.toFixed(1)}`);
  console.log(`       (drift against a different card: ${real.toFixed(1)})`);

  console.log('\nWrap backwards');
  await page.getByRole('tab', { name: 'AI Voyager' }).click();
  await settle(page);
  await page.getByLabel('Previous', { exact: true }).click();
  await page.waitForTimeout(1200);
  check('prev from card 1 reaches the last card', cardFrom(await trackX(page)) === 6);
  check('title is the last card', (await activeTitle(page)) === 'Marketplace');

  console.log('\nNavigation is locked mid-wrap');
  await page.locator('[aria-label="Show AI Voyager"][aria-current]').click();
  await settle(page);
  await page.getByLabel('Previous', { exact: true }).click();
  await page.getByLabel('Previous', { exact: true }).click(); // ignored — wrap in flight
  await page.waitForTimeout(1200);
  check('a second click during the wrap is ignored', cardFrom(await trackX(page)) === 6);

  console.log('\nCTAs');
  await page.locator('[aria-label="Show AI Voyager"][aria-current]').click();
  await settle(page);
  await page.getByRole('button', { name: 'Ask AI Voyager' }).click();
  await page.waitForTimeout(1200);
  const voyagerOpen = await page
    .locator('[aria-label="Voyager assistant"], video')
    .first()
    .isVisible()
    .catch(() => false);
  check('the Voyager card opens the assistant', voyagerOpen);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await page.locator('[aria-label="Show Supercharts"][aria-current]').click();
  await settle(page);
  await page.getByRole('link', { name: 'Open Supercharts' }).click();
  await page.waitForURL('**/supercharts', { timeout: 8000 });
  check('a card CTA navigates', page.url().includes('/supercharts'));

  console.log('\nHeader stays put while the page scrolls');
  await page.goto(HOME, { waitUntil: 'networkidle' });
  const before = await page.locator('header').boundingBox();
  await page.mouse.wheel(0, 1800);
  await page.waitForTimeout(500);
  const after = await page.locator('header').boundingBox();
  const scrolled = await page.evaluate(() => window.scrollY);
  check('the page actually scrolled', scrolled > 1000, `scrollY ${scrolled}`);
  check('the header is still at the top', after !== null && Math.abs(after.y) < 2, `y ${after?.y}`);
  check('the header did not move', Math.abs(after.y - before.y) < 2);

  // A real click, not a visibility check: the last header defect was an overlay
  // sitting on top of a button that reported itself perfectly visible.
  const marketNav = page.getByRole('button', { name: 'Market', exact: true });
  await marketNav.click({ timeout: 3000 });
  await page.waitForTimeout(300);
  check('a scrolled header still takes a click', (await marketNav.getAttribute('aria-expanded')) === 'true');
  await page.keyboard.press('Escape');

  console.log('\nOn a phone');
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const small = await phone.newPage();
  await small.goto(HOME, { waitUntil: 'networkidle' });
  await small.locator('#ecosystem-title').scrollIntoViewIfNeeded();
  await small.waitForTimeout(400);

  const card = small.locator('[aria-roledescription="carousel"] > div > div[aria-hidden="false"]');
  const cardBox = await card.boundingBox();
  check('the card fits the screen', cardBox.width <= 390, `${cardBox.width}px wide`);

  // The headline is the one thing that must survive the crop.
  const title = await card.locator('h3').boundingBox();
  check(
    'the headline is not cropped',
    title.x >= -1 && title.x + title.width <= 391,
    `${Math.round(title.x)}…${Math.round(title.x + title.width)}`
  );

  const viewport = small.locator('[aria-roledescription="carousel"]');
  const box = await viewport.boundingBox();
  const y = box.y + box.height / 2;
  const swipe = async (fromX, toX) => {
    await viewport.dispatchEvent('pointerdown', {
      pointerType: 'touch',
      clientX: fromX,
      clientY: y,
      isPrimary: true,
    });
    await viewport.dispatchEvent('pointerup', {
      pointerType: 'touch',
      clientX: toX,
      clientY: y,
      isPrimary: true,
    });
    await small.waitForTimeout(900);
  };
  const activeOn = () => small.locator('[role="tab"][aria-selected="true"]').innerText();

  await swipe(box.x + 300, box.x + 80);
  check('swiping left advances', (await activeOn()) === 'Market Intelligence');
  await swipe(box.x + 80, box.x + 300);
  check('swiping right goes back', (await activeOn()) === 'AI Voyager');
  await swipe(box.x + 200, box.x + 180);
  check('a short drag is not a swipe', (await activeOn()) === 'AI Voyager');

  await phone.close();
} finally {
  console.log(`\n${passed}/${passed + failed} passed`);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
