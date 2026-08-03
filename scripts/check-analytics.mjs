import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every declared analytics event has somewhere that emits it.
 *
 * A union member with no caller is a lie in the schema: it says the product
 * measures something it does not, and whoever reads the analytics later will
 * conclude the feature is unused rather than uninstrumented. TypeScript catches
 * the opposite mistake — emitting an event that was never declared — so this
 * closes the pair.
 */

function walk(directory) {
  const out = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(path);
  }
  return out;
}

const analytics = readFileSync('src/lib/events/analytics.ts', 'utf8');
const declared = [...analytics.matchAll(/\| \{ name: '([a-z_]+)'/g)].map((match) => match[1]);

const sources = walk('src')
  .filter((path) => !path.endsWith('analytics.ts'))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');

const orphans = declared.filter((name) => !sources.includes(`'${name}'`));

console.log(`${declared.length} events declared`);

if (orphans.length) {
  console.error(`\n${orphans.length} declared but never emitted:`);
  for (const name of orphans) console.error(`  ${name}`);
  process.exit(1);
}

console.log('every one has a caller');
