/**
 * What the Learn landing says about someone's progress.
 *
 * Dependency-free so the arithmetic can be tested without a database or a
 * browser. The rule that matters is the one about zero: a person with no
 * progress is not shown a ring at 0% and a "next lesson" they never chose —
 * they are shown an invitation to start. A dashboard for a journey that has not
 * begun is the fake personal metric the brief rules out, and it is worse than
 * useless because it looks like a record of failure.
 */

export type LessonRef = { slug: string; title: string };

export type LearnSummary =
  | { state: 'new'; total: number }
  | {
      state: 'started' | 'finished';
      done: number;
      total: number;
      percent: number;
      /** The first lesson not yet done, in path order. Null once everything is. */
      next: LessonRef | null;
    };

export function learnSummary(lessonsDone: readonly string[], path: readonly LessonRef[]): LearnSummary {
  const total = path.length;

  // Only lessons that are actually on the path count. A slug from an older path
  // would otherwise push the percentage above what the person has read.
  const onPath = new Set(path.map((lesson) => lesson.slug));
  const done = new Set(lessonsDone.filter((slug) => onPath.has(slug)));

  if (done.size === 0) return { state: 'new', total };

  const next = path.find((lesson) => !done.has(lesson.slug)) ?? null;

  return {
    state: next ? 'started' : 'finished',
    done: done.size,
    total,
    // Rounded, never up to 100 while something is outstanding — "100%" beside an
    // unread lesson is the kind of small lie that costs a product its numbers.
    percent: next ? Math.min(99, Math.round((done.size / total) * 100)) : 100,
    next,
  };
}

/** The stroke-dasharray for a progress ring of this radius, filled this far. */
export function ringDash(percent: number, radius: number): string {
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * circumference;
  return `${filled.toFixed(1)} ${(circumference - filled).toFixed(1)}`;
}
