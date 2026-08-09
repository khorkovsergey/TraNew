import type { Metadata } from 'next';
import { redirect } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/**
 * The old plan result, kept only as a door back to the router.
 *
 * "Your profile / Your plan is ready / Your route" was the end of a suitability
 * questionnaire the product should not have been giving. The questionnaire is
 * gone and so is its result; what remains is this redirect, because links to it
 * exist in browser histories, in old emails and in one or two account screens
 * that have not been rewritten yet.
 *
 * A redirect rather than a deletion: a bookmark that lands on the current
 * product is a better answer than a 404, and it costs one file to say so.
 * Rows already saved under the old schema are left where they are — nothing
 * here reads or writes them, and a destructive migration to tidy up a table
 * nobody queries is risk bought for nothing.
 */

type Props = { params: Promise<{ locale: Locale }> };

export function generateMetadata(): Metadata {
  // Not a page, and not a landing surface. It exists to forward.
  return { robots: { index: false, follow: false } };
}

export default async function StartPlanPage({ params }: Props) {
  const { locale } = await params;
  redirect({ href: '/start', locale });
}
