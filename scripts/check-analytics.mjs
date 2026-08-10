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

/**
 * The telemetry layer describes every event; it does not emit them.
 *
 * `src/lib/analytics/registry.ts` names all of them as string literals, which
 * is exactly what this script treats as proof of a caller — so without this
 * exclusion the registry would have made every orphan below look emitted and
 * turned this gate green while nothing emitted anything. The check would have
 * gone on passing forever and meant nothing.
 *
 * The directory is skipped rather than the one file, because the same argument
 * applies to anything else that layer grows: a validator, a coverage report and
 * a metric dictionary all mention event names for a living.
 */
const DESCRIBES_RATHER_THAN_EMITS = ['src\\lib\\analytics', 'src/lib/analytics'];

/**
 * Orphans that were already on `main` before this check learned to be strict.
 *
 * They are the retired plan funnel: the `/start` router replaced it, the
 * emitters went with it, and the union members stayed. They cannot be removed
 * from inside a section — `src/lib/events/analytics.ts` is shared and the
 * append-only protocol forbids deleting another section's entries — so the
 * decision belongs to the `start` owner. See `docs/admin-metrics/current-state.md` §9b.
 *
 * Listing them does not excuse them: the gate still fails. It separates a debt
 * somebody already owes from a regression somebody just introduced, which is
 * the difference between a red build you understand and one you learn to skip.
 */
const INHERITED_ORPHANS = [
  'diagnostic_completed',
  'plan_generated',
  'plan_step_started',
  'plan_step_completed',
  'save_prompt_viewed',
  'registration_completed_from_plan',
  'plan_resumed',
];

const analytics = readFileSync('src/lib/events/analytics.ts', 'utf8');
const declared = [...analytics.matchAll(/\| \{ name: '([a-z_]+)'/g)].map((match) => match[1]);

const sources = walk('src')
  .filter((path) => !path.endsWith('analytics.ts'))
  .filter((path) => !DESCRIBES_RATHER_THAN_EMITS.some((skip) => path.includes(skip)))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');

const orphans = declared.filter((name) => !sources.includes(`'${name}'`));
const inherited = orphans.filter((name) => INHERITED_ORPHANS.includes(name));
const introduced = orphans.filter((name) => !INHERITED_ORPHANS.includes(name));

console.log(`${declared.length} events declared`);

if (orphans.length) {
  if (inherited.length) {
    console.error(`\n${inherited.length} inherited — the retired plan funnel, awaiting the start owner:`);
    for (const name of inherited) console.error(`  ${name}`);
  }

  if (introduced.length) {
    console.error(`\n${introduced.length} NEW — declared by somebody and emitted by nobody:`);
    for (const name of introduced) console.error(`  ${name}`);
  }

  process.exit(1);
}

console.log('every one has a caller');
