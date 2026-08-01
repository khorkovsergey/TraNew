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

/** Which card index is currently centred, read from the position of the track. */
function posFrom(x) {
  return Math.round((-x - OFFSET) / PITCH);
}

async function activeTitle(page) {
  return page.locator('[role="tab"][aria-selected="true"]').innerText();
}

async function settle(page) {
  await page.waitForTimeout(700);
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
    'eight cards on the track (seven plus the clone)',
    (await page.locator('[aria-roledescription="carousel"] > div > div').count()) === 8
  );

  console.log('\nThe three replaced blocks are gone');
  const body = await page.locator('body').innerText();
  check('no "Already know what you need?"', !body.includes('Already know what you need'));
  check('no Supercharts showcase pair', !body.includes('Professional charting and market analysis'));
  check('no principles strip', !body.includes('Reliable, real-time data from 150+'));
  check('no demo-integrations banner', !body.includes('Demo integrations'));

  console.log('\nNext');
  const start = await trackX(page);
  check('starts on card 1', posFrom(start) === 0, `pos ${posFrom(start)}`);
  await page.getByLabel('Next', { exact: true }).click();
  await settle(page);
  check('next moves one card', posFrom(await trackX(page)) === 1);
  check('title follows', (await activeTitle(page)) === 'Market Intelligence');

  console.log('\nPrev');
  await page.getByLabel('Previous', { exact: true }).click();
  await settle(page);
  check('prev moves back', posFrom(await trackX(page)) === 0);
  check('title follows back', (await activeTitle(page)) === 'AI Voyager');

  console.log('\nDots and titles');
  await page.getByRole('tab', { name: 'Wealth Hub' }).click();
  await settle(page);
  check('a title jumps to its card', posFrom(await trackX(page)) === 4);
  await page.locator('[aria-label="Show Academy"][aria-current]').click();
  await settle(page);
  check('a dot jumps to its card', posFrom(await trackX(page)) === 5);
  check('active dot is wide', (await page.locator('[aria-current="true"]').boundingBox()).width > 20);

  console.log('\nClicking a neighbour');
  await page.locator('[aria-roledescription="carousel"] > div > div').nth(6).click();
  await settle(page);
  check('an off-centre card centres itself', posFrom(await trackX(page)) === 6);

  console.log('\nWrap forwards');
  check('sitting on the last card', (await activeTitle(page)) === 'Marketplace');
  await page.getByLabel('Next', { exact: true }).click();
  await page.waitForTimeout(200);
  const mid = posFrom(await trackX(page));
  check('animates onto the clone first', mid === 7, `pos ${mid}`);
  await page.waitForTimeout(900);
  check('lands silently back on card 1', posFrom(await trackX(page)) === 0);
  check('title is card 1', (await activeTitle(page)) === 'AI Voyager');
  check(
    'transition is live again after the reset',
    await page.evaluate(() => {
      const track = document.querySelector('[aria-roledescription="carousel"] > div');
      return getComputedStyle(track).transitionDuration !== '0s';
    })
  );

  console.log('\nWrap backwards');
  await page.getByLabel('Previous', { exact: true }).click();
  await page.waitForTimeout(900);
  check('prev from card 1 reaches the last card', posFrom(await trackX(page)) === 6);
  check('title is the last card', (await activeTitle(page)) === 'Marketplace');

  console.log('\nNavigation is locked mid-wrap');
  await page.locator('[aria-label="Show AI Voyager"][aria-current]').click();
  await settle(page);
  await page.getByLabel('Previous', { exact: true }).click();
  await page.getByLabel('Previous', { exact: true }).click(); // ignored — wrap in flight
  await page.waitForTimeout(900);
  check('a second click during the wrap is ignored', posFrom(await trackX(page)) === 6);

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
} finally {
  console.log(`\n${passed}/${passed + failed} passed`);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
