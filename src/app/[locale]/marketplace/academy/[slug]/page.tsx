import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { CourseDetail } from '@/components/academy/CourseDetail';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import { courseBySlug } from '@/content/academyCourses';
import type { Locale } from '@/i18n/routing';
import { isEnrolled, lessonsDoneFor } from '@/lib/academy/enrolment';
import { isSaved } from '@/lib/data/savedObjects';
import { pageMetadata } from '@/lib/metadata';
import { getSession } from '@/lib/session';

/**
 * A course page.
 *
 * Public — the curriculum, the instructor and the price are what somebody is
 * deciding on, and asking them to sign in to read it would be asking them to
 * commit before they can. Only the enrolment state is personal, which is why
 * this is dynamic.
 */

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const course = courseBySlug(slug);

  if (!course) return { title: 'Course not found', robots: { index: false, follow: false } };

  return pageMetadata({
    href: { pathname: '/marketplace/academy/[slug]', params: { slug } },
    locale,
    title: `${course.title} — TradingNew Academy`,
    description: course.tagline,
  });
}

export default async function CoursePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const course = courseBySlug(slug);
  if (!course) notFound();

  const session = await getSession();
  const userId = session?.user?.id ?? null;

  const [enrolled, lessonsDone, saved] = await Promise.all([
    isEnrolled(userId, slug),
    lessonsDoneFor(userId),
    userId ? isSaved(userId, 'course', slug) : Promise.resolve(false),
  ]);

  return (
    <>
      <SpaceBackdrop tone={4} />
      <CourseDetail
        course={course}
        signedIn={Boolean(userId)}
        enrolled={enrolled}
        lessonsDone={lessonsDone}
        saved={saved}
      />
    </>
  );
}
