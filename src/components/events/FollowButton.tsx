'use client';

import { useState, useTransition } from 'react';
import { toggleFollowAction } from '@/app/actions/eventOrganizer';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import styles from './Events.module.css';

/**
 * Following an organizer.
 *
 * Following is a subscription to future notifications, so it needs an account —
 * there is nowhere to send anything otherwise. The button says so by opening the
 * login dialogue rather than by being disabled with no explanation.
 */
export function FollowButton({ organizerId, name }: { organizerId: string; name: string }) {
  const { openLogin, authed } = useLoginModal();
  const [following, setFollowing] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={following ? styles.secondary : styles.primary}
      aria-pressed={following}
      disabled={pending}
      onClick={() => {
        if (!authed) {
          openLogin();
          return;
        }

        const next = !following;
        setFollowing(next);

        startTransition(async () => {
          const result = await toggleFollowAction({ organizerId });
          if (result.status === 'ok') setFollowing(result.data.following);
          else setFollowing(!next);
        });
      }}
    >
      {following ? 'Following' : `Follow ${name.split(' ')[0]}`}
    </button>
  );
}
