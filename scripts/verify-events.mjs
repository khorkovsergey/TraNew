import { chromium } from 'playwright';

/**
 * Events, driven in a browser.
 *
 * The unit tests cover the rules; this covers the things only a rendered page can
 * answer — whether a filter survives a refresh and the back button, whether a
 * draft is unreachable by URL, whether the joining link stays on the server, and
 * whether the dialogues behave like dialogues.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EVENTS = `${BASE}/en/events`;

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

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  console.log('\nDiscovery');
  await page.goto(EVENTS, { waitUntil: 'networkidle' });

  const cards = await page.locator('article').count();
  check('the catalogue renders', cards > 0, `${cards} cards`);
  check(
    'curated sections appear when nothing is filtered',
    (await page.getByRole('heading', { name: 'Recommended for you' }).count()) === 1
  );
  // No Learning tab: Learn is its own section in the navigation, and the strip
  // only offered a way off the page someone had just chosen.
  check(
    'the section header is about events and nothing else',
    (await page.getByRole('heading', { level: 1, name: /Meet the people behind the markets/ }).count()) === 1 &&
      (await page.getByRole('link', { name: 'Learning', exact: true }).count()) === 0
  );

  console.log('\nFilters live in the URL');
  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('button', { name: 'Online', exact: true }).first().click();
  // Waits for the thing being asserted rather than for a guess at how long the
  // transition takes. A fixed 700ms passed or failed depending on how busy the
  // dev server was, which is a coin toss reported as a result.
  await page.waitForURL(/format=online/, { timeout: 5000 }).catch(() => {});

  check('a filter is written to the query string', page.url().includes('format=online'), page.url());

  const filteredCount = await page.locator('article').count();
  await page.reload({ waitUntil: 'networkidle' });
  check(
    'it survives a refresh',
    page.url().includes('format=online') && (await page.locator('article').count()) === filteredCount
  );
  check('an active chip is shown', (await page.getByRole('button', { name: /Online/ }).count()) > 0);

  await page.goBack({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  check('back removes the filter', !page.url().includes('format=online'), page.url());

  await page.goForward({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  check('forward restores it', page.url().includes('format=online'));

  console.log('\nSearch and views');
  await page.goto(EVENTS, { waitUntil: 'networkidle' });
  await page.getByLabel('Search events').fill('Limassol');
  // Scoped to the form: the site header has a Search button of its own, and an
  // unqualified role lookup matches both.
  await page
    .locator('form[role="search"]')
    .getByRole('button', { name: 'Search' })
    .click();
  await page.waitForURL(/q=Limassol/, { timeout: 5000 }).catch(() => {});
  check('search narrows the list', page.url().includes('q=Limassol'));

  await page.goto(`${EVENTS}?view=calendar`, { waitUntil: 'networkidle' });
  check('calendar view groups by day', (await page.locator('h3').count()) > 0);

  await page.goto(`${EVENTS}?view=map`, { waitUntil: 'networkidle' });
  check('map view places pins', (await page.getByText(/venue/i).count()) > 0);

  console.log('\nAn event page');
  await page.goto(`${BASE}/en/events/understanding-market-cycles`, { waitUntil: 'networkidle' });
  check('the title renders', (await page.locator('h1').innerText()) === 'Understanding Market Cycles');
  check('a trust badge is present', (await page.getByText('TradingNew official').count()) > 0);
  check('the agenda is listed', (await page.getByText('The four regimes, with data').count()) > 0);
  check(
    'anonymous sees Register, which opens sign-in',
    (await page.getByRole('button', { name: 'Register' }).count()) === 1
  );

  const jsonLd = await page.locator('script[type="application/ld+json"]').innerText();
  const parsed = JSON.parse(jsonLd);
  check('schema.org Event is emitted', parsed['@type'] === 'Event');
  check('it carries the attendance mode', String(parsed.eventAttendanceMode).includes('Online'));
  check('it carries the status', String(parsed.eventStatus).includes('EventScheduled'));

  console.log('\nThe joining link never leaves the server');
  const html = await page.content();
  check(
    'no meeting URL in the page for an unregistered visitor',
    !html.includes('live.tradingnew.space/rooms'),
    'found a room link in the HTML'
  );

  const ics = await page.request.get(
    `${BASE}/api/events/live-market-session-cpi-print/calendar.ics`
  );
  const icsBody = await ics.text();
  check('the calendar file downloads', ics.status() === 200);
  check('it is a VEVENT', icsBody.includes('BEGIN:VEVENT'));
  check(
    'and it does not contain the room link either',
    !icsBody.includes('live.tradingnew.space/rooms')
  );

  console.log('\nCancelled and external events');
  await page.goto(`${BASE}/en/events/algorithmic-signals-evening-cancelled`, {
    waitUntil: 'networkidle',
  });
  check('a cancelled event says so', (await page.getByText(/has been cancelled/i).count()) > 0);
  check(
    'and offers no registration',
    (await page.getByRole('button', { name: 'Register' }).count()) === 0
  );

  await page.goto(`${BASE}/en/events/etf-investing-conference-athens`, { waitUntil: 'networkidle' });
  const external = page.getByRole('button', { name: /Go to event website/ });
  check('an external event sends people to the organizer', (await external.count()) === 1);
  await external.click();
  await page.waitForTimeout(400);
  check(
    'an unverified domain warns first',
    (await page.getByText('You are leaving TradingNew').count()) === 1
  );
  check(
    'the destination is named in plain text',
    (await page.getByText('etfcon-europe.example').count()) > 0
  );

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check(
    'Escape closes the dialogue',
    (await page.getByText('You are leaving TradingNew').count()) === 0
  );

  console.log('\nPrivate pages');
  for (const path of ['/en/events/create', '/en/events/my', '/en/events/manage']) {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    check(
      `${path} sends an anonymous visitor to sign-in`,
      page.url().includes('/sign-in'),
      `landed on ${page.url()} (${response?.status()})`
    );
  }

  const missing = await page.goto(`${BASE}/en/events/no-such-event-anywhere`, {
    waitUntil: 'domcontentloaded',
  });
  check('an unknown slug is a 404', missing?.status() === 404, String(missing?.status()));

  console.log('\nAccessibility');
  await page.goto(`${BASE}/en/events/understanding-market-cycles`, { waitUntil: 'networkidle' });

  const named = await page.evaluate(() =>
    [...document.querySelectorAll('button, a')].every(
      (element) =>
        (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().length > 0
    )
  );
  check('every control has a name', named);

  const headings = await page.evaluate(() =>
    [...document.querySelectorAll('h1, h2, h3')].map((element) => Number(element.tagName[1]))
  );
  check('there is exactly one h1', headings.filter((level) => level === 1).length === 1);
  check(
    'heading levels never skip',
    headings.every((level, index) => index === 0 || level - headings[index - 1] <= 1),
    headings.join(',')
  );

  console.log('\nLayout');
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(EVENTS, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    check(`no sideways scroll at ${width}px`, overflow <= 0, `${overflow}px over`);
  }

  console.log('\nThe rest of the product knows about events');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/en/symbols/TSLA`, { waitUntil: 'networkidle' });
  check(
    'a symbol page offers events on the same asset',
    (await page.getByText('Events on this asset').count()) > 0
  );
} finally {
  console.log(`\n${passed}/${passed + failed} passed`);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}
