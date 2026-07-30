'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './Modal.module.css';

type LoginModalContextValue = {
  /** Opens the login modal. Call this from any "save"-shaped action for anonymous users. */
  openLogin: () => void;
  closeLogin: () => void;
  isOpen: boolean;
  /**
   * Simulated session. The prototype has no real authentication — completing the
   * login modal flips this so the authed header, account area and Wealth Hub can be
   * exercised. Nothing sensitive is stored.
   */
  authed: boolean;
  signOut: () => void;
};

const LoginModalContext = createContext<LoginModalContextValue | null>(null);

export function useLoginModal() {
  const value = useContext(LoginModalContext);
  if (!value) {
    throw new Error('useLoginModal must be used inside <LoginModalProvider>');
  }
  return value;
}

export function LoginModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const t = useTranslations('login');

  const openLogin = useCallback(() => setIsOpen(true), []);
  const closeLogin = useCallback(() => setIsOpen(false), []);
  const signIn = useCallback(() => {
    setAuthed(true);
    setIsOpen(false);
  }, []);
  const signOut = useCallback(() => setAuthed(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLogin();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeLogin]);

  const value = useMemo(
    () => ({ openLogin, closeLogin, isOpen, authed, signOut }),
    [openLogin, closeLogin, isOpen, authed, signOut]
  );

  return (
    <LoginModalContext.Provider value={value}>
      {children}
      {isOpen && (
        <>
          <div className={styles.overlay} onClick={closeLogin} />
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={t('title')}>
            <div className={styles.title}>{t('title')}</div>
            <div className={styles.reassurance}>{t('reassurance')}</div>
            <input className={styles.field} placeholder={t('email')} type="email" />
            <input className={styles.field} placeholder={t('password')} type="password" />
            <button className={styles.primary} onClick={signIn}>
              {t('continue')}
            </button>
            <div className={styles.socialRow}>
              <button className={styles.social}>{t('google')}</button>
              <button className={styles.social}>{t('apple')}</button>
            </div>
            <div className={styles.links}>
              <a href="#">{t('forgot')}</a>
              <a href="#">{t('create')}</a>
            </div>
          </div>
        </>
      )}
    </LoginModalContext.Provider>
  );
}
