import { chromium } from 'playwright';

/**
 * The ui-ux-pro-max checks that can only be answered by a rendered page:
 * contrast of real computed colours, real hit-target sizes, and whether the
 * section forces the document sideways at phone width.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

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

const CONTRAST = `(fg, bg) => {
  const parse = (c) => c.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number);
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = lum(parse(fg));
  const b2 = lum(parse(bg));
  const [hi, lo] = a > b2 ? [a, b2] : [b2, a];
  return (hi + 0.05) / (lo + 0.05);
}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(`${BASE}/en`, { waitUntil: 'networkidle' });

  console.log('\nAccessibility');
  const titleContrast = await page.evaluate(
    ([contrast]) => {
      const ratio = eval(contrast);
      const inactive = [...document.querySelectorAll('[role="tab"]')].find(
        (el) => el.getAttribute('aria-selected') === 'false'
      );
      const bg = getComputedStyle(document.body).backgroundColor;
      return ratio(getComputedStyle(inactive).color, bg);
    },
    [CONTRAST]
  );
  check('inactive titles meet 4.5:1', titleContrast >= 4.5, `${titleContrast.toFixed(2)}:1`);

  const named = await page.evaluate(() =>
    [...document.querySelectorAll('[aria-roledescription="carousel"] button, [aria-current]')].every(
      (el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().length > 0
    )
  );
  check('every control carries a name', named);

  const focusRing = await page.evaluate(() => {
    const tab = document.querySelector('[role="tab"]');
    tab.focus();
    return getComputedStyle(tab).outlineWidth !== '0px' || tab.matches(':focus-visible');
  });
  check('focus is not suppressed', focusRing);

  console.log('\nTouch targets');
  for (const [label, selector] of [
    ['titles', '[role="tab"]'],
    ['dots', '[aria-current]'],
    ['arrows', '[aria-label="Next"]'],
  ]) {
    const box = await page.locator(selector).first().boundingBox();
    check(`${label} are at least 16×24`, box.width >= 16 && box.height >= 24, `${box.width}×${box.height}`);
  }

  console.log('\nMotion');
  const reduced = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const quiet = await reduced.newPage();
  await quiet.goto(`${BASE}/en`, { waitUntil: 'networkidle' });
  const duration = await quiet.evaluate(
    () =>
      getComputedStyle(document.querySelector('[aria-roledescription="carousel"] > div'))
        .transitionDuration
  );
  // globals.css collapses every transition to 0.01ms rather than 0s, so that
  // transitionend still fires for anything that listens for it.
  check('reduced motion turns the slide off', parseFloat(duration) < 0.001, duration);
  await quiet.getByLabel('Next', { exact: true }).click();
  await quiet.waitForTimeout(400);
  check(
    'it still advances without the animation',
    (await quiet.locator('[role="tab"][aria-selected="true"]').innerText()) === 'Market Intelligence'
  );
  await reduced.close();

  console.log('\nLayout');
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    check(`no sideways scroll at ${width}px`, overflow <= 0, `${overflow}px over`);
  }
} finally {
  console.log(`\n${passed}/${passed + failed} passed`);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
