import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Observatory, in a browser.
 *
 * The metric suite already proves the numbers. This proves the things only a
 * rendered page can answer, and after the design-handoff rebuild that is two
 * sets of claims rather than one.
 *
 * **Truthfulness** — unchanged from the previous revision, and deliberately so.
 * No canonical absent state may come out looking like a zero, CLS stays a
 * score, the Voyager server-request scope stays on the page, market wording
 * stays "resolutions", and Supercharts keeps intent and render apart. These
 * assertions encode product semantics, not layout, so the redesign was not
 * allowed to weaken them.
 *
 * **Structure** — new, and encoding the supplied design rather than the Phase 6
 * page it replaced: a standalone dark console with no customer chrome, fourteen
 * numbered sections, a sticky rail that hides on narrow viewports, right-side
 * drawers with real dialog semantics, and a presentation mode that changes
 * emphasis without changing a value.
 *
 *   node scripts/verify-observatory-ui.mjs
 *
 * Needs a running app and `METRICS_ACCESS_SECRET`. Read-only: it authorizes,
 * looks, and writes nothing anywhere.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3414';
const SECRET = process.env.METRICS_ACCESS_SECRET;
const SHOTS = process.env.OBSERVATORY_SHOTS ?? '';

/** The design's own preview size first, then the two the brief asks about. */
const VIEWPORTS = [
  { name: 'design', width: 1600, height: 1100 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

/** The fourteen sections, in the order the rail numbers them. */
const SECTIONS = [
  's-exec',
  's-strategy',
  's-lifecycle',
  's-continuation',
  's-start',
  's-retention',
  's-areas',
  's-voyager',
  's-charts',
  's-money',
  's-acq',
  's-reliability',
  's-coverage',
  's-states',
];

/** Every state that is NOT a number. None of them may render as one. */
const ABSENT_STATES = [
  'insufficient_sample',
  'source_not_connected',
  'feature_disabled',
  'coming_soon',
  'external',
  'legacy',
  'stale',
  'not_measurable',
];

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

if (!SECRET) {
  console.error('METRICS_ACCESS_SECRET is not set; cannot authorize the dashboard.');
  process.exit(1);
}

const browser = await chromium.launch();

try {
  const context = await browser.newContext({
    viewport: VIEWPORTS[0],
    /* A headless UA is dropped by ingest, and this run must not write anyway. */
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  });

  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  /* ------------------------------------------------------------- Access */

  console.log('\nAccess');
  await page.goto(`${BASE}/en/admin_admin_metrics`, { waitUntil: 'domcontentloaded' });
  check(
    'the unauthorized shell renders no section',
    (await page.locator('#s-exec').count()) === 0
  );

  const exchange = await page.request.post(`${BASE}/api/admin-metrics/access`, {
    data: { secret: SECRET },
  });
  check('the fragment secret is accepted', exchange.ok());

  await page.goto(`${BASE}/en/admin_admin_metrics`, { waitUntil: 'networkidle' });

  /* --------------------------------------------------- Standalone shell */

  console.log('\nStandalone Observatory shell');
  check('the Observatory root is present', (await page.locator('[data-observatory]').count()) === 1);
  check(
    'the sticky Observatory header is present',
    (await page.locator('[data-observatory-header]').count()) === 1
  );
  check(
    'the header is sticky',
    (await page.locator('[data-observatory-header]').evaluate((node) => getComputedStyle(node).position)) ===
      'sticky'
  );

  /*
   * The customer chrome must be absent, not merely hidden. A CSS-hidden header
   * still ships its markup, its focus targets and its network prefetches.
   */
  check('no customer portal wrapper', (await page.locator('.tn-app').count()) === 0);
  check('no customer header', (await page.locator('header[class*="Header"]').count()) === 0);
  check('no customer footer', (await page.locator('footer[class*="Footer"]').count()) === 0);
  /*
   * Matched on the widget's own markup rather than on the word "Voyager": the
   * Observatory has a Voyager cockpit and a Voyager product-area card, and a
   * text match would fail on the page's own legitimate content.
   */
  check(
    'no floating Voyager widget',
    (await page.locator('[class*="VoyagerWidget"], [class*="voyagerWidget"]').count()) === 0
  );

  /*
   * Exactly one main landmark. The bare route used to wrap the page in a
   * `<main>` from PortalChrome and then render a second one around the content
   * column, which is invalid and leaves a screen reader's landmark list
   * ambiguous about which one is the page.
   */
  const mains = await page.locator('main').count();
  check('exactly one main landmark', mains === 1, `${mains} found`);
  check(
    'the main landmark is the content column, not the whole page',
    (await page.locator('main #s-exec').count()) === 1 &&
      (await page.locator('main [data-observatory-header]').count()) === 0
  );

  const ground = await page.locator('[data-observatory]').evaluate((node) => {
    const style = getComputedStyle(node);
    return { color: style.color, background: style.backgroundColor + style.backgroundImage };
  });
  check(
    'the Observatory paints its own dark ground',
    /rgb\(4,\s*7,\s*12\)|#04070c/.test(ground.background),
    ground.background.slice(0, 80)
  );

  /* ------------------------------------------- Information architecture */

  console.log('\nFourteen-section architecture');
  for (const id of SECTIONS) {
    check(`section ${id} renders`, (await page.locator(`#${id}`).count()) === 1);
  }

  const order = await page.$$eval('section[id^="s-"]', (nodes) => nodes.map((node) => node.id));
  check(
    'the sections appear in the design order',
    SECTIONS.every((id, index) => order.indexOf(id) === index),
    order.join(' → ')
  );

  /* ------------------------------------------------------ Section rail */

  console.log('\nSection rail');
  const rail = page.locator('nav[aria-label="Sections"]');
  check('the rail exists', (await rail.count()) === 1);
  check('the rail is visible at desktop width', await rail.isVisible());
  check(
    'the rail links to every section',
    (await rail.locator('a[href^="#s-"]').count()) === SECTIONS.length
  );
  check(
    'the rail is sticky',
    (await rail.evaluate((node) => getComputedStyle(node).position)) === 'sticky'
  );
  check(
    'the rail carries the provenance legend',
    (await rail.getByText('Provenance states').count()) === 1
  );
  check(
    'the rail offers the metric dictionary',
    (await rail.getByRole('button', { name: 'Metric dictionary' }).count()) === 1
  );

  /* ------------------------------------------ States never look like zero */

  console.log('\nData states never look like zero');
  const absent = await page.$$eval('[data-state]', (nodes, states) =>
    nodes
      .filter((node) => states.includes(node.dataset.state ?? ''))
      .filter((node) => node.matches('button, [class*="Card"], [class*="card"]'))
      .map((node) => ({ state: node.dataset.state, text: (node.textContent ?? '').trim() })),
    ABSENT_STATES
  );

  check('at least one non-numeric state is on the page', absent.length > 0, `${absent.length} found`);
  check(
    'every absent card says a word rather than a figure',
    absent.every((card) => /[A-Za-z]{3}/.test(card.text)),
    absent
      .filter((card) => !/[A-Za-z]{3}/.test(card.text))
      .map((card) => card.state)
      .join(', ')
  );
  check(
    'no absent card leads with a bare 0 or 0%',
    absent.every((card) => !/^0(\.0)?%?$/.test(card.text.split('\n')[0]?.trim() ?? '')),
    absent.map((card) => card.state).join(', ')
  );

  /* Every state badge carries its word, so nothing means anything by hue alone. */
  const badges = await page.$$eval('[data-state]', (nodes) =>
    nodes
      .filter((node) => node.className.includes('badge'))
      .map((node) => (node.textContent ?? '').trim())
  );
  check('every state badge is labelled in words', badges.length > 0 && badges.every(Boolean));

  console.log('\nCanonical states the redesign must not have dropped');
  /* Lower-cased: the state tags carry `text-transform: uppercase`, so innerText
     returns them shouted and a case-sensitive match would test the CSS. */
  const statesText = (await page.locator('#s-states').innerText()).toLowerCase();
  for (const label of ['collecting', 'not measurable', 'delayed', 'legacy', 'coming soon', 'no source']) {
    check(`the state kit names "${label}"`, statesText.includes(label));
  }

  /* ------------------------------------------------------- Truthfulness */

  /* ------------------------- Provenance states are not a colour vocabulary */

  console.log('\nCanonical states are not used as a generic palette');

  /*
   * The rendered half of the correction. A tone badge and a state badge look
   * alike on purpose, so the guarantee has to be checked in the DOM: nothing
   * that is merely health, outcome, category or operational status may carry a
   * `data-state`.
   */
  const badgeVocabularies = await page.evaluate(() => {
    const states = [...document.querySelectorAll('[data-state]')].length;
    const tones = [...document.querySelectorAll('[data-tone]')].length;
    return { states, tones };
  });
  check('both vocabularies are in use', badgeVocabularies.states > 0 && badgeVocabularies.tones > 0,
    JSON.stringify(badgeVocabularies));

  check(
    'every tone badge carries a word',
    await page.$$eval('[data-tone]', (nodes) =>
      nodes
        .filter((node) => node.className.includes('statusBadge'))
        .every((node) => (node.textContent ?? '').trim().length > 0)
    )
  );

  /* Supercharts capability outcomes. */
  const chartsSection = page.locator('#s-charts');
  const capabilityStates = await chartsSection.evaluate((section) =>
    [...section.querySelectorAll('[data-state]')].map((node) => node.dataset.state ?? '')
  );
  check(
    'no Supercharts capability outcome is rendered as a disabled feature',
    !capabilityStates.includes('feature_disabled'),
    capabilityStates.join(', ')
  );
  check(
    'pane and overlay are rendered as categories',
    await chartsSection.evaluate((section) => {
      const placements = [...section.querySelectorAll('[data-tone]')].filter((node) =>
        ['pane', 'overlay', 'unknown'].includes((node.textContent ?? '').trim())
      );
      /* Present only when a study has been requested or rendered. */
      return placements.every((node) => !node.hasAttribute('data-state'));
    })
  );

  /* Web Vitals. */
  const vitalsRow = await page.locator('#s-reliability table').first().evaluate((table) => {
    const header = [...table.querySelectorAll('thead th')].map((cell) => (cell.textContent ?? '').trim());
    const badges = [...table.querySelectorAll('tbody [data-state], tbody [data-tone]')].map((node) => ({
      state: node.dataset.state ?? null,
      tone: node.dataset.tone ?? null,
      text: (node.textContent ?? '').trim().toLowerCase(),
    }));
    return { header, badges };
  });

  check(
    'the vitals table separates rating from sample',
    vitalsRow.header.includes('Rating') && vitalsRow.header.includes('Sample'),
    vitalsRow.header.join(' | ')
  );
  check(
    'no Web Vital is labelled as a disabled feature',
    !vitalsRow.badges.some((badge) => badge.state === 'feature_disabled'),
    vitalsRow.badges.map((badge) => badge.state).filter(Boolean).join(', ')
  );
  check(
    'a rating never borrows the insufficient-sample state',
    !vitalsRow.badges.some(
      (badge) =>
        badge.state === 'insufficient_sample' &&
        /good|needs improvement|poor/.test(badge.text)
    )
  );
  check(
    'a genuinely small sample still says insufficient sample',
    vitalsRow.badges.every((badge) => badge.tone !== null || badge.state !== null)
  );

  /* Source freshness. */
  const freshness = await page.locator('#s-reliability').evaluate((section) => {
    const rows = [...section.querySelectorAll('table')].at(-1)?.querySelectorAll('tbody tr') ?? [];
    return [...rows].map((row) => {
      const badge = row.querySelector('[data-state], [data-tone]');
      return {
        text: (badge?.textContent ?? '').trim().toLowerCase(),
        state: badge instanceof HTMLElement ? (badge.dataset.state ?? null) : null,
      };
    });
  });
  check(
    'a never-seen source does not claim an insufficient sample',
    !freshness.some((row) => row.text.includes('never seen') && row.state === 'insufficient_sample'),
    JSON.stringify(freshness)
  );

  /* Market copy. */
  const marketText = await page.locator('#s-reliability').innerText();
  check(
    'the no-data card does not claim an unknown symbol',
    /no usable/i.test(marketText) && !/nothing for the symbol/i.test(marketText)
  );

  console.log('\nUnits and limitations survive the redesign');
  const vitalsText = await page.locator('#s-reliability').innerText();
  check('CLS is labelled a score, not a time', /CLS\s*\(score\)/.test(vitalsText));
  check('the time vitals are labelled as time', /LCP\s*\(time\)/.test(vitalsText));
  check(
    'client failures keep their stated denominator',
    /per 1,000 page views/.test(vitalsText)
  );
  check(
    'market wording says resolutions rather than provider requests',
    /Market data resolutions/.test(vitalsText) && !/Provider network requests/.test(vitalsText)
  );
  /* A sentence saying no uptime is claimed must not itself trip this. What is
     forbidden is a figure presented as one. */
  check(
    'no provider uptime figure is claimed',
    !/\d+(\.\d+)?\s*%\s*uptime|uptime[:\s]+\d/i.test(vitalsText)
  );

  const voyagerText = await page.locator('#s-voyager').innerText();
  check('the Voyager server-request scope is on the page', /voyager\/research/.test(voyagerText));
  check(
    'a simulated fallback is not called a success',
    /not a success/.test(voyagerText) || /never merged/.test(voyagerText)
  );
  /*
   * Checked against the section rather than a card, deliberately. A card whose
   * metric is absent renders its absence reason in the subline slot, so the
   * denominator rule has to live in prose that survives every data state.
   */
  check(
    'the quota refusal denominator is stated',
    /refusals excluded/.test(voyagerText) && /over\s+every request/i.test(voyagerText)
  );

  const chartsText = await page.locator('#s-charts').innerText();
  check(
    'Supercharts separates intent from rendered outcome',
    /Intent and outcome are different rows/.test(chartsText)
  );
  check('Supercharts names the intent event', /superchart_study_toggled/.test(chartsText));
  check('Supercharts names the render event', /superchart_study_applied/.test(chartsText));
  check(
    'no TradingView handoff KPI is reintroduced',
    !/native vs tradingview/i.test(chartsText) || /not reintroduced/.test(chartsText)
  );

  const moneyText = await page.locator('#s-money').innerText();
  check('confirmed revenue is absent rather than zero', /Source not connected/.test(moneyText));
  check(
    'the four commercial facts are kept apart',
    /Offer exposure/.test(moneyText) &&
      /Entitlement/.test(moneyText) &&
      /Purchase record/.test(moneyText) &&
      /Provider-confirmed transaction/.test(moneyText)
  );
  check(
    'the retired five-plan lineup is not restored',
    !/(Essential|Premium|Ultimate)/.test(moneyText),
    moneyText.slice(0, 120)
  );

  const retentionText = await page.locator('#s-retention').innerText();
  check(
    'anonymous return stays not measurable',
    /Not measurable/.test(retentionText) && /authenticated/i.test(retentionText)
  );

  console.log('\nNo invented comparison or trend');
  const bodyText = await page.locator('[data-observatory]').innerText();
  check(
    'no decorative "vs previous period" delta',
    !/[+−-]\s*\d+(\.\d+)?\s*(%|pp)\s*(vs|versus)/i.test(bodyText)
  );
  check(
    'the comparison control is disabled rather than fake',
    await page.locator('select[aria-label^="Comparison basis"]').isDisabled()
  );
  check(
    'the North Star panel says the series is unavailable',
    /Historical trend not available/.test(await page.locator('#s-exec').innerText())
  );

  /* ------------------------------------------------------------ Drawers */

  console.log('\nMetric drill-down drawer');
  await page.locator('#s-exec button').first().click();
  await page.waitForTimeout(250);

  const drawer = page.locator('[data-drawer]');
  check('a drawer opens on a KPI click', (await drawer.count()) === 1);
  check('the drawer is a modal dialog', (await drawer.getAttribute('aria-modal')) === 'true');
  check('the drawer sits on the right', (await drawer.evaluate((node) => getComputedStyle(node).right)) === '0px');
  const drawerText = (await drawer.innerText()).toLowerCase();
  check(
    'the drawer explains the metric rather than dumping rows',
    drawerText.includes('provenance') && drawerText.includes('privacy')
  );
  check(
    'the drawer states that no comparison exists',
    /No previous-period comparison exists/.test(await drawer.innerText())
  );

  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check('Escape closes the drawer', (await page.locator('[data-drawer]').count()) === 0);

  console.log('\nMetric dictionary drawer');
  await page.getByRole('button', { name: 'Metric dictionary' }).first().click();
  await page.waitForTimeout(250);
  check('the dictionary opens', (await page.locator('[data-drawer]').count()) === 1);
  check(
    'the dictionary lists real definitions',
    /Portal Meaningful Continuation Rate/.test(await page.locator('[data-drawer]').innerText())
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  console.log('\nData sources drawer');
  await page.getByRole('button', { name: /Data sources/ }).click();
  await page.waitForTimeout(250);
  const sources = await page.locator('[data-drawer]').innerText();
  check('the sources drawer opens', (await page.locator('[data-drawer]').count()) === 1);
  check('it names what is not connected', /not connected/i.test(sources));
  check('it shows source state rather than raw events', !/session_id|user_id/.test(sources));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  /* -------------------------------------------------- Presentation mode */

  console.log('\nPresentation mode');
  const toggle = page.getByRole('button', { name: 'Presentation' });
  check('the toggle is a real button', (await toggle.count()) === 1);
  check('it is not pressed to begin with', (await toggle.getAttribute('aria-pressed')) === 'false');

  const execBefore = await page.locator('#s-exec').innerText();
  await toggle.click();
  await page.waitForTimeout(250);

  check('the shell switches mode', (await page.locator('[data-mode="presentation"]').count()) === 1);
  check('aria-pressed follows the mode', (await toggle.getAttribute('aria-pressed')) === 'true');
  check('values are unchanged by the mode', (await page.locator('#s-exec').innerText()) === execBefore);
  check('the filter chip strip is hidden', !(await page.locator('#s-areas').isVisible()));
  check(
    'the presenter sections stay visible',
    (await page.locator('#s-exec').isVisible()) &&
      (await page.locator('#s-strategy').isVisible()) &&
      (await page.locator('#s-lifecycle').isVisible()) &&
      (await page.locator('#s-voyager').isVisible()) &&
      (await page.locator('#s-reliability').isVisible())
  );
  check(
    'caveats for the visible metrics stay accessible',
    /Confirmed revenue has no source/.test(await page.locator('[data-observatory]').innerText())
  );

  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check('Escape leaves presentation mode', (await page.locator('[data-mode="detail"]').count()) === 1);

  /* -------------------------------------------------------- Accessibility */

  console.log('\nAccessibility');
  check(
    'the period control marks the current option',
    (await page.locator('[aria-current="page"]').count()) === 1
  );
  check('tables carry scoped headers', (await page.locator('table th[scope]').count()) > 0);
  check(
    'every section is labelled by its heading',
    (await page.locator('section[aria-labelledby]').count()) === SECTIONS.length
  );

  /* ------------------------------------------------------------ Responsive */

  console.log('\nResponsive');
  for (const size of VIEWPORTS) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.waitForTimeout(300);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    check(`no page-level horizontal overflow at ${size.name} (${size.width}px)`, !overflow);

    if (size.width <= 1240) {
      check(`the rail is hidden at ${size.name}`, !(await rail.isVisible()));
    } else {
      check(`the rail is visible at ${size.name}`, await rail.isVisible());
      check(
        `the inline chip strip is visible at ${size.name}`,
        await page.locator('[data-filter-strip]').isVisible()
      );
    }

    if (size.width <= 1024) {
      const filterButton = page.getByRole('button', { name: /^Filters/ });
      check(`the Filters button appears at ${size.name}`, await filterButton.isVisible());
      check(
        `the inline chip strip is hidden at ${size.name}`,
        !(await page.locator('[data-filter-strip]').isVisible())
      );
    }

    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: join(SHOTS, `observatory-${size.name}.png`), fullPage: false });
    }
  }

  /* ------------------------------------------------------- Filters drawer */

  console.log('\nFilters drawer');
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.waitForTimeout(250);

  const filters = page.locator('[data-drawer]');
  check('the filters drawer opens', (await filters.count()) === 1);
  check('it is a modal dialog', (await filters.getAttribute('aria-modal')) === 'true');
  check(
    'unsupported segmentation is disabled rather than fake',
    (await filters.locator('button[disabled]').count()) > 0
  );
  check(
    'it says why a dimension is unavailable',
    /not available|precomputed|No geography/.test(await filters.innerText())
  );
  check('it offers a reset', (await filters.getByRole('button', { name: /Reset/ }).count()) > 0);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.waitForTimeout(250);
  const width = await page.locator('[data-drawer]').evaluate((node) => node.getBoundingClientRect().width);
  check('the drawer is full width on mobile', Math.round(width) >= 388, `${Math.round(width)}px`);
  await page.keyboard.press('Escape');

  /* ------------------------------------------- Customer routes are untouched */

  console.log('\nCustomer routes keep their shell');

  for (const route of ['/en', '/en/voyager', '/en/markets/global', '/en/marketplace/subscriptions']) {
    const response = await page.request.get(`${BASE}${route}`);
    const html = await response.text();
    check(`${route} responds`, response.ok(), String(response.status()));
    check(`${route} keeps the portal shell`, html.includes('tn-app'));
  }

  const bare = await (await page.request.get(`${BASE}/en/admin_admin_metrics`)).text();
  check('the Observatory renders no portal shell', !bare.includes('tn-app'));

  /* ---------------------------------------------------------------- Console */

  console.log('\nConsole');
  const real = consoleErrors.filter((message) => !/favicon|Download the React DevTools/i.test(message));
  check('no console errors', real.length === 0, real.slice(0, 3).join(' | '));
} catch (error) {
  failed += 1;
  console.log(`\n  FAIL the run stopped early — ${String(error).split('\n')[0]}`);
} finally {
  await browser.close();
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed === 0 ? 0 : 1);
}
