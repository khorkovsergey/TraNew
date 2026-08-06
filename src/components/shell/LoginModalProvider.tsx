'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
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
  /** Set when a sign-out request came back refused. Cleared on the next attempt. */
  const [signOutFailed, setSignOutFailed] = useState(false);
  const t = useTranslations('login');
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  /*
   * Where to come back to.
   *
   * The prompt used to send everybody to a generic sign-in and drop them on
   * whatever the auth flow considered home. Somebody who pressed "save" on
   * their plan meant to keep *that*, and landing anywhere else reads as having
   * lost it — which, until the migration existed, they had.
   */
  const next = pathname && pathname !== '/' ? pathname : null;

  const openLogin = useCallback(() => setIsOpen(true), []);
  const closeLogin = useCallback(() => setIsOpen(false), []);

  /*
   * Signing out, and admitting when it did not happen.
   *
   * This used to navigate home unconditionally. `authClient.signOut()` resolves
   * with `{ error }` rather than throwing, so a rejected request — a 403 from
   * the origin check, a network failure — produced the whole appearance of
   * having signed out: the menu closed, the page went to the home screen, and
   * the session was still live. On a shared machine that is not a cosmetic bug.
   *
   * Now the redirect only happens on success, and a failure says so and leaves
   * the person signed in, where they can see that they are.
   */
  const signOut = useCallback(async () => {
    setSignOutFailed(false);
    try {
      const result = await authClient.signOut();
      if (result?.error) {
        setSignOutFailed(true);
        return;
      }
    } catch {
      setSignOutFailed(true);
      return;
    }
    // A full load, not a router push: every server component holding the old
    // session has to be rebuilt, and the session cookie is gone by now.
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
      {/*
        * Said where the person is, not on a screen they were sent to. The
        * notice stays until they try again or leave the page: a session that
        * was not ended is worth interrupting for.
        */}
      {signOutFailed && (
        <div className={styles.signOutError} role="alert">
          <span>
            <b>You are still signed in.</b> The sign-out request was refused, so your session is
            unchanged. Try again — if it keeps failing, close every tab of this site.
          </span>
          <button onClick={() => setSignOutFailed(false)} aria-label="Dismiss">
            Dismiss
          </button>
        </div>
      )}

      {isOpen && (
        <>
          <div className={styles.overlay} onClick={closeLogin} />
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={t('title')}>
            <div className={styles.title}>Save this to your account</div>
            <div className={styles.reassurance}>
              Watchlists, alerts, learning progress and your wealth record are stored against your
              account. {t('reassurance')}
            </div>

            <Link
              className={styles.primary}
              href={{ pathname: '/sign-in', query: next ? { next } : undefined }}
              style={{ display: 'block', textAlign: 'center' }}
            >
              {t('title')}
            </Link>
            <Link
              className={styles.social}
              href={{ pathname: '/sign-up', query: next ? { next } : undefined }}
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
