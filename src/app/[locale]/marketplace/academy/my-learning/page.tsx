import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { MyLearning, type LibraryItem } from '@/components/academy/MyLearning';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import { courseBySlug } from '@/content/academyCourses';
import type { Locale } from '@/i18n/routing';
import { listEnrolments, lessonsDoneFor } from '@/lib/academy/enrolment';
import {
  FORMAT_LABEL,
  courseMeta,
  courseProgress,
  formatHours,
  isUpcoming,
} from '@/lib/academy/courses';
import { pageMetadata } from '@/lib/metadata';
import { requireUser } from '@/lib/session';

/**
 * My Learning.
 *
 * The one Academy screen that needs an account, because it is a list of what
 * one person owns. Everything on it is assembled here rather than in the
 * browser: enrolments and watched lessons are the user's records, and the
 * component receives the finished view so it cannot compute a different answer.
 */

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/marketplace/academy/my-learning',
    locale,
    title: 'My Learning',
    description: 'The Academy courses, cohorts and workshops you are enrolled in.',
  });
}

export default async function MyLearningPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser('/marketplace/academy/my-learning');

  const [enrolments, lessonsDone] = await Promise.all([
    listEnrolments(user.id),
    lessonsDoneFor(user.id),
  ]);

  const now = new Date();

  const items: LibraryItem[] = enrolments.flatMap((enrolment) => {
    const course = courseBySlug(enrolment.slug);

    // An enrolment in a course that has since left the catalogue. It stays in
    // the account's purchases, where the record belongs; it cannot be rendered
    // as a library row without a curriculum behind it.
    if (!course) return [];

    const progress = courseProgress(course, lessonsDone);
    const ahead = isUpcoming(course, now);
    const tab: LibraryItem['tab'] = progress.complete
      ? 'completed'
      : ahead
        ? 'upcoming'
        : 'progress';

    return [
      {
        slug: course.slug,
        title: course.title,
        provider: course.provider,
        verified: course.providerVerified,
        image: course.image,
        formatLabel: FORMAT_LABEL[course.format],
        meta:
          course.schedule && ahead
            ? `${course.schedule.label}${course.schedule.location ? ` · ${course.schedule.location}` : ''}`
            : courseMeta(course),
        metaIcon: course.schedule && ahead ? 'calendar' : 'clock',
        badge: progress.complete ? 'Completed' : ahead ? 'Seat reserved' : null,
        badgeDone: progress.complete,
        tab,
        progress: {
          done: progress.done,
          total: progress.total,
          percent: progress.percent,
          started: progress.started,
          complete: progress.complete,
          next: progress.next ? `${progress.next.sectionTitle} · ${progress.next.title}` : null,
        },
      },
    ];
  });

  // Counted from the lessons actually marked watched, across every enrolment —
  // the one figure on the screen that is not visible in a row of its own.
  const watchedSeconds = enrolments.reduce((total, enrolment) => {
    const course = courseBySlug(enrolment.slug);
    return course ? total + courseProgress(course, lessonsDone).seconds : total;
  }, 0);

  return (
    <>
      <SpaceBackdrop tone={4} />
      <MyLearning
        items={items}
        stats={{
          owned: items.length,
          inProgress: items.filter((item) => item.tab === 'progress').length,
          hours: formatHours(watchedSeconds),
          completed: items.filter((item) => item.progress.complete).length,
        }}
      />
    </>
  );
}
