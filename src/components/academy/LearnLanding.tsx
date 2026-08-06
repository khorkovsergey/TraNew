import { Icon } from '@/components/ui/Icon';
import {
  BEGINNER_PATH,
  LEARN_ARTICLES,
  LEARN_CATEGORIES,
  LEARN_TRUST,
  PRACTICE_TILES,
} from '@/content/learn';
import { Link } from '@/i18n/navigation';
import { ringDash, type LearnSummary } from '@/lib/academy/summary';
import styles from './Learn.module.css';

/**
 * Learn.
 *
 * The hero card is the one place on this page that can lie, so it is the one
 * place with a branch: somebody who has read nothing sees an invitation, not a
 * ring at zero per cent beside a "next lesson" they never chose. A dashboard for
 * a journey that has not started reads as a record of failure.
 */

const RING_RADIUS = 48;

export function LearnLanding({ summary }: { summary: LearnSummary }) {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <h1 className={styles.h1}>
            Learn with
            <br />
            <span className={styles.accentText}>confidence</span>
          </h1>
          <p className={styles.lead}>
            Short lessons in plain language, and a path that starts where you are rather than where
            a course thinks you should be.
          </p>
        </div>

        <div className={styles.pathCard}>
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative, fixed size. */}
          <img className={styles.robot} src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />

          {summary.state === 'new' ? (
            <div className={styles.pathBody}>
              <div className={styles.pathIcon}>
                <Icon name="compass" size={30} strokeWidth={1.7} />
              </div>
              <div>
                <div className={styles.pathTitle}>Your learning path</div>
                <div className={styles.pathSub}>
                  Two minutes of questions, and the path starts where you already are.
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.pathBody}>
              <div className={styles.ringWrap}>
                <svg viewBox="0 0 110 110" className={styles.ring} aria-hidden="true">
                  <circle
                    cx="55"
                    cy="55"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="#101c2a"
                    strokeWidth="9"
                  />
                  <circle
                    cx="55"
                    cy="55"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="var(--tn-progress)"
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={ringDash(summary.percent, RING_RADIUS)}
                    transform="rotate(-90 55 55)"
                  />
                </svg>
                <div className={`${styles.ringValue} tn-num`}>
                  {summary.percent}
                  <span className={styles.ringPercent}>%</span>
                </div>
              </div>

              <div>
                <div className={styles.pathTitle}>Your learning path</div>
                <div className={styles.pathSub}>
                  {summary.done} of {summary.total} lessons done.
                </div>

                {summary.next && (
                  <div className={styles.nextRow}>
                    <span className={styles.nextIcon}>
                      <Icon name="play" size={12} strokeWidth={2} />
                    </span>
                    <div>
                      <div className={styles.nextLabel}>Next up</div>
                      <div className={styles.nextTitle}>{summary.next.title}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <Link
            className={styles.continue}
            href={summary.state === 'new' ? '/academy/setup' : '/academy/dashboard'}
          >
            {summary.state === 'new' ? 'Start my path' : 'Continue learning'}
            <Icon name="arrowRight" size={16} strokeWidth={2.4} />
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>What would you like to understand?</h2>
        <div className={styles.catGrid}>
          {LEARN_CATEGORIES.map((category) => (
            <Link
              key={category.name}
              className={styles.catCard}
              href={{ pathname: category.href, params: category.params } as never}
              prefetch={false}
            >
              <Icon
                name={category.icon}
                size={24}
                strokeWidth={1.8}
                className={styles[`accent_${category.accent}`]}
              />
              <div className={styles.catName}>{category.name}</div>
              <div className={styles.catText}>{category.text}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>
            Beginner path
            <span className={styles.h2Sub}>Five lessons, in the order they build on each other.</span>
          </h2>
          <Link className={styles.moreLink} href="/academy/path" prefetch={false}>
            See the whole plan
            <Icon name="arrowRight" size={13} strokeWidth={2.2} />
          </Link>
        </div>

        <ol className={styles.lessonGrid}>
          {BEGINNER_PATH.map((lesson, index) => (
            <li key={lesson.slug}>
              <Link
                className={styles.lessonCard}
                href={
                  lesson.built
                    ? ({ pathname: '/academy/lesson/[slug]', params: { slug: lesson.slug } } as never)
                    : '/academy/path'
                }
                prefetch={false}
              >
                <div className={styles.lessonTop}>
                  <span className={`${styles.lessonNumber} ${styles[`num_${lesson.accent}`]}`}>
                    {index + 1}
                  </span>
                  {/* Said on the card, not after the click. */}
                  {!lesson.built && <span className={styles.soon}>Soon</span>}
                </div>
                <div className={styles.lessonTitle}>{lesson.title}</div>
                <div className={styles.lessonMeta}>{lesson.minutes} min · Easy</div>
                <div className={styles.lessonText}>{lesson.text}</div>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className={styles.splitRow}>
        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Learn from today</h2>
            <Link className={styles.moreLink} href="/news" prefetch={false}>
              All news
              <Icon name="arrowRight" size={13} strokeWidth={2.2} />
            </Link>
          </div>

          <div className={styles.articleList}>
            {LEARN_ARTICLES.map((article) => (
              <Link key={article.title} className={styles.article} href={article.href}
              prefetch={false}>
                <span className={`${styles.articleIcon} ${styles[`mark_${article.accent}`]}`}>
                  <Icon name={article.icon} size={18} strokeWidth={1.9} />
                </span>
                <div>
                  <div className={styles.articleTitle}>{article.title}</div>
                  <div className={styles.articleText}>{article.text}</div>
                </div>
                <span className={styles.articleMeta}>{article.minutes}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.h2}>Practise as you learn</h2>
          <p className={styles.cardSub}>
            A concept is not learned by being read. Each of these turns one into something done.
          </p>

          <div className={styles.practiceGrid}>
            {PRACTICE_TILES.map((tile) => (
              <Link
                key={tile.name}
                className={styles.practiceTile}
                href={{ pathname: tile.href, params: tile.params } as never}
                prefetch={false}
              >
                <Icon
                  name={tile.icon}
                  size={22}
                  strokeWidth={1.8}
                  className={styles[`accent_${tile.accent}`]}
                />
                <div className={styles.practiceName}>{tile.name}</div>
                <div className={styles.practiceText}>{tile.text}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className={styles.trustBar}>
        {LEARN_TRUST.map((item) => (
          <div key={item.label} className={styles.trustItem}>
            <Icon
              name={item.icon}
              size={17}
              strokeWidth={2}
              className={styles[`accent_${item.accent}`]}
            />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
