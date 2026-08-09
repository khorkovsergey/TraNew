import { chromium } from 'playwright';

/**
 * "Find my next step", driven in a browser.
 *
 * The routing table is a pure function and could be unit-tested; what cannot be
 * tested that way is whether a person actually arrives somewhere. Every check
 * below ends on a real CTA and reads the href off it, because the failure this
 * script exists to catch is a recommendation that points at a route which is not
 * there — which is exactly what the four-question wizard it replaced used to do.
 *
 * It also checks the two promises the screen makes about privacy: the free text
 * a person types never reaches the URL, and the flow finishes without an
 * account.
 *
 *   node scripts/verify-start.mjs [baseUrl]
 */

const base = process.argv[2] ?? 'http://localhost:3410';
const url = `${base}/en/start`;

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${String(error.message).split('\n')[0]}`);
  }
}

function group(title) {
  console.log(`\n${title}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

/** The answer card carrying this title. Cards are buttons, and that is the point. */
const card = (title) => page.getByRole('radio', { name: new RegExp(escape(title)) }).first();

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Press an answer and wait for the screen it opens. */
async function pick(title, expect) {
  await card(title).click();
  await page.getByText(expect, { exact: false }).first().waitFor({ timeout: 8000 });
}

/** Back to a clean step 1, whatever screen we are on. */
async function restart() {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Where are you today?' }).waitFor({ timeout: 8000 });
}

/** The primary CTA on the result, and where it actually points. */
function primary() {
  return page.locator('main a[class*="primary"], a[class*="primary"]').first();
}

async function primaryHref() {
  await page.getByText('Your best next step').first().waitFor({ timeout: 8000 });
  return primary().getAttribute('href');
}

try {
  await restart();

  group('The router opens on a question, not on a profile');

  await check('step 1 asks where somebody is, and offers six answers', async () => {
    const count = await page.getByRole('radio').count();
    if (count !== 6) throw new Error(`expected 6 level cards, saw ${count}`);
  });

  await check('the obsolete plan wizard is gone', async () => {
    const body = await page.locator('body').innerText();
    for (const dead of ['Start investing with', 'Your profile', 'Your plan is ready', 'Your route']) {
      if (body.includes(dead)) throw new Error(`"${dead}" is still on the page`);
    }
  });

  await check('the progress rail has three markers and not four', async () => {
    const items = await page.locator('ol li').count();
    if (items !== 3) throw new Error(`expected 3 progress markers, saw ${items}`);
  });

  group('Flow A — beginner → Learn');

  await check('new + learn + step by step lands on Learn, pointing at /academy', async () => {
    await pick('I’m new to investing', 'What would you like to do?');
    await pick('Learn how investing works', 'How would you like to start?');
    await pick('Learn step by step', 'Your best next step');

    const href = await primaryHref();
    if (!href?.endsWith('/en/academy')) throw new Error(`CTA points at ${href}`);
  });

  await check('the result names at most two secondary cards', async () => {
    const also = await page.locator('[class*="alsoCard"]').count();
    if (also > 2) throw new Error(`expected at most 2 secondary cards, saw ${also}`);
  });

  group('Flow B — investor → Wealth Hub, as a guest');

  await check('organize routes straight to Wealth Hub with no third question', async () => {
    await restart();
    await pick('I already invest', 'What would you like to do?');
    await pick('Organize my financial picture', 'Your best next step');

    const title = await page.locator('h1').first().innerText();
    if (!title.includes('Wealth Hub')) throw new Error(`result was "${title}"`);
  });

  await check('the value is explained before the account is asked for', async () => {
    const body = await page.locator('body').innerText();
    const reason = body.indexOf('assets, liabilities and financial goals');
    const gate = body.indexOf('Available with a TradingNew account');
    if (reason < 0) throw new Error('the reason paragraph is missing');
    if (gate < 0) throw new Error('the account gate is missing');
    if (gate < reason) throw new Error('the gate is shown above the reason');
  });

  await check('create-account and sign-in both come back to /account/wealth', async () => {
    const up = await page.locator('a[href*="/sign-up"]').first().getAttribute('href');
    const inn = await page.locator('a[href*="/sign-in"]').first().getAttribute('href');
    if (!up?.includes('next=%2Faccount%2Fwealth') && !up?.includes('next=/account/wealth')) {
      throw new Error(`sign-up link is ${up}`);
    }
    if (!inn?.includes('next=%2Faccount%2Fwealth') && !inn?.includes('next=/account/wealth')) {
      throw new Error(`sign-in link is ${inn}`);
    }
  });

  group('Flow C — professional → TradingView, in two taps');

  await check('pro + tools skips the clarification entirely', async () => {
    await restart();
    await pick('I work with markets professionally', 'What would you like to do?');
    await pick('Use advanced trading tools', 'Your best next step');

    const title = await page.locator('h1').first().innerText();
    if (!title.includes('TradingView')) throw new Error(`result was "${title}"`);
  });

  await check('the external destination opens safely in a new tab', async () => {
    const link = primary();
    const [href, target, rel] = await Promise.all([
      link.getAttribute('href'),
      link.getAttribute('target'),
      link.getAttribute('rel'),
    ]);
    if (!href?.startsWith('https://www.tradingview.com')) throw new Error(`href is ${href}`);
    if (target !== '_blank') throw new Error('the link does not open in a new tab');
    if (!rel?.includes('noopener')) throw new Error(`rel is "${rel}" — noopener is the one that matters`);
  });

  await check('and it says so before the click', async () => {
    const body = await page.locator('body').innerText();
    if (!body.includes('Opens TradingView in a new tab')) throw new Error('no helper text');
  });

  group('Flow D — beginner → advanced tools is asked, not refused');

  await check('new + tools asks one more question and offers all three routes', async () => {
    await restart();
    await pick('I’m new to investing', 'What would you like to do?');
    await pick('Use advanced trading tools', 'Advanced tools are built for active market work');

    for (const option of [
      'Take me to the professional tools',
      'Show me the basics first',
      'Let me practice first',
    ]) {
      if ((await card(option).count()) === 0) throw new Error(`"${option}" is missing`);
    }
  });

  await check('“take me there anyway” is honoured', async () => {
    await pick('Take me to the professional tools', 'Your best next step');
    const href = await primary().getAttribute('href');
    if (!href?.startsWith('https://www.tradingview.com')) throw new Error(`href is ${href}`);
  });

  group('Flow E — intent beats level');

  await check('a professional who asks for an expert gets Expert Services', async () => {
    await restart();
    await pick('I work with markets professionally', 'What would you like to do?');
    await pick('Get help from an expert', 'Your best next step');

    const href = await primaryHref();
    if (!href?.endsWith('/en/marketplace/experts')) throw new Error(`CTA points at ${href}`);
  });

  group('Flows F and G — events keep their own filters');

  await check('an online event uses the real format=online filter', async () => {
    await restart();
    await pick('I know the basics', 'What would you like to do?');
    await pick('Find courses or events', 'What sounds more useful right now?');
    await pick('Join an online event', 'Your best next step');

    const href = await primaryHref();
    if (!href?.includes('/events?format=online')) throw new Error(`CTA points at ${href}`);
  });

  await check('events near me uses the map view rather than an invented filter', async () => {
    await restart();
    await pick('I know the basics', 'What would you like to do?');
    await pick('Find courses or events', 'What sounds more useful right now?');
    await pick('Find events near me', 'Your best next step');

    const href = await primaryHref();
    if (!href?.includes('view=map') || !href?.includes('sort=nearest')) {
      throw new Error(`CTA points at ${href}`);
    }
    if (href?.includes('format=nearby')) throw new Error('format=nearby is not a real filter');
  });

  group('Flow H — ambiguity ends in Voyager, not in more questions');

  await check('the step-1 escape reaches the free-text screen without choosing a level', async () => {
    await restart();
    await page.getByRole('button', { name: /Ask Voyager/ }).first().click();
    await page.getByRole('heading', { name: /figure it out together/ }).waitFor({ timeout: 8000 });
  });

  await check('an empty question cannot be sent', async () => {
    const send = page.getByRole('button', { name: /^Ask Voyager$/ });
    if (!(await send.isDisabled())) throw new Error('the CTA was enabled with an empty box');

    await page.locator('textarea').fill('   ');
    if (!(await send.isDisabled())) throw new Error('whitespace counted as a question');
  });

  await check('the typed question never reaches the URL', async () => {
    const secret = 'my pension is invested in something I cannot name';
    await page.locator('textarea').fill(secret);
    await page.getByRole('button', { name: /^Ask Voyager$/ }).click();
    await page.waitForURL(/\/voyager/, { timeout: 8000 });

    const current = page.url();
    if (current.includes('pension')) throw new Error(`the question is in the URL: ${current}`);
    if (!current.includes('context=')) throw new Error('Voyager was opened without any context');
  });

  group('Navigation');

  await check('Back returns one step and keeps the earlier answer', async () => {
    await restart();
    await pick('I already invest', 'What would you like to do?');
    await pick('Improve what I already have', 'What kind of help would be most useful?');

    await page.getByRole('button', { name: /^Back$/ }).click();
    await page.getByRole('heading', { name: 'What would you like to do?' }).waitFor({ timeout: 8000 });

    await page.getByRole('button', { name: /^Back$/ }).click();
    await page.getByRole('heading', { name: 'Where are you today?' }).waitFor({ timeout: 8000 });

    const checked = await page.locator('[role="radio"][aria-checked="true"]').count();
    if (checked !== 1) throw new Error(`expected the earlier answer to still be marked, saw ${checked}`);
  });

  await check('Start over clears everything', async () => {
    await restart();
    await pick('I already invest', 'What would you like to do?');
    await pick('Organize my financial picture', 'Your best next step');

    await page.getByRole('button', { name: /^Start over$/ }).click();
    await page.getByRole('heading', { name: 'Where are you today?' }).waitFor({ timeout: 8000 });

    const checked = await page.locator('[role="radio"][aria-checked="true"]').count();
    if (checked !== 0) throw new Error('an answer survived Start over');
  });

  await check('every answer card is a real button with a visible focus ring', async () => {
    const tag = await page.getByRole('radio').first().evaluate((node) => node.tagName);
    if (tag !== 'BUTTON') throw new Error(`answer cards render as <${tag.toLowerCase()}>`);

    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const active = document.activeElement;
      return active ? getComputedStyle(active).outlineStyle : 'none';
    });
    if (outline === 'none') throw new Error('the focused element has no outline');
  });

  group('The legacy flow is gone');

  await check('/start/plan forwards to the router', async () => {
    await page.goto(`${base}/en/start/plan`, { waitUntil: 'networkidle' });
    if (!page.url().endsWith('/en/start')) throw new Error(`landed on ${page.url()}`);
    await page.getByRole('heading', { name: 'Where are you today?' }).waitFor({ timeout: 8000 });
  });

  await check('the guest workspace no longer offers a plan to resume', async () => {
    await page.goto(`${base}/en/workspace`, { waitUntil: 'networkidle' });
    const body = await page.locator('body').innerText();
    for (const dead of ['Resume my plan', 'No plan yet', 'Save my plan']) {
      if (body.includes(dead)) throw new Error(`"${dead}" is still on the workspace`);
    }
    if (!body.includes('Find my next step')) throw new Error('the workspace does not point at the router');
  });

  await check('the whole flow was completed without an account', async () => {
    const cookies = await context.cookies();
    const session = cookies.find((cookie) => /session|auth/i.test(cookie.name));
    if (session) throw new Error(`a session cookie appeared: ${session.name}`);
  });
} finally {
  await browser.close();
}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
