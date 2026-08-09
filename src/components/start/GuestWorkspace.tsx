'use client';

import { useEffect } from 'react';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { Icon } from '@/components/ui/Icon';
import { Link, useRouter } from '@/i18n/navigation';
import styles from './GuestWorkspace.module.css';

/**
 * The guest's workspace.
 *
 * Everything a person can hold without an account, in one place, with the fact
 * that it is temporary said at the top rather than discovered when a browser is
 * cleared.
 *
 * It used to open on a saved plan — "Continue where you left off", a progress
 * bar, "Resume my plan" — from the four-question wizard that no longer exists.
 * What replaced that wizard is a router that ends in a destination rather than a
 * document, so there is no half-finished plan to resume: the card below points
 * at the router, and the four cards under it are the things a guest can
 * genuinely carry.
 *
 * Signed-in visitors are sent to their own home. Two places to keep the same
 * work would eventually disagree about which is real.
 */
export function GuestWorkspace() {
  const router = useRouter();
  const { authed, openLogin } = useLoginModal();

  useEffect(() => {
    if (authed) router.replace('/account');
  }, [authed, router]);

  return (
    <div className={styles.page}>
      {/*
       * Said at the top, every visit. "Stored in this browser" is the single
       * most important fact about this screen, and it is the one somebody
       * otherwise finds out by losing something.
       */}
      <div className={styles.banner}>
        <Icon name="info" size={16} strokeWidth={2} />
        <span>
          <b>Temporary workspace</b> — everything here is stored in this browser only. Clearing it,
          or opening the site elsewhere, starts from nothing.
        </span>
        <button className={styles.bannerCta} onClick={() => openLogin()}>
          Create an account to keep it
        </button>
      </div>

      <h1 className={styles.h1}>Your workspace</h1>

      <section className={styles.resume}>
        <div className={styles.resumeTitle}>Find your next step</div>
        <p className={styles.resumeSub}>
          Tell us what you want to do and we’ll point you to the most useful part of TradingNew.
        </p>
        <Link className={styles.resumeCta} href="/start" prefetch={false}>
          Find my next step
          <Icon name="arrowRight" size={16} strokeWidth={2.4} />
        </Link>
      </section>

      <div className={styles.grid}>
        <Card
          icon="book"
          title="Learning"
          body="Start anywhere in the beginner path — no account needed."
          cta="Open the lessons"
          href="/academy"
        />
        <Card
          icon="scale"
          title="Comparisons"
          body="Anything you compare opens from a link, so it can be shared or reopened."
          cta="Compare the options"
          href="/explore/options"
        />
        <Card
          icon="pie"
          title="Practice portfolio"
          body="Virtual money and real prices. It runs without an account."
          cta="Open the simulator"
          href="/portfolio"
        />
        <Card
          icon="sparkle"
          title="Voyager"
          body="Ten free questions a day on this browser. An account raises the limit."
          cta="Ask a question"
          href="/voyager"
        />
      </div>

      <section className={styles.saveBanner}>
        <div>
          <div className={styles.saveTitle}>Do not lose this</div>
          <p className={styles.saveText}>
            An account keeps your lessons, your practice portfolio and anything you have compared,
            and puts them on your other devices. It is free and it is the only reason we ask.
          </p>
        </div>
        <button className={styles.saveCta} onClick={() => openLogin()}>
          Save my workspace
          <Icon name="bookmark" size={16} strokeWidth={2.2} />
        </button>
      </section>
    </div>
  );
}

function Card({
  icon,
  title,
  body,
  cta,
  href,
}: {
  icon: 'book' | 'scale' | 'pie' | 'sparkle';
  title: string;
  body: string;
  cta: string;
  href: '/academy' | '/explore/options' | '/portfolio' | '/voyager';
}) {
  return (
    <div className={styles.card}>
      <Icon name={icon} size={22} strokeWidth={1.8} className={styles.cardIcon} />
      <div className={styles.cardTitle}>{title}</div>
      <p className={styles.cardBody}>{body}</p>
      <Link className={styles.cardCta} href={href} prefetch={false}>
        {cta}
        <Icon name="arrowRight" size={14} strokeWidth={2.2} />
      </Link>
    </div>
  );
}
