import { redirect } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The intake is no longer a screen of its own.
 *
 * It was the middle page of a three-page funnel — pick a task, answer the
 * questions, then finally see an expert — and the questions now live on the
 * Expert Services screen next to the brief they fill in. This stays as a
 * redirect because links to it exist: Voyager's action routes point here, and
 * so does "edit request" from an older session still open in a tab.
 *
 * The chosen task rides along, since it is what the screen opens the
 * conversation with.
 */
export default async function ExpertsIntakePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { task } = await searchParams;

  redirect({
    href:
      typeof task === 'string'
        ? { pathname: '/marketplace/experts', query: { task } }
        : '/marketplace/experts',
    locale,
  });
}
