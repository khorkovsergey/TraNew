import { chromium } from 'playwright';

/**
 * Explore, clicked rather than read.
 *
 * A QA pass found that nine of the eleven clickable things in this section
 * ended somewhere useless: a placeholder screen, an empty research page, a dead
 * SOON button, or a comparison that did not contain the thing being compared.
 * This suite walks every one of them, because "it links somewhere" and "it
 * links somewhere worth arriving at" are different claims and only the second
 * one matters.
 *
 *   node scripts/verify-explore.mjs [baseUrl]
 */

const base = process.argv[2] ?? 'http://localhost:3210';
const CLASSES = ['stocks', 'etfs', 'bonds', 'cash', 'crypto', 'property'];

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

/** The placeholder screen, and the empty answer. Neither may end a journey. */
const DEAD_ENDS = [/high-fidelity build/i, /Ask a question from the search/i];

async function isDeadEnd(page) {
  const body = await page.locator('#main').innerText();
  return DEAD_ENDS.some((pattern) => pattern.test(body));
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1512, height: 1000 } });

try {
  await page.goto(`${base}/en/explore`, { waitUntil: 'networkidle' });

  group('The tabs are asset classes, and only asset classes');

  const tabs = await page.locator('[role="radio"]').allInnerTexts();
  check('six of them', tabs.length === 6, tabs.join(' · '));
  check(
    'Economy is not among them',
    !tabs.some((tab) => /economy/i.test(tab)),
    tabs.join(' · ')
  );
  check('Stocks is the one selected on arrival', tabs[0].includes('Stocks'));
  check(
    'and it is the selected one',
    (await page.locator('[role="radio"][aria-checked="true"]').innerText()).includes('Stocks')
  );

  group('Every tab moves all three columns');

  for (const label of ['Stocks', 'ETFs', 'Bonds', 'Cash & Deposits', 'Crypto', 'Property']) {
    await page.locator('[role="radio"]', { hasText: label }).first().click();
    await page.waitForTimeout(200);

    const understand = await page.locator('section', { hasText: 'Understand this option' }).first().innerText();
    const compare = await page.locator('section', { hasText: 'Compare options' }).first().innerText();
    const ask = await page.locator('section', { hasText: 'Ask Voyager about this option' }).first().innerText();

    /*
     * The stem rather than the label: the Ask column speaks in sentences and
     * uses the singular subject — "I can explain how a bond works" — so looking
     * for the plural heading there tests the grammar, not the wiring.
     */
    const stem = label.split(' ')[0].replace(/s$/, '').toLowerCase();
    const mentions = (text) => text.toLowerCase().includes(stem);
    check(
      `${label}: all three columns follow the tab`,
      mentions(understand) && mentions(compare) && mentions(ask),
      `understand:${mentions(understand)} compare:${mentions(compare)} ask:${mentions(ask)}`
    );
  }

  group('Nothing clickable is a dead end');

  /*
   * Scoped to the section. The site footer also badges its placeholder links,
   * and there the badge is doing its job — it warns before the click rather
   * than after it. Inside Explore nothing clickable is allowed to be a
   * placeholder at all, which is a stronger rule and the one being checked.
   */
  check(
    'no SOON badge sits on anything clickable in Explore',
    (await page.locator('#main a:has-text("Soon"), #main button:has-text("Soon")').count()) === 0
  );

  const exploreLinks = await page
    .locator('#main a[href]')
    .evaluateAll((nodes) => nodes.map((node) => new URL(node.href).pathname));
  check(
    'and nothing links to the placeholder screen',
    exploreLinks.every((path) => !path.startsWith('/en/tool/')),
    exploreLinks.filter((path) => path.startsWith('/en/tool/')).join(', ')
  );

  group('Learn more opens a real page');

  for (const slug of CLASSES) {
    await page.goto(`${base}/en/explore/${slug}`, { waitUntil: 'domcontentloaded' });
    const dead = await isDeadEnd(page);
    const body = await page.locator('#main').innerText();
    check(
      `/en/explore/${slug} is a written page`,
      !dead && body.length > 1200 && /Main risks/.test(body),
      dead ? 'placeholder' : `${body.length} chars`
    );
  }

  const redirect = await page.request.get(`${base}/en/tool/etfs`, { maxRedirects: 0 });
  check(
    '/en/tool/etfs answers 301',
    redirect.status() === 301,
    `${redirect.status()} → ${redirect.headers()['location'] ?? '(none)'}`
  );
  check(
    'and points at the new page',
    (redirect.headers()['location'] ?? '').includes('/en/explore/etfs')
  );

  group('Compare in detail carries the comparison');

  await page.goto(`${base}/en/explore`, { waitUntil: 'networkidle' });
  await page.locator('[role="radio"]', { hasText: 'Bonds' }).first().click();
  await page.waitForTimeout(200);
  await page.locator('a', { hasText: 'Compare in detail' }).first().click();
  await page.waitForURL(/\/research/, { timeout: 8000 });
  await page.waitForTimeout(400);

  const comparison = await page.locator('#main').innerText();
  check('it is a comparison, not the canned answer', !/Direct answer/i.test(comparison));
  check('the class you were reading about is in it', /Bonds/.test(comparison));
  check('so are its two alternatives', /ETFs/.test(comparison) && /Cash/.test(comparison));
  check('all six measures are shown', /Ease of selling/.test(comparison) && /Minimum amount/.test(comparison));
  check('and each column offers its own page', /Understand Bonds/.test(comparison));

  group('Every "Try asking" question is answered');

  await page.goto(`${base}/en/explore`, { waitUntil: 'networkidle' });

  for (const label of ['Stocks', 'ETFs', 'Bonds', 'Cash & Deposits', 'Crypto', 'Property']) {
    await page.goto(`${base}/en/explore`, { waitUntil: 'networkidle' });
    await page.locator('[role="radio"]', { hasText: label }).first().click();
    await page.waitForTimeout(200);

    const chips = page.locator('button', { hasText: '?' });
    const question = (await chips.first().innerText()).trim();

    await chips.first().click();
    await page.waitForURL(/\/voyager/, { timeout: 8000 });
    await page.waitForTimeout(5500);

    const answer = await page.locator('#main').innerText();
    check(
      `${label}: "${question.slice(0, 40)}…" is answered`,
      answer.includes(question) && !/Where the US market closed/.test(answer),
      /Where the US market closed/.test(answer) ? 'got the market summary' : 'question not shown'
    );
  }

  group('See all options opens a catalogue');

  await page.goto(`${base}/en/explore/options`, { waitUntil: 'domcontentloaded' });
  const catalogue = await page.locator('#main').innerText();
  check('it is not a dead end', !(await isDeadEnd(page)));
  check('every class is listed', CLASSES.every((slug) => catalogue.toLowerCase().includes(slug.slice(0, 5))));
  check(
    'and both actions are on every card',
    (await page.locator('a', { hasText: 'Understand' }).count()) >= 6 &&
      (await page.locator('a', { hasText: 'Compare' }).count()) >= 6
  );

  group('Explore more is a block, not a row of tabs');

  await page.goto(`${base}/en/explore`, { waitUntil: 'networkidle' });
  const more = page.locator('section', { hasText: 'Explore more' }).last();
  check('the section exists', (await more.count()) > 0);
  check('Economy is in it', (await more.innerText()).includes('Economy'));

  // The tab row and this block must not look like the same control.
  const tabBox = await page.locator('[role="radio"]').first().boundingBox();
  const cardBox = await more.locator('a').first().boundingBox();
  check(
    'and it does not look like a tab',
    cardBox && tabBox && Math.abs(cardBox.height - tabBox.height) > 20,
    `tab ${tabBox?.height} vs card ${cardBox?.height}`
  );
} finally {
  await browser.close();
}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
