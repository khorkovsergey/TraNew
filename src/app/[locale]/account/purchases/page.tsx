import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountPurchases, type PurchasedCourse } from '@/components/account/AccountSections';
import { courseBySlug } from '@/content/academyCourses';
import type { Locale } from '@/i18n/routing';
import { FORMAT_LABEL, courseMeta, formatPrice } from '@/lib/academy/courses';
import { listEnrolments } from '@/lib/academy/enrolment';
import { pageMetadata } from '@/lib/metadata';
import { requireUser } from '@/lib/session';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/account/purchases',
    locale,
    title: "Purchases",
    description: "Expert services, tools and data, learning, merchandise and payments.",
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Middleware only checks that a cookie exists; this is the real gate.
  const user = await requireUser();

  /*
   * Academy enrolments, read here rather than in the component.
   *
   * The catalogue lookup is what turns a purchase row into a line worth
   * reading, so a course removed from the catalogue drops out of the list
   * rather than rendering as a blank.
   */
  const enrolments = await listEnrolments(user.id);
  const courses: PurchasedCourse[] = enrolments.flatMap((enrolment) => {
    const course = courseBySlug(enrolment.slug);
    if (!course) return [];

    return [
      {
        slug: course.slug,
        title: course.title,
        demo: enrolment.demo,
        meta: `${course.provider} · ${FORMAT_LABEL[course.format]} · ${courseMeta(
          course
        )} · ${formatPrice(enrolment.amountCents / 100, course.currency)}`,
      },
    ];
  });

  return (
    <AccountLayout>
      <AccountPurchases courses={courses} />
    </AccountLayout>
  );
}
