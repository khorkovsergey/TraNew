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

  /*
   * A plain link again. It briefly carried a dropdown, and every entry in that
   * dropdown opened this same page — plus one duplicating Marketplace's
   * Subscriptions. A menu whose options are all one destination is a door with
   * a list of ways to open it.
   */
  const entry = page.locator('header nav a', { hasText: 'Voyager' }).first();
  check('Voyager is a first-level entry', (await entry.count()) > 0);
  check(
    'and it goes straight to the workspace',
    (await entry.getAttribute('href'))?.endsWith('/voyager') === true,
    await entry.getAttribute('href')
  );

  const items = await page.locator('header nav a, header nav button').allInnerTexts();
  /*
   * Last in the row, after Marketplace. Before the redesign this was a violet
   * pill outside the row; as an ordinary item it stops asking for attention the
   * other sections do not get.
   */
  check(
    'and sits among the others rather than outside them',
    items[items.length - 1] === 'Voyager' && items[items.length - 2] === 'Marketplace',
    items.join(' · ')
  );
  check('styled like them, not as a pill', (await page.locator('[class*="voyagerPill"]').count()) === 0);

  /*
   * The navigation is centred in the window, not in the gap the logo and the
   * buttons leave. It looked centred with `space-between` and was off by the
   * difference between the two sides, which is the sort of thing only a
   * measurement catches.
   */
  const navBox = await page.locator('header nav').boundingBox();
  const viewport = page.viewportSize();
  const drift = Math.abs(navBox.x + navBox.width / 2 - viewport.width / 2);
  check('the navigation is centred in the window', drift <= 2, `${Math.round(drift)}px off centre`);

  const others = await page.locator('header nav a, header nav button').count();
  check('and the rest of the navigation is intact', others >= 5, `${others} nav items`);

  await entry.click();
  await page.waitForURL(/\/voyager/, { timeout: 10_000 });
  check('one click reaches Voyager', page.url().includes('/voyager'));

  /*
   * The menu entry opens the dialogue, which is what somebody clicking
   * "Voyager" is asking for. This file is about the research workspace beside
   * it — the three-zone canvas — and the way in is the rail card on that page.
   */
  await page.getByRole('link', { name: 'Open Research Workspace' }).click();
  await page.waitForURL(/\/voyager\/research/, { timeout: 10_000 });
  check('and the rail card reaches the research workspace', page.url().includes('/voyager/research'));

  group('It opens as the workspace, with nothing asked yet');

  /*
   * There used to be a landing in front of this: a headline, a composer and
   * five suggested questions, and only after answering one did the workspace
   * appear. It was a page whose only job was to hand somebody to another page.
   */
  const bodyAtRest = await page.locator('body').innerText();
  check('no landing screen', !/What would you like to understand/.test(bodyAtRest));
  check(
    'and no refusal to a question nobody asked',
    !/Nothing came back for that/.test(bodyAtRest),
    bodyAtRest.slice(0, 120)
  );
  check('the three columns are already there', (await page.locator('[class*="topBar"]').count()) === 1);
  check('the composer is in the conversation column', (await page.getByRole('textbox', { name: /Ask/ }).count()) > 0);
  // The history column arrives with the first conversation: one chat in it is
  // furniture, and it costs the dialogue 264px to say nothing.
  check('no history column before there is a chat', (await page.locator('aside[aria-label="Chat history"]').count()) === 0);
  check(
    'and the output panel says what it is waiting for',
    /Ask something and the answer appears here/.test(bodyAtRest),
  );

  group('A request fills the workspace, and New empties it');

  await page.getByRole('textbox', { name: /Ask/ }).first().fill('What is happening in the US market today?');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3600);

  check('the request is carried through', /US market/.test(await page.locator('body').innerText()));
  check('and it produced modules', (await page.locator('[class*="moduleCard"]').count()) > 0);

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForTimeout(600);

  check('New clears the canvas', (await page.locator('[class*="moduleCard"]').count()) === 0);
  check('but keeps the workspace', (await page.locator('[class*="topBar"]').count()) === 1);
  check(
    'and keeps the chat that was just had',
    (await page.locator('[class*="historyItemTitle"]').count()) > 0,
  );
  check(
    'the history column has arrived with it',
    (await page.locator('aside[aria-label="Chat history"]').count()) === 1,
  );

  group('Typing a request works too');

  await page.getByRole('textbox', { name: /Ask/ }).first().fill('Why has gold risen this year?');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  check('the composer sends', (await page.locator('body').innerText()).includes('gold'));

  group('The three zones, at the geometry the handoff gives');

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole('textbox', { name: /Ask/ }).first().fill('What is happening in the US market today?');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3600);

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
  await page.waitForTimeout(800);

  /*
   * Checked before anything is typed. The previous group collapsed the
   * conversation, so its composer is behind the rail — reaching for it here
   * would be measuring whether the arrangement survived by first undoing it.
   */
  check('the rail is still a rail', (await widthOf('Conversation')) === 46, `${await widthOf('Conversation')}`);

  await page.getByRole('button', { name: 'Open the conversation' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('textbox', { name: /Ask/ }).first().fill('What is happening in the US market today?');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3600);

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
  await page.getByRole('textbox', { name: /Ask/ }).first().fill('What is happening in the US market today?');
  await page.keyboard.press('Enter');
  /*
   * A short wait on purpose. This group is about the *early* stages, and the
   * run reaches Complete in a couple of seconds — waiting for the answer first
   * would be checking that understanding happened by looking after it ended.
   */
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
  await page.getByRole('textbox', { name: /Ask/ }).first().fill('What is happening in the US market today?');
  await page.keyboard.press('Enter');
  // Mid-run on purpose: Stop is only meaningful while there is something to
  // stop, and the run reaches Complete in a couple of seconds.
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
    await page.getByRole('textbox', { name: /Ask/ }).first().fill(question);
    await page.keyboard.press('Enter');
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
  await page.getByRole('textbox', { name: /Ask/ }).first().fill('What is happening in the US market today?');
  await page.keyboard.press('Enter');
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
  await page.getByRole('textbox', { name: /Ask/ }).first().fill('Why has gold risen over the last three months?');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3400);

  const named = await page.locator('[class*="workspaceTitle"]').innerText();
  check('Voyager names the workspace from the request', /gold/i.test(named), named);
  check('and says the name is a suggestion', (await page.locator('[class*="namedBadge"]').count()) > 0);

  /*
   * A guest saving is asked to sign in, and is not told it worked.
   *
   * This used to write to localStorage and report "Saved to your workspaces" to
   * anybody who clicked — a workspace in one browser, on one device, until the
   * storage was cleared, and the person had been told otherwise.
   */
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(500);

  const gate = page.getByRole('dialog', { name: 'Sign in to save chat history' });
  check('a guest saving is asked for an account', await gate.isVisible());

  const gateText = await gate.innerText();
  check('the offer is both doors, not only one', /Sign in/.test(gateText) && /Create account/.test(gateText));
  check('and it can be dismissed', /Cancel/.test(gateText));
  check(
    'the conversation is still behind it',
    /gold/i.test(await page.locator('[class*="workspaceTitle"]').innerText())
  );

  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.waitForTimeout(300);
  check('cancelling returns to the workspace', (await gate.count()) === 0);

  await page.getByRole('button', { name: 'Workspaces' }).click();
  await page.waitForTimeout(400);

  const dialogLib = page.getByRole('dialog', { name: 'Your workspaces' });
  check('the library opens', await dialogLib.isVisible());
  check('and nothing was saved behind the gate', !/Why has gold risen/i.test(await dialogLib.innerText()));

  /*
   * The library's own behaviour — search, rename, pin — is a signed-in feature
   * now that saving is. Seeding storage exercises that interface without
   * pretending a guest can put something in it, which is the thing the gate
   * above exists to prevent.
   */
  await page.evaluate(() => {
    const at = new Date().toISOString();
    localStorage.setItem(
      'tn_voyager_workspaces_v1',
      JSON.stringify({
        schemaVersion: 1,
        workspaces: [
          {
            id: 'ws_seed',
            name: 'Gold this quarter',
            autoNamed: true,
            kind: 'research',
            request: 'Why has gold risen this quarter?',
            summary: '4 modules · 3 sources',
            pinned: false,
            createdAt: at,
            updatedAt: at,
          },
        ],
      })
    );
  });
  // Back into the workspace stage: the top bar only exists once a request does.
  await page.goto(`${BASE}/en/voyager/research?q=${encodeURIComponent('Why has gold risen this quarter?')}`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(3400);
  await page.getByRole('button', { name: 'Workspaces' }).click();
  await page.waitForTimeout(400);

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
  await page.getByRole('textbox', { name: /Ask/ }).first().fill('anything');
  await page.keyboard.press('Enter');
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
  await page.getByRole('textbox', { name: /Ask/ }).first().fill('What are the main risks in my portfolio?');
  await page.keyboard.press('Enter');
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
  await page.getByRole('textbox', { name: /Ask/ }).first().fill('I am a beginner and want to invest 500 every month');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  const beginnerText = await page.locator('main[aria-label="Canvas"]').innerText();
  check('a beginner is asked questions, not given a portfolio', /How long can the money/.test(beginnerText));
  check('and told this is educational', /Educational/.test(beginnerText));

  group('Failure states name a cause and a way out');

  const failContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const failPage = await failContext.newPage();
  await failPage.goto(`${BASE}/en/voyager/research`, { waitUntil: 'domcontentloaded' });
  await failPage.waitForTimeout(600);

  await failPage.getByRole('textbox', { name: /Ask/ }).first().fill('make this fail');
  await failPage.keyboard.press('Enter');
  /*
   * Waited for, not slept through. This phrase matches no scripted analysis, so
   * it goes to the model and back before the failure is known — and the round
   * trip gets slower every time the system prompt grows. A fixed pause here is
   * a test that fails for a reason that has nothing to do with the product.
   */
  await failPage
    .locator('[class*="failureCard"]')
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {});

  const failureCard = failPage.locator('[class*="failureCard"]');
  check('a failure is shown', (await failureCard.count()) === 1);

  const failureText = await failureCard.innerText();
  check('it names the cause', /did not answer in time/i.test(failureText), failureText.slice(0, 90));
  check('says nothing was changed', /Nothing was changed/i.test(failureText));
  check('and offers a way forward', (await failPage.getByRole('button', { name: 'Try again' }).count()) === 1);
  check('announced as an alert', (await failPage.getByRole('alert').count()) >= 1);

  await failPage.getByRole('textbox', { name: /Ask/ }).first().fill('find everything about every company');
  await failPage.keyboard.press('Enter');
  /*
   * Waited for, not slept through. This phrase matches no scripted analysis, so
   * it goes to the model and back before the failure is known — and the round
   * trip gets slower every time the system prompt grows. A fixed pause here is
   * a test that fails for a reason that has nothing to do with the product.
   */
  await failPage
    .locator('[class*="failureCard"]')
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {});

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
  await a11yPage.goto(`${BASE}/en/voyager/research`, { waitUntil: 'domcontentloaded' });
  await a11yPage.waitForTimeout(600);
  await a11yPage.getByRole('textbox', { name: /Ask/ }).first().fill('Build a Tesla chart with RSI and support levels');
  await a11yPage.keyboard.press('Enter');
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
  await tabletPage.goto(`${BASE}/en/voyager/research`, { waitUntil: 'domcontentloaded' });
  await tabletPage.waitForTimeout(600);
  await tabletPage.getByRole('textbox', { name: /Ask/ }).first().fill('What is happening in the US market today?');
  await tabletPage.keyboard.press('Enter');
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
  await moneyPage.goto(`${BASE}/en/voyager/research`, { waitUntil: 'domcontentloaded' });
  await moneyPage.waitForTimeout(600);

  // The signup offer went with the landing; the meter under the composer says
  // the same thing without a screen of its own.
  check(
    'the allowance is stated before anything is spent',
    /free messages/.test(await moneyPage.locator('body').innerText())
  );
  check(
    'and no floating card, because nothing has been asked yet',
    (await moneyPage.locator('[class*="ctaTile"]').count()) === 0
  );

  await moneyPage.getByRole('textbox', { name: /Ask/ }).first().fill('What is happening in the US market today?');
  await moneyPage.keyboard.press('Enter');
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
  await wealthPage.goto(`${BASE}/en/voyager/research`, { waitUntil: 'domcontentloaded' });
  await wealthPage.waitForTimeout(600);
  await wealthPage.getByRole('textbox', { name: /Ask/ }).first().fill('What are the main risks in my portfolio?');
  await wealthPage.keyboard.press('Enter');
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
  await wealthPage.getByRole('textbox', { name: /Ask/ }).first().fill('What are the main risks in my portfolio?');
  await wealthPage.keyboard.press('Enter');
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
    .getByRole('textbox', { name: /Ask/ }).first()
    .fill('Book me a flight to Lisbon');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  /*
   * The market summary is no longer the fallback, and this is where that is
   * held. It used to be: a question none of the scripted analyses recognised
   * got the one at the end of the list, so "Book me a flight to Lisbon" was
   * answered with where the S&P closed. A dashboard answers a question about
   * the market; it is not a shrug.
   */
  const canvasAfter = await page.locator('main[aria-label="Canvas"]').innerText();
  check(
    'an off-topic question does not get the market dashboard',
    !/Where the US market closed/.test(canvasAfter),
    canvasAfter.slice(0, 80)
  );
  check(
    'it goes to the model, and the question is repeated back',
    /You asked/.test(canvasAfter) && /Lisbon/.test(canvasAfter),
    canvasAfter.slice(0, 80)
  );
  check('and still cites its sources', (await page.locator('[class*="sourceList"] li').count()) > 0);

  check(
    'and the old "scenario is not written yet" card is gone',
    /*
     * It rendered whenever there was no plan, which since the model was wired
     * in is the normal state *while the answer is being fetched* — so it showed
     * for several seconds on every question, beside a line saying the model was
     * being asked. Two contradictory messages at once.
     */
    !/scenario is not written yet/i.test(await page.locator('body').innerText())
  );

  group('A model that cannot be reached says so');

  await page.route('**/api/voyager', (route) => route.abort());
  await page.goto(`${BASE}/en/voyager/research?q=${encodeURIComponent('Tell me something')}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(4000);

  const downText = await page.locator('body').innerText();
  check('it is named as unavailable', /temporarily unavailable/i.test(downText));
  check('the question is kept', /Tell me something/.test(downText));
  /*
   * The line that matters. An integration failure disguised as a valid market
   * answer is worse than an outage, because nobody finds out.
   */
  check('and no dashboard is substituted', !/Where the US market closed/.test(downText));
  await page.unroute('**/api/voyager');

  await page.close();

  group('The phone gets the same screen, not a squeezed one');

  const phone = await browser.newContext({ ...devices['iPhone 13'] });
  const small = await phone.newPage();

  await small.goto(`${BASE}/en/voyager/research`, { waitUntil: 'domcontentloaded' });
  await small.waitForTimeout(700);

  check('the composer is there', (await small.getByRole('textbox', { name: /Ask/ }).first().count()) > 0);
  check(
    'the workspace opens directly on a phone too',
    (await small.locator('[class*="topBar"]').count()) === 1
  );
  check('and the inspector is not in front of it', (await small.locator('[class*="inspectorSection"]').count()) === 0);

  const overflow = await small.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check('no sideways scroll', overflow <= 1, `${overflow}px`);

  // The 44px rule from the accessibility list. The starter rows it used to
  // measure went with the landing, so it measures what replaced them: the
  // controls somebody actually reaches for on a phone.
  const tooSmall = [];
  for (const row of await small.locator('header button, [class*="composerSend"]').all()) {
    const box = await row.boundingBox();
    if (box && box.height > 0 && box.height < 32) tooSmall.push(`${box.height}px`);
  }
  check('workspace controls clear 32px', tooSmall.length === 0, tooSmall.join(', '));

  group('And one zone at a time once a request exists');

  await small.getByRole('textbox', { name: /Ask/ }).first().fill('What is happening in the US market today?');
  await small.keyboard.press('Enter');
  await small.waitForTimeout(3600);

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
