import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AccountLayout } from '@/components/account/AccountLayout';
import {
  AccountPurchases,
  type PurchasedCourse,
  type PurchasedScript,
} from '@/components/account/AccountSections';
import { courseBySlug } from '@/content/academyCourses';
import { findProduct, formatPrice } from '@/content/chartMarket';
import type { Locale } from '@/i18n/routing';
import { FORMAT_LABEL, courseMeta, formatPrice as formatCoursePrice } from '@/lib/academy/courses';
import { listEnrolments } from '@/lib/academy/enrolment';
import { listScriptPurchases } from '@/lib/chartMarket/purchases';
import { pageMetadata } from '@/lib/metadata';
import { requireUser } from '@/lib/session';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({
    href: '/account/purchases',
    locale,
    title: 'Purchases',
    description: 'Expert services, tools and data, learning, merchandise and payments.',
  });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Middleware only checks that a cookie exists; this is the real gate.
  const user = await requireUser();

  /*
   * Chart Market entitlements and Academy enrolments, read here rather than in
   * the component.
   *
   * Each tab used to be an empty state with no way to stop being one. Now they
   * list what somebody actually owns — and the catalogue lookup is what turns a
   * purchase row into a line worth reading, so a product removed from the
   * catalogue drops out of the list rather than rendering as a blank.
   */
  const purchases = await listScriptPurchases(user.id);
  const scripts: PurchasedScript[] = purchases.flatMap((purchase) => {
    const product = findProduct(purchase.productId);
    if (!product) return [];

    return [
      {
        productId: product.id,
        title: product.title,
        demo: purchase.demo,
        meta: `${product.creator} · ${product.type} · Pine Script v${product.pine} · ${formatPrice(
          purchase.amountCents
        )}`,
      },
    ];
  });

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
        )} · ${formatCoursePrice(enrolment.amountCents / 100, course.currency)}`,
      },
    ];
  });

  return (
    <AccountLayout>
      <AccountPurchases scripts={scripts} courses={courses} />
    </AccountLayout>
  );
}
