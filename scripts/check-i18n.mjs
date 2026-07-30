/**
 * Guards the project's standing rule: everything ships in Russian and English at
 * once. Fails the build if a key exists in one locale and not the other, and warns
 * about values left identical, which usually means a string was never translated.
 *
 * Run with `npm run check:i18n` (included in `npm run check`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(here, '..', 'src', 'messages');

/** Values that are the same in both locales on purpose: brands, codes, templates. */
const ALLOWED_IDENTICAL = new Set([
  'meta.siteName',
  'menu.market.supercharts',
  'menu.symbols.tesla',
  'menu.symbols.sp500',
  'menu.symbols.bitcoin',
  'menu.symbols.nvidia',
  'menu.community.theLeap',
  'menu.globe.currencyValue',
  'menu.globe.timezoneValue',
  'login.email',
  'explore.tools.charts',
  'marketplace.brief.goalValue',
  'marketplace.brief.preferredValue',
  'strategy.empty',
  'screens.supercharts.title',
  'home.showcase.chartsTitle',
]);

function flatten(object, prefix = '') {
  const out = [];
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...flatten(value, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

function valueAt(object, path) {
  return path.split('.').reduce((node, key) => (node ? node[key] : undefined), object);
}

const en = JSON.parse(readFileSync(join(messagesDir, 'en.json'), 'utf8'));
const ru = JSON.parse(readFileSync(join(messagesDir, 'ru.json'), 'utf8'));

const enKeys = flatten(en);
const ruKeys = flatten(ru);
const enSet = new Set(enKeys);
const ruSet = new Set(ruKeys);

const missingInRu = enKeys.filter((key) => !ruSet.has(key));
const missingInEn = ruKeys.filter((key) => !enSet.has(key));
const untranslated = enKeys.filter(
  (key) => ruSet.has(key) && !ALLOWED_IDENTICAL.has(key) && valueAt(en, key) === valueAt(ru, key)
);

let failed = false;

if (missingInRu.length > 0) {
  failed = true;
  console.error(`Missing ${missingInRu.length} key(s) in ru.json:`);
  for (const key of missingInRu) console.error(`  ${key}`);
}

if (missingInEn.length > 0) {
  failed = true;
  console.error(`Missing ${missingInEn.length} key(s) in en.json:`);
  for (const key of missingInEn) console.error(`  ${key}`);
}

if (untranslated.length > 0) {
  failed = true;
  console.error(`${untranslated.length} value(s) identical in both locales — translate or allow-list:`);
  for (const key of untranslated) console.error(`  ${key} = ${JSON.stringify(valueAt(en, key))}`);
}

if (failed) {
  process.exit(1);
}

console.log(`i18n OK — ${enKeys.length} keys present in both locales.`);
