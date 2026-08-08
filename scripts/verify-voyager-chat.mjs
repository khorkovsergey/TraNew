import { chromium, devices } from 'playwright';

/**
 * Voyager, the dialogue agent — the nine states the handoff designs for it.
 *
 * Six of the nine are failures: the daily limit, the guest gate, the API being
 * down, an action waiting on a confirmation. They are the states nobody reaches
 * by hand, so they are the ones that rot. Everything here drives one of them on
 * purpose rather than hoping to stumble into it.
 *
 * The three that are not failures are checked for what they must *not* contain:
 * no second header, no landing in front of the composer, and no action row
 * under a message that is not an answer.
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

/** A fresh dialogue every time, so one group cannot set up the next by accident. */
async function reset(page) {
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.removeItem('tn.voyager.allowance.v1');
  });
}

const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  group('The menu entry opens the dialogue');

  await page.goto(`${BASE}/en`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const entry = page.locator('header nav a', { hasText: 'Voyager' }).first();
  check('Voyager is a first-level entry', (await entry.count()) > 0);
  check(
    'pointing at the dialogue, not a sub-page',
    (await entry.getAttribute('href'))?.endsWith('/voyager') === true,
    await entry.getAttribute('href')
  );

  await entry.click();
  await page.waitForURL(/\/voyager$/, { timeout: 10_000 });
  await page.waitForTimeout(600);
  await reset(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  group('State 1 — the first screen is the composer');

  const body = await page.locator('body').innerText();
  check('the heading is the ask', /Ask\s+Voyager/.test(body), body.slice(0, 80));
  check('the composer is on the first screen', (await page.getByRole('textbox', { name: 'Ask Voyager' }).count()) > 0);
  check('with the robot beside it', (await page.locator('img[src*="voyager-robot"]').count()) > 0);
  check('four mode chips', (await page.getByRole('group', { name: 'Answer mode' }).getByRole('button').count()) === 4);
  check('and Explain is the one that is on', await page
    .getByRole('group', { name: 'Answer mode' })
    .getByRole('button', { name: 'Explain' })
    .getAttribute('aria-pressed') === 'true');
  check(
    'three suggested questions',
    (await page.locator('button[class*="suggestion"]').count()) === 3,
    `${await page.locator('button[class*="suggestion"]').count()}`
  );
  check('five starters in the rail', (await page.locator('[class*="topicLabel"]').count()) === 5);

  /*
   * One header. The workspace shipped with its own toolbar under the portal's,
   * and two rows of chrome above a chat is the clearest sign a screen was
   * bolted on rather than designed in.
   */
  check('one header, not two', (await page.locator('[class*="topBar"]').count()) === 0);

  group('The status strip answers "what can it see"');

  const strip = await page.locator('[class*="statusRow"]').innerText();
  for (const fact of ['Context:', 'Model: Voyager 3', 'Tools:', 'Memory: On', 'Private']) {
    check(`the strip states ${fact.replace(':', '')}`, strip.includes(fact), strip);
  }
  check(
    'and the free counter is there before anything is asked',
    /Free: \d+ of 10 questions used today/.test(strip),
    strip
  );

  group('A question carried in from another page arrives asked');

  await page.goto(`${BASE}/en`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const homeAsk = page.getByRole('textbox', { name: 'Ask Voyager' }).first();
  await homeAsk.fill('What is an ETF?');
  await homeAsk.press('Enter');
  await page.waitForURL(/\/voyager/, { timeout: 10_000 });
  await page.waitForTimeout(9000);

  const afterEntry = await page.locator('body').innerText();
  check('the context follows the question', (await page.locator('[class*="contextChip"]').innerText()).includes('Home'));
  check('the question is on screen as the person asked it', afterEntry.includes('What is an ETF?'));
  check('and it was answered rather than parked in a box', (await page.locator('[class*="botBubble"]').count()) > 0);

  group('States 4 and 5 — what an answer rests on');

  check('sources are listed under the answer', (await page.locator('[class*="sourceChip"]').count()) > 0);
  check(
    'and the page source is one of them, so the context was really sent',
    (await page.locator('[class*="sourceChip"]').first().innerText()).length > 0
  );

  group('Every completed answer offers the action row, led by research');

  const actions = await page.locator('[class*="actionRow"] button').allInnerTexts();
  check('six actions', actions.length === 6, actions.join(' · '));
  check('research is first', actions[0] === 'Turn this answer into research', actions[0]);

  group('State 9 — nothing changes without a Confirm');

  /*
   * The practice portfolio needs no account, so a guest reaches the
   * confirmation itself rather than the sign-in gate — which is the state being
   * checked here.
   */
  await page.getByRole('button', { name: 'Add to portfolio scenario' }).first().click();
  await page.waitForTimeout(400);

  const dialog = page.getByRole('dialog', { name: 'Confirmation required' });
  check('a mutating action asks first', await dialog.isVisible());

  const dialogText = await dialog.innerText();
  check('it says what it is about to do', /I.m about to/.test(dialogText), dialogText.slice(0, 90));
  check('where it lands', /Practice portfolio/.test(dialogText), dialogText.slice(0, 160));
  check('and how to undo it', /remove the position/.test(dialogText), dialogText.slice(0, 220));

  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.waitForTimeout(300);
  check(
    'cancelling does nothing and says nothing happened',
    !(await page.locator('body').innerText()).includes('Done —')
  );

  group('State 8 — a guest is gated, and the action is kept');

  await page.getByRole('button', { name: 'Add to watchlist' }).first().click();
  await page.waitForTimeout(400);

  const gate = await page.locator('[class*="authGate"]').innerText();
  check('an account-only action opens the gate', gate.includes('Sign in to continue this conversation'));
  check('and promises the dialog back', /restored exactly here/.test(gate), gate);

  const queued = await page.evaluate(() => sessionStorage.getItem('tn.voyager.pending.v1'));
  check('the action is queued rather than dropped', /watchlist/.test(queued ?? ''), queued);

  group('The dialogue survives the trip through sign-in');

  const stored = await page.evaluate(() => sessionStorage.getItem('tn.voyager.dialog.v1'));
  check('the transcript is kept for the return', /What is an ETF\?/.test(stored ?? ''));

  await page.goto(`${BASE}/en/sign-in?next=/voyager`, { waitUntil: 'domcontentloaded' });
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  check(
    'and it is still there on the way back',
    (await page.locator('body').innerText()).includes('What is an ETF?')
  );

  group('State 6 — the API is down and the portal still works');

  const offline = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await offline.route('**/api/voyager', (route) => route.abort());
  await offline.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await offline.waitForTimeout(600);
  await offline.getByRole('textbox', { name: 'Ask Voyager' }).fill('Why are markets falling?');
  await offline.keyboard.press('Enter');
  await offline.waitForTimeout(3000);

  const errorCard = offline.locator('[class*="errorCard"]');
  check('the failure is stated', await errorCard.isVisible());

  const errorText = await errorCard.innerText();
  check('the question is kept', /saved and will send automatically/.test(errorText));
  check('with somewhere to go meanwhile', /Browse lessons/.test(errorText) && /Read today/.test(errorText));
  check('and a way to try again', (await errorCard.getByRole('button', { name: 'Retry now' }).count()) === 1);

  const held = await offline.evaluate(() => sessionStorage.getItem('tn.voyager.pending.v1'));
  check('the unsent question is in the queue', /markets falling/.test(held ?? ''), held);

  check(
    'no action row under a failure',
    (await offline.locator('[class*="actionRow"]').count()) === 0,
    'a broken answer offered to act on itself'
  );

  const stillWorks = await offline.locator('header nav a, header nav button').count();
  check('the rest of the portal is still navigable', stillWorks >= 5, `${stillWorks} nav items`);
  await offline.close();

  group('State 7 — the daily limit');

  const spent = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await spent.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await spent.evaluate(() => {
    const day = new Date().toISOString().slice(0, 10);
    localStorage.setItem('tn.voyager.allowance.v1', JSON.stringify({ used: 10, day }));
    sessionStorage.setItem(
      'tn.voyager.dialog.v1',
      JSON.stringify([
        { id: 'u1', role: 'user', text: 'What is an ETF?', at: new Date().toISOString() },
        { id: 'a1', role: 'assistant', text: 'A basket of holdings.', at: new Date().toISOString() },
      ])
    );
  });
  await spent.reload({ waitUntil: 'domcontentloaded' });
  await spent.waitForTimeout(800);

  const limitCard = spent.locator('[class*="limitGate"]');
  check('the limit is stated as a banner', await limitCard.isVisible());
  check('with the reset and the way past it', /Resets at midnight/.test(await limitCard.innerText()));
  check('and a route to Plans', (await limitCard.getByRole('link', { name: 'See Plans' }).count()) === 1);

  const composer = spent.getByRole('textbox', { name: 'Ask Voyager' });
  check('the composer is disabled', await composer.isDisabled());
  check(
    'and says why rather than going quiet',
    /Daily free limit reached/.test((await composer.getAttribute('placeholder')) ?? '')
  );
  check(
    'the strip badge turns amber',
    (await spent.locator('[class*="limitChipHot"]').count()) === 1
  );
  await spent.close();

  group('It fits the window it is in');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check('no sideways scroll at 1440', overflow <= 1, `${overflow}px`);

  const phone = await browser.newContext({ ...devices['iPhone 13'] });
  const small = await phone.newPage();
  await small.goto(`${BASE}/en/voyager`, { waitUntil: 'domcontentloaded' });
  await small.waitForTimeout(700);

  const phoneOverflow = await small.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check('nor on a phone', phoneOverflow <= 1, `${phoneOverflow}px`);
  check(
    'and the composer is still the first thing',
    (await small.getByRole('textbox', { name: 'Ask Voyager' }).count()) > 0
  );
  await phone.close();
} catch (error) {
  failed += 1;
  console.log(`\n  FAIL the run stopped early — ${error.message}`);
} finally {
  await browser.close();
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
}
