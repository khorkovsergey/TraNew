import { chromium } from 'playwright';
const [,, url, out, w, h, scrollY] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +(w||1440), height: +(h||900) } });
await page.goto(url, { waitUntil: 'networkidle' });
if (scrollY === 'full') {
  await page.screenshot({ path: out, fullPage: true });
} else {
  if (scrollY) await page.evaluate((y) => window.scrollTo(0, +y), scrollY);
  await page.waitForTimeout(400);
  await page.screenshot({ path: out });
}
await browser.close();
console.log('shot', out);
