/**
 * Captures the built screens at the handoff's capture size (909x540) so they can be
 * compared against the screenshots folders in the design handoff packages. Run it
 * against a local production server: `npm run build && npm run start`, then
 * `node scripts/capture-screens.mjs`.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT =
  process.env.SHOT_DIR ??
  'C:/Users/User/AppData/Local/Temp/claude/c--Users-User-Documents-TradingView/20f0f7b6-3952-44ba-a430-786b55c02ad0/scratchpad/shots';
const BASE = process.env.SHOT_BASE ?? 'http://localhost:3210/en';

// [name, path, scrollY] — scrollY lines the frame up with the handoff crop.
const SHOTS = [
  ['01-home-hero', '/', 0],
  ['02-home-goal-cards', '/', 1180],
  ['03-home-showcases', '/', 1980],
  ['04-symbol', '/symbols/TSLA', 0],
  ['05-workspace', '/research?q=Why%20is%20gold%20rising%20today%3F', 0],
  ['06-brief', '/market/brief', 0],
  ['07-academy', '/academy', 0],
  ['08-strategy', '/strategy', 0],
  ['13-news', '/news', 0],
  ['14-ideas', '/ideas', 0],
  ['17-marketplace-hub', '/marketplace', 0],
  ['18-experts-landing', '/marketplace/experts', 0],
  ['20-experts-matches', '/marketplace/experts/matches', 0],
  ['22-expert-profile', '/marketplace/experts/ak', 0],
  ['v2-01-economy-overview', '/economy', 0],
  ['v2-06-country-us', '/economy/countries/US', 0],
  ['v2-07-indicator-cpi', '/economy/indicators/us-cpi', 0],
  ['v2-10-wealth-overview', '/account/wealth', 0],
  ['v2-11-wealth-asset', '/account/wealth/assets/apt', 0],
  ['v2-21-account-overview', '/account', 0],
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 909, height: 540 },
  deviceScaleFactor: 1,
});

for (const [name, path, scrollY] of SHOTS) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  // Fonts must be loaded before the shot or every metric shifts.
  await page.evaluate(() => document.fonts.ready);
  if (scrollY) await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`captured ${name}`);
}

await browser.close();
console.log('done');
