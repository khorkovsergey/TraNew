'use client';

import { useState } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import styles from './Courses.module.css';

/**
 * My Learning — what somebody has actually enrolled in.
 *
 * Every figure on this screen is counted from real records: the library comes
 * from the enrolment rows, the progress bars from lessons that were marked
 * watched, and "hours learned" from the length of those lessons. A course
 * nobody has opened says so instead of showing a bar at a made-up percentage,
 * because a fake number here is a claim about the person, not about us.
 */

export type LibraryItem = {
  slug: string;
  title: string;
  provider: string;
  verified: boolean;
  image: string;
  formatLabel: string;
  meta: string;
  metaIcon: IconName;
  /** "Seat reserved", "Completed" — absent when there is nothing true to say. */
  badge: string | null;
  badgeDone: boolean;
  tab: 'progress' | 'upcoming' | 'completed';
  progress: {
    done: number;
    total: number;
    percent: number;
    started: boolean;
    complete: boolean;
    next: string | null;
  };
};

export type LearningStats = {
  owned: number;
  inProgress: number;
  hours: string;
  completed: number;
};

const TABS: Array<{ id: LibraryItem['tab']; label: string }> = [
  { id: 'progress', label: 'In progress' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
];

const EMPTY: Record<LibraryItem['tab'], [string, string]> = {
  progress: [
    'Nothing in progress yet',
    'Courses you enrol in show up here, with your place saved as you go.',
  ],
  upcoming: [
    'No scheduled courses',
    'Live cohorts and in-person workshops you enrol in appear here with their dates and joining details.',
  ],
  completed: [
    'Nothing completed yet',
    'Mark every lesson of a course watched and it moves here.',
  ],
};

export function MyLearning({ items, stats }: { items: LibraryItem[]; stats: LearningStats }) {
  const [tab, setTab] = useState<LibraryItem['tab']>(() => {
    // Open on a tab that has something in it, so an empty first screen is a
    // fact about the library rather than about the default.
    const first = TABS.find((entry) => items.some((item) => item.tab === entry.id));
    return first?.id ?? 'progress';
  });

  const shown = items.filter((item) => item.tab === tab);

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/marketplace" prefetch={false}>
          Marketplace
        </Link>
        <span className={styles.breadcrumbSep}>/</span>
        <Link href="/marketplace/academy" prefetch={false}>
          Academy
        </Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbHere}>My Learning</span>
      </div>

      <h1 className={styles.h1} style={{ fontSize: 'clamp(28px, 3.2vw, 40px)' }}>
        My Learning
      </h1>
      <p className={styles.lead} style={{ maxWidth: 620 }}>
        Everything you have enrolled in — courses, live cohorts and workshops.
      </p>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Courses owned</div>
          <div className={`${styles.statValue} tn-num`}>{stats.owned}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>In progress</div>
          <div className={`${styles.statValue} ${styles.statMint} tn-num`}>{stats.inProgress}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Hours watched</div>
          <div className={`${styles.statValue} ${styles.statBlue} tn-num`}>{stats.hours}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Completed</div>
          <div className={`${styles.statValue} tn-num`}>{stats.completed}</div>
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="My Learning">
        {TABS.map((entry) => {
          const on = tab === entry.id;
          const count = items.filter((item) => item.tab === entry.id).length;
          return (
            <button
              key={entry.id}
              role="tab"
              aria-selected={on}
              className={`${styles.tab} ${on ? styles.tabOn : ''}`}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
              <span className={`${styles.tabCount} ${on ? styles.tabCountOn : ''} tn-num`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {shown.length > 0 ? (
        <div className={styles.library}>
          {shown.map((item) => (
            <div className={styles.libraryRow} key={item.slug}>
              <div
                className={styles.libraryCover}
                style={{ backgroundImage: `url(/redesign/courses/${item.image}.jpg)` }}
              >
                <span className={styles.formatTag}>{item.formatLabel}</span>
              </div>

              <div style={{ minWidth: 0 }}>
                <div className={styles.libraryTitleRow}>
                  <span className={styles.libraryTitle}>{item.title}</span>
                  {item.badge && (
                    <span
                      className={`${styles.libraryBadge} ${item.badgeDone ? styles.libraryBadgeDone : ''}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>

                <div className={styles.libraryProvider}>
                  {item.provider}
                  {item.verified && (
                    <Icon className={styles.verified} name="checkCircle" size={13} strokeWidth={2.4} />
                  )}
                </div>

                <div className={styles.libraryMeta}>
                  <Icon name={item.metaIcon} size={14} strokeWidth={2} />
                  {item.meta}
                </div>

                {item.progress.started ? (
                  <>
                    <div className={styles.libraryProgress}>
                      <span className={styles.progressTrack}>
                        <span
                          className={styles.progressFill}
                          style={{ width: `${item.progress.percent}%` }}
                        />
                      </span>
                      <span className={`${styles.progressLabel} tn-num`}>
                        {item.progress.percent}% watched
                      </span>
                    </div>
                    {item.progress.next && (
                      <div className={styles.libraryNext}>Next: {item.progress.next}</div>
                    )}
                  </>
                ) : (
                  <div className={styles.libraryNext}>
                    Not started · {item.progress.total} lessons waiting
                  </div>
                )}
              </div>

              <div className={styles.libraryActions}>
                <Link
                  className={styles.rowPrimary}
                  href={{ pathname: '/marketplace/academy/[slug]', params: { slug: item.slug } }}
                  prefetch={false}
                >
                  {item.progress.complete
                    ? 'Revisit course'
                    : item.progress.started
                      ? 'Continue learning'
                      : 'Start course'}
                </Link>
                <Link className={styles.rowSecondary} href="/account/purchases" prefetch={false}>
                  Purchase details
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <Icon name="grad" size={25} strokeWidth={1.8} />
          </span>
          <div className={styles.emptyTitle}>{EMPTY[tab][0]}</div>
          <p className={styles.emptyText}>{EMPTY[tab][1]}</p>
          <div className={styles.emptyActions}>
            <Link className={styles.primary} href="/marketplace/academy" prefetch={false}>
              Browse courses
            </Link>
            <Link className={styles.ghost} href="/academy" prefetch={false}>
              Free lessons in Learn
            </Link>
          </div>
        </div>
      )}

      <div className={styles.voyagerStrip}>
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative, fixed size. */}
        <img className={styles.voyagerRobot} src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />
        <div className={styles.voyagerText}>
          Not sure what to take next? Voyager can suggest one from what you have finished and what
          you are working toward.
        </div>
        <Link
          className={styles.ghost}
          href={{ pathname: '/voyager', query: { context: 'learn' } }}
          prefetch={false}
        >
          Ask Voyager
        </Link>
      </div>
    </div>
  );
}
