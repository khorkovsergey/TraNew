import 'server-only';
import { randomBytes } from 'node:crypto';
import {
  artifactFor,
  artifactIsFresh,
  ARTIFACT_TTL_MS,
  type ChartArtifact,
} from './chart/artifact';
import type { VoyagerChartSpec } from './chart/spec';
import type { Bar } from './tools/range';

/**
 * Where a chart waits for the next question.
 *
 * This is the security decision of §29, so it is worth stating plainly.
 *
 * A follow-up needs the previous chart's data. The obvious route — send the
 * series to the browser, take it back with the next question — is the one this
 * deliberately does not take. Anything a browser posts is something a browser
 * can write, and a request that could hand Voyager a price series would be a
 * request that could make Voyager present invented prices as the provider's.
 * No amount of validation fixes that: the numbers would be well-formed and
 * false.
 *
 * So the browser is given a **name, not a payload**. The bars stay on the
 * server; the answer carries an opaque identifier; the next question quotes it.
 * The worst a forged identifier can do is miss, and a miss is the ordinary tool
 * path — the one that runs today.
 *
 * The identifier is 32 random bytes from the platform CSPRNG, so it cannot be
 * guessed or walked. What it names is delayed public market data that was
 * already on the screen of the browser holding it; there is nothing personal in
 * an artifact and nothing is written to a database. It lives in this process,
 * for an hour at most, under a hard count.
 */

/**
 * How many charts the process keeps at once.
 *
 * Small on purpose. This exists so that *this* conversation's follow-up is
 * cheap, not so that every chart ever drawn stays reachable. Past the limit the
 * oldest goes, which is the right one to lose: a chart nobody has followed up
 * on for the length of sixty-three other charts is not being worked on.
 */
export const MAX_ARTIFACTS = 64;

/**
 * The store, keyed by identifier, in insertion order.
 *
 * A `Map` iterates oldest-first, which is the whole of the eviction policy.
 * Process-local and deliberately not a database: an artifact is a convenience
 * that expires within the hour, and persisting anonymous visitors' market
 * history for convenience is a storage decision nobody asked for.
 */
const store = new Map<string, ChartArtifact>();

function mintId(): string {
  return randomBytes(32).toString('hex');
}

/** Drops what has aged out, then what is oldest if the count is still over. */
function prune(now: number): void {
  for (const [id, artifact] of store) {
    if (!artifactIsFresh(artifact, now)) store.delete(id);
  }

  while (store.size >= MAX_ARTIFACTS) {
    const oldest = store.keys().next();
    if (oldest.done) break;
    store.delete(oldest.value);
  }
}

/**
 * Keeps the chart that was just drawn, and returns its name.
 *
 * Null when there is nothing worth keeping — a chart of one bar, or a spec with
 * no series — so a caller cannot end up quoting an artifact that would refuse
 * every edit.
 */
export function rememberChart(input: {
  spec: VoyagerChartSpec;
  series: { assetId: string; bars: Bar[] }[];
  now?: number;
}): ChartArtifact | null {
  const now = input.now ?? Date.now();
  prune(now);

  const artifact = artifactFor({
    id: mintId(),
    createdAt: now,
    spec: input.spec,
    series: input.series,
  });

  if (!artifact) return null;

  store.set(artifact.id, artifact);
  return artifact;
}

/**
 * The chart a follow-up named, if it is still here and still fresh.
 *
 * Every rejection is silent and lands in the same place: no artifact, so the
 * request runs exactly as it would have before any of this existed. A missing
 * chart is never an error shown to anybody — it is a fetch.
 */
export function recallChart(id: unknown, now = Date.now()): ChartArtifact | null {
  if (typeof id !== 'string' || !/^[0-9a-f]{64}$/.test(id)) return null;

  const artifact = store.get(id);
  if (!artifact) return null;

  if (!artifactIsFresh(artifact, now)) {
    store.delete(id);
    return null;
  }

  return artifact;
}

/** How long an artifact may be quoted for, re-exported where callers look. */
export { ARTIFACT_TTL_MS };
