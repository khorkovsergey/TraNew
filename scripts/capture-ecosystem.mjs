import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

/** Shoots the centred card at each position, for comparison against the handoff. */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = process.env.OUT ?? 'shots';
const LABELS = [
  'voyager',
  'market-intelligence',
  'supercharts',
  'strategy-builder',
  'wealth-hub',
  'academy',
  'marketplace',
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/en`, { waitUntil: 'networkidle' });

await page.locator('#ecosystem-title').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/section.png` });

for (const [index, label] of LABELS.entries()) {
  await page.locator('[role="tab"]').nth(index).click();
  await page.waitForTimeout(700);
  const card = page.locator('[aria-roledescription="carousel"] > div > div').nth(index);
  await card.screenshot({ path: `${OUT}/${String(index + 1).padStart(2, '0')}-${label}.png` });
}

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/home-top.png` });

await browser.close();
console.log(`wrote ${LABELS.length + 2} images to ${OUT}`);
