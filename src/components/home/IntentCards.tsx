'use client';

import { Icon } from '@/components/ui/Icon';
import { INTENT_CARDS, type IntentCard } from '@/content/homeV2';
import { Link } from '@/i18n/navigation';
import { track } from '@/lib/events/analytics';
import styles from './HomeV2.module.css';

/**
 * "What do you want to do?"
 *
 * Five doors, each named by the thing somebody wants to do rather than by the
 * kind of person who does it. A client component so the choice can be counted —
 * and the id that is counted is a card, not a person: no goal, no amount,
 * nothing about them.
 */
export function IntentCards() {
  return (
    <div className={styles.intentGrid}>
      {INTENT_CARDS.map((card) => (
        <IntentTile key={card.id} card={card} />
      ))}
    </div>
  );
}

function IntentTile({ card }: { card: IntentCard }) {
  const body = (
    <>
      <Icon name={card.icon} size={26} strokeWidth={1.8} className={styles.iconMuted} />
      <div className={styles.intentTitle}>{card.title}</div>
      <div className={styles.intentBody}>{card.body}</div>

      {card.external ? (
        /*
         * Said on the card, before the click. A tile that looks like the four
         * beside it and silently hands somebody to another company is a small
         * deception, and this one leads to the community the portal points at —
         * worth arriving at deliberately.
         */
        <span className={styles.intentAway}>
          tradingview.com
          <Icon name="arrowUpRight" size={13} strokeWidth={2.4} />
        </span>
      ) : (
        <span className={styles.intentGo} aria-hidden="true">
          <Icon name="chevronRight" size={13} strokeWidth={2.4} />
        </span>
      )}
    </>
  );

  const onClick = () => track({ name: 'intent_selected', intent: card.id });

  // No internal route is what "this card leaves the product" means, and it is
  // the check the type can narrow on — `external` is a string, and a string is
  // never proof to the compiler that the other half of the union is gone.
  if (card.href === undefined) {
    return (
      <a
        className={styles.intentCard}
        href={card.external}
        target="_blank"
        // `noopener` is the one that matters: without it the opened page gets a
        // handle back to this one through `window.opener`.
        rel="noopener noreferrer"
        onClick={onClick}
      >
        {body}
        <span className="tn-sr-only">Opens tradingview.com in a new tab</span>
      </a>
    );
  }

  return (
    <Link
      className={styles.intentCard}
      href={card.href}
      /*
       * A grid of options is not a path anybody is about to take — they will
       * follow at most one of these. Prefetching all five spends the network on
       * the four that will not be opened.
       */
      prefetch={false}
      onClick={onClick}
    >
      {body}
    </Link>
  );
}
