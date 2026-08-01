import { chromium } from 'playwright';

/**
 * The top menu, driven rather than read.
 *
 * Where a dropdown lands is not visible in the source — the panel is fixed and
 * its `left` is computed at runtime — so every assertion here measures the
 * rendered box against the box of the item that opened it.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const HOME = `${BASE}/en`;

const MENUS = ['Market', 'Symbols', 'Economy', 'Community', 'Marketplace'];
const MARGIN = 12;

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

async function openAndMeasure(page, name) {
  const trigger = page.getByRole('button', { name, exact: true });
  await trigger.click();
  await page.waitForTimeout(200);

  const box = await page.evaluate(() => {
    const open = document.querySelector('[aria-expanded="true"]');
    // The panel is the fixed box that is not the header itself.
    const candidates = [...document.querySelectorAll('div')].filter((el) => {
      const style = getComputedStyle(el);
      return style.position === 'fixed' && style.zIndex === '50';
    });
    const panel = candidates[0];
    if (!panel || !open) return null;
    const p = panel.getBoundingClientRect();
    const t = open.getBoundingClientRect();
    return {
      panel: { left: p.left, right: p.right, width: p.width, top: p.top },
      trigger: { centre: t.left + t.width / 2 },
      viewport: window.innerWidth,
    };
  });

  return box;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(HOME, { waitUntil: 'networkidle' });

  console.log('\nEvery dropdown opens under the item that opened it');
  for (const name of MENUS) {
    const m = await openAndMeasure(page, name);
    if (!m) {
      check(`${name} panel is present`, false);
      continue;
    }

    const centre = m.panel.left + m.panel.width / 2;
    const clampedLeft = m.panel.left <= MARGIN + 1;
    const clampedRight = m.panel.right >= m.viewport - MARGIN - 1;
    const aligned = Math.abs(centre - m.trigger.centre) <= 2;

    check(
      `${name} is centred on its trigger (or clamped to an edge)`,
      aligned || clampedLeft || clampedRight,
      `panel centre ${Math.round(centre)}, trigger centre ${Math.round(m.trigger.centre)}`
    );
    check(`${name} stays on screen`, m.panel.left >= 0 && m.panel.right <= m.viewport,
      `${Math.round(m.panel.left)}…${Math.round(m.panel.right)} of ${m.viewport}`);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }

  console.log('\nNarrow window');
  await page.setViewportSize({ width: 900, height: 900 });
  await page.waitForTimeout(300);
  const narrow = await openAndMeasure(page, 'Marketplace');
  check(
    'the rightmost menu is pulled back on screen',
    narrow && narrow.panel.right <= narrow.viewport - MARGIN + 1,
    narrow ? `right edge ${Math.round(narrow.panel.right)} of ${narrow.viewport}` : 'no panel'
  );
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });

  console.log('\nOpening and closing still works');
  const marketplace = page.getByRole('button', { name: 'Marketplace', exact: true });
  await marketplace.click();
  await page.waitForTimeout(200);
  check('a click opens it', (await marketplace.getAttribute('aria-expanded')) === 'true');

  await marketplace.click();
  await page.waitForTimeout(200);
  check('a second click closes it', (await marketplace.getAttribute('aria-expanded')) === 'false');

  await marketplace.click();
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('Escape closes it', (await marketplace.getAttribute('aria-expanded')) === 'false');

  await marketplace.click();
  await page.waitForTimeout(200);
  await page.mouse.move(720, 700);
  await page.waitForTimeout(500);
  check(
    'leaving with the pointer closes it',
    (await marketplace.getAttribute('aria-expanded')) === 'false'
  );

  console.log('\nAfter scrolling');
  await page.mouse.wheel(0, 1500);
  await page.waitForTimeout(400);
  const scrolled = await openAndMeasure(page, 'Economy');
  check('a scrolled header still opens its menu', scrolled !== null);
  check(
    'and it is still under its trigger',
    scrolled && Math.abs(scrolled.panel.left + scrolled.panel.width / 2 - scrolled.trigger.centre) <= 2,
    scrolled
      ? `panel centre ${Math.round(scrolled.panel.left + scrolled.panel.width / 2)}, trigger ${Math.round(scrolled.trigger.centre)}`
      : 'no panel'
  );
} finally {
  console.log(`\n${passed}/${passed + failed} passed`);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
