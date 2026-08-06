import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import styles from './AuthShell.module.css';

/**
 * The frame around sign-in and sign-up.
 *
 * The form itself is untouched — it carries the validation, the providers and
 * the server calls, and none of that is a design question. What the redesign
 * adds is the reason: a column that says what an account keeps, so the ask is
 * answered on the same screen it is made.
 *
 * The two modes are two routes rather than one screen with a toggle. The
 * prototype switches in place; keeping the URLs means a link to "create an
 * account" still lands on creating an account, and the back button still works.
 */

const KEEPS: Array<{ icon: 'layers' | 'trendUp' | 'book'; accent: string; lead: string; rest: string }> =
  [
    {
      icon: 'layers',
      accent: 'green',
      lead: 'Your starting path',
      rest: 'saved, and picked up on any device.',
    },
    {
      icon: 'trendUp',
      accent: 'blue',
      lead: 'Practice portfolio',
      rest: 'simulations kept in one place.',
    },
    {
      icon: 'book',
      accent: 'purple',
      lead: 'Learning progress',
      rest: 'lessons and quizzes that follow you.',
    },
  ];

export function AuthShell({
  mode,
  children,
  next,
}: {
  mode: 'in' | 'up';
  children: React.ReactNode;
  /** Where the person came from, so the promise below can name it. */
  next?: string;
}) {
  const fromPlan = next?.includes('/start/plan') ?? false;
  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/">
        <Icon name="arrowLeft" size={14} strokeWidth={2.2} />
        Back to home
      </Link>

      <div className={styles.columns}>
        <div className={styles.formColumn}>
          {/* Two routes, styled as a switch. Real links, so both are
              bookmarkable and the back button behaves. */}
          <nav className={styles.tabs} aria-label="Account">
            <Link
              className={`${styles.tab} ${mode === 'in' ? styles.tabOn : ''}`}
              href="/sign-in"
              aria-current={mode === 'in' ? 'page' : undefined}
            >
              Sign in
            </Link>
            <Link
              className={`${styles.tab} ${mode === 'up' ? styles.tabOn : ''}`}
              href="/sign-up"
              aria-current={mode === 'up' ? 'page' : undefined}
            >
              Create account
            </Link>
          </nav>

          {/*
            * Said before the form, not after it.
            *
            * Somebody who pressed "save" on their plan is being asked to
            * register in the middle of something. The reassurance is only worth
            * printing where it is true, so it names what is preserved and it
            * only appears when arriving from the plan.
            */}
          {fromPlan && (
            <div className={styles.preserve}>
              <Icon name="shieldCheck" size={15} strokeWidth={2} className={styles.accent_mint} />
              <span>
                <b>Your plan is waiting.</b> All four answers and your progress are preserved — you
                will land right back on it.
              </span>
            </div>
          )}

          {children}

          {/* The sign-in form already promises to return you where you were;
              repeating it here would be the same sentence twice on one screen.
              This says the other thing somebody hesitating wants to know. */}
          <div className={styles.reassure}>
            <Icon name="shieldCheck" size={14} strokeWidth={2} className={styles.accent_mint} />
            A demo portal. Real authentication, and no real money moves.
          </div>
        </div>

        <aside className={styles.aside}>
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative, fixed size. */}
          <img className={styles.robot} src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />

          <h2 className={styles.asideTitle}>
            {mode === 'in' ? 'Everything, where you left it' : 'What an account keeps'}
          </h2>

          <ul className={styles.keeps}>
            {KEEPS.map((keep) => (
              <li key={keep.lead} className={styles.keep}>
                <Icon
                  name={keep.icon}
                  size={18}
                  strokeWidth={1.9}
                  className={styles[`accent_${keep.accent}`]}
                />
                <span>
                  <b className={styles.keepLead}>{keep.lead}</b> — {keep.rest}
                </span>
              </li>
            ))}
          </ul>

          <div className={styles.asideNote}>
            No marketing email unless you ask for it. Nothing here is shared with anybody.
          </div>
        </aside>
      </div>
    </div>
  );
}
