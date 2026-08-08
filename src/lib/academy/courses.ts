import {
  ACADEMY_COURSES,
  type Course,
  type CourseFormat,
  type CourseSection,
  type CourseSort,
  type Currency,
} from '@/content/academyCourses';

/**
 * The arithmetic behind Academy.
 *
 * Dependency-free on purpose — no database, no React — so that "how long is this
 * course" and "how far through is this person" are answered by one function each
 * and can be checked without starting anything.
 *
 * Every duration on every Academy screen is counted from the lesson list. There
 * is no field holding "8h 45m": a curriculum that gains a lesson gains the
 * minutes too, and a headline that disagrees with the list underneath it is not
 * possible to write here.
 */

export const FORMAT_LABEL: Record<CourseFormat, string> = {
  online: 'Online',
  live_online: 'Live Online',
  in_person: 'In-person',
  hybrid: 'Hybrid',
};

const CURRENCY_SYMBOL: Record<Currency, string> = { EUR: '€', GBP: '£', USD: '$' };

/** mm:ss — the only duration format the content file writes. */
export function lessonSeconds(time: string): number {
  const [minutes, seconds] = time.split(':');
  return Number(minutes) * 60 + Number(seconds ?? 0);
}

export function sectionSeconds(section: CourseSection): number {
  return section.lessons.reduce((total, lesson) => total + lessonSeconds(lesson.time), 0);
}

export function courseSeconds(course: Course): number {
  return course.sections.reduce((total, section) => total + sectionSeconds(section), 0);
}

export function courseLessons(course: Course) {
  return course.sections.flatMap((section) => section.lessons);
}

export function lessonCount(course: Course): number {
  return course.sections.reduce((total, section) => total + section.lessons.length, 0);
}

/** "8h 45m", "45m". Never "0h". */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${String(rest).padStart(2, '0')}m`;
}

export function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(1);
}

export function sectionMeta(section: CourseSection): string {
  const count = section.lessons.length;
  return `${count} ${count === 1 ? 'lesson' : 'lessons'} · ${formatDuration(sectionSeconds(section))}`;
}

export function courseMeta(course: Course): string {
  const count = lessonCount(course);
  return `${formatDuration(courseSeconds(course))} · ${count} ${count === 1 ? 'lesson' : 'lessons'}`;
}

export function formatPrice(price: number, currency: Currency): string {
  if (price === 0) return 'Free';
  return `${CURRENCY_SYMBOL[currency]}${price.toLocaleString('en-GB')}`;
}

export function formatAmount(price: number, currency: Currency): string {
  return `${CURRENCY_SYMBOL[currency]}${price.toFixed(2)}`;
}

/**
 * The second line on a catalogue card.
 *
 * A scheduled cohort says when it meets; a self-paced course says how long it
 * is. Showing "8h 45m" for a two-day workshop in Frankfurt would answer a
 * question nobody asked about it.
 */
export function cardMeta(course: Course): string {
  if (course.schedule) {
    return `${course.level} · ${course.schedule.label}${
      course.schedule.location ? ` · ${course.schedule.location}` : ''
    }`;
  }
  return `${course.level} · ${courseMeta(course)}`;
}

/** A cohort whose first session has not happened yet. */
export function isUpcoming(course: Course, now: Date): boolean {
  if (!course.schedule) return false;
  return Date.parse(course.schedule.startsAt) >= now.getTime();
}

/* ------------------------------------------------------------- The catalogue */

export type CatalogQuery = {
  q: string;
  category: string;
  type: string[];
  format: string[];
  level: string[];
  provider: string[];
  price: string[];
};

export const EMPTY_QUERY: CatalogQuery = {
  q: '',
  category: 'All',
  type: [],
  format: [],
  level: [],
  provider: [],
  price: [],
};

export function providerLabel(course: Course): string {
  return course.providerType === 'tradingnew' ? 'TradingNew' : 'External providers';
}

export function priceLabel(course: Course): string {
  return course.price === 0 ? 'Free' : 'Paid';
}

function matches(course: Course, query: CatalogQuery): boolean {
  const needle = query.q.trim().toLowerCase();
  if (needle) {
    const haystack = [
      course.title,
      course.provider,
      course.category,
      course.level,
      course.instructor.name,
      course.tagline,
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }

  if (query.category !== 'All' && course.category !== query.category) return false;
  if (query.type.length && !query.type.includes(course.category)) return false;
  if (query.format.length && !query.format.includes(FORMAT_LABEL[course.format])) return false;
  if (query.level.length && !query.level.includes(course.level)) return false;
  if (query.provider.length && !query.provider.includes(providerLabel(course))) return false;
  if (query.price.length && !query.price.includes(priceLabel(course))) return false;

  return true;
}

export function sortCourses(list: Course[], sort: CourseSort): Course[] {
  const sorted = [...list];

  if (sort === 'Highest rated') {
    // A course with no reviews is not "worse than 4.5" — it is unrated, and it
    // sorts last rather than being given a score it never earned.
    return sorted.sort((a, b) => (b.rating?.score ?? -1) - (a.rating?.score ?? -1));
  }
  if (sort === 'Price: low to high') {
    return sorted.sort((a, b) => a.price - b.price);
  }
  if (sort === 'Newest') {
    return sorted.sort(
      (a, b) => Number(b.badge === 'New') - Number(a.badge === 'New')
    );
  }
  // Popular: how many people reviewed it, which is the only popularity signal
  // this catalogue actually holds.
  return sorted.sort((a, b) => (b.rating?.count ?? 0) - (a.rating?.count ?? 0));
}

export function searchCourses(query: CatalogQuery, sort: CourseSort): Course[] {
  return sortCourses(ACADEMY_COURSES.filter((course) => matches(course, query)), sort);
}

/** How many courses each facet option would match, counted over the whole catalogue. */
export function facetCount(group: keyof CatalogQuery, value: string): number {
  return ACADEMY_COURSES.filter((course) => {
    if (group === 'type') return course.category === value;
    if (group === 'format') return FORMAT_LABEL[course.format] === value;
    if (group === 'level') return course.level === value;
    if (group === 'provider') return providerLabel(course) === value;
    if (group === 'price') return priceLabel(course) === value;
    return false;
  }).length;
}

/* --------------------------------------------------------------- Progress */

/**
 * How a finished Academy lesson is recorded.
 *
 * Prefixed and written into the same `lessonsDone` list the free path uses.
 * A separate table would have been a migration for one array of strings, and
 * the prefix keeps the two apart: the Learn summary only counts slugs that are
 * on its path, so these are invisible to it.
 */
export function progressKey(slug: string, lessonId: string): string {
  return `course:${slug}:${lessonId}`;
}

export type CourseProgress = {
  done: number;
  total: number;
  percent: number;
  /** Seconds of lesson time actually completed. */
  seconds: number;
  /** The first unfinished lesson, in curriculum order. Null once none are left. */
  next: { sectionTitle: string; title: string; id: string } | null;
  started: boolean;
  complete: boolean;
};

export function courseProgress(course: Course, lessonsDone: readonly string[]): CourseProgress {
  const done = new Set(lessonsDone);
  const total = lessonCount(course);

  let completed = 0;
  let seconds = 0;
  let next: CourseProgress['next'] = null;

  for (const section of course.sections) {
    for (const lesson of section.lessons) {
      if (done.has(progressKey(course.slug, lesson.id))) {
        completed += 1;
        seconds += lessonSeconds(lesson.time);
      } else if (!next) {
        next = { sectionTitle: section.title, title: lesson.title, id: lesson.id };
      }
    }
  }

  return {
    done: completed,
    total,
    // Never rounded up to 100 while a lesson is outstanding.
    percent: total === 0 ? 0 : next ? Math.min(99, Math.round((completed / total) * 100)) : 100,
    seconds,
    next,
    started: completed > 0,
    complete: total > 0 && completed === total,
  };
}

/* ---------------------------------------------------------------- Checkout */

/**
 * The line items behind the price.
 *
 * VAT is inside the price rather than added to it, which is how a consumer
 * price is quoted in the EU — so the total equals the number on the card, and
 * the breakdown explains it instead of contradicting it.
 */
export const VAT_RATE = 0.19;

export function checkoutLines(course: Course) {
  const list = course.listPrice ?? course.price;
  const discount = list - course.price;
  const vat = course.price - course.price / (1 + VAT_RATE);

  return {
    list,
    discount,
    vat,
    total: course.price,
    hasDiscount: discount > 0,
    discountPercent: discount > 0 ? Math.round((discount / list) * 100) : 0,
  };
}
