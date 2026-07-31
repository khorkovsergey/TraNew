import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

/**
 * Drives the Voyager widget through its states and captures each one, so the
 * result can be held next to the handoff screenshots. Viewport matches the
 * 909×540 the mockups were captured at.
 */

const BASE = process.env.SHOT_BASE ?? 'http://localhost:3210';
const DIR = process.env.SHOT_DIR ?? 'voyager-shots';

const shots = [];

async function main() {
  await mkdir(DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 909, height: 540 } });

  const shot = async (name) => {
    await page.screenshot({ path: `${DIR}/${name}.png` });
    shots.push(name);
  };

  // 01 collapsed on the home page
  await page.goto(`${BASE}/en`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Ask Voyager');
  await shot('01-collapsed-home');

  // 02 peek
  await page.click('text=Ask Voyager');
  await page.waitForSelector('text=Open Voyager');
  await shot('02-peek');

  // 03 panel, first run
  await page.click('text=Open Voyager');
  await page.waitForSelector('text=Ask about this page');
  await shot('03-panel-firstrun');

  // 05 manage sources
  await page.click('text=/Using:/');
  await page.waitForSelector('text=Sources you switch off');
  await shot('05-sources-manage');
  await page.click('text=/Using:/');

  // 04 an answer
  await page.click('text=Ask about this page');
  await page.waitForSelector('text=/Sources:/', { timeout: 30000 });
  await shot('04-answer');

  // 06 full workspace
  await page.click('text=Full workspace');
  await page.waitForTimeout(300);
  await shot('06-full-workspace');
  await page.click('text=Side panel');

  // 07 collapsed on a symbol page
  await page.click('[aria-label="Close Voyager"]');
  await page.goto(`${BASE}/en/symbols/TSLA`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Ask about Tesla');
  await shot('07-collapsed-symbol');

  // 08 peek on a symbol page
  await page.click('text=Ask about Tesla');
  await page.waitForSelector('text=Why is it moving today?');
  await shot('08-peek-symbol');

  // 09 symbol answer
  await page.click('text=Why is it moving today?');
  await page.waitForSelector('text=/Sources:/', { timeout: 30000 });
  await shot('09-answer-why-moving');

  await browser.close();
  console.log(`captured ${shots.length}: ${shots.join(', ')}`);
}

main().catch((error) => {
  console.error('capture failed:', error.message);
  process.exit(1);
});
