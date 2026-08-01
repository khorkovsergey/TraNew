'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { openVoyager } from '@/lib/voyager/openRequest';
import { ECOSYSTEM } from '@/content/ecosystem';
import { EcosystemArt } from './EcosystemScenes';
import styles from './Ecosystem.module.css';

/**
 * The ecosystem carousel — seven cards, one centred, its neighbours peeking.
 *
 * The wrap is the whole problem. A track that stops at the last card announces
 * its own ends, so the strip is padded with clones and the position is quietly
 * reset once a slide has carried it into them.
 *
 * Two clones on each side, not one. With a single trailing clone the position
 * reset is invisible but the *neighbours* are not: standing on the clone of card
 * one, Marketplace peeks from the left and nothing peeks from the right, and the
 * moment the reset lands that swaps to nothing on the left and Market
 * Intelligence on the right. The centre never moves, and it still reads as a
 * jolt, because the eye is watching the edges. Padding with the last two cards
 * and the first two makes both peeks identical either side of the reset, so
 * there is nothing left to notice.
 *
 * That also removes the special case that used to make Prev worse than Next: it
 * no longer has to jump to a clone before it can animate. Both directions are
 * now an ordinary slide, and the reset happens afterwards, off-screen in every
 * sense that matters.
 *
 * Navigation is locked during that window. The clones give two cards of runway,
 * so the lock is not what keeps the position in range — it is what stops a
 * queued click from being applied to a position that is about to be replaced.
 */

const COUNT = ECOSYSTEM.length;
/** Clones of the last two cards sit in front, so real card i lives at i + LEAD. */
const LEAD = 2;
const FIRST = LEAD;
const LAST = LEAD + COUNT - 1;

/**
 * Longer than `--slide` in the stylesheet, so the silent reset always lands after
 * the animation has finished. Reset it too early and the jump becomes visible —
 * which is the one thing the clones exist to prevent.
 */
const WRAP_AFTER = 680;

const CARDS = [
  ECOSYSTEM[COUNT - 2],
  ECOSYSTEM[COUNT - 1],
  ...ECOSYSTEM,
  ECOSYSTEM[0],
  ECOSYSTEM[1],
];

export function Ecosystem() {
  const [pos, setPos] = useState(FIRST);
  const [animated, setAnimated] = useState(true);

  const locked = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const frames = useRef<number[]>([]);
  /* Read outside render, by callbacks that run frames apart from it. */
  const posRef = useRef(FIRST);

  const active = (((pos - LEAD) % COUNT) + COUNT) % COUNT;

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      frames.current.forEach(cancelAnimationFrame);
    },
    []
  );

  const later = (fn: () => void, delay: number) => {
    timers.current.push(setTimeout(fn, delay));
  };

  /**
   * Two frames, not one. After `transition: none` is applied the browser still has
   * to paint the new position before the transition may come back; restoring it in
   * the same frame lets it animate the jump it was meant to hide.
   */
  const afterPaint = (fn: () => void) => {
    frames.current.push(
      requestAnimationFrame(() => {
        frames.current.push(requestAnimationFrame(fn));
      })
    );
  };

  const move = (value: number) => {
    posRef.current = value;
    setPos(value);
  };

  /**
   * Slide one card, and if that lands on a clone, quietly step back onto the real
   * card wearing the same face once the slide has finished. Both the position and
   * its two neighbours are identical across that step, so there is nothing to see.
   */
  const step = useCallback((delta: 1 | -1) => {
    if (locked.current) return;

    setAnimated(true);
    const target = posRef.current + delta;
    move(target);

    if (target >= FIRST && target <= LAST) return;

    locked.current = true;
    later(() => {
      setAnimated(false);
      move(target - delta * COUNT);
      afterPaint(() => {
        setAnimated(true);
        locked.current = false;
      });
    }, WRAP_AFTER);
  }, []);

  const next = useCallback(() => step(1), [step]);
  const prev = useCallback(() => step(-1), [step]);

  const goTo = useCallback((index: number) => {
    if (locked.current) return;
    setAnimated(true);
    move(index + LEAD);
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      prev();
    }
  };

  /*
   * Swipe. On a phone the arrows are hidden and dragging the cards is what
   * anyone will try first. The threshold is deliberately generous — below 45px
   * a horizontal wobble during a vertical scroll would steal the gesture, and
   * `touch-action: pan-y` already leaves the page's own scrolling alone.
   */
  const dragFrom = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse') return;
    dragFrom.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (!from) return;

    const dx = event.clientX - from.x;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(event.clientY - from.y)) return;
    if (dx < 0) next();
    else prev();
  };

  return (
    <section className={styles.section} aria-labelledby="ecosystem-title">
      <div className={styles.head}>
        <h2 className={styles.h2} id="ecosystem-title">
          One platform, seven ways it works for you
        </h2>
        <p className={styles.sub}>From your first question to managing your entire wealth.</p>
      </div>

      <div className={styles.titles} role="tablist" aria-label="Platform areas">
        {ECOSYSTEM.map((card, index) => (
          <button
            key={card.key}
            role="tab"
            aria-selected={index === active}
            className={`${styles.title} ${index === active ? styles.titleActive : ''}`}
            onClick={() => goTo(index)}
          >
            {card.label}
          </button>
        ))}
      </div>

      <div
        className={styles.viewport}
        role="group"
        aria-roledescription="carousel"
        aria-label="One platform, seven ways it works for you"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragFrom.current = null;
        }}
      >
        <div
          className={`${styles.track} ${animated ? styles.animated : styles.instant}`}
          style={{ '--pos': pos } as React.CSSProperties}
        >
          {CARDS.map((card, index) => {
            const isActive = index === pos;

            return (
              <div
                key={`${card.key}-${index}`}
                className={`${styles.card} ${isActive ? styles.cardActive : styles.cardInert}`}
                style={{ background: card.background }}
                aria-hidden={!isActive}
              >
                <EcosystemArt card={card.key} />

                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{card.title}</h3>
                  <p className={styles.cardValue}>{card.value}</p>

                  {card.href ? (
                    <Link
                      className={styles.cta}
                      href={card.href}
                      style={{ background: card.ctaBg }}
                      tabIndex={isActive ? undefined : -1}
                    >
                      {card.cta}
                    </Link>
                  ) : (
                    <button
                      className={styles.cta}
                      style={{ background: card.ctaBg }}
                      tabIndex={isActive ? undefined : -1}
                      onClick={openVoyager}
                    >
                      {card.cta}
                    </button>
                  )}
                </div>

                {/* A card off to the side is a destination, not a page: clicking
                    anywhere on it brings it to the centre. Only the immediate
                    neighbours are ever reachable, and stepping onto one is the
                    same move as the arrow beside it — including when the one you
                    clicked is a clone. */}
                {!isActive && (
                  <button
                    className={styles.cardHit}
                    onClick={() => (index > pos ? next() : prev())}
                    tabIndex={-1}
                    aria-label={`Show ${card.label}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <button
          className={`${styles.arrow} ${styles.arrowPrev}`}
          onClick={prev}
          aria-label="Previous"
        >
          <Arrow direction="left" />
        </button>
        <button
          className={`${styles.arrow} ${styles.arrowNext}`}
          onClick={next}
          aria-label="Next"
        >
          <Arrow direction="right" />
        </button>
      </div>

      <div className={styles.dots}>
        {ECOSYSTEM.map((card, index) => (
          <button
            key={card.key}
            className={`${styles.dot} ${index === active ? styles.dotActive : ''}`}
            onClick={() => goTo(index)}
            aria-label={`Show ${card.label}`}
            aria-current={index === active}
          >
            <span className={styles.dotVisual} />
          </button>
        ))}
      </div>
    </section>
  );
}

function Arrow({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width={19}
      height={19}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === 'left' ? 'M19 12H5M11 19l-7-7 7-7' : 'M5 12h14M13 5l7 7-7 7'} />
    </svg>
  );
}
