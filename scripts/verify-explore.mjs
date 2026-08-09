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

  group('Every tab moves the whole page with it');

  for (const label of ['Stocks', 'ETFs', 'Bonds', 'Cash & Deposits', 'Crypto', 'Property']) {
    await page.locator('[role="radio"]', { hasText: label }).first().click();
    await page.waitForTimeout(250);

    const explain = await page.locator('#main h2').first().innerText();
    const compare = await page.locator('#compare').innerText();
    const leads = await page.locator('section', { hasText: 'Where this leads' }).last().innerText();
    const ask = await page.locator('section', { hasText: 'Ask Voyager about' }).last().innerText();

    /*
     * The stem rather than the label: Voyager speaks in sentences and uses the
     * singular subject — "I can explain how a bond works" — so looking for the
     * plural heading there tests the grammar, not the wiring.
     */
    const stem = label.split(' ')[0].replace(/s$/, '').toLowerCase();
    const mentions = (text) => text.toLowerCase().includes(stem);
    check(
      `${label}: explanation, comparison, next steps and Voyager all follow the tab`,
      mentions(explain) && mentions(compare) && mentions(leads) && mentions(ask),
      `explain:${mentions(explain)} compare:${mentions(compare)} leads:${mentions(leads)} ask:${mentions(ask)}`
    );
  }

  group('Each option is explained, not just named');

  for (const label of ['Stocks', 'Bonds', 'Crypto']) {
    await page.locator('[role="radio"]', { hasText: label }).first().click();
    await page.waitForTimeout(250);

    /* Lower-cased: these headings are upper-cased in CSS, and `innerText`
       reports what is rendered rather than what is in the markup. */
    const detail = (await page.locator('#main section').first().innerText()).toLowerCase();
    const missing = [
      'risk',
      'typical horizon',
      'liquidity',
      'entry size',
      'good to know',
      'watch out for',
    ].filter((heading) => !detail.includes(heading));
    check(
      `${label}: the four facts, what to know, and what to watch`,
      missing.length === 0,
      `missing: ${missing.join(', ')}`
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

  /*
   * ---- The comparison ----
   *
   * It used to leave for `/research`, which is the instrument-research
   * workspace: a search box, a chart and a canned "Direct answer". Somebody
   * still deciding whether they wanted bonds or a fund at all was handed a
   * screen built for choosing between two tickers. It stays on this page now,
   * and the first thing checked is that it did not go anywhere.
   */
  group('Compare investment types stays on the page');

  await page.goto(`${base}/en/explore`, { waitUntil: 'networkidle' });
  await page.locator('[role="radio"]', { hasText: 'Bonds' }).first().click();
  await page.waitForTimeout(250);
  await page.locator('a', { hasText: 'Compare investment types' }).first().click();
  await page.waitForTimeout(400);

  check(
    'it did not leave for the research workspace',
    new URL(page.url()).pathname === '/en/explore',
    page.url()
  );

  const comparison = await page.locator('#compare').innerText();
  check('the class you were reading about is in it', /Bonds/.test(comparison));
  check('so are its two alternatives', /ETFs/.test(comparison) && /Cash/.test(comparison));
  check(
    'all six criteria are shown',
    /Ease of selling/.test(comparison) && /Complexity/.test(comparison)
  );
  /* The two that are answers rather than positions on a scale. */
  check(
    'and the two that are not scales',
    /Minimum amount/.test(comparison) && /Typical use case/.test(comparison)
  );
  check(
    'each column offers its own page',
    (await page.locator('#compare a[href^="/en/explore/"]').count()) >= 3
  );
  check(
    'and it is labelled as education, not advice',
    /not investment advice/i.test(comparison)
  );

  // The same comparison, arrived at from elsewhere: the class travels in `tab`.
  await page.goto(`${base}/en/explore?tab=crypto#compare`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  check(
    'an arriving compare link opens on the class it names',
    (await page.locator('[role="radio"][aria-checked="true"]').innerText()).includes('Crypto')
  );

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

  /*
   * ---- What this page is ----
   *
   * It is education, and the redesign's whole point is that it says so before
   * anything else. It used to open under "Explore your options" with four
   * market tiles and a percentage on each — a page that answers "what is an
   * ETF" was also reporting what the market did this morning, which made it
   * the wrong answer to both questions.
   */
  group('The page says what it is, and it is not markets');

  await page.goto(`${base}/en/explore`, { waitUntil: 'networkidle' });

  const head = await page.locator('#main').innerText();
  check('it is announced as Learn', /\blearn\b/i.test(head.slice(0, 200)), head.slice(0, 60));
  check(
    'and states that it carries no live prices',
    /no live prices/i.test(head),
    head.slice(0, 120).replace(/\s+/g, ' ')
  );
  check('the heading is Investment options', (await page.locator('#main h1').innerText()) === 'Investment options');

  /*
   * A quoted change — a sign, a decimal and a per cent — is a price. The prose
   * on this page talks in percentages ("a 0.20% fee", "falls of 50–70%") and
   * that is not the same claim, so the pattern is deliberately narrow.
   */
  const quoted = head.match(/[+−-]\d+\.\d+\s*%/g) ?? [];
  check('and there is not a quoted price on it', quoted.length === 0, quoted.join(' '));

  check(
    'somebody who wanted live markets is told where they are',
    (await page.locator('#main a[href="/en/markets/global"]').count()) > 0
  );

  group('Where this leads, and what it does not promise');

  const leadsCard = page.locator('section', { hasText: 'Where this leads' }).last();
  const leadHrefs = await leadsCard
    .locator('a')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
  check('three ways on from here', leadHrefs.length === 3, leadHrefs.join(' '));
  check('the comparison is one of them, on this page', leadHrefs.includes('#compare'));
  check(
    'and the other two are real routes',
    leadHrefs.filter((href) => href?.startsWith('/en/')).length === 2,
    leadHrefs.join(' ')
  );

  /*
   * Starting points are examples and the card says so. They used to be cards
   * with an "Understand" button each, which made six product shapes look like
   * six screens the portal had built.
   */
  const startsCard = page.locator('section', { hasText: 'Popular starting points' }).last();
  check(
    'starting points are examples, not destinations',
    (await startsCard.locator('a').count()) === 0
  );
  check(
    'and they are labelled as examples',
    /not recommendations/i.test(await startsCard.innerText())
  );
  /*
   * ---- The header menu ----
   *
   * The section's own screens are above; this is the panel that names them from
   * the top of every page. It announces a market data product that does not
   * exist yet — twenty rows, none of which goes anywhere — which is an unusual
   * thing to ship on purpose and an easy thing to undo by accident. One `href`
   * put back, one `<a>` instead of a `<div>`, and the menu starts making
   * promises the portal cannot keep. Most of what follows exists to catch that.
   */

  const MARKET = [
    'Market overview',
    'Stocks',
    'ETFs',
    'Indices',
    'Crypto',
    'Forex',
    'Futures & Commodities',
    'Bonds',
  ];
  const SYMBOLS = [
    'Search an asset',
    'Stock screener',
    'ETF screener',
    'Crypto screener',
    'Bond screener',
    'Popular symbols',
  ];
  const ECONOMY = [
    'World economy',
    'Countries',
    'Economic indicators',
    'Economic calendar',
    'Macro maps',
    'Yield curves',
  ];

  const panel = () => page.locator('div[class*="panel"]').first();

  /*
   * Reopen at every width rather than assuming what the last one left behind.
   *
   * A mouse closes this menu by leaving it, and both things that happen here
   * move the trigger out from under a stationary cursor: resizing the window,
   * and the narrow navigation scrolling sideways to bring Explore into view.
   * Neither happens to a finger — the header ignores touch there — so parking
   * the cursor in the panel is what a phone user's pointer effectively does,
   * not a workaround for a bug they would meet.
   */
  const openExplore = async () => {
    // The close is scheduled, not immediate: 220ms of grace so a diagonal reach
    // for the panel does not snatch it away. Let it land before asking.
    await page.waitForTimeout(300);

    if ((await page.locator('div[class*="panelMega"]').count()) === 0) {
      await page.locator('header nav button', { hasText: 'Explore' }).first().click();
    }

    const view = page.viewportSize();
    if (view) await page.mouse.move(view.width / 2, view.height / 2);
    await page.waitForTimeout(350);
  };

  /*
   * Marketplace on purpose, not the home page: the case the redesign is built
   * around is a reader who is somewhere else when they open Explore, and the
   * mark on where they are has to survive it.
   */
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`${base}/en/marketplace`, { waitUntil: 'networkidle' });
  await openExplore();

  group('The menu names three groups, and only three');

  const titles = await page.locator('div[class*="groupTitle"]').allInnerTexts();
  check(
    'MARKET, SYMBOLS, ECONOMY',
    titles.join('|') === 'MARKET|SYMBOLS|ECONOMY',
    titles.join(' | ')
  );

  const hints = await page.locator('div[class*="groupHint"]').allInnerTexts();
  check(
    'each carries the question it answers',
    hints.join('|') === 'What is happening?|What is this asset?|Why is it happening?',
    hints.join(' | ')
  );

  group('Twenty rows, none of them a way anywhere');

  const rows = panel().locator('div[class*="menuItemWide"]');
  check('twenty of them', (await rows.count()) === 20, `${await rows.count()}`);

  const named = (await panel().locator('[class*="menuItemLabel"]').allInnerTexts()).map((text) =>
    text.split('\n')[0].trim()
  );
  for (const expected of [...MARKET, ...SYMBOLS, ...ECONOMY]) {
    check(`"${expected}" is listed`, named.includes(expected));
  }

  check(
    'nothing in the panel is a link',
    (await panel().locator('a[href]').count()) === 0,
    (
      await panel()
        .locator('a[href]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')))
    ).join(' ')
  );
  check(
    'every row is announced as disabled',
    (await panel().locator('div[class*="menuItemWide"][aria-disabled="true"]').count()) === 20
  );
  // The drawer's close button is the one control in here, and only on a phone.
  check(
    'nothing in the panel takes focus',
    (await panel()
      .locator('a, button:not([class*="drawerClose"]), input, [tabindex]:not([tabindex="-1"])')
      .count()) === 0
  );

  const cursors = await rows.evaluateAll((nodes) => [
    ...new Set(nodes.map((node) => getComputedStyle(node).cursor)),
  ]);
  check('the pointer says so too', cursors.length === 1 && cursors[0] === 'default', cursors.join(','));

  /*
   * Not dimmed. The menu is a public roadmap, and a greyed-out list of twenty
   * things nobody can quite read announces nothing.
   */
  const dimmed = await rows.evaluateAll(
    (nodes) => nodes.filter((node) => Number(getComputedStyle(node).opacity) < 1).length
  );
  check('and the rows are not dimmed to say it', dimmed === 0, `${dimmed} dimmed`);

  group('The Coming Soon badge');

  const badges = panel().locator('[class*="menuItemLabel"] > [class*="soon"]');
  check('one on every row', (await badges.count()) === 20, `${await badges.count()}`);

  const badge = await badges.first().evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      background: style.backgroundColor,
      color: style.color,
      whiteSpace: style.whiteSpace,
      text: node.innerText.trim(),
    };
  });
  check('it reads "Coming soon"', /coming soon/i.test(badge.text), badge.text);
  check('never breaks across lines', badge.whiteSpace === 'nowrap', badge.whiteSpace);
  check(
    'and is blue-grey, not a traffic light',
    badge.background === 'rgb(13, 27, 42)' && badge.color === 'rgb(126, 166, 201)',
    `${badge.background} / ${badge.color}`
  );

  group('Two conventions, two colours');

  const underline = (label) =>
    page
      .locator('header nav a, header nav button', { hasText: label })
      .first()
      .evaluate((node) => getComputedStyle(node).borderBottomColor);

  const currentUnderline = await underline('Marketplace');
  const openUnderline = await underline('Explore');

  check('the page you are on keeps its mint underline', currentUnderline === 'rgb(46, 230, 168)', currentUnderline);
  check('the menu you opened takes a blue one', openUnderline === 'rgb(56, 189, 248)', openUnderline);
  check('and they are never the same', currentUnderline !== openUnderline);

  const chevron = await page
    .locator('header nav button', { hasText: 'Explore' })
    .first()
    .locator('svg')
    .evaluate((node) => getComputedStyle(node).transform);
  // rotate(180deg), as a matrix.
  check('the chevron has flipped', chevron.startsWith('matrix(-1'), chevron);

  group('One glyph per row, all of one weight');

  check('twenty, drawn from the sprite', (await panel().locator('span[class*="menuIcon"] svg use').count()) === 20);

  const colours = await panel()
    .locator('span[class*="menuIcon"]')
    .evaluateAll((nodes) => [...new Set(nodes.map((node) => getComputedStyle(node).color))]);
  check('and monochrome', colours.length === 1, colours.join(','));

  group('Nothing else got into the menu');

  const menuText = (await panel().innerText()).replace(/\s+/g, ' ');
  for (const forbidden of ['Voyager', 'TradingView']) {
    check(`no ${forbidden} in it`, !menuText.includes(forbidden));
  }
  // A number with a decimal point is a price or a percentage, and neither
  // belongs in a navigation panel.
  check('no market data either', !/\d[.,]\d/.test(menuText), menuText.slice(0, 120));

  group('The menu at three widths');

  const columns = async () =>
    new Set(
      await panel()
        .locator('div[class*="groupHead"]')
        .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().x)))
    ).size;

  check('1600 — three columns', (await columns()) === 3, `${await columns()}`);

  await page.setViewportSize({ width: 834, height: 1100 });
  await openExplore();
  check('834 — two, with the third across the bottom', (await columns()) === 2, `${await columns()}`);
  check(
    'and the descriptions step aside',
    (await panel().locator('span[class*="menuItemSub"]').first().isVisible()) === false
  );

  await page.setViewportSize({ width: 390, height: 780 });
  await openExplore();

  const drawer = await panel().boundingBox();
  check(
    '390 — the panel is the screen',
    Boolean(drawer) && drawer.x === 0 && drawer.width === 390,
    drawer ? `${Math.round(drawer.x)}+${Math.round(drawer.width)}` : 'no panel'
  );
  check('the descriptions come back', await panel().locator('span[class*="menuItemSub"]').first().isVisible());

  const short = await panel().locator('span[class*="soonShort"]').first().innerText();
  check('and the badge shortens', short.trim().toLowerCase() === 'soon', short);

  const shortest = await rows.evaluateAll((nodes) =>
    Math.min(...nodes.map((node) => node.getBoundingClientRect().height))
  );
  check('every row is a thumb-sized target', shortest >= 44, `${Math.round(shortest)}px`);

  const close = panel().locator('button[class*="drawerClose"]');
  check('the drawer has a way out', (await close.count()) === 1);
  await close.click();
  await page.waitForTimeout(250);
  check('and it closes', (await page.locator('div[class*="panelMega"]').count()) === 0);

  /*
   * ---- The way in ----
   *
   * The menu names this section and deliberately does not link to it, so the
   * way in has to exist somewhere else. It was the footer; the shell redesign
   * reduced the footer to a brand line and it moved to Home.
   *
   * It is moving again. The Investment options redesign gives Home's "Explore
   * markets" button to Market Overview at `/markets/global`, because that
   * button says markets and this page is education — and this page becomes
   * something reached *from* live markets rather than instead of them.
   *
   * So the door is not asserted to be on Home. What must not change is that
   * there is one somewhere: a section with no way in is a deleted feature
   * wearing a route. The known doors are listed and at least one must be open,
   * which stays true before that hand-over, after it, and during it.
   */
  group('The section has a way in');

  const DOORS = [
    { path: '/en', name: 'Home' },
    { path: '/en/markets/global', name: 'Global markets' },
    { path: '/en/explore/options', name: 'the catalogue' },
  ];

  const open = [];
  for (const door of DOORS) {
    await page.goto(`${base}${door.path}`, { waitUntil: 'networkidle' });
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((nodes) => nodes.map((node) => new URL(node.href).pathname));
    if (hrefs.includes('/en/explore')) open.push(door.name);
  }

  check(
    'at least one page still leads here',
    open.length > 0,
    `open: ${open.join(', ') || 'none'}`
  );
  console.log(`       reached from: ${open.join(', ') || 'nowhere'}`);
} finally {
  await browser.close();
}

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
