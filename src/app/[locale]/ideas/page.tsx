import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { IdeasScreen } from '@/components/ideas/IdeasScreen';
import { SpaceBackdrop } from '@/components/shell/SpaceBackdrop';
import type { Locale } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';

/**
 * Ideas — the discovery layer.
 *
 * This route used to be "Market Views", a list of published trading ideas with a
 * status on each. What sits here now answers a question one step earlier: not
 * "what does somebody think about this asset" but "what should I look at at
 * all", starting from concepts a reader already understands and working down
 * towards companies and funds.
 *
 * The copy is literal rather than message keys, as every screen the redesign
 * added is: the portal is English-only by an explicit decision, and a namespace
 * for one screen is a second place to look for a sentence.
 */

type Props = { params: Promise<{ locale: Locale }> };

const TITLE = 'Ideas';
const DESCRIPTION =
  'Discover themes, trends and market opportunities worth exploring. Start from something you already understand — the companies and funds come later.';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  return pageMetadata({ href: '/ideas', locale, title: TITLE, description: DESCRIPTION });
}

export default async function IdeasPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SpaceBackdrop tone={4} />
      <IdeasScreen />
    </>
  );
}
