'use client';

import { Icon } from '@/components/ui/Icon';
import { INTENT_CARDS } from '@/content/homeV2';
import { Link } from '@/i18n/navigation';
import { track } from '@/lib/events/analytics';
import styles from './HomeV2.module.css';

/**
 * "What brings you here today?"
 *
 * A client component only so the choice can be counted. Which card somebody
 * picks is the first thing the funnel needs to know and the last thing that can
 * be inferred from a page view — every one of these leads somewhere different.
 * The id is a card, not a person: no goal, no amount, nothing about them.
 */
export function IntentCards() {
  return (
    <div className={styles.intentGrid}>
      {INTENT_CARDS.map((card) => (
        <Link
          key={card.id}
          className={styles.intentCard}
          href={{ pathname: card.href, params: card.params } as never}
          prefetch={false}
          onClick={() => track({ name: 'intent_selected', intent: card.id })}
        >
          <Icon
            name={card.icon}
            size={26}
            strokeWidth={1.8}
            className={styles[`accent_${card.accent}`]}
          />
          <div className={styles.intentTitle}>{card.title}</div>
          <div className={styles.intentBody}>{card.body}</div>
          <span className={styles.intentGo} aria-hidden="true">
            <Icon name="chevronRight" size={13} strokeWidth={2.4} />
          </span>
        </Link>
      ))}
    </div>
  );
}
