import { chromium } from 'playwright';

/**
 * Journey A, driven end to end: diagnostic → plan → guest workspace.
 *
 * The rules are unit-tested. What cannot be tested there is whether the three
 * surfaces agree — the plan page, the workspace and the resume strip all read
 * one store, and the whole design depends on that being true rather than on
 * three screens rebuilding the route for themselves.
 *
 *   node scripts/verify-plan.mjs [baseUrl]
 */

const base = process.argv[2] ?? 'http://localhost:3210';

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

function group(title) {
  console.log(`\n${title}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();

const QUOTES_AN_ANSWER = /you (chose|said)|your (four )?answers|your horizon/i;

const option = (title) => page.locator('button', { hasText: title }).first();
const nextButton = () => page.getByRole('button', { name: /^(Continue|See my plan)$/ });

/** Answer the four questions with the given labels. */
async function runDiagnostic(labels) {
  await page.goto(`${base}/en/start`, { waitUntil: 'networkidle' });
  for (const label of labels) {
    await option(label).click();
    await page.waitForTimeout(150);
    await nextButton().click();
    await page.waitForTimeout(250);
  }
  await page.waitForURL(/\/start\/plan/, { timeout: 8000 });
  await page.waitForTimeout(400);
}

try {
  group('The result page refuses to invent a plan');

  await page.goto(`${base}/en/start/plan`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  check(
    'arriving with no answers sends you to the questions',
    page.url().includes('/start') && !page.url().includes('/plan'),
    page.url()
  );

  group('The wizard shows no route until there is one');

  await page.goto(`${base}/en/start`, { waitUntil: 'networkidle' });
  const rail = await page.locator('aside').innerText();
  check('the rail is a teaser, not a finished path', /being built/i.test(rail));
  check(
    'and it names no step before an answer exists',
    !/cash reserve|beginner path|practice portfolio/i.test(rail),
    rail.replace(/\n/g, ' · ').slice(0, 120)
  );

  group('Two different answer sets produce two different plans');

  await runDiagnostic(['All of it', 'Safety', 'Within a year', 'Short reads']);
  const cautious = await page.locator('#main ol').first().innerText();
  const cautiousSteps = await page.locator('#main ol > li').count();

  await context.clearCookies();
  await page.evaluate(() => window.localStorage.clear());

  await runDiagnostic(['I already invest', 'Growth', 'More than five years', 'By doing']);
  const confident = await page.locator('#main ol').first().innerText();
  const confidentSteps = await page.locator('#main ol > li').count();

  check('the step counts differ', cautiousSteps !== confidentSteps, `${cautiousSteps} vs ${confidentSteps}`);
  check('the routes read differently', cautious !== confident);
  check('the cautious one starts with a reserve', /cash reserve/i.test(cautious.split('\n')[1] ?? cautious));
  check('the confident one does not', !/cash reserve/i.test(confident));

  group('Every step says which answer produced it');

  const whys = await page.locator('#main ol > li').evaluateAll((nodes) =>
    nodes.map((node) => node.textContent ?? '')
  );
  check(
    'each carries a reason quoting an answer',
    // Second person, about something they told us. The save step points at the
    // four answers rather than at one of them, which is the honest thing it can
    // say: it is the one step no single answer produced.
    whys.every((text) => QUOTES_AN_ANSWER.test(text)),
    whys.find((text) => !QUOTES_AN_ANSWER.test(text))?.slice(0, 60)
  );

  group('The first outstanding step is the one the page pushes');

  const primaries = await page.locator('#main ol > li button[class*="stepCtaPrimary"]').count();
  check('exactly one primary action', primaries === 1, `${primaries}`);

  group('Progress is shared, not per screen');

  await page.locator('#main ol > li button', { hasText: 'Mark done' }).first().click();
  await page.waitForTimeout(300);
  const afterMark = await page.locator('#main').innerText();
  check('the plan page counts it', /1 of \d+ done/.test(afterMark), afterMark.match(/\d+ of \d+ done/)?.[0]);

  await page.goto(`${base}/en/workspace`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const workspace = await page.locator('#main').innerText();
  check('and so does the workspace', /step 2 of \d+/.test(workspace), workspace.match(/step \d+ of \d+/)?.[0]);
  check(
    'which offers the same next step',
    /Next: /.test(workspace) && !/Next: .*reserve/i.test(workspace)
  );

  group('The workspace says what it is');

  check('temporary, at the top, every visit', /stored in this browser only/i.test(workspace));
  check('and offers the way to keep it', /create an account to keep it/i.test(workspace));

  group('A reload loses nothing');

  await page.goto(`${base}/en/start/plan`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const reloaded = await page.locator('#main').innerText();
  check('the plan is still there', /Your plan is/i.test(reloaded));
  check('with the same progress', /1 of \d+ done/.test(reloaded));
  check('and the same profile', /Risk comfort/i.test(reloaded) && /high/i.test(reloaded));

  group('Editing an answer rebuilds the route');

  await page.locator('a', { hasText: 'Edit answers' }).first().click();
  await page.waitForURL(/\/start$/, { timeout: 8000 });
  await page.waitForTimeout(400);
  const restored = await page.locator('[role="radio"][aria-checked="true"], [role="checkbox"][aria-checked="true"]').count();
  check('the answers come back prefilled', restored >= 1, `${restored} selected`);
} finally {
  await browser.close();
}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
