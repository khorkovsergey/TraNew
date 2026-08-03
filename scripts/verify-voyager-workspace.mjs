import { chromium, devices } from 'playwright';

/**
 * The Voyager workspace landing.
 *
 * The handoff calls this the most important screen in the section, and states
 * the rule as a prohibition: with no request in flight the conversation panel,
 * the inspector, the canvas toolbar and the floating call to action are **not
 * rendered at all**. A prohibition is exactly the kind of thing that decays —
 * somebody adds a helpful widget, it looks fine, and the screen stops being the
 * thing it was designed to be. So it is checked rather than remembered.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

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

const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  group('Reaching it from the portal');

  await page.goto(`${BASE}/en`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const pill = page.getByRole('link', { name: 'AI Voyager' });
  check('AI Voyager is a first-level entry', (await pill.count()) > 0);

  const others = await page.locator('header nav a, header nav button').count();
  check('and the rest of the navigation is intact', others >= 5, `${others} nav items`);

  await pill.first().click();
  await page.waitForURL(/\/voyager/, { timeout: 10_000 });
  check('it leads to the workspace', page.url().includes('/voyager'));

  group('The empty state holds only what it is allowed to hold');

  await page.waitForTimeout(600);
  const body = await page.locator('body').innerText();

  check('the headline is the question', body.includes('What would you like to understand'));
  check('one supporting line', body.includes('Voyager shows the data it used'));

  const composer = page.getByRole('textbox', { name: 'Ask Voyager' });
  check('the composer is there', (await composer.count()) > 0);

  const starters = page.locator('[class*="starters"] > button');
  check('five starters, not four and not eight', (await starters.count()) === 5, `${await starters.count()}`);

  check('the More link', (await page.getByRole('button', { name: 'More things I can do' }).count()) > 0);
  check('the sign-up link', (await page.getByRole('link', { name: /free tokens/ }).count()) > 0);

  // The prohibitions. Each of these is a component the handoff says must not be
  // mounted before a request exists.
  for (const [what, selector] of [
    ['no conversation panel', '[class*="conversation"]'],
    ['no inspector', '[class*="inspector"]'],
    ['no canvas toolbar', '[class*="canvasBar"], [class*="toolbar"]'],
    ['no floating sign-up card', '[class*="floatingCta"], [class*="ctaCard"]'],
    ['no dashboard rail', '[class*="dashboard"], [class*="statRail"]'],
  ]) {
    check(what, (await page.locator(selector).count()) === 0);
  }

  group('The categories are behind the link, not on the screen');

  check(
    'they start hidden',
    (await page.locator('text=Understand the market').count()) === 0,
    'a category was visible before the link was pressed'
  );

  await page.getByRole('button', { name: 'More things I can do' }).click();
  await page.waitForTimeout(400);

  const categories = await page.locator('h2').allInnerTexts();
  check('five editorial categories appear', categories.length === 5, categories.join(' | '));
  check(
    'and the gated ones say so before the click',
    (await page.locator('text=Pro').count()) >= 4,
    'PRO badges missing'
  );

  await page.getByRole('button', { name: 'Hide examples' }).click();
  await page.waitForTimeout(300);
  check('the link closes them again', (await page.locator('h2').count()) === 0);

  group('A request assembles the workspace, and New goes back');

  await starters.first().click();
  await page.waitForTimeout(500);

  check('the landing is gone', !(await page.locator('body').innerText()).includes('What would you like to understand'));
  check('the request is carried through', (await page.locator('body').innerText()).includes('US market'));
  check('a workspace top bar exists now', (await page.locator('[class*="topBar"]').count()) > 0);

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForTimeout(400);

  check(
    'New returns to the bare screen',
    (await page.locator('body').innerText()).includes('What would you like to understand')
  );
  check('and the panels are still not there', (await page.locator('[class*="topBar"]').count()) === 0);

  group('Typing a request works too');

  await composer.fill('Why has gold risen this year?');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(500);
  check('the composer sends', (await page.locator('body').innerText()).includes('gold'));

  group('The three zones, at the geometry the handoff gives');

  // The previous group left a workspace open; the starters only exist on the
  // landing.
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForTimeout(400);
  await starters.first().click();
  await page.waitForTimeout(500);

  const widthOf = async (label) => {
    const box = await page
      .locator(`aside[aria-label="${label}"], main[aria-label="${label}"]`)
      .first()
      .boundingBox();
    return box ? Math.round(box.width) : 0;
  };

  check('conversation is 348 wide', (await widthOf('Conversation')) === 348, `${await widthOf('Conversation')}`);
  check('the canvas takes the rest', (await widthOf('Canvas')) > 700);
  check(
    'the inspector starts closed',
    !(await page.locator('aside[aria-label="Context and sources"]').isVisible()),
    'provenance was in front of the thing it is provenance for'
  );

  await page.getByRole('button', { name: 'Context' }).click();
  await page.waitForTimeout(400);
  check('and opens to 312', (await widthOf('Context and sources')) === 312, `${await widthOf('Context and sources')}`);

  await page.getByRole('button', { name: 'Collapse the conversation' }).click();
  await page.waitForTimeout(400);
  check('collapsing leaves a 46px rail, not nothing', (await widthOf('Conversation')) === 46);

  const rail = page.getByRole('button', { name: 'Open the conversation' });
  check('and the rail can reopen it', (await rail.count()) > 0);

  group('The arrangement survives a reload');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.locator('[class*="starters"] > button').first().click();
  await page.waitForTimeout(600);

  check('the rail is still a rail', (await widthOf('Conversation')) === 46, `${await widthOf('Conversation')}`);

  await page.getByRole('button', { name: 'Open the conversation' }).click();
  await page.waitForTimeout(400);

  group('Below 1180 the inspector becomes an overlay');

  await page.setViewportSize({ width: 1100, height: 900 });
  await page.waitForTimeout(500);

  const scrim = page.getByRole('button', { name: 'Close the context panel' }).first();
  check('it is open from the saved arrangement', await page.locator('aside[aria-label="Context and sources"]').isVisible());
  check('with a scrim behind it', (await scrim.count()) > 0);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check(
    'Escape closes it',
    !(await page.locator('aside[aria-label="Context and sources"]').isVisible()),
    'a panel over the content trapped the person'
  );

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.close();

  group('The phone gets the same screen, not a squeezed one');

  const phone = await browser.newContext({ ...devices['iPhone 13'] });
  const small = await phone.newPage();

  await small.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await small.waitForTimeout(700);

  check(
    'the headline is there',
    (await small.locator('body').innerText()).includes('What would you like to understand')
  );
  check('the composer is there', (await small.getByRole('textbox', { name: 'Ask Voyager' }).count()) > 0);
  check('and still no panels', (await small.locator('[class*="inspector"]').count()) === 0);

  const overflow = await small.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check('no sideways scroll', overflow <= 1, `${overflow}px`);

  // The 44px rule from the accessibility list.
  const tooSmall = [];
  for (const row of await small.locator('[class*="starters"] > button').all()) {
    const box = await row.boundingBox();
    if (box && box.height > 0 && box.height < 44) tooSmall.push(`${box.height}px`);
  }
  check('starter rows clear 44px', tooSmall.length === 0, tooSmall.join(', '));

  group('And one zone at a time once a request exists');

  await small.locator('[class*="starters"] > button').first().click();
  await small.waitForTimeout(600);

  const tabBar = small.getByRole('navigation', { name: 'Workspace zones' });
  check('the four tabs are there', (await tabBar.getByRole('button').count()) === 4);

  const visibleZones = async () => {
    let count = 0;
    for (const label of ['Conversation', 'Canvas', 'Context and sources']) {
      const zone = small.locator(`aside[aria-label="${label}"], main[aria-label="${label}"]`).first();
      if ((await zone.count()) && (await zone.isVisible())) count += 1;
    }
    return count;
  };

  check('exactly one zone is on screen', (await visibleZones()) === 1, `${await visibleZones()} visible`);

  await tabBar.getByRole('button', { name: 'Chat', exact: true }).click();
  await small.waitForTimeout(400);
  check('switching keeps it to one', (await visibleZones()) === 1, `${await visibleZones()} visible`);
  check('and it is the one asked for', await small.locator('aside[aria-label="Conversation"]').isVisible());

  const tabOverflow = await small.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check('still no sideways scroll in workspace mode', tabOverflow <= 1, `${tabOverflow}px`);

  await phone.close();
} catch (error) {
  failed += 1;
  console.log(`\n  FAIL the run stopped early — ${error.message}`);
} finally {
  await browser.close();
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}
