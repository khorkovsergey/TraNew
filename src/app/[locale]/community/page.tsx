import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RelatedEvents } from '@/components/events/RelatedEvents';
import { Link } from '@/i18n/navigation';
import type { Locale, StaticPathname } from '@/i18n/routing';
import { pageMetadata } from '@/lib/metadata';
import styles from '@/components/content/Content.module.css';

/**
 * Community.
 *
 * It used to be four links, all four of which were already in the menu that
 * pointed at it — a page whose entire content was a copy of the way you got
 * there. It now says what the community actually is, what the rules are, and
 * shows what is happening next, which is the one thing a menu cannot do.
 */

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'screens' });

  return pageMetadata({
    href: '/community',
    locale,
    title: t('community.title'),
    description: t('community.subtitle'),
  });
}

const WAYS: Array<{ title: string; text: string; cta: string; href: StaticPathname }> = [
  {
    title: 'Publish an idea',
    text: 'Write up a thesis with the chart and the reasoning behind it. Other members can disagree in public, which is the point — an idea nobody can argue with is not an idea.',
    cta: 'Read the ideas feed',
    href: '/ideas',
  },
  {
    title: 'Organize or attend an event',
    text: 'Meetups, study groups and webinars run by members. Free to list, read by a moderator before publication, and never a place to sell a signal service.',
    cta: 'Find events near you',
    href: '/events',
  },
  {
    title: 'Learn together',
    text: 'Academy is the structured path; the community is where people get stuck in public and get unstuck faster. Study groups run weekly on options, ETFs and portfolio basics.',
    cta: 'Open Academy',
    href: '/academy',
  },
];

const RULES = [
  'No guaranteed returns, ever — not in an idea, a comment or an event listing.',
  'No signal subscriptions, referral schemes or pump-and-dump coordination.',
  'Say when you hold what you are writing about.',
  'Disagree with the argument, not the person.',
];

export default async function CommunityPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('screens');
  const tCommon = await getTranslations('common');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.h1}>{t('community.title')}</h1>
      <p className={styles.lead}>
        Ideas, study groups and events from people investing their own money. Everything here is
        written by members and moderated against one short set of rules.
      </p>

      <h2 className={styles.sectionTitle}>Three ways to take part</h2>
      <div className={styles.cardList}>
        {WAYS.map((way) => (
          <article className={styles.card} key={way.title}>
            <h3 className={styles.cardTitle}>{way.title}</h3>
            <p className={styles.cardSummary}>{way.text}</p>
            <div className={styles.cardActions}>
              <Link className={styles.chip} href={way.href}>
                {way.cta}
              </Link>
            </div>
          </article>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>The rules, in full</h2>
      <div className={styles.card}>
        <p className={styles.cardSummary}>
          Short enough to read, so nobody can say they did not. Moderators enforce all four, and
          anything reported under them is looked at by a person.
        </p>
        <ul className={styles.ruleList}>
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>

      {/* The one thing a menu cannot show: what is actually happening next. */}
      <RelatedEvents
        topics={['Investing basics', 'Personal finance', 'Options and derivatives']}
        title="Coming up in the community"
      />
    </div>
  );
}
