'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { authClient } from '@/lib/authClient';
import styles from './Auth.module.css';

/** Only shown when the corresponding OAuth credentials are configured server-side. */
function SocialButtons({ providers }: { providers: string[] }) {
  if (providers.length === 0) return null;

  return (
    <div className={styles.socialRow}>
      {providers.map((provider) => (
        <button
          key={provider}
          className={styles.social}
          onClick={() =>
            authClient.signIn.social({ provider: provider as 'google' | 'apple', callbackURL: '/en/account' })
          }
        >
          Continue with {provider === 'google' ? 'Google' : 'Apple'}
        </button>
      ))}
    </div>
  );
}

function strength(password: string): 0 | 1 | 2 | 3 {
  if (password.length < 10) return 0;
  let score = 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length >= 16) score = Math.min(3, score + 1) as 1 | 2 | 3;
  return score as 0 | 1 | 2 | 3;
}

export function SignInForm({ providers, next }: { providers: string[]; next?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
      callbackURL: next ? `/en${next}` : '/en/account',
    });

    if (signInError) {
      // Deliberately not distinguishing "no such account" from "wrong password":
      // a precise message here tells an attacker which addresses are registered.
      setError('That email and password combination did not work.');
      setBusy(false);
      return;
    }

    window.location.href = next ? `/en${next}` : '/en/account';
  };

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Log in to TradingNew</h1>
      <p className={styles.subtitle}>You&apos;ll return exactly where you left off.</p>

      <form onSubmit={submit}>
        <label className={styles.label} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className={styles.field}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <label className={styles.label} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className={styles.field}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.primary} type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Continue'}
        </button>
      </form>

      <SocialButtons providers={providers} />

      <div className={styles.links}>
        <Link className={styles.link} href="/forgot-password">
          Forgot password
        </Link>
        <Link className={styles.link} href="/sign-up">
          Create account
        </Link>
      </div>
    </div>
  );
}

export function SignUpForm({ providers }: { providers: string[] }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const score = strength(password);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const { error: signUpError } = await authClient.signUp.email({
      name: name || email.split('@')[0],
      email,
      password,
      callbackURL: '/en/account',
    });

    if (signUpError) {
      setError(signUpError.message ?? 'Could not create the account.');
      setBusy(false);
      return;
    }

    // No session yet: the address has to be confirmed first.
    setSent(true);
    setBusy(false);
  };

  if (sent) {
    return (
      <div className={styles.card}>
        <h1 className={styles.title}>Confirm your email</h1>
        <div className={styles.success}>
          We sent a confirmation link to <strong>{email}</strong>. Open it to finish setting up
          your account. The link expires in an hour.
        </div>
        <p className={styles.notice}>
          Nothing is stored against your account until the address is confirmed.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Create your account</h1>
      <p className={styles.subtitle}>
        Free. Needed only to save things — a watchlist, an alert, your progress or your wealth
        record.
      </p>

      <form onSubmit={submit}>
        <label className={styles.label} htmlFor="name">
          Name
        </label>
        <input
          id="name"
          className={styles.field}
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <label className={styles.label} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className={styles.field}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <label className={styles.label} htmlFor="new-password">
          Password
        </label>
        <input
          id="new-password"
          className={styles.field}
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <div className={styles.strength} aria-hidden="true">
          {[1, 2, 3].map((level) => (
            <span
              key={level}
              className={`${styles.strengthBar} ${
                score >= level
                  ? score === 1
                    ? styles.strengthWeak
                    : score === 2
                      ? styles.strengthMedium
                      : styles.strengthStrong
                  : ''
              }`}
            />
          ))}
        </div>
        <div className={styles.hint}>
          At least 10 characters. Length matters more than symbols — a passphrase beats a short
          password with punctuation.
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.primary} type="submit" disabled={busy || score === 0}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <SocialButtons providers={providers} />

      <div className={styles.links}>
        <Link className={styles.link} href="/sign-in">
          I already have an account
        </Link>
      </div>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);

    await authClient.requestPasswordReset({ email, redirectTo: '/en/reset-password' });

    // Always the same outcome, whether or not the address exists — otherwise this
    // form becomes a way to test which emails are registered.
    setSent(true);
    setBusy(false);
  };

  if (sent) {
    return (
      <div className={styles.card}>
        <h1 className={styles.title}>Check your email</h1>
        <div className={styles.success}>
          If an account exists for <strong>{email}</strong>, a reset link is on its way. It
          expires in an hour and can be used once.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Reset your password</h1>
      <p className={styles.subtitle}>
        Enter the address on your account and we&apos;ll send a link to choose a new password.
      </p>

      <form onSubmit={submit}>
        <label className={styles.label} htmlFor="reset-email">
          Email
        </label>
        <input
          id="reset-email"
          className={styles.field}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <button className={styles.primary} type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <div className={styles.links}>
        <Link className={styles.link} href="/sign-in">
          Back to log in
        </Link>
      </div>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <div className={styles.card}>
        <h1 className={styles.title}>This link is not valid</h1>
        <p className={styles.subtitle}>
          Reset links expire after an hour and can be used once. Request a new one.
        </p>
        <div className={styles.links}>
          <Link className={styles.link} href="/forgot-password">
            Send a new link
          </Link>
        </div>
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token });

    if (resetError) {
      setError('That link has expired or was already used. Request a new one.');
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
  };

  if (done) {
    return (
      <div className={styles.card}>
        <h1 className={styles.title}>Password changed</h1>
        <div className={styles.success}>
          Your password is updated and every other session has been signed out.
        </div>
        <div className={styles.links}>
          <Link className={styles.link} href="/sign-in">
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Choose a new password</h1>

      <form onSubmit={submit}>
        <label className={styles.label} htmlFor="reset-password">
          New password
        </label>
        <input
          id="reset-password"
          className={styles.field}
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <div className={styles.hint}>At least 10 characters.</div>

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.primary} type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </div>
  );
}
