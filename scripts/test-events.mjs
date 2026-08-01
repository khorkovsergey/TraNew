import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

/**
 * Unit tests for the pure Events logic.
 *
 * The repository has no unit test runner — its convention is Playwright scripts
 * against a running app — so this compiles the dependency-free modules under
 * `lib/events` with the TypeScript compiler already in devDependencies and runs
 * assertions against the output. That keeps the source in TypeScript, adds no
 * dependency, and covers the rules that a browser test cannot reach every branch
 * of: every CTA state, every URL rejection, timezone conversion across a DST
 * boundary, and filter serialisation round-trips.
 */

const out = mkdtempSync(join(tmpdir(), 'tn-events-'));
let passed = 0;
let failed = 0;

// Without this a compile error would land in `finally` and print "0/0 passed",
// which reads as "nothing to test" rather than "the tests could not be built".
process.on('uncaughtException', (error) => {
  console.error('\nThe test build failed:\n', error);
  rmSync(out, { recursive: true, force: true });
  process.exit(1);
});

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${error.message.split('\n')[0]}`);
  }
}

function group(title) {
  console.log(`\n${title}`);
}

try {
  execFileSync(
    'npx',
    [
      'tsc',
      'src/lib/events/filters.ts',
      'src/lib/events/cta.ts',
      'src/lib/events/externalUrl.ts',
      'src/lib/events/time.ts',
      'src/lib/events/calendar.ts',
      'src/lib/events/sanitize.ts',
      'src/lib/events/access.ts',
      'src/lib/events/recommend.ts',
      'src/lib/events/related.ts',
      'src/lib/studies/registry.ts',
      'src/lib/voyager/answerSchema.ts',
      'src/lib/wave.ts',
      '--outDir',
      out,
      '--module',
      'esnext',
      '--target',
      'es2022',
      '--moduleResolution',
      'bundler',
      '--skipLibCheck',
    ],
    { stdio: 'inherit', shell: process.platform === 'win32' }
  );

  /*
   * tsc computes the output root from the common prefix of the inputs, so the
   * emitted tree is flat only while every input sits in one directory — adding
   * `lib/studies` and `lib/wave.ts` moved the root up and broke that assumption
   * silently. Finding the file instead of computing its path means the next
   * module added here does not have to think about it.
   */
  const find = (dir, name) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        const hit = find(path, name);
        if (hit) return hit;
      } else if (entry.name === `${name}.js`) {
        return path;
      }
    }
    return null;
  };

  const load = (name) => {
    const path = find(out, name);
    if (!path) throw new Error(`compiled module ${name}.js was not emitted`);
    return import(pathToFileURL(path).href);
  };

  /*
   * tsc emits `from '../studies/registry'` with no extension under
   * `moduleResolution: bundler`, and Node's ESM loader refuses that. It went
   * unnoticed while every compiled module imported only types, which are erased.
   */
  const addExtensions = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        addExtensions(path);
      } else if (entry.name.endsWith('.js')) {
        const source = readFileSync(path, 'utf8');
        writeFileSync(path, source.replace(/(from '\.[^']*?)(')/g, (all, head, tail) =>
          head.endsWith('.js') ? all : `${head}.js${tail}`
        ));
      }
    }
  };

  addExtensions(out);

  const filters = await load('filters');
  const cta = await load('cta');
  const external = await load('externalUrl');
  const time = await load('time');
  const calendar = await load('calendar');
  const sanitize = await load('sanitize');
  const access = await load('access');
  const recommend = await load('recommend');
  const studies = await load('registry');
  const schema = await load('answerSchema');
  const wave = await load('wave');

  /* ------------------------------------------------------ Filter round-trip */

  group('Filter serialisation');

  check('a default filter set serialises to nothing', () => {
    assert.deepEqual(filters.serializeFilters(filters.DEFAULT_FILTERS), {});
    assert.equal(filters.filtersToSearchString(filters.DEFAULT_FILTERS), '');
  });

  check('parse ∘ serialize is the identity', () => {
    const original = {
      ...filters.DEFAULT_FILTERS,
      q: 'macro',
      dateWindow: 'this_week',
      formats: ['online', 'hybrid'],
      city: 'Limassol',
      topics: ['Macroeconomics', 'ETFs'],
      levels: ['beginner'],
      languages: ['EN', 'RU'],
      types: ['webinar'],
      sources: ['tradingnew'],
      price: 'free',
      onlineOnly: true,
      sort: 'soonest',
      view: 'calendar',
      page: 3,
    };

    assert.deepEqual(filters.parseFilters(filters.serializeFilters(original)), original);
  });

  check('unknown values are dropped, not passed through', () => {
    const parsed = filters.parseFilters({
      format: 'online,<script>,teleport',
      level: 'beginner,wizard',
      sort: 'by-vibes',
      view: 'hologram',
      price: 'barter',
    });

    assert.deepEqual(parsed.formats, ['online']);
    assert.deepEqual(parsed.levels, ['beginner']);
    assert.equal(parsed.sort, 'recommended');
    assert.equal(parsed.view, 'cards');
    assert.equal(parsed.price, null);
  });

  check('a custom window with no dates is not a custom window', () => {
    const parsed = filters.parseFilters({ when: 'custom' });
    assert.equal(parsed.dateWindow, 'any');
    assert.equal(parsed.from, null);
  });

  check('a malformed date is rejected rather than guessed', () => {
    const parsed = filters.parseFilters({ when: 'custom', from: '2026-13-45', to: '2026-09-01' });
    assert.equal(parsed.from, null);
    assert.equal(parsed.to, '2026-09-01');
  });

  check('free text is length-capped', () => {
    const parsed = filters.parseFilters({ q: 'x'.repeat(500) });
    assert.equal(parsed.q.length, 120);
  });

  check('removing a chip resets the page', () => {
    const start = { ...filters.DEFAULT_FILTERS, topics: ['ETFs', 'Stocks'], page: 4 };
    const chips = filters.activeChips(start);
    const next = filters.withoutChip(start, chips[0]);
    assert.deepEqual(next.topics, ['Stocks']);
    assert.equal(next.page, 1);
  });

  check('clearing keeps location, sort and view', () => {
    const start = {
      ...filters.DEFAULT_FILTERS,
      city: 'Berlin',
      country: 'Germany',
      sort: 'popular',
      view: 'map',
      topics: ['ETFs'],
    };
    const cleared = filters.clearFilters(start);
    assert.equal(cleared.city, 'Berlin');
    assert.equal(cleared.sort, 'popular');
    assert.equal(cleared.view, 'map');
    assert.deepEqual(cleared.topics, []);
  });

  check('this_weekend resolves to Saturday and Sunday', () => {
    // A Wednesday.
    const now = new Date('2026-08-05T10:00:00Z');
    const range = filters.dateRange({ ...filters.DEFAULT_FILTERS, dateWindow: 'this_weekend' }, now);
    assert.equal(range.from.toISOString().slice(0, 10), '2026-08-08');
    assert.equal(range.to.toISOString().slice(0, 10), '2026-08-10');
  });

  check('a custom range includes the end day', () => {
    const range = filters.dateRange(
      { ...filters.DEFAULT_FILTERS, dateWindow: 'custom', from: '2026-08-01', to: '2026-08-03' },
      new Date('2026-07-30T00:00:00Z')
    );
    assert.equal(range.to.toISOString().slice(0, 10), '2026-08-04');
  });

  /* ----------------------------------------------------------- CTA states */

  group('CTA state');

  const baseCta = {
    status: 'published',
    priceType: 'free',
    sourceType: 'community',
    startsAt: '2026-09-01T17:00:00Z',
    endsAt: '2026-09-01T19:00:00Z',
    registrationDeadline: null,
    capacity: 40,
    registrationCount: 10,
    waitlistEnabled: true,
    format: 'online',
    externalDomain: null,
    registration: null,
    now: new Date('2026-08-01T12:00:00Z'),
  };

  check('an open event offers Register', () => {
    assert.equal(cta.ctaFor(baseCta).kind, 'register');
  });

  check('a full event with a waitlist offers the waitlist', () => {
    const state = cta.ctaFor({ ...baseCta, registrationCount: 40 });
    assert.equal(state.kind, 'waitlist');
    assert.equal(state.enabled, true);
  });

  check('a full event without a waitlist is closed, not registrable', () => {
    const state = cta.ctaFor({ ...baseCta, registrationCount: 40, waitlistEnabled: false });
    assert.equal(state.kind, 'closed');
    assert.equal(state.enabled, false);
  });

  check('a past deadline closes registration', () => {
    const state = cta.ctaFor({ ...baseCta, registrationDeadline: '2026-07-01T00:00:00Z' });
    assert.equal(state.kind, 'closed');
  });

  check('a cancelled event never offers registration', () => {
    for (const count of [0, 40]) {
      const state = cta.ctaFor({ ...baseCta, status: 'cancelled', registrationCount: count });
      assert.equal(state.kind, 'cancelled');
      assert.equal(state.enabled, false);
    }
  });

  check('an event that already ended shows as completed', () => {
    const state = cta.ctaFor({ ...baseCta, now: new Date('2026-09-02T00:00:00Z') });
    assert.equal(state.kind, 'completed');
  });

  check('an external event never registers here, whatever its capacity', () => {
    const state = cta.ctaFor({
      ...baseCta,
      sourceType: 'external',
      externalDomain: 'example.org',
      registrationCount: 0,
    });
    assert.equal(state.kind, 'external');
    assert.match(state.note, /example\.org/);
  });

  check('a registered person sees their registration, not Register', () => {
    assert.equal(cta.ctaFor({ ...baseCta, registration: 'registered' }).kind, 'registered');
  });

  check('the join window opens 15 minutes before an online event', () => {
    const before = cta.ctaFor({
      ...baseCta,
      registration: 'registered',
      now: new Date('2026-09-01T16:44:00Z'),
    });
    const inside = cta.ctaFor({
      ...baseCta,
      registration: 'registered',
      now: new Date('2026-09-01T16:46:00Z'),
    });
    assert.equal(before.kind, 'registered');
    assert.equal(inside.kind, 'join');
  });

  check('an in-person event never offers Join', () => {
    const state = cta.ctaFor({
      ...baseCta,
      format: 'in_person',
      registration: 'registered',
      now: new Date('2026-09-01T17:30:00Z'),
    });
    assert.equal(state.kind, 'registered');
  });

  check('a waitlisted person is told so', () => {
    assert.equal(cta.ctaFor({ ...baseCta, registration: 'waitlisted' }).kind, 'on_waitlist');
  });

  check('a draft is not registrable by anyone', () => {
    assert.equal(cta.ctaFor({ ...baseCta, status: 'draft' }).kind, 'unavailable');
  });

  check('availability counts places, not registrations', () => {
    assert.equal(
      cta.availabilityLabel({
        capacity: 40,
        registrationCount: 22,
        status: 'published',
        waitlistEnabled: true,
      }),
      '18 of 40 spots left'
    );
    assert.equal(
      cta.availabilityLabel({
        capacity: 40,
        registrationCount: 40,
        status: 'published',
        waitlistEnabled: false,
      }),
      'Sold out'
    );
  });

  check('price formats by currency', () => {
    assert.equal(cta.priceLabel({ priceType: 'free', priceAmount: null, currency: null }), 'Free');
    assert.equal(cta.priceLabel({ priceType: 'paid', priceAmount: 45, currency: 'EUR' }), '€45');
    assert.equal(cta.priceLabel({ priceType: 'paid', priceAmount: 220, currency: 'USD' }), '$220');
  });

  /* ----------------------------------------------------- External URL rules */

  group('External URLs');

  const rejected = [
    ['javascript:alert(1)', 'unsupported_protocol'],
    ['data:text/html,<script>', 'unsupported_protocol'],
    ['http://example.com', 'unsupported_protocol'],
    ['file:///etc/passwd', 'unsupported_protocol'],
    ['https://user:pass@example.com', 'credentials_in_url'],
    ['https://localhost/event', 'not_a_public_host'],
    ['https://127.0.0.1/event', 'not_a_public_host'],
    ['https://192.168.1.4/event', 'not_a_public_host'],
    ['not a url', 'malformed'],
    ['', 'empty'],
  ];

  for (const [url, reason] of rejected) {
    check(`rejects ${url || '(empty)'} as ${reason}`, () => {
      const result = external.checkExternalUrl(url);
      assert.equal(result.ok, false);
      assert.equal(result.reason, reason);
    });
  }

  check('accepts a plain https event page', () => {
    const result = external.checkExternalUrl('https://www.Example.com/events/2026');
    assert.equal(result.ok, true);
    assert.equal(result.domain, 'example.com');
    assert.equal(result.trusted, false);
  });

  check('trust matches on a label boundary only', () => {
    assert.equal(external.isTrustedDomain('example.com', ['example.com']), true);
    assert.equal(external.isTrustedDomain('tickets.example.com', ['example.com']), true);
    // The one that matters: a lookalike must not inherit the trust.
    assert.equal(external.isTrustedDomain('evil-example.com', ['example.com']), false);
    assert.equal(external.isTrustedDomain('exampleXcom', ['example.com']), false);
  });

  /* ---------------------------------------------------------------- Time */

  group('Timezones');

  check('an event is shown in the zone it runs in', () => {
    const times = time.formatEventTimes({
      startsAt: '2026-08-06T15:00:00Z',
      endsAt: '2026-08-06T16:30:00Z',
      timezone: 'Europe/Nicosia',
    });
    // Cyprus is UTC+3 in August.
    assert.equal(times.local.startsWith('18:00–19:30'), true);
  });

  check('daylight saving is applied per instant, not per event', () => {
    const summer = time.formatEventTimes({
      startsAt: '2026-08-06T12:00:00Z',
      endsAt: '2026-08-06T13:00:00Z',
      timezone: 'Europe/London',
    });
    const winter = time.formatEventTimes({
      startsAt: '2026-12-06T12:00:00Z',
      endsAt: '2026-12-06T13:00:00Z',
      timezone: 'Europe/London',
    });
    assert.equal(summer.local.startsWith('13:00'), true);
    assert.equal(winter.local.startsWith('12:00'), true);
  });

  check("the viewer's time appears only when it differs", () => {
    const same = time.formatEventTimes({
      startsAt: '2026-08-06T12:00:00Z',
      endsAt: '2026-08-06T13:00:00Z',
      timezone: 'Europe/London',
      viewerTimeZone: 'Europe/Dublin',
    });
    const different = time.formatEventTimes({
      startsAt: '2026-08-06T12:00:00Z',
      endsAt: '2026-08-06T13:00:00Z',
      timezone: 'Europe/London',
      viewerTimeZone: 'Asia/Tokyo',
    });
    assert.equal(same.viewer, null);
    assert.notEqual(different.viewer, null);
  });

  check('days are grouped in the venue zone, not the reader one', () => {
    const grouped = time.groupByDay([
      { startsAt: '2026-08-06T22:00:00Z', timezone: 'Asia/Tokyo' },
      { startsAt: '2026-08-06T22:00:00Z', timezone: 'Europe/London' },
    ]);
    // Same instant, two calendar days once each venue zone is applied.
    assert.equal(grouped.length, 2);
  });

  check('an invalid zone is rejected', () => {
    assert.equal(time.isValidTimeZone('Europe/Nicosia'), true);
    assert.equal(time.isValidTimeZone('Middle/Earth'), false);
  });

  /* ------------------------------------------------------------- Calendar */

  group('Calendar export');

  const ics = calendar.buildIcs(
    {
      title: 'Understanding; Market Cycles, part 2',
      description: 'Line one\nLine two',
      startsAt: '2026-08-06T15:00:00Z',
      endsAt: '2026-08-06T16:30:00Z',
      timezone: 'Europe/Nicosia',
      location: 'https://tradingnew.space/en/events/x',
      url: 'https://tradingnew.space/en/events/x',
      uid: 'evt_1@tradingnew.space',
    },
    new Date('2026-08-01T00:00:00Z')
  );

  check('the file is a valid VEVENT with CRLF line endings', () => {
    assert.equal(ics.startsWith('BEGIN:VCALENDAR\r\n'), true);
    assert.equal(ics.includes('BEGIN:VEVENT'), true);
    assert.equal(ics.trimEnd().endsWith('END:VCALENDAR'), true);
  });

  check('instants are written in UTC basic format', () => {
    assert.equal(ics.includes('DTSTART:20260806T150000Z'), true);
    assert.equal(ics.includes('DTEND:20260806T163000Z'), true);
  });

  check('separators inside text are escaped', () => {
    assert.equal(ics.includes('SUMMARY:Understanding\\; Market Cycles\\, part 2'), true);
    assert.equal(ics.includes('\\nLine two'), true);
  });

  check('a protected joining link never reaches the file', () => {
    const location = calendar.calendarLocation({
      format: 'online',
      venueName: null,
      venueAddress: null,
      city: null,
      url: 'https://tradingnew.space/en/events/x',
    });
    assert.equal(location.includes('meet'), false);
    assert.equal(location, 'https://tradingnew.space/en/events/x');
  });

  check('an in-person event carries its venue', () => {
    assert.equal(
      calendar.calendarLocation({
        format: 'in_person',
        venueName: 'Columbia Plaza',
        venueAddress: '223 Ayiou Andreou, Limassol',
        city: 'Limassol',
        url: 'https://tradingnew.space/x',
      }),
      'Columbia Plaza, 223 Ayiou Andreou, Limassol'
    );
  });

  /* -------------------------------------------------------------- Content */

  group('Content safety');

  check('markup is kept as text, never as structure', () => {
    const cleaned = sanitize.cleanText('<script>alert(1)</script>', 200);
    assert.equal(cleaned.includes('<script>'), true, 'stored verbatim, rendered as text');
    assert.equal(typeof cleaned, 'string');
  });

  check('zero-width and bidi characters are removed', () => {
    const cleaned = sanitize.cleanLine('Free​Money‮', 100);
    assert.equal(cleaned, 'FreeMoney');
  });

  check('control characters are removed', () => {
    assert.equal(sanitize.cleanLine('a bc', 100), 'abc');
  });

  check('paragraph breaks survive, runs of blanks do not', () => {
    assert.deepEqual(sanitize.paragraphs(sanitize.cleanText('one\n\n\n\ntwo', 200)), ['one', 'two']);
  });

  check('slugs are safe and unique per call', () => {
    assert.equal(sanitize.slugify('Événement d’Investissement!', 'abc123'), 'evenement-d-investissement-abc123');
    assert.equal(sanitize.slugify('###', 'xyz'), 'event-xyz');
  });

  /* ------------------------------------------------------------- Access */

  group('Authorization');

  const event = { status: 'published', createdBy: 'u1', organizerId: 'o1', visibility: 'public' };
  const owner = { id: 'u1', role: 'user', organizerIds: ['o1'] };
  const stranger = { id: 'u2', role: 'user', organizerIds: [] };
  const moderator = { id: 'u3', role: 'moderator', organizerIds: [] };
  const admin = { id: 'u4', role: 'admin', organizerIds: [] };

  check('a stranger cannot edit or cancel', () => {
    assert.equal(access.canEdit(stranger, event), false);
    assert.equal(access.canCancel(stranger, event), false);
  });

  check('a stranger cannot read the attendee list', () => {
    assert.equal(access.canViewRegistrations(stranger, event), false);
    assert.equal(access.canExportRegistrations(stranger, event), false);
  });

  check('anonymous can do none of it', () => {
    assert.equal(access.canEdit(null, event), false);
    assert.equal(access.canViewRegistrations(null, event), false);
    assert.equal(access.canModerate(null), false);
  });

  check('the owner can edit and see their own attendees', () => {
    assert.equal(access.canEdit(owner, event), true);
    assert.equal(access.canViewRegistrations(owner, event), true);
  });

  check('a moderator moderates but does not read attendee lists', () => {
    assert.equal(access.canModerate(moderator), true);
    assert.equal(access.canViewRegistrations(moderator, event), false);
  });

  check('only an admin creates official events or publishes directly', () => {
    assert.equal(access.canCreateOfficialEvent(owner), false);
    assert.equal(access.canCreateOfficialEvent(moderator), false);
    assert.equal(access.canCreateOfficialEvent(admin), true);
    assert.equal(access.canPublishDirectly(owner), false);
    assert.equal(access.canPublishDirectly(admin), true);
  });

  check('a draft is invisible to anyone but its owner and staff', () => {
    const draft = { ...event, status: 'draft' };
    assert.equal(access.canView(null, draft), false);
    assert.equal(access.canView(stranger, draft), false);
    assert.equal(access.canView(owner, draft), true);
    assert.equal(access.canView(moderator, draft), true);
  });

  check('the moderation state machine refuses illegal jumps', () => {
    assert.equal(access.canTransition('pending_review', 'published'), true);
    assert.equal(access.canTransition('rejected', 'published'), false);
    assert.equal(access.canTransition('cancelled', 'published'), false);
    assert.equal(access.canTransition('draft', 'published'), false);
  });

  /* ---------------------------------------------------------- Recommender */

  group('Recommendations');

  const summary = (overrides) => ({
    id: 'e1',
    slug: 'e1',
    title: 'Event',
    shortDescription: '',
    coverImageUrl: null,
    coverGradient: null,
    status: 'published',
    format: 'in_person',
    eventType: 'meetup',
    sourceType: 'community',
    organizerType: 'community',
    verificationStatus: 'unverified',
    externalDomain: null,
    externalTrusted: false,
    startsAt: '2026-08-10T17:00:00Z',
    endsAt: '2026-08-10T19:00:00Z',
    timezone: 'UTC',
    language: ['EN'],
    country: 'Cyprus',
    city: 'Limassol',
    venueName: null,
    latitude: null,
    longitude: null,
    capacity: null,
    registrationCount: 0,
    waitlistEnabled: false,
    priceType: 'free',
    priceAmount: null,
    currency: null,
    experienceLevel: 'all_levels',
    topics: ['Macroeconomics'],
    isPromoted: false,
    organizerName: 'Org',
    organizerSlug: 'org',
    organizerInitials: 'O',
    ...overrides,
  });

  const now = new Date('2026-08-01T00:00:00Z');

  check('the local event outranks the distant one', () => {
    const local = summary({ id: 'local', city: 'Limassol' });
    const away = summary({ id: 'away', city: 'Tokyo', country: 'Japan' });
    const ranked = recommend.rankEvents([away, local], {
      ...recommend.NO_SIGNALS,
      city: 'Limassol',
      country: 'Cyprus',
    }, now);
    assert.equal(ranked[0].event.id, 'local');
  });

  check('a matching topic beats no match', () => {
    const match = summary({ id: 'match', topics: ['ETFs'] });
    const other = summary({ id: 'other', topics: ['Trading'] });
    const ranked = recommend.rankEvents([other, match], {
      ...recommend.NO_SIGNALS,
      topics: ['ETFs'],
    }, now);
    assert.equal(ranked[0].event.id, 'match');
  });

  check('every ranked event can explain itself', () => {
    const ranked = recommend.rankEvents([summary({})], recommend.NO_SIGNALS, now);
    assert.equal(typeof recommend.explain(ranked[0]), 'string');
    assert.equal(recommend.explain(ranked[0]).length > 10, true);
  });

  check('soonest sorts by date and nothing else', () => {
    const later = summary({ id: 'later', startsAt: '2026-09-01T00:00:00Z' });
    const sooner = summary({ id: 'sooner', startsAt: '2026-08-03T00:00:00Z', registrationCount: 0 });
    const sorted = recommend.sortEvents([later, sooner], 'soonest', recommend.NO_SIGNALS, now);
    assert.equal(sorted[0].id, 'sooner');
  });

  check('equal scores keep a stable order', () => {
    const a = summary({ id: 'a', startsAt: '2026-08-05T00:00:00Z' });
    const b = summary({ id: 'b', startsAt: '2026-08-06T00:00:00Z' });
    const once = recommend.rankEvents([a, b], recommend.NO_SIGNALS, now).map((r) => r.event.id);
    const twice = recommend.rankEvents([b, a], recommend.NO_SIGNALS, now).map((r) => r.event.id);
    assert.deepEqual(once, twice);
  });

  check('distance is a real great-circle distance', () => {
    const km = recommend.distanceKm(
      { latitude: 34.707, longitude: 33.022 },
      { latitude: 35.185, longitude: 33.382 }
    );
    // Limassol to Nicosia is about 60km.
    assert.equal(km > 50 && km < 75, true, `got ${km}`);
  });

  /* --------------------------------------------------------- Chart studies */

  group('Chart studies');

  check("RSI(14) matches Wilder's reference", () => {
    // The sequence every RSI implementation is checked against; the first
    // defined value is 70.5. A plain EMA in place of Wilder's smoothing lands
    // near 69, which is close enough to look right and wrong enough to disagree
    // with the `ta.rsi` the Pine block claims this is.
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61,
      46.28, 46.28,
    ];
    const values = studies.STUDIES.rsi.compute(closes, { length: 14 })[0].values;
    const first = values.findIndex((value) => value !== null);

    assert.equal(first, 14, 'RSI needs 14 changes before it exists');
    assert.ok(Math.abs(values[first] - 70.5) <= 0.5, `got ${values[first]}`);
  });

  check('an unknown study is refused rather than approximated', () => {
    assert.equal(studies.clampSpec({ id: 'vwap' }), null);
    assert.equal(studies.clampSpec({ id: 'ichimoku', params: { a: 9 } }), null);
    assert.equal(studies.clampSpec(null), null);
    assert.equal(studies.clampSpec({}), null);
  });

  check('missing parameters take the defaults', () => {
    assert.deepEqual(studies.clampSpec({ id: 'rsi' }), { id: 'rsi', params: { length: 14 } });
    assert.deepEqual(studies.clampSpec({ id: 'sma' }), {
      id: 'sma',
      params: { fast: 50, slow: 200 },
    });
  });

  check('out-of-range parameters are pulled in, not rejected', () => {
    const spec = studies.clampSpec({ id: 'sma', params: { fast: 9999, slow: -3 } });
    assert.equal(spec.params.fast, 200);
    assert.equal(spec.params.slow, 2);
  });

  check('a non-numeric parameter falls back to its default', () => {
    const spec = studies.clampSpec({ id: 'rsi', params: { length: 'fourteen' } });
    assert.equal(spec.params.length, 14);
  });

  check('every study warms up before it draws', () => {
    const closes = Array.from({ length: 260 }, (_, i) => 100 + Math.sin(i / 9) * 8);

    for (const id of studies.STUDY_IDS) {
      const spec = studies.clampSpec({ id });
      for (const line of studies.STUDIES[id].compute(closes, spec.params)) {
        assert.equal(line.values.length, closes.length, `${id}/${line.key} length`);
        assert.ok(
          line.values.some((value) => value !== null),
          `${id}/${line.key} produced nothing`
        );
      }
    }
  });

  check('a series shorter than the window produces no line rather than nonsense', () => {
    const values = studies.STUDIES.sma.compute([1, 2, 3], { fast: 50, slow: 200 })[0].values;
    assert.ok(values.every((value) => value === null));
  });

  check('Bollinger bands sit either side of their basis', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 5);
    const lines = studies.STUDIES.bbands.compute(closes, { length: 20, mult: 2 });
    const [upper, basis, lower] = ['upper', 'basis', 'lower'].map(
      (key) => lines.find((line) => line.key === key).values
    );

    for (let i = 0; i < closes.length; i += 1) {
      if (basis[i] === null) continue;
      assert.ok(upper[i] > basis[i] && basis[i] > lower[i], `bands inverted at ${i}`);
    }
  });

  check('the MACD histogram is the gap between its two lines', () => {
    const closes = Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i / 7) * 6);
    const lines = studies.STUDIES.macd.compute(closes, { fast: 12, slow: 26, signal: 9 });
    const macd = lines.find((line) => line.key === 'macd').values;
    const signal = lines.find((line) => line.key === 'signal').values;
    const hist = lines.find((line) => line.key === 'hist').values;

    for (let i = 0; i < closes.length; i += 1) {
      if (hist[i] === null) continue;
      assert.ok(Math.abs(hist[i] - (macd[i] - signal[i])) < 1e-9, `histogram wrong at ${i}`);
    }
  });

  check('every Pine template declares v6 and carries the parameters in force', () => {
    for (const id of studies.STUDY_IDS) {
      const spec = studies.clampSpec({ id });
      const code = studies.STUDIES[id].pine(spec.params);

      assert.ok(code.startsWith('//@version=6'), `${id} is not v6`);
      assert.ok(code.includes('indicator('), `${id} declares no indicator`);

      for (const value of Object.values(spec.params)) {
        assert.ok(code.includes(String(value)), `${id} does not mention ${value}`);
      }
    }
  });

  check('the answer schema is one the API will accept', () => {
    /*
     * A schema the API rejects fails invisibly: the orchestrator catches the
     * error, logs it and returns a scripted answer, so the widget still replies
     * and the screen looks fine. Every answer on production was scripted for an
     * hour before a log line gave it away, and the cause was one property.
     *
     * The rule is that `additionalProperties` must be `false` — never a type.
     */
    const walk = (node, path) => {
      if (!node || typeof node !== 'object') return;

      if ('additionalProperties' in node && node.additionalProperties !== false) {
        assert.fail(`${path}.additionalProperties must be false, got ${JSON.stringify(node.additionalProperties)}`);
      }

      if (node.type === 'object' && node.properties) {
        assert.ok(
          'additionalProperties' in node,
          `${path} is an object without additionalProperties: false`
        );
        for (const [key, child] of Object.entries(node.properties)) walk(child, `${path}.${key}`);
      }

      if (node.type === 'array' && node.items) walk(node.items, `${path}[]`);
    };

    walk(schema.ANSWER_SCHEMA, 'answer');
  });

  check('the study schema names every parameter the registry uses', () => {
    // Derived rather than written down, so a study gaining a parameter cannot
    // leave the schema behind and quietly make that parameter unavailable.
    const declared = Object.keys(schema.ANSWER_SCHEMA.properties.study.properties.params.properties);
    for (const id of studies.STUDY_IDS) {
      for (const name of Object.keys(studies.STUDIES[id].params)) {
        assert.ok(declared.includes(name), `${id}.${name} is missing from the schema`);
      }
    }
  });

  check('every study id is offered to the model', () => {
    assert.deepEqual(
      [...schema.ANSWER_SCHEMA.properties.study.properties.id.enum].sort(),
      [...studies.STUDY_IDS].sort()
    );
  });

  check('the code copied is the code shown, on any platform', () => {
    // The templates are literals in a checked-out file, so a Windows checkout
    // carries CRLF and a Linux one LF. Without normalising, the bytes on the
    // clipboard depend on which machine built the site while the screen looks
    // the same either way.
    for (const id of studies.STUDY_IDS) {
      const code = studies.STUDIES[id].pine(studies.clampSpec({ id }).params);
      assert.ok(!code.includes(String.fromCharCode(13)), `${id} carries a carriage return`);
    }
  });

  check('a study never describes itself as a reason to trade', () => {
    const forbidden = /\b(buy|sell|short|long the|entry signal|take profit)\b/i;

    for (const id of studies.STUDY_IDS) {
      const spec = studies.clampSpec({ id });
      assert.ok(!forbidden.test(studies.STUDIES[id].pine(spec.params)), `${id} pine`);
      assert.ok(!forbidden.test(studies.STUDIES[id].label(spec.params)), `${id} label`);
    }
  });

  check('the fallback series is deterministic and priced around its base', () => {
    const a = wave.waveSeries(5.1, 260, 250);
    const b = wave.waveSeries(5.1, 260, 250);

    assert.deepEqual(a, b, 'two calls disagreed — this would be a hydration mismatch');
    assert.equal(a.length, 260);
    assert.ok(Math.min(...a) > 150 && Math.max(...a) < 350, `${Math.min(...a)}..${Math.max(...a)}`);
  });
} catch (error) {
  failed += 1;
  console.log(`
  FAIL the run stopped early — ${String(error).split(String.fromCharCode(10))[0]}`);
} finally {
  rmSync(out, { recursive: true, force: true });
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed === 0 ? 0 : 1);
}
