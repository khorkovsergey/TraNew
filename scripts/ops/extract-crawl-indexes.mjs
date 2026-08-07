import fs from 'node:fs';
import path from 'node:path';

/*
 * Pulls two factual indexes out of the tradingview.com crawl:
 *
 *   1. the names of the fundamentals terms, grouped by the section they sit in
 *   2. the ticker/exchange/instrument-name universe
 *
 * Names, categories and tickers only. No definition text, no descriptions, no
 * prices — a list of what exists is a fact; their prose about it is theirs.
 */

const ROOT = 'C:/Users/User/Documents/TradingView/output';
const OUT = 'C:/Users/User/Documents/TradingView/tradingnew-portal/docs';

const crawls = fs.readdirSync(ROOT).filter((d) => fs.statSync(path.join(ROOT, d)).isDirectory());
const files = [];
for (const c of crawls) {
  const dir = path.join(ROOT, c, 'pages');
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) files.push(path.join(dir, f));
}

/** The H1 is the line sitting directly above a run of `=`. */
function heading(text) {
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    if (/^=+\s*$/.test(lines[i]) && lines[i - 1].trim()) return lines[i - 1].trim();
  }
  return null;
}

/* ------------------------------------------------------- 1. Fundamentals terms */

const sections = new Map(); // category -> Set of term names

/*
 * Sections about *their application* rather than about markets — how to install
 * it, where its settings live, how its push notifications work. We are not that
 * product, and a syllabus that teaches someone else's menus is worse than short.
 */
const PRODUCT_SUPPORT = new Set([
  'Application installation',
  'Application settings',
  'Push notifications',
  'Other questions',
]);

for (const file of files) {
  if (!/support-folders-/.test(path.basename(file))) continue;
  const text = fs.readFileSync(file, 'utf8');
  const category = heading(text);
  if (!category || PRODUCT_SUPPORT.has(category)) continue;

  const terms = sections.get(category) ?? new Set();
  for (const m of text.matchAll(/^\*\s+\[([^\]]+)\]\(https:\/\/www\.tradingview\.com\/support\/solutions\/[^)]+\)/gm)) {
    // Curly punctuation the crawler kept, normalised to plain ASCII.
    terms.add(m[1].replace(/\u2019/g, "'").replace(/[\u2013\u2014]/g, '-').trim());
  }
  if (terms.size) sections.set(category, terms);
}

/* --------------------------------------------------------- 2. Symbol universe */

const symbols = new Map(); // "EXCHANGE:TICKER" -> name

for (const file of files) {
  const base = path.basename(file);
  const m = base.match(/-symbols-([A-Z0-9]+)(?:-([A-Z0-9._]+))?\.md$/);
  if (!m) continue;
  const [, a, b] = m;
  const key = b ? `${a}:${b}` : a;
  const name = heading(fs.readFileSync(file, 'utf8'));
  if (name && !symbols.has(key)) symbols.set(key, name);
}

/* ------------------------------------------------------------------- Write out */

const totalTerms = [...sections.values()].reduce((n, s) => n + s.size, 0);

let doc = `# Fundamentals terms a beginner meets

${totalTerms} terms across ${sections.size} sections, taken from the field list a
mature market product exposes on a symbol page.

**This is a checklist, not content.** Only the names and their grouping are here —
a list of which terms exist is a fact about the domain. The definitions are ours to
write, and have to be: our voice rules ask for probabilistic language and no
promises, which is not how a data dictionary is written.

Use it two ways. As an Academy syllabus, to see which concepts we cover and which
we do not. And as a backlog for Voyager's \`explain\` branch, which answers from
the hand-written \`CONCEPTS\` table in
\`src/lib/voyager/workspace/scenarios.ts\` — **31 entries against the 533 below.**
Anything not in that table falls through to the model with no house definition
behind it.

Not all 533 are worth writing. "Beneish M-score" is not a beginner's first
question. Sequence them by what somebody actually meets: the Overview and Key data
points sections first, then Statistics, then the statement-level fields.

Source: crawl of tradingview.com, 6 August 2026.

`;

for (const [category, terms] of [...sections].sort((a, b) => b[1].size - a[1].size)) {
  doc += `## ${category} (${terms.size})\n\n`;
  for (const t of [...terms].sort()) doc += `- ${t}\n`;
  doc += '\n';
}

fs.writeFileSync(path.join(OUT, 'academy-term-checklist.md'), doc.replace(/\n/g, '\r\n'));

/*
 * The crawl found 538 symbol pages, but 499 of them are Euronext and BME
 * sub-indices — "IGBM Aerospace Index", "IGBM Water & Others" — because the
 * crawler wandered into two European index directories and enumerated them.
 * Nobody arriving at TradingNew searches for those, and padding the fixture with
 * them would make search look broad while returning noise.
 */
const EXCLUDE = /^(EURONEXT|BME):/;

const CLASSES = [
  ['Equities', (k) => /^(NASDAQ|NYSE|XETR):/.test(k) && !/NDX|DAX/.test(k)],
  ['Indices', (k) => /^(SPX|SSE:|FTSE:|IG:|FOREXCOM:|XETR:DAX|NASDAQ:NDX|TVC:(NDQ|NI225))/.test(k)],
  ['Commodities', (k) => /^(COMEX|NYMEX):/.test(k)],
  ['Crypto', (k) => /^(BTCUSD|ETHUSD|TOTAL)$/.test(k)],
  ['Currencies', (k) => /^([A-Z]{6}|TVC:DXY)$/.test(k)],
  ['Rates and economy', (k) => /^(TVC:US10Y|ECONOMICS:)/.test(k)],
];

const kept = [...symbols].filter(([k]) => !EXCLUDE.test(k));

let sym = `# Symbol universe

${kept.length} instruments — ticker, exchange and instrument name, grouped by asset
class. Facts, not copied content: a ticker is an identifier and the issuer's name
is the issuer's.

**This is the useful remainder, not the whole crawl.** 538 symbol pages were
collected; 499 of them are Euronext and BME sector sub-indices the crawler
enumerated from two European directories. They are dropped. A fixture padded with
"IGBM Water & Others Index" looks broad and returns noise.

**No prices here, deliberately.** The crawl carried quotes frozen at 6 August 2026,
and a second market-data source that is silently months stale is worse than a
narrow one. Anything priced still comes from the live feed.

Intended use: widening the \`SYMBOLS\` fixture, which is currently too small for
search or comparison to feel real. The spread lines up with our six asset-class
pages, which is what makes it worth having.

Source: crawl of tradingview.com, 6 August 2026.

`;

const claimed = new Set();
for (const [label, test] of CLASSES) {
  const rows = kept.filter(([k]) => !claimed.has(k) && test(k)).sort();
  if (!rows.length) continue;
  rows.forEach(([k]) => claimed.add(k));
  sym += `## ${label} (${rows.length})\n\n| Symbol | Name |\n| --- | --- |\n`;
  for (const [k, name] of rows) sym += `| \`${k}\` | ${name.replace(/\|/g, '\\|')} |\n`;
  sym += '\n';
}

const rest = kept.filter(([k]) => !claimed.has(k)).sort();
if (rest.length) {
  sym += `## Unclassified (${rest.length})\n\n| Symbol | Name |\n| --- | --- |\n`;
  for (const [k, name] of rest) sym += `| \`${k}\` | ${name.replace(/\|/g, '\\|')} |\n`;
  sym += '\n';
}

fs.writeFileSync(path.join(OUT, 'symbol-universe.md'), sym.replace(/\n/g, '\r\n'));

console.log(`terms:   ${totalTerms} in ${sections.size} sections`);
console.log(`symbols: ${kept.length} kept of ${symbols.size}`);
