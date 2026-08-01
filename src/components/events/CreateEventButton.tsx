'use client';

import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { useRouter } from '@/i18n/navigation';
import { track } from '@/lib/events/analytics';
import styles from './Events.module.css';

/**
 * "Create an event" for someone who is not signed in opens the login dialogue
 * rather than the wizard. Letting an anonymous visitor fill in five steps and
 * then asking who they are would throw the work away at the last moment.
 */
export function CreateEventButton() {
  const { openLogin, authed } = useLoginModal();
  const router = useRouter();

  return (
    <button
      type="button"
      className={styles.primary}
      onClick={() => {
        if (!authed) {
          openLogin();
          return;
        }
        track({ name: 'event_creation_started' });
        router.push('/events/create');
      }}
    >
      Create an event
    </button>
  );
}
