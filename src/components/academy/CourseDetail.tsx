'use client';

import { useEffect, useState, useTransition } from 'react';
import { enrolAction, setLessonWatchedAction } from '@/app/actions/academy';
import { toggleSavedAction } from '@/app/actions/saved';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import { Icon } from '@/components/ui/Icon';
import type { Course } from '@/content/academyCourses';
import { Link, useRouter } from '@/i18n/navigation';
import {
  FORMAT_LABEL,
  checkoutLines,
  courseMeta,
  courseProgress,
  formatAmount,
  formatPrice,
  lessonCount,
  progressKey,
  sectionMeta,
} from '@/lib/academy/courses';
import styles from './Courses.module.css';

/**
 * A course page, and the purchase it leads to.
 *
 * The order of the gates is the design's and it matters: browsing never asks for
 * an account, and the sign-in prompt appears at the moment of buying with the
 * course named in it, so nobody is asked to register to find out what something
 * costs.
 *
 * Enrolment is written by a server action against the session — the browser
 * sends a slug, never a price. The checkout says, above the button, that no
 * payment provider is connected, and the row it writes is marked `demo` for the
 * same reason.
 */

const FORMAT_NOTE: Record<Course['format'], string> = {
  online: 'Online · Self-paced',
  live_online: 'Live Online · Scheduled sessions',
  in_person: 'In-person · Scheduled dates',
  hybrid: 'Hybrid · Recorded plus a live day',
};

type Props = {
  course: Course;
  /** Settled on the server. The client's own idea of the session arrives later. */
  signedIn: boolean;
  enrolled: boolean;
  lessonsDone: string[];
  saved: boolean;
};

export function CourseDetail({ course, signedIn, enrolled, lessonsDone, saved }: Props) {
  const router = useRouter();
  const { openLogin, authed } = useLoginModal();

  /*
   * Whether this person is signed in, answered by the render rather than by a
   * request in flight.
   *
   * `useLoginModal` learns the session from the client, a moment after the page
   * is interactive — long enough for somebody who has just signed in to press
   * Buy and be told to sign in. The server already knew; this takes its answer
   * and lets the client's catch up if the session changes in another tab.
   */
  const isSignedIn = signedIn || authed;
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState<string[]>(course.sections.length ? [course.sections[0].id] : []);
  const [modal, setModal] = useState<'auth' | 'checkout' | 'done' | null>(null);
  const [method, setMethod] = useState<'card' | 'paypal'>('card');
  const [isSaved, setSaved] = useState(saved);
  /**
   * Watched lessons, mirrored locally so a tick does not wait for a round trip.
   *
   * Seeded from the server once. The server stays the record — a failed write
   * puts the tick back — but this copy is what the ticks move, so a second tab
   * is the only place the two can disagree, and a reload settles it.
   */
  const [done, setDone] = useState<string[]>(lessonsDone);
  const [error, setError] = useState<string | null>(null);

  // Escape closes whichever dialog is open — a modal with no way out but the
  // mouse is the one people get stuck in.
  useEffect(() => {
    if (!modal) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const progress = courseProgress(course, done);
  const lines = checkoutLines(course);
  const total = lessonCount(course);

  const confirm = () => {
    startTransition(async () => {
      const result = await enrolAction(course.slug);

      if (result.status === 'sign_in_required') {
        setModal('auth');
        return;
      }
      if (result.status === 'unknown_course') {
        setError('This course is no longer available.');
        setModal(null);
        return;
      }

      setModal('done');
      // The page was rendered for somebody who did not own this; it has to be
      // re-rendered by the server before the panel can claim otherwise.
      router.refresh();
    });
  };

  const buy = () => {
    setError(null);

    if (!isSignedIn) {
      setModal('auth');
      return;
    }

    // A free course has nothing to check out. A payment method and a total of
    // €0.00 would be a form standing between somebody and a thing that costs
    // nothing.
    if (course.price === 0) {
      confirm();
      return;
    }

    setModal('checkout');
  };

  const save = () => {
    startTransition(async () => {
      const result = await toggleSavedAction({
        kind: 'course',
        ref: course.slug,
        title: course.title,
        subtitle: course.provider,
      });

      if (result.status === 'sign_in_required') {
        openLogin();
        return;
      }
      setSaved(result.status === 'saved');
    });
  };

  const toggleWatched = (lessonId: string) => {
    const key = progressKey(course.slug, lessonId);
    const next = done.includes(key) ? done.filter((entry) => entry !== key) : [...done, key];
    setDone(next);

    startTransition(async () => {
      const result = await setLessonWatchedAction(course.slug, lessonId, !done.includes(key));
      if (result.status !== 'ok') {
        // Put the tick back where the server says it is.
        setDone(done);
      }
    });
  };

  return (
    <div className={`${styles.page} ${styles.pageNarrow}`}>
      <div className={styles.breadcrumb}>
        <Link href="/marketplace" prefetch={false}>
          Marketplace
        </Link>
        <span className={styles.breadcrumbSep}>/</span>
        <Link href="/marketplace/academy" prefetch={false}>
          Academy
        </Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbHere}>{course.title}</span>
      </div>

      <div className={styles.detail}>
        <div style={{ minWidth: 0 }}>
          <div className={styles.tags}>
            {course.badge && <span className={`${styles.tag} ${styles.tagAmber}`}>{course.badge}</span>}
            <span className={`${styles.tag} ${styles.tagBlue}`}>{FORMAT_NOTE[course.format]}</span>
            <span className={styles.tag}>{course.level}</span>
            <span className={styles.tag}>{course.language}</span>
          </div>

          <h1 className={styles.detailH1}>{course.title}</h1>
          <p className={styles.detailLead}>{course.tagline}</p>

          <div className={styles.byline}>
            <div className={styles.bylineProvider}>
              <span className={styles.monogram} aria-hidden="true">
                {course.provider
                  .split(' ')
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join('')}
              </span>
              <div>
                <div className={styles.bylineName}>
                  {course.provider}
                  {course.providerVerified && (
                    <Icon
                      className={styles.verified}
                      name="checkCircle"
                      size={13}
                      strokeWidth={2.4}
                    />
                  )}
                </div>
                <div className={styles.bylineSub}>
                  {course.providerVerified ? 'Verified provider' : 'Provider not yet verified'}
                </div>
              </div>
            </div>

            {course.rating && (
              <>
                <span className={styles.divider} />
                <div className={styles.bylineMeta}>
                  <span className={styles.stars} aria-hidden="true">
                    ★★★★★
                  </span>{' '}
                  <b className="tn-num">{course.rating.score.toFixed(1)}</b> (
                  <span className="tn-num">{course.rating.count.toLocaleString('en-GB')}</span>{' '}
                  reviews)
                </div>
              </>
            )}

            <span className={styles.divider} />
            <div className={`${styles.bylineMeta} tn-num`}>{courseMeta(course)}</div>
          </div>

          <div
            className={styles.detailCover}
            style={{ backgroundImage: `url(/redesign/courses/${course.image}.jpg)` }}
            role="img"
            aria-label={`${course.title} course cover`}
          />

          <section className={styles.section}>
            <h2 className={styles.h2} style={{ marginBottom: 14 }}>
              What you&rsquo;ll learn
            </h2>
            <ul className={styles.outcomes}>
              {course.outcomes.map((outcome) => (
                <li className={styles.outcome} key={outcome}>
                  <Icon name="check" size={16} strokeWidth={2.6} />
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.h2}>Curriculum</h2>
              <span className={`${styles.sectionMeta} tn-num`}>
                {course.sections.length} sections · {courseMeta(course)}
              </span>
            </div>

            <div className={styles.curriculum}>
              {course.sections.map((section, index) => {
                const isOpen = open.includes(section.id);
                const hasPreview = section.lessons.some((lesson) => lesson.free);

                return (
                  <div className={styles.module} key={section.id}>
                    <button
                      className={styles.moduleHead}
                      onClick={() =>
                        setOpen((current) =>
                          current.includes(section.id)
                            ? current.filter((entry) => entry !== section.id)
                            : [...current, section.id]
                        )
                      }
                      aria-expanded={isOpen}
                    >
                      <Icon
                        className={`${styles.moduleChevron} ${isOpen ? styles.moduleChevronOpen : ''}`}
                        name="chevronRight"
                        size={14}
                        strokeWidth={2.6}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className={styles.moduleTitle}>
                          {index + 1}. {section.title}
                        </span>
                        <span className={`${styles.moduleMeta} tn-num`}>{sectionMeta(section)}</span>
                      </span>
                      {hasPreview && !enrolled && <span className={styles.previewTag}>Preview</span>}
                    </button>

                    {isOpen && (
                      <ul className={styles.lessons}>
                        {section.lessons.map((lesson) => {
                          const watched = done.includes(progressKey(course.slug, lesson.id));
                          return (
                            <li
                              className={`${styles.lessonRow} ${
                                watched
                                  ? styles.lessonRowDone
                                  : lesson.free
                                    ? styles.lessonRowFree
                                    : ''
                              }`}
                              key={lesson.id}
                            >
                              <span
                                className={styles.lessonThumb}
                                style={{
                                  backgroundImage: `url(/redesign/courses/${course.image}.jpg)`,
                                }}
                                aria-hidden="true"
                              >
                                <Icon name="play" size={15} strokeWidth={2} />
                              </span>
                              <span className={styles.lessonTitle}>{lesson.title}</span>

                              {lesson.free && !enrolled && (
                                <span className={styles.previewTag}>Preview</span>
                              )}

                              {enrolled && (
                                <button
                                  className={`${styles.watchToggle} ${
                                    watched ? styles.watchToggleOn : ''
                                  }`}
                                  onClick={() => toggleWatched(lesson.id)}
                                  aria-pressed={watched}
                                >
                                  <Icon name="check" size={12} strokeWidth={3} />
                                  {watched ? 'Watched' : 'Mark watched'}
                                </button>
                              )}

                              <span className={`${styles.lessonTime} tn-num`}>{lesson.time}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            {enrolled && (
              <p className={styles.playerNote}>
                <Icon name="alert" size={15} strokeWidth={2} />
                <span>
                  The video player is not part of this demonstration — no lesson footage has been
                  produced. Marking a lesson watched is what moves your progress, here and in My
                  Learning.
                </span>
              </p>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2} style={{ marginBottom: 14 }}>
              Your instructor
            </h2>
            <div className={styles.instructor}>
              <span className={styles.instructorAvatar} aria-hidden="true">
                {course.instructor.name.replace(/^Dr\.\s*/, '')[0]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.instructorName}>{course.instructor.name}</div>
                <div className={styles.instructorCreds}>{course.instructor.credentials}</div>
                <p className={styles.instructorBio}>{course.instructor.bio}</p>
                <div className={styles.instructorStats}>
                  <span>
                    <b className="tn-num">{course.instructor.rating.toFixed(1)}</b> instructor rating
                  </span>
                  <span>
                    <b className="tn-num">{course.instructor.students}</b> students
                  </span>
                  <span>
                    <b className="tn-num">{course.instructor.courses}</b> courses
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2} style={{ marginBottom: 14 }}>
              Reviews
            </h2>

            {course.rating ? (
              <>
                <div className={styles.ratingSummary}>
                  <div className={styles.ratingScore}>
                    <div className={`${styles.ratingNumber} tn-num`}>
                      {course.rating.score.toFixed(1)}
                    </div>
                    <div className={styles.stars} aria-hidden="true">
                      ★★★★★
                    </div>
                    <div className={`${styles.ratingCount} tn-num`}>
                      {course.rating.count.toLocaleString('en-GB')} reviews
                    </div>
                  </div>

                  <div className={styles.ratingBars}>
                    {course.rating.breakdown.map((percent, index) => (
                      <div className={styles.ratingBarRow} key={index}>
                        <span className={`${styles.ratingBarLabel} tn-num`}>{5 - index}★</span>
                        <span className={styles.ratingTrack}>
                          <span className={styles.ratingFill} style={{ width: `${percent}%` }} />
                        </span>
                        <span className={`${styles.ratingPct} tn-num`}>{percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.reviews}>
                  {course.reviews.map((review) => (
                    <div className={styles.review} key={review.name}>
                      <div className={styles.reviewHead}>
                        <span className={styles.stars} aria-hidden="true">
                          ★★★★★
                        </span>
                        <span className={styles.reviewName}>{review.name}</span>
                        <span className={styles.reviewWhen}>{review.when}</span>
                      </div>
                      <p className={styles.reviewText}>{review.text}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.noReviews}>
                No reviews yet — this course has not run long enough to have any. It will show a
                rating once students have left one, and not before.
              </div>
            )}
          </section>
        </div>

        {/* ---------------------------------------------------------- Panel */}
        <div className={styles.buyColumn}>
          <div className={styles.buyPanel}>
            <div className={styles.buyBody}>
              {enrolled ? (
                <>
                  <div className={styles.enrolled}>
                    <Icon name="check" size={16} strokeWidth={2.6} />
                    You&rsquo;re enrolled
                  </div>
                  <div className={styles.enrolledText}>
                    {progress.started
                      ? `${progress.done} of ${total} lessons marked watched.`
                      : `Lifetime access to all ${total} lessons. Nothing watched yet.`}
                  </div>

                  {progress.started && (
                    <div className={styles.progressRow}>
                      <span className={styles.progressTrack}>
                        <span
                          className={styles.progressFill}
                          style={{ width: `${progress.percent}%` }}
                        />
                      </span>
                      <span className={`${styles.progressLabel} tn-num`}>{progress.percent}%</span>
                    </div>
                  )}

                  <Link
                    className={`${styles.primary} ${styles.buyPrimary}`}
                    href="/marketplace/academy/my-learning"
                    prefetch={false}
                  >
                    Go to My Learning
                  </Link>
                </>
              ) : (
                <>
                  <div className={styles.priceRow}>
                    <span className={`${styles.priceNow} tn-num`}>
                      {formatPrice(course.price, course.currency)}
                    </span>
                    {lines.hasDiscount && (
                      <>
                        <span className={`${styles.priceWas} tn-num`}>
                          {formatPrice(lines.list, course.currency)}
                        </span>
                        <span className={`${styles.priceOff} tn-num`}>
                          −{lines.discountPercent}%
                        </span>
                      </>
                    )}
                  </div>
                  <div className={styles.priceNote}>
                    {course.price === 0
                      ? 'Free, and free permanently · lifetime access'
                      : 'One-time payment · lifetime access'}
                  </div>

                  <button
                    className={`${styles.primary} ${styles.buyPrimary}`}
                    onClick={buy}
                    disabled={pending}
                  >
                    {course.price === 0 ? 'Enrol for free' : 'Buy now'}
                  </button>

                  <button
                    className={`${styles.ghost} ${styles.buySecondary}`}
                    onClick={save}
                    disabled={pending}
                    aria-pressed={isSaved}
                  >
                    <Icon name="bookmark" size={15} strokeWidth={2} />
                    {isSaved ? 'Saved for later' : 'Save for later'}
                  </button>

                  <div className={styles.buyNote}>
                    30-day money-back guarantee · browsing Academy never needs an account
                  </div>
                  {error && (
                    <div className={styles.buyNote} role="alert">
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className={styles.includes}>
              <div className={styles.includesTitle}>This course includes</div>
              <ul className={styles.includesList}>
                {course.includes.map((item) => (
                  <li className={styles.include} key={item.label}>
                    <Icon name={item.icon} size={15} strokeWidth={1.9} />
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={styles.freeCard}>
            Looking for the free version first? Short explainers on the same subjects are in{' '}
            <Link href="/academy" prefetch={false}>
              Learn
            </Link>
            , and always will be.
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------- Sign in */}
      {modal === 'auth' && (
        <>
          <div className={styles.overlay} onClick={() => setModal(null)} />
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Sign in to enrol">
            <div className={styles.dialogTitle} style={{ fontSize: 21 }}>
              Sign in to complete your purchase
            </div>
            <p className={styles.doneText} style={{ fontSize: 13.5 }}>
              Your course selection is kept — you will come straight back to{' '}
              <b>{course.title}</b>.
            </p>
            <div className={styles.dialogActions}>
              <button
                className={`${styles.primary} ${styles.blockButton}`}
                onClick={() => {
                  setModal(null);
                  openLogin();
                }}
              >
                Continue to sign in
              </button>
              <button
                className={`${styles.ghost} ${styles.blockButton}`}
                onClick={() => setModal(null)}
              >
                Keep browsing instead
              </button>
            </div>
            <div className={styles.buyNote}>
              Browsing Academy never requires an account — only enrolling does.
            </div>
          </div>
        </>
      )}

      {/* ------------------------------------------------------ Checkout */}
      {modal === 'checkout' && (
        <>
          <div className={styles.overlay} onClick={() => (pending ? null : setModal(null))} />
          <div
            className={`${styles.dialog} ${styles.dialogWide}`}
            role="dialog"
            aria-modal="true"
            aria-label="Checkout"
          >
            <div className={styles.dialogHead}>
              <div>
                <div className={styles.dialogTitle}>Checkout</div>
                <div className={styles.dialogSub}>No card is charged — see below</div>
              </div>
              <button
                className={styles.dialogClose}
                onClick={() => setModal(null)}
                aria-label="Close checkout"
                disabled={pending}
              >
                <Icon name="close" size={15} strokeWidth={2.2} />
              </button>
            </div>

            <div className={styles.dialogBody}>
              <div className={styles.checkoutItem}>
                <span
                  className={styles.checkoutThumb}
                  style={{ backgroundImage: `url(/redesign/courses/${course.image}.jpg)` }}
                  aria-hidden="true"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.checkoutTitle}>{course.title}</div>
                  <div className={styles.checkoutMeta}>
                    {course.provider} · {FORMAT_LABEL[course.format]}
                  </div>
                </div>
              </div>

              <div className={styles.lines}>
                <div className={styles.line}>
                  <span className={styles.lineLabel}>Course price</span>
                  <span className="tn-num">{formatAmount(lines.list, course.currency)}</span>
                </div>
                {lines.hasDiscount && (
                  <div className={styles.line}>
                    <span className={styles.lineLabel}>Launch discount</span>
                    <span className={`${styles.lineDiscount} tn-num`}>
                      −{formatAmount(lines.discount, course.currency)}
                    </span>
                  </div>
                )}
                <div className={styles.line}>
                  <span className={styles.lineLabel}>VAT (19%), included</span>
                  <span className="tn-num">{formatAmount(lines.vat, course.currency)}</span>
                </div>
                <div className={styles.lineTotal}>
                  <span className={styles.lineTotalLabel}>Total</span>
                  <span className={`${styles.lineTotalValue} tn-num`}>
                    {formatAmount(lines.total, course.currency)}
                  </span>
                </div>
              </div>

              <div className={styles.includesTitle} style={{ marginTop: 20 }}>
                Payment method
              </div>
              <div className={styles.payMethods}>
                {(
                  [
                    ['card', 'Card · Visa, Mastercard, Amex'],
                    ['paypal', 'PayPal'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    className={`${styles.payMethod} ${method === id ? styles.payMethodOn : ''}`}
                    onClick={() => setMethod(id)}
                    aria-pressed={method === id}
                  >
                    <span className={`${styles.payDot} ${method === id ? styles.payDotOn : ''}`} />
                    {label}
                  </button>
                ))}
              </div>

              <div className={styles.demoNote}>
                <Icon name="alert" size={15} strokeWidth={2} />
                <span className={styles.demoNoteText}>
                  <b>Demonstration checkout.</b> No payment provider is connected: nothing is
                  charged, no card details are asked for or stored, and the enrolment is recorded as
                  a demo purchase in your account.
                </span>
              </div>

              <button
                className={`${styles.primary} ${styles.buyPrimary}`}
                onClick={confirm}
                disabled={pending}
              >
                {pending
                  ? 'Enrolling…'
                  : `Complete enrolment · ${formatAmount(lines.total, course.currency)}`}
              </button>
              <div className={styles.buyNote}>
                By enrolling you agree to the Terms. The 30-day money-back guarantee applies.
              </div>
            </div>
          </div>
        </>
      )}

      {/* --------------------------------------------------------- Done */}
      {modal === 'done' && (
        <>
          <div className={styles.overlay} onClick={() => setModal(null)} />
          <div
            className={`${styles.dialog} ${styles.dialogMint} ${styles.doneDialog}`}
            role="dialog"
            aria-modal="true"
            aria-label="Enrolled"
          >
            <span className={styles.doneMark}>
              <Icon name="check" size={30} strokeWidth={3} />
            </span>
            <div className={styles.doneTitle}>You&rsquo;re enrolled</div>
            <div className={styles.doneText}>
              {course.title} is in your library with lifetime access. It is listed under My Learning
              and in your account purchases.
            </div>
            <div className={styles.dialogActions}>
              <Link
                className={`${styles.primary} ${styles.blockButton}`}
                href="/marketplace/academy/my-learning"
                prefetch={false}
              >
                Go to My Learning
              </Link>
              <button
                className={`${styles.ghost} ${styles.blockButton}`}
                onClick={() => setModal(null)}
              >
                Back to the course
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
