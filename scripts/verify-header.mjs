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

  /*
   * The Marketplace menu and the Marketplace hub describe the same four
   * categories. They had drifted apart — three of the four led somewhere
   * different depending on which one you used, and Merchandise opened the page
   * about choosing a broker. Two descriptions of one thing drift again unless
   * something compares them.
   */
  console.log('\nThe Marketplace menu and its hub agree');

  await page.goto(HOME, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Marketplace', exact: true }).click();
  await page.waitForTimeout(250);

  const menuHrefs = await page.evaluate(() => {
    const panel = [...document.querySelectorAll('div')].find(
      (el) => getComputedStyle(el).position === 'fixed' && getComputedStyle(el).zIndex === '50'
    );
    return [...panel.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  });
  await page.keyboard.press('Escape');

  check(
    'the menu no longer opens a copy of itself',
    !menuHrefs.includes('/en/marketplace'),
    'an entry leading back to the hub is present again'
  );

  await page.goto(`${BASE}/en/marketplace`, { waitUntil: 'networkidle' });
  const hubHrefs = await page.evaluate(() =>
    [...document.querySelectorAll('main a[href^="/en"]')]
      .map((a) => a.getAttribute('href'))
      .filter((href) => href !== '/en')
  );

  /*
   * One deliberate exception, listed rather than allowed by a loose rule.
   *
   * `/learning-events` groups two sections — Academy and Events — and the menu
   * points at both of them directly instead. It used to point at the grouping
   * page, which put "Learning and events" immediately above "Events near you"
   * and "Create an event": a row that led to a page containing the two rows
   * under it. The hub keeps the grouping page, where grouping is the job.
   *
   * Anything else missing from the menu is still a failure.
   */
  const groupingPages = ['/en/learning-events'];

  for (const href of hubHrefs) {
    if (groupingPages.includes(href)) continue;
    check(`the hub's ${href} is also in the menu`, menuHrefs.includes(href), menuHrefs.join(', '));
  }

  for (const href of ['/en/academy', '/en/events']) {
    check(
      `${href} is in the menu, so the grouping page hides nothing`,
      menuHrefs.includes(href),
      menuHrefs.join(', ')
    );
  }

  check(
    'Merchandise does not open the brokers page',
    !hubHrefs.includes('/en/brokers'),
    'the merchandise card points at /en/brokers again'
  );

  console.log('\nUnbuilt destinations say so before the click');

  await page.goto(HOME, { waitUntil: 'networkidle' });
  let badged = 0;
  let placeholders = 0;
  let mismatched = 0;

  for (const name of MENUS) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(250);

    const entries = await page.evaluate(() => {
      const panel = [...document.querySelectorAll('div')].find(
        (el) => getComputedStyle(el).position === 'fixed' && getComputedStyle(el).zIndex === '50'
      );
      return [...panel.querySelectorAll('a')].map((a) => ({
        href: a.getAttribute('href'),
        soon: a.textContent?.includes('Soon') ?? false,
      }));
    });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);

    for (const entry of entries) {
      const unbuilt = (entry.href ?? '').startsWith('/en/tool/');
      if (unbuilt) placeholders += 1;
      if (entry.soon) badged += 1;
      if (unbuilt !== entry.soon) mismatched += 1;
    }
  }

  check('every unbuilt destination is badged, and only those', mismatched === 0, `${mismatched} disagree`);
  check('the badge count matches the placeholder count', badged === placeholders, `${badged} badged, ${placeholders} placeholders`);
  check('and there is at least one to badge', placeholders > 0);

  console.log('\nSearch answers while you type');

  await page.goto(HOME, { waitUntil: 'networkidle' });
  const field = page.getByPlaceholder(/Search any asset/i);

  await field.fill('Tes');
  await page.waitForTimeout(400);
  const symbolRows = await page.locator('[role="option"]').allInnerTexts();
  check('a known asset is offered', symbolRows.some((row) => row.includes('Tesla')), symbolRows.join(' / '));

  await field.fill('event');
  await page.waitForTimeout(400);
  const sectionRows = await page.locator('[role="option"]').allInnerTexts();
  check('a section is offered', sectionRows.some((row) => row.includes('Events')), sectionRows.join(' / '));

  await field.fill('qqqzzz');
  await page.waitForTimeout(400);
  const fallback = await page.locator('[role="option"]').allInnerTexts();
  check('an unknown query still offers a way forward', fallback.length > 0, 'nothing offered');

  await field.press('ArrowDown');
  await field.press('Enter');
  await page.waitForTimeout(1200);
  check('the keyboard can take a suggestion', page.url().includes('/research'), page.url());

  await page.goto(HOME, { waitUntil: 'networkidle' });
  await page.getByPlaceholder(/Search any asset/i).fill('Tes');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check('Escape closes the list', (await page.locator('[role="option"]').count()) === 0);

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
} catch (error) {
  /*
   * Without this an exception halfway through lands in `finally`, which prints
   * the checks that did run and exits zero — a suite that stopped early
   * reporting itself as a suite that passed.
   */
  failed += 1;
  console.log(`\n  FAIL the run stopped early — ${String(error).split('\n')[0]}`);
} finally {
  console.log(`\n${passed}/${passed + failed} passed`);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
