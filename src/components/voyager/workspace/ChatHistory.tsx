'use client';

import { Icon } from '@/components/ui/Icon';
import { groupByDay, isBlank, type Chat } from '@/lib/voyager/workspace/chats';
import styles from './VoyagerWorkspace.module.css';

/**
 * The conversations somebody has had, on the left.
 *
 * Two things it has to be honest about, and both are easy to get wrong:
 *
 * - **A guest's chats are not saved.** They live in session storage and go with
 *   the tab. The notice says so before anybody types, rather than after they
 *   lose something — a history sidebar looks like permanence, and for a guest
 *   it is not.
 * - **The time shown is when the chat was last used**, not when it was started,
 *   because that is the one people scan for when looking for the thing they
 *   were just doing.
 *
 * `now` arrives as a prop rather than from the clock: the grouping decides what
 * "Today" means, and a component that reads the time during render disagrees
 * with the server about it.
 */

type Props = {
  chats: Chat[];
  activeId: string | null;
  signedIn: boolean;
  now: Date;
  onOpen: (id: string) => void;
  onNew: () => void;
  onSignIn: () => void;
};

export function ChatHistory({ chats, activeId, signedIn, now, onOpen, onNew, onSignIn }: Props) {
  // A blank chat nobody has typed into is not history yet.
  const groups = groupByDay(chats.filter((chat) => !isBlank(chat)), now);

  return (
    <div className={styles.historyBody}>
      {!signedIn && (
        <div className={styles.historyNotice}>
          <span className={styles.historyNoticeHead}>
            <Icon name="lock" size={13} strokeWidth={2} />
            Saving chat history requires sign in
          </span>
          <span className={styles.historyNoticeBody}>
            Sign in to save and sync your conversations across devices.
          </span>
          <button className={styles.historyNoticeAction} onClick={onSignIn}>
            Sign in
          </button>
        </div>
      )}

      <button className={styles.newChat} onClick={onNew}>
        <Icon name="plus" size={14} strokeWidth={2.4} />
        New chat
      </button>

      {groups.length === 0 ? (
        <p className={styles.historyEmpty}>
          Conversations appear here once you ask something.
        </p>
      ) : (
        groups.map((group) => (
          <div className={styles.historyGroup} key={group.label}>
            <div className={styles.historyGroupLabel}>{group.label}</div>
            {group.chats.map((chat) => (
              <button
                key={chat.id}
                className={`${styles.historyItem} ${
                  chat.id === activeId ? styles.historyItemActive : ''
                }`}
                onClick={() => onOpen(chat.id)}
                aria-current={chat.id === activeId ? 'true' : undefined}
              >
                <Icon name="bubble" size={13} strokeWidth={2} />
                <span className={styles.historyItemTitle}>{chat.title}</span>
                <span className={styles.historyItemTime}>{timeOf(chat.updatedAt, now)}</span>
              </button>
            ))}
          </div>
        ))
      )}

      <div className={styles.historyAbout}>
        <span className={styles.historyAboutHead}>
          <Icon name="sparkle" size={13} strokeWidth={2} />
          What Voyager can do
        </span>
        <span className={styles.historyAboutBody}>
          Explain concepts, summarise a market, compare holdings and draft Pine Script — showing
          the sources it used each time.
        </span>
      </div>
    </div>
  );
}

/**
 * A clock time for today, a date for anything older.
 *
 * The group heading already says which day it was, so repeating "Yesterday" on
 * every row inside the Yesterday group is noise. What is not noise is the time
 * on today's rows, which is how somebody finds the chat from an hour ago.
 */
function timeOf(iso: string, now: Date): string {
  const when = new Date(iso);
  const sameDay =
    when.getFullYear() === now.getFullYear() &&
    when.getMonth() === now.getMonth() &&
    when.getDate() === now.getDate();

  return sameDay
    ? when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
