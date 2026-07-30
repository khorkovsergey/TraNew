import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import type { StaticPathname } from '@/i18n/routing';
import styles from './PlaceholderScreen.module.css';

/**
 * Stand-in for screens whose high-fidelity build is still queued. It follows the
 * handoff's "Tool page" pattern: heading, contextual next steps, hatched preview
 * block — so an unfinished route never looks like a broken one.
 */
export async function PlaceholderScreen({
  screenKey,
  nextSteps = [],
}: {
  screenKey: string;
  nextSteps?: Array<{ labelKey: string; href: StaticPathname }>;
}) {
  const t = await getTranslations('screens');
  const tCommon = await getTranslations('common');

  return (
    <div className={styles.wrap}>
      <Link className={styles.backHome} href="/">
        {tCommon('backHome')}
      </Link>

      <h1 className={styles.title}>{t(`${screenKey}.title`)}</h1>
      <p className={styles.subtitle}>{t(`${screenKey}.subtitle`)}</p>

      {nextSteps.length > 0 && (
        <div className={styles.nextSteps}>
          <div className={styles.nextStepsTitle}>{tCommon('nextSteps')}</div>
          {nextSteps.map((step) => (
            <Link className={styles.nextStep} href={step.href} key={step.labelKey}>
              <span>{t(step.labelKey)}</span>
              <Icon name="arrowRight" size={16} />
            </Link>
          ))}
        </div>
      )}

      <div className={styles.preview}>{t('placeholderNote')}</div>
    </div>
  );
}
