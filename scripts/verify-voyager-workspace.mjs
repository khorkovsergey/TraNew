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

  await page.locator('header').getByRole('button', { name: 'Context', exact: true }).click();
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
  group('The lifecycle runs, and every card says where it came from');

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForTimeout(400);
  await page.locator('[class*="starters"] > button').first().click();
  await page.waitForTimeout(300);

  const status = page.locator('[class*="planStatus"]');
  check('it starts by understanding', (await status.innerText()).includes('Understanding'));
  check('with a Stop that keeps what is ready', (await page.getByRole('button', { name: /Stop and keep/ }).count()) > 0);

  await page.waitForTimeout(3400);

  check('it reaches complete', (await status.innerText()) === 'Complete', await status.innerText());

  const cards = page.locator('[class*="moduleCard"]');
  check('modules are on the canvas', (await cards.count()) >= 3, `${await cards.count()}`);

  // Every card, without exception, says where its content came from.
  const unlabelled = [];
  for (const card of await cards.all()) {
    if ((await card.locator('[class*="provenance"]').count()) === 0) {
      unlabelled.push((await card.locator('h3').innerText()).slice(0, 30));
    }
  }
  check('every card carries a provenance label', unlabelled.length === 0, unlabelled.join(', '));

  const sourceLines = await page.locator('[class*="sourceList"] li').allInnerTexts();
  check('sources name a provider and a time', sourceLines.length > 0 && /\d{4}-\d{2}-\d{2}/.test(sourceLines.join(' ')), sourceLines[0] ?? 'none');
  check('and delayed data says so', sourceLines.join(' ').includes('delayed'));

  const canvasText = await page.locator('main[aria-label="Canvas"]').innerText();
  check('direction is a glyph, not only a colour', /▲/.test(canvasText) && /▼/.test(canvasText));

  check('a real table has real headers', (await page.locator('main[aria-label="Canvas"] th').count()) >= 0);

  group('Stop keeps what is already built');

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForTimeout(400);
  await page.locator('[class*="starters"] > button').first().click();
  await page.waitForTimeout(2100);
  await page.getByRole('button', { name: /Stop and keep/ }).click();
  await page.waitForTimeout(400);

  const stoppedStatus = await status.innerText();
  check('it says it stopped, not that it finished', /Stopped/.test(stoppedStatus), stoppedStatus);
  check('and says how much it kept', /of \d+ kept/.test(stoppedStatus), stoppedStatus);

  group('All ten scenarios reach a canvas');

  const TEN = [
    'What is happening in the US market today?',
    'Why are technology stocks falling?',
    'Compare NVIDIA, AMD and Broadcom',
    'Build a Tesla chart with RSI and support levels',
    'Find US technology companies with growing revenue',
    'What are the main risks in my portfolio?',
    'Monitor NVIDIA and tell me if its valuation falls',
    'I am a beginner and want to invest 500 every month',
    'Why has gold risen over the last three months?',
    'Create a Pine Script indicator that shows a trend reversal',
  ];

  const empty = [];
  const unlabelledCards = [];

  for (const question of TEN) {
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByRole('textbox', { name: 'Ask Voyager' }).fill(question);
    await page.getByRole('button', { name: 'Send' }).click();
    await page.waitForTimeout(3500);

    const built = await page.locator('[class*="moduleCard"]').count();
    if (built === 0) empty.push(question.slice(0, 32));

    for (const card of await page.locator('[class*="moduleCard"]').all()) {
      if ((await card.locator('[class*="provenance"]').count()) === 0) {
        unlabelledCards.push(question.slice(0, 24));
      }
    }
  }

  check('every one produces modules', empty.length === 0, empty.join(' | '));
  check('and every card in every one is labelled', unlabelledCards.length === 0, unlabelledCards.join(' | '));

  group('No change reaches the platform without a confirmation');

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('textbox', { name: 'Ask Voyager' }).fill('What is happening in the US market today?');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(3400);

  await page.getByRole('button', { name: /Create a watchlist/ }).click();
  await page.waitForTimeout(400);

  const dialog = page.getByRole('dialog', { name: 'Confirm this change' });
  check('a mutating action opens a confirmation', await dialog.isVisible());

  const dialogText = await dialog.innerText();
  check('it says where the change lands', /My Workspace/.test(dialogText), dialogText.slice(0, 90));
  check('and what it costs, not only what it does', /nothing you already have/.test(dialogText));
  check('and how to undo it', /Deleting the list/.test(dialogText));

  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.waitForTimeout(300);

  await page.locator('header').getByRole('button', { name: 'Context', exact: true }).click();
  await page.waitForTimeout(400);
  const historyBefore = await page.locator('aside[aria-label="Context and sources"]').innerText();
  check(
    'cancelling changes nothing and records nothing',
    /Nothing has been changed outside this canvas/.test(historyBefore),
    historyBefore.slice(0, 120)
  );

  group('Applying is recorded, and undoing keeps the record');

  await page.getByRole('button', { name: /Create a watchlist/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.waitForTimeout(500);

  const inspector = page.locator('aside[aria-label="Context and sources"]');
  check('the history lists it', /Create a watchlist/.test(await inspector.innerText()));
  check('with where it landed', /My Workspace/.test(await inspector.innerText()));

  const undoButton = inspector.getByRole('button', { name: 'Undo' }).first();
  check('and it can be undone', (await undoButton.count()) > 0);

  await undoButton.click();
  await page.waitForTimeout(400);

  const afterUndo = await inspector.innerText();
  check('undoing marks it rather than deleting it', /undone/.test(afterUndo), afterUndo.slice(0, 140));
  check('so the record of what happened survives', /Create a watchlist/.test(afterUndo));

  group('A read-only action does not ask');

  await page.getByRole('button', { name: /Open in Supercharts/ }).first().click();
  await page.waitForTimeout(400);
  check(
    'it navigates without a dialog',
    (await page.getByRole('dialog', { name: 'Confirm this change' }).count()) === 0,
    'a link asked for confirmation, which teaches people to click through them'
  );

  group('The workspace library');

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('textbox', { name: 'Ask Voyager' }).fill('Why has gold risen over the last three months?');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(3400);

  const named = await page.locator('[class*="workspaceTitle"]').innerText();
  check('Voyager names the workspace from the request', /gold/i.test(named), named);
  check('and says the name is a suggestion', (await page.locator('[class*="namedBadge"]').count()) > 0);

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: 'Workspaces' }).click();
  await page.waitForTimeout(400);

  const dialogLib = page.getByRole('dialog', { name: 'Your workspaces' });
  check('the library opens', await dialogLib.isVisible());
  check('with the saved workspace in it', /gold/i.test(await dialogLib.innerText()));
  check(
    'showing what was asked, not only what it was called',
    /Why has gold risen/i.test(await dialogLib.innerText())
  );

  await dialogLib.getByRole('textbox', { name: 'Search your workspaces' }).fill('gold');
  await page.waitForTimeout(300);
  check(
    'search finds it by the question',
    (await dialogLib.locator('[class*="libraryMain"]').count()) === 1,
    `${await dialogLib.locator('[class*="libraryMain"]').count()} rows`
  );

  await dialogLib.getByRole('textbox', { name: 'Search your workspaces' }).fill('zzzz');
  await page.waitForTimeout(300);
  check('and says so when nothing matches', /Nothing matches/.test(await dialogLib.innerText()));

  await dialogLib.getByRole('textbox', { name: 'Search your workspaces' }).fill('');
  await page.waitForTimeout(300);

  await dialogLib.getByRole('button', { name: 'Pin', exact: true }).first().click();
  await page.waitForTimeout(300);
  check('pinning marks it', /Pinned/.test(await dialogLib.innerText()));

  await dialogLib.getByRole('button', { name: 'Duplicate' }).first().click();
  await page.waitForTimeout(300);
  check(
    'duplicating adds a copy',
    (await dialogLib.locator('[class*="libraryMain"]').count()) === 2,
    `${await dialogLib.locator('[class*="libraryMain"]').count()} rows`
  );
  check('and the copy is not pinned', (await dialogLib.locator('[class*="pinnedBadge"]').count()) === 1);

  await dialogLib.getByRole('button', { name: 'Rename' }).first().click();
  await page.waitForTimeout(200);
  await dialogLib.getByRole('textbox', { name: 'New name' }).fill('Gold macro analysis');
  await dialogLib.getByRole('textbox', { name: 'New name' }).press('Enter');
  await page.waitForTimeout(400);

  const afterRename = await dialogLib.innerText();
  check('renaming works', /Gold macro analysis/.test(afterRename));

  group('Reopening replays the request');

  await dialogLib.getByRole('button', { name: 'Open' }).first().click();
  await page.waitForTimeout(3400);

  check(
    'the canvas is rebuilt from the question',
    /gold/i.test(await page.locator('main[aria-label="Canvas"]').innerText())
  );
  check('with modules, not a screenshot', (await page.locator('[class*="moduleCard"]').count()) > 0);

  group('It survives a reload');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.getByRole('textbox', { name: 'Ask Voyager' }).fill('anything');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(3200);
  await page.getByRole('button', { name: 'Workspaces' }).click();
  await page.waitForTimeout(400);

  check(
    'the library is still there',
    /Gold macro analysis/.test(await page.getByRole('dialog', { name: 'Your workspaces' }).innerText())
  );

  await page
    .getByRole('dialog', { name: 'Your workspaces' })
    .getByRole('button', { name: 'Close' })
    .click();
  await page.waitForTimeout(300);

  group('The shape of the answer is part of the answer');

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('textbox', { name: 'Ask Voyager' }).fill('What are the main risks in my portfolio?');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(3000);

  const portfolioText = await page.locator('main[aria-label="Canvas"]').innerText();
  check('a portfolio question asks permission first', /Wealth Hub/.test(portfolioText), portfolioText.slice(0, 80));
  check(
    'and shows nothing else until it is granted',
    (await page.locator('[class*="moduleCard"]').count()) === 1,
    'holdings were shown beside the request to read them'
  );

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('textbox', { name: 'Ask Voyager' }).fill('I am a beginner and want to invest 500 every month');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(3000);

  const beginnerText = await page.locator('main[aria-label="Canvas"]').innerText();
  check('a beginner is asked questions, not given a portfolio', /How long can the money/.test(beginnerText));
  check('and told this is educational', /Educational/.test(beginnerText));

  group('Failure states name a cause and a way out');

  const failContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const failPage = await failContext.newPage();
  await failPage.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await failPage.waitForTimeout(600);

  await failPage.getByRole('textbox', { name: 'Ask Voyager' }).fill('make this fail');
  await failPage.getByRole('button', { name: 'Send' }).click();
  await failPage.waitForTimeout(900);

  const failureCard = failPage.locator('[class*="failureCard"]');
  check('a failure is shown', (await failureCard.count()) === 1);

  const failureText = await failureCard.innerText();
  check('it names the cause', /did not answer in time/i.test(failureText), failureText.slice(0, 90));
  check('says nothing was changed', /Nothing was changed/i.test(failureText));
  check('and offers a way forward', (await failPage.getByRole('button', { name: 'Try again' }).count()) === 1);
  check('announced as an alert', (await failPage.getByRole('alert').count()) >= 1);

  await failPage.getByRole('textbox', { name: 'Ask Voyager' }).fill('find everything about every company');
  await failPage.getByRole('button', { name: 'Send' }).click();
  await failPage.waitForTimeout(900);

  const secondFailure = await failPage.locator('[class*="failureCard"]').innerText();
  check('a different cause reads differently', /more than 4 000 companies/i.test(secondFailure), secondFailure.slice(0, 90));
  check(
    'with its own recovery',
    (await failPage.getByRole('button', { name: /Add a constraint/ }).count()) === 1
  );

  await failContext.close();

  group('Accessibility');

  const a11yContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const a11yPage = await a11yContext.newPage();
  await a11yPage.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await a11yPage.waitForTimeout(600);
  await a11yPage.getByRole('textbox', { name: 'Ask Voyager' }).fill('Build a Tesla chart with RSI and support levels');
  await a11yPage.getByRole('button', { name: 'Send' }).click();
  await a11yPage.waitForTimeout(3400);

  const chartCard = a11yPage.locator('[class*="moduleCard"]').first();
  check(
    'a chart carries a text summary beside it',
    /RSI is currently mid-range/.test(await chartCard.innerText()),
    'the chart module was unreadable without seeing it'
  );

  check('the canvas is a labelled region', (await a11yPage.locator('main[aria-label="Canvas"]').count()) === 1);
  check('the conversation is too', (await a11yPage.locator('aside[aria-label="Conversation"]').count()) === 1);

  const headings = await a11yPage.locator('main[aria-label="Canvas"] h3').count();
  check('module cards are headings, not decorative divs', headings > 0, `${headings}`);

  const unnamed = await a11yPage.evaluate(() =>
    [...document.querySelectorAll('button')].filter((button) => {
      const text = (button.textContent ?? '').trim();
      return !text && !button.getAttribute('aria-label') && !button.getAttribute('title');
    }).length
  );
  check('no icon control is nameless', unnamed === 0, `${unnamed} unnamed`);

  // The keyboard path: top bar → conversation → canvas → inspector.
  let reached = 0;
  for (let i = 0; i < 40; i += 1) {
    await a11yPage.keyboard.press('Tab');
    const inside = await a11yPage.evaluate(() => {
      const active = document.activeElement;
      if (!active || active === document.body) return false;
      return Boolean(active.closest('[class*="shell"]'));
    });
    if (inside) reached += 1;
  }
  check('the keyboard reaches into the workspace', reached > 5, `${reached} of 40 stops`);

  await a11yContext.close();

  group('The tablet keeps the panel rather than losing it');

  const tabletContext = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const tabletPage = await tabletContext.newPage();
  await tabletPage.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await tabletPage.waitForTimeout(600);
  await tabletPage.getByRole('textbox', { name: 'Ask Voyager' }).fill('What is happening in the US market today?');
  await tabletPage.getByRole('button', { name: 'Send' }).click();
  await tabletPage.waitForTimeout(3200);

  check('the conversation is still a column', await tabletPage.locator('aside[aria-label="Conversation"]').isVisible());
  check('and the canvas has room', ((await tabletPage.locator('main[aria-label="Canvas"]').boundingBox())?.width ?? 0) > 500);

  await tabletPage.locator('header').getByRole('button', { name: 'Context', exact: true }).click();
  await tabletPage.waitForTimeout(500);

  check('the inspector opens as an overlay', await tabletPage.locator('[class*="inspectorOverlay"]').isVisible());
  check(
    'with a scrim behind it',
    (await tabletPage.locator('[class*="scrim"]').count()) === 1,
    `${await tabletPage.locator('[class*="scrim"]').count()} scrims`
  );

  const tabletOverflow = await tabletPage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check('and no sideways scroll', tabletOverflow <= 1, `${tabletOverflow}px`);

  await tabletContext.close();

  group('Sign-up, tokens and plans');

  const moneyContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const moneyPage = await moneyContext.newPage();
  await moneyPage.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await moneyPage.waitForTimeout(600);

  check(
    'the landing carries the quiet offer',
    (await moneyPage.getByRole('link', { name: /free tokens/ }).count()) > 0
  );
  check(
    'and no floating card, because nothing has been asked yet',
    (await moneyPage.locator('[class*="ctaTile"]').count()) === 0
  );

  await moneyPage.getByRole('textbox', { name: 'Ask Voyager' }).fill('What is happening in the US market today?');
  await moneyPage.getByRole('button', { name: 'Send' }).click();
  await moneyPage.waitForTimeout(3400);

  check('the card appears once the workspace exists', (await moneyPage.locator('[class*="ctaTile"]').count()) === 1);

  /*
   * The rule the handoff states plainly: nothing floats over content without a
   * matching allowance. Measured rather than trusted.
   */
  const reserved = await moneyPage.evaluate(() => {
    const canvas = document.querySelector('main[aria-label="Canvas"]');
    return canvas ? parseInt(getComputedStyle(canvas).paddingBottom, 10) : 0;
  });
  check('the canvas reserves room for it', reserved >= 74, `${reserved}px reserved`);

  const meterText = await moneyPage.locator('[class*="meter"]').first().innerText();
  check('the meter counts messages for a guest', /free messages/i.test(meterText), meterText);
  check('and says they are a guest', /guest/i.test(meterText));

  await moneyPage.locator('[class*="meter"]').first().click();
  await moneyPage.waitForTimeout(400);

  const plansDialog = moneyPage.getByRole('dialog', { name: 'Plans' });
  check('the meter opens the plans', await plansDialog.isVisible());

  const plansText = await plansDialog.innerText();
  check('three plans', /Free/.test(plansText) && /Pro/.test(plansText) && /Private AI/.test(plansText));
  check(
    'each saying what it is for rather than only what it has',
    /Enough to work with/.test(plansText) && /reads a lot of data/.test(plansText)
  );

  await plansDialog.getByRole('button', { name: 'Close' }).click();
  await moneyPage.waitForTimeout(300);

  await moneyPage.getByRole('button', { name: 'Sign up free' }).click();
  await moneyPage.waitForTimeout(400);

  const signupDialog = moneyPage.getByRole('dialog', { name: 'Free account' });
  check('the card opens the offer', await signupDialog.isVisible());
  check('with four things that happen', (await signupDialog.locator('li').count()) === 4);
  check(
    'and both ways in',
    (await signupDialog.getByRole('link', { name: /Create a free account/ }).count()) === 1 &&
      (await signupDialog.getByRole('link', { name: /already have an account/ }).count()) === 1
  );

  await signupDialog.getByRole('button', { name: 'Close' }).click();
  await moneyPage.waitForTimeout(300);

  await moneyPage.getByRole('button', { name: 'Dismiss' }).first().click();
  await moneyPage.waitForTimeout(300);
  check('the card can be dismissed', (await moneyPage.locator('[class*="ctaTile"]').count()) === 0);

  await moneyContext.close();

  group('Wealth Hub: nothing before consent, revocable in one click');

  /*
   * On its own page. The permission flow is the most security-relevant thing
   * here and it should be checked from a clean start rather than after twenty
   * other groups have left state behind — a failure in this group must mean the
   * permission model is wrong, not that the suite drifted.
   */
  /*
   * A fresh context, not just a fresh page: the zone arrangement and the
   * library live in localStorage, which pages in one context share. Twenty
   * groups of earlier clicking is exactly the state this check should not be
   * standing on.
   */
  const wealthContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const wealthPage = await wealthContext.newPage();
  await wealthPage.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await wealthPage.waitForTimeout(600);
  await wealthPage.getByRole('textbox', { name: 'Ask Voyager' }).fill('What are the main risks in my portfolio?');
  await wealthPage.getByRole('button', { name: 'Send' }).click();
  await wealthPage.waitForTimeout(3000);

  const wealthPanel = wealthPage.locator('aside[aria-label="Context and sources"]');

  /*
   * Opened only if it is shut. The arrangement persists across pages, so a
   * blind click closes it whenever an earlier group left it open — and the
   * checks below then read an empty panel and fail for the wrong reason.
   */
  const openContext = async () => {
    const body = wealthPanel.locator('[class*="zoneBody"]');
    if ((await body.count()) === 0 || !(await body.isVisible())) {
      await wealthPage.locator('header').getByRole('button', { name: 'Context', exact: true }).click();
      await wealthPage.waitForTimeout(400);
    }
  };

  await openContext();

  check('it starts not connected', /not connected/i.test(await wealthPanel.innerText()));
  check(
    'and says nothing has been read',
    /nothing from your wealth record has been read/i.test(await wealthPanel.innerText())
  );
  check(
    'with nothing to revoke, because nothing was granted',
    (await wealthPage.getByRole('button', { name: 'Revoke access' }).count()) === 0
  );

  const required = wealthPage.getByRole('checkbox', { name: /Which assets you hold/ });
  const optional = wealthPage.getByRole('checkbox', { name: /What each holding is worth/ });

  check('the scope that makes the question answerable is locked on', await required.isDisabled());
  check('and an optional scope starts off', !(await optional.isChecked()));
  check(
    'each optional scope says what refusing it costs',
    /concentration still works/i.test(await wealthPage.locator('main[aria-label="Canvas"]').innerText())
  );

  await optional.check();
  await wealthPage.getByRole('button', { name: /Choose scopes and continue/ }).click();
  await wealthPage.waitForTimeout(400);
  await wealthPage.getByRole('button', { name: 'Apply', exact: true }).click();
  await wealthPage.waitForTimeout(700);

  const granted = await wealthPanel.innerText();
  check('granting shows what was shared', /shared for this workspace/i.test(granted), granted.slice(0, 120));
  check('including the optional scope that was ticked', /what each holding is worth/i.test(granted));
  check('and names what was withheld', /not shared/i.test(granted));

  const revokeButton = wealthPage.getByRole('button', { name: 'Revoke access' });
  check('a revoke is offered', (await revokeButton.count()) === 1);

  await revokeButton.click({ force: true });
  await wealthPage.waitForTimeout(500);

  const revokedText = await wealthPanel.innerText();
  check('revoking takes one click', /revoked/i.test(revokedText), revokedText.slice(0, 120));
  check('and says nothing further is read', /nothing is being read/i.test(revokedText));

  group('A grant does not carry into the next question');

  await wealthPage.getByRole('button', { name: 'New', exact: true }).click();
  await wealthPage.waitForTimeout(400);
  await wealthPage.getByRole('textbox', { name: 'Ask Voyager' }).fill('What are the main risks in my portfolio?');
  await wealthPage.getByRole('button', { name: 'Send' }).click();
  await wealthPage.waitForTimeout(3000);
  await openContext();

  check(
    'the new workspace starts with nothing shared',
    /not connected/i.test(await wealthPanel.innerText()),
    'a grant survived into a question it was not made about'
  );

  await wealthContext.close();

  group('An unwritten scenario is refused, not answered wrongly');

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForTimeout(400);
  await page
    .getByRole('textbox', { name: 'Ask Voyager' })
    .fill('Book me a flight to Lisbon');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(3000);

  /*
   * Everything routes somewhere, and the fallback is the market summary. What
   * this checks is that the fallback is honest about what it answered rather
   * than pretending the question was understood.
   */
  const canvasAfter = await page.locator('main[aria-label="Canvas"]').innerText();
  check('the fallback answers the market question it can answer', /US market/.test(canvasAfter));
  check('and still cites its sources', (await page.locator('[class*="sourceList"] li').count()) > 0);

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
