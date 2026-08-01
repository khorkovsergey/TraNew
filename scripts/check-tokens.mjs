import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every `var(--tn-…)` in the stylesheets must name a token that exists.
 *
 * A misspelt or invented custom property fails silently — the declaration is
 * dropped and the element renders with the inherited or initial value, which
 * usually looks like a styling choice rather than a bug. This is the check that
 * turns it back into an error.
 */

const declared = new Set(
  [...readFileSync('src/app/tokens.css', 'utf8').matchAll(/(--tn-[\w-]+)\s*:/g)].map((m) => m[1])
);

function stylesheets(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return stylesheets(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

const files = stylesheets('src');
const problems = [];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  source.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(/var\((--tn-[\w-]+)/g)) {
      if (!declared.has(match[1])) {
        problems.push(`${file}:${index + 1}  ${match[1]}`);
      }
    }
  });
}

console.log(`${declared.size} tokens declared, ${files.length} stylesheets checked`);

if (problems.length) {
  console.log(`\n${problems.length} reference${problems.length === 1 ? '' : 's'} to a token that does not exist:`);
  problems.forEach((line) => console.log(`  ${line}`));
  process.exit(1);
}

console.log('every token reference resolves');
