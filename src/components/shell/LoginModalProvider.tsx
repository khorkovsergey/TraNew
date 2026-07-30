'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { authClient } from '@/lib/authClient';
import styles from './Modal.module.css';

type LoginModalContextValue = {
  /** Opens the sign-in prompt. Call this from any "save"-shaped action. */
  openLogin: () => void;
  closeLogin: () => void;
  isOpen: boolean;
  /** True once a real server session exists. Never set by the client alone. */
  authed: boolean;
  signOut: () => Promise<void>;
};

const LoginModalContext = createContext<LoginModalContextValue | null>(null);

export function useLoginModal() {
  const value = useContext(LoginModalContext);
  if (!value) {
    throw new Error('useLoginModal must be used inside <LoginModalProvider>');
  }
  return value;
}

/**
 * The prompt shown when an anonymous visitor tries to save something.
 *
 * It no longer accepts credentials: sign-in happens on its own page against the
 * server. A modal that took a password would have to post it from wherever it was
 * opened, and would tempt exactly the kind of shortcut this rewrite removes.
 */
export function LoginModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('login');
  const { data: session } = authClient.useSession();

  const openLogin = useCallback(() => setIsOpen(true), []);
  const closeLogin = useCallback(() => setIsOpen(false), []);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    window.location.href = '/en';
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLogin();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeLogin]);

  const value = useMemo(
    () => ({ openLogin, closeLogin, isOpen, authed: Boolean(session?.user), signOut }),
    [openLogin, closeLogin, isOpen, session, signOut]
  );

  return (
    <LoginModalContext.Provider value={value}>
      {children}
      {isOpen && (
        <>
          <div className={styles.overlay} onClick={closeLogin} />
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={t('title')}>
            <div className={styles.title}>Save this to your account</div>
            <div className={styles.reassurance}>
              Watchlists, alerts, learning progress and your wealth record are stored against your
              account. {t('reassurance')}
            </div>

            <Link className={styles.primary} href="/sign-in" style={{ display: 'block', textAlign: 'center' }}>
              {t('title')}
            </Link>
            <Link
              className={styles.social}
              href="/sign-up"
              style={{ display: 'block', textAlign: 'center', width: '100%', marginTop: 10 }}
            >
              {t('create')}
            </Link>

            <div className={styles.links}>
              <button onClick={closeLogin}>Not now</button>
            </div>
          </div>
        </>
      )}
    </LoginModalContext.Provider>
  );
}
