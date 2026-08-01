import 'server-only';
import { cache } from 'react';
import { and, eq } from 'drizzle-orm';
import { db, isDatabaseConfigured, schema } from '@/db';
import { getSession } from '@/lib/session';
import { NO_SIGNALS, type RecommendationSignals } from './recommend';

/**
 * What the recommender is allowed to know about someone.
 *
 * Assembled here rather than inside the ranking so the two questions stay apart:
 * this module answers "what may we use", `recommend.ts` answers "what does it
 * mean". It reads what the person has already told the product — their Academy
 * path, what they saved, the location they picked — and nothing else. No
 * inference from behaviour they did not choose to record.
 */

export const signalsForViewer = cache(
  async (location: { city: string | null; country: string | null }): Promise<RecommendationSignals> => {
    const base: RecommendationSignals = {
      ...NO_SIGNALS,
      city: location.city,
      country: location.country,
      languages: ['EN'],
    };

    const session = await getSession();
    if (!session?.user || !isDatabaseConfigured()) return base;

    const userId = session.user.id;

    try {
      const [progress] = await db
        .select()
        .from(schema.academyProgress)
        .where(eq(schema.academyProgress.userId, userId))
        .limit(1);

      const saved = await db
        .select({ kind: schema.savedObject.kind, ref: schema.savedObject.ref })
        .from(schema.savedObject)
        .where(eq(schema.savedObject.userId, userId));

      const [levelPreference] = await db
        .select({ value: schema.preference.value })
        .from(schema.preference)
        .where(
          and(eq(schema.preference.userId, userId), eq(schema.preference.key, 'events.level'))
        )
        .limit(1);

      const level = typeof levelPreference?.value === 'string' ? levelPreference.value : null;

      return {
        ...base,
        academyLessons: progress?.lessonsDone?.length ?? 0,
        // Symbols someone follows are the markets they care about.
        markets: saved.filter((row) => row.kind === 'symbol').map((row) => row.ref),
        topics: topicsFromAcademy(progress?.termsSeen ?? []),
        level: isLevel(level) ? level : null,
      };
    } catch {
      return base;
    }
  }
);

function isLevel(value: string | null): value is RecommendationSignals['level'] & string {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced' || value === 'all_levels';
}

/**
 * Maps Academy vocabulary onto event topics. A lookup rather than a similarity
 * score: a wrong recommendation is cheap, but an unexplainable one is not, and
 * every entry here can be pointed at.
 */
const TERM_TO_TOPIC: Record<string, string> = {
  inflation: 'Macroeconomics',
  'interest rate': 'Macroeconomics',
  recession: 'Macroeconomics',
  etf: 'ETFs',
  'index fund': 'ETFs',
  diversification: 'Portfolio construction',
  allocation: 'Portfolio construction',
  volatility: 'Risk management',
  drawdown: 'Risk management',
  dividend: 'Stocks',
  'price to earnings': 'Stocks',
  option: 'Options and derivatives',
  bitcoin: 'Crypto and digital assets',
  'capital gains': 'Regulation and taxation',
};

function topicsFromAcademy(terms: string[]): string[] {
  const topics = new Set<string>();

  for (const term of terms) {
    const topic = TERM_TO_TOPIC[term.toLowerCase()];
    if (topic) topics.add(topic);
  }

  return [...topics];
}
