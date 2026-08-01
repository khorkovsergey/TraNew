import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

/**
 * A sweep of every route reachable from the navigation, plus the states a person
 * actually lands in.
 *
 * Written to find defects rather than to prove correctness, so it reports rather
 * than asserts: broken and redirecting links, pages that duplicate the menu that
 * points at them, dead ends with nothing to do next, empty or placeholder
 * content, and layout that breaks on a phone. Everything it reports is checked
 * by hand afterwards — a crawler's opinion is a lead, not a finding.
 */

const BASE = process.env.BASE_URL ?? 'https://tradingnew.space';
const findings = [];

function note(severity, area, what, detail) {
  findings.push({ severity, area, what, detail });
  console.log(`  ${severity.padEnd(6)} [${area}] ${what}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

/* ------------------------------------------------------------ Menu contents */

console.log('\nNavigation');

await page.goto(`${BASE}/en`, { waitUntil: 'networkidle' });

const menus = {};
for (const name of ['Market', 'Symbols', 'Economy', 'Community', 'Marketplace']) {
  await page.getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(250);

  menus[name] = await page.evaluate(() => {
    const panel = [...document.querySelectorAll('div')].find(
      (element) => getComputedStyle(element).position === 'fixed' && getComputedStyle(element).zIndex === '50'
    );
    if (!panel) return [];
    return [...panel.querySelectorAll('a, button')].map((element) => ({
      label: element.querySelector('div')?.textContent?.trim() ?? element.textContent?.trim() ?? '',
      href: element.getAttribute('href'),
    }));
  });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
}

for (const [name, items] of Object.entries(menus)) {
  const seen = new Map();
  for (const item of items) {
    if (!item.href) continue;
    if (seen.has(item.href)) {
      note('MEDIUM', `menu:${name}`, 'two entries lead to the same page', `"${seen.get(item.href)}" and "${item.label}" → ${item.href}`);
    }
    seen.set(item.href, item.label);
  }
  console.log(`  ${name}: ${items.length} entries`);
}

/* ---------------------------------------------------- Every link, once each */

console.log('\nEvery destination');

const targets = new Set();
for (const items of Object.values(menus)) {
  for (const item of items) if (item.href) targets.add(item.href);
}

// Plus the pages the home page and footer point at.
await page.goto(`${BASE}/en`, { waitUntil: 'networkidle' });
const homeLinks = await page.evaluate(() =>
  [...document.querySelectorAll('a[href^="/en"]')].map((a) => a.getAttribute('href'))
);
for (const href of homeLinks) targets.add(href);

const pages = new Map();

for (const href of [...targets].sort()) {
  const url = href.startsWith('http') ? href : `${BASE}${href}`;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
  const status = response?.status() ?? 0;
  const landed = page.url().replace(BASE, '');

  if (status >= 400) {
    note('HIGH', 'routing', `${href} returns ${status}`);
    continue;
  }
  if (status === 0) {
    note('HIGH', 'routing', `${href} failed to load`);
    continue;
  }
  if (landed !== href && !landed.startsWith('/en/sign-in')) {
    note('LOW', 'routing', `${href} redirects`, `lands on ${landed}`);
  }

  await page.waitForLoadState('networkidle').catch(() => {});

  const info = await page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body;
    const text = (main.innerText ?? '').trim();
    const links = [...main.querySelectorAll('a[href^="/en"]')].map((a) => a.getAttribute('href'));
    return {
      title: document.title,
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent?.trim() ?? ''),
      headings: [...document.querySelectorAll('h1,h2,h3')].map((h) => Number(h.tagName[1])),
      words: text.split(/\s+/).length,
      text: text.slice(0, 4000),
      links,
      buttons: [...main.querySelectorAll('button')].map((b) => b.textContent?.trim() ?? ''),
    };
  });

  pages.set(href, info);

  if (info.h1.length === 0) note('MEDIUM', 'structure', `${href} has no h1`);
  if (info.h1.length > 1) note('LOW', 'structure', `${href} has ${info.h1.length} h1 elements`);

  const skips = info.headings.filter(
    (level, index) => index > 0 && level - info.headings[index - 1] > 1
  );
  if (skips.length) note('LOW', 'structure', `${href} skips a heading level`);

  if (info.words < 40) {
    note('MEDIUM', 'content', `${href} is nearly empty`, `${info.words} words`);
  }

  for (const marker of ['Lorem ipsum', 'TODO', 'Coming soon', 'placeholder', 'undefined', 'NaN', '[object Object]']) {
    if (info.text.includes(marker)) {
      note('HIGH', 'content', `${href} shows "${marker}"`);
    }
  }
}

/* --------------------------------------------- Pages that repeat their menu */

console.log('\nPages that only repeat the menu that points at them');

for (const [name, items] of Object.entries(menus)) {
  const menuHrefs = new Set(items.map((item) => item.href).filter(Boolean));

  for (const item of items) {
    const info = item.href ? pages.get(item.href) : null;
    if (!info) continue;

    const outgoing = [...new Set(info.links)];
    if (outgoing.length < 2) continue;

    const alsoInMenu = outgoing.filter((href) => menuHrefs.has(href));
    const ratio = alsoInMenu.length / outgoing.length;

    if (ratio >= 0.6 && info.words < 220) {
      note(
        'MEDIUM',
        'information architecture',
        `${item.href} mostly repeats the ${name} menu`,
        `${alsoInMenu.length} of ${outgoing.length} links are already in the menu, ${info.words} words of its own`
      );
    }
  }
}

/* -------------------------------------------------------------- Dead ends */

console.log('\nDead ends');

for (const [href, info] of pages) {
  if (info.links.length === 0 && info.buttons.length <= 2) {
    note('MEDIUM', 'navigation', `${href} offers nowhere to go next`);
  }
}

/* ----------------------------------------------------------------- Phone */

console.log('\nPhone width');

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const small = await phone.newPage();

for (const href of [...pages.keys()]) {
  await small.goto(`${BASE}${href}`, { waitUntil: 'networkidle' }).catch(() => {});
  const overflow = await small.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  if (overflow > 0) note('MEDIUM', 'responsive', `${href} scrolls sideways at 390px`, `${overflow}px over`);

  const tiny = await small.evaluate(() =>
    [...document.querySelectorAll('a, button')].filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.height < 24;
    }).length
  );
  if (tiny > 3) note('LOW', 'responsive', `${href} has ${tiny} controls under 24px tall at 390px`);
}

await phone.close();

/* --------------------------------------------------------------- Summary */

writeFileSync(
  process.env.OUT ?? 'audit-findings.json',
  JSON.stringify({ base: BASE, pages: [...pages.keys()], findings }, null, 2)
);

console.log(`\n${pages.size} pages visited, ${findings.length} things to look at`);
for (const severity of ['HIGH', 'MEDIUM', 'LOW']) {
  const count = findings.filter((finding) => finding.severity === severity).length;
  if (count) console.log(`  ${severity}: ${count}`);
}

await browser.close();
