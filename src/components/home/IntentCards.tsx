'use client';

import { Icon } from '@/components/ui/Icon';
import { INTENT_CARDS, type IntentCard } from '@/content/homeV2';
import { Link } from '@/i18n/navigation';
import { track } from '@/lib/events/analytics';
import styles from './HomeV2.module.css';

/**
 * "What brings you here today?"
 *
 * A client component so the choice can be counted, and so each card can carry
 * its answer to the destination. The section asks what somebody came for and
 * then has to act on it: three of these used to open Explore on the same tab,
 * which made the question decorative.
 *
 * The id is a card, not a person — no goal, no amount, nothing about them.
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
      <Icon
        name={card.icon}
        size={26}
        strokeWidth={1.8}
        className={styles[`accent_${card.accent}`]}
      />
      <div className={styles.intentTitle}>{card.title}</div>
      <div className={styles.intentBody}>{card.body}</div>

      {card.external ? (
        /*
         * Said on the card, before the click. A tile that looks like the five
         * beside it and silently hands somebody to another company is a small
         * deception, and this one leads to the professional product the whole
         * portal is a on-ramp to — worth arriving at deliberately.
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

  if (card.external) {
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
      href={{ pathname: card.href, params: card.params, query: card.query } as never}
      prefetch={false}
      onClick={onClick}
    >
      {body}
    </Link>
  );
}
