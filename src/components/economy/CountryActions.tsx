'use client';

import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { Link } from '@/i18n/navigation';
import styles from './Economy.module.css';

/** Follow and Add alert save something, so both ask an anonymous visitor to sign in. */
export function CountryActions({ name }: { name: string }) {
  const { openLogin } = useLoginModal();

  return (
    <div className={styles.actions}>
      <button className={styles.action} onClick={openLogin}>
        Follow
      </button>
      <button className={styles.action} onClick={openLogin}>
        Add alert
      </button>
      <Link
        className={styles.action}
        href={{ pathname: '/tool/[slug]', params: { slug: 'country-compare' } }}
      >
        Compare
      </Link>
      <Link
        className={`${styles.action} ${styles.actionAi}`}
        href={{ pathname: '/research', query: { q: `What is happening in the ${name} economy?` } }}
      >
        Ask Copilot
      </Link>
    </div>
  );
}
