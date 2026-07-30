'use client';

import { useTranslations } from 'next-intl';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import type { StaticPathname } from '@/i18n/routing';
import { academyCardState, academyPercent, answeredCount, useAcademy } from '@/lib/academyProgress';
import styles from './Home.module.css';

type Goal = {
  key: 'learn' | 'strategy' | 'explore';
  href: StaticPathname;
  icon: IconName;
  color: string;
  tile: string;
};

const GOALS: Goal[] = [
  {
    key: 'learn',
    href: '/academy',
    icon: 'grad',
    color: 'var(--tn-purple)',
    tile: 'var(--tn-purple-tint)',
  },
  {
    key: 'strategy',
    href: '/strategy',
    icon: 'target',
    color: 'var(--tn-blue)',
    tile: 'var(--tn-blue-tint)',
  },
  {
    key: 'explore',
    href: '/explore',
    icon: 'search',
    color: 'var(--tn-green)',
    tile: 'var(--tn-green-tint)',
  },
];

export function GoalCards() {
  const t = useTranslations('home.goals');
  const { state } = useAcademy();

  // Before hydration `state` is null — render the plain "new" card so server and
  // client markup agree, then swap in the guest's real progress.
  const cardState = state ? academyCardState(state) : 'new';
  const percent = state ? academyPercent(state) : 0;
  const answered = state ? answeredCount(state) : 0;

  const learnHref: StaticPathname =
    cardState === 'setup'
      ? '/academy/setup'
      : cardState === 'new'
        ? '/academy'
        : '/academy/dashboard';

  const learnLabel = () => {
    switch (cardState) {
      case 'setup':
        return t('learn.stateSetup', { done: answered });
      case 'continue':
        return t('learn.stateContinue', { percent });
      case 'done':
        return t('learn.stateDone');
      default:
        return null;
    }
  };

  return (
    <div className={styles.goalGrid}>
      {GOALS.map((goal) => {
        const isLearn = goal.key === 'learn';
        const label = isLearn ? learnLabel() : null;

        return (
          <Link
            key={goal.key}
            className={styles.goalCard}
            href={isLearn ? learnHref : goal.href}
            style={{ color: goal.color }}
          >
            <div className={styles.goalTile} style={{ background: goal.tile }}>
              <Icon name={goal.icon} size={40} strokeWidth={1.7} />
            </div>

            <div className={styles.goalTitle} style={{ color: 'var(--tn-text)' }}>
              {t(`${goal.key}.title`)}
            </div>
            <div className={styles.goalDesc}>{t(`${goal.key}.text`)}</div>

            <div className={styles.goalPoints}>
              {(['b1', 'b2', 'b3', 'b4'] as const).map((point) => (
                <div className={styles.goalPoint} key={point}>
                  <Icon name="check" size={15} strokeWidth={2.5} style={{ color: goal.color }} />
                  {t(`${goal.key}.${point}`)}
                </div>
              ))}
            </div>

            {label && <div className={styles.goalState}>{label}</div>}

            <div className={styles.goalFooter}>
              {isLearn && cardState !== 'new' && (
                <div className={styles.goalProgress}>
                  <div className={styles.goalProgressFill} style={{ width: `${percent}%` }} />
                </div>
              )}
              <div className={styles.goalArrow}>
                <Icon name="arrowRight" size={17} />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
