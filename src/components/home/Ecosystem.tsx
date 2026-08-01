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
 * The interesting part is the wrap. A track that stops at the last card announces
 * its own ends, so the seventh card is followed by a clone of the first: Next
 * animates onto the clone and the position is then reset to the real first card
 * with the transition switched off, which the eye cannot separate from a normal
 * step. Prev from the first card does the same in reverse — jump to the clone with
 * no animation, then animate back to the seventh.
 *
 * Two details make it seamless rather than nearly seamless. The transition has to
 * be killed on the cards as well as the track, because the opacity/scale crossfade
 * between clone and original gives away a seam the position never revealed. And
 * navigation is locked while it happens: a second click mid-reset lands on a
 * position that is about to be thrown away.
 */

const COUNT = ECOSYSTEM.length;
const CLONE = COUNT;
/**
 * Longer than `--slide` in the stylesheet, so the silent reset always lands after
 * the animation has finished. Reset it too early and the jump becomes visible —
 * which is the one thing the clone exists to prevent.
 */
const WRAP_AFTER = 680;

const CARDS = [...ECOSYSTEM, ECOSYSTEM[0]];

export function Ecosystem() {
  const [pos, setPos] = useState(0);
  const [animated, setAnimated] = useState(true);

  const locked = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const frames = useRef<number[]>([]);
  /* Read outside render, by callbacks that run frames apart from it. */
  const posRef = useRef(0);

  const active = pos % COUNT;

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

  const next = useCallback(() => {
    if (locked.current) return;
    setAnimated(true);

    if (posRef.current < CLONE - 1) {
      move(posRef.current + 1);
      return;
    }

    // Onto the clone, then quietly back to the real card underneath it.
    locked.current = true;
    move(CLONE);
    later(() => {
      setAnimated(false);
      move(0);
      afterPaint(() => {
        setAnimated(true);
        locked.current = false;
      });
    }, WRAP_AFTER);
  }, []);

  const prev = useCallback(() => {
    if (locked.current) return;

    if (posRef.current > 0) {
      setAnimated(true);
      move(posRef.current - 1);
      return;
    }

    // Standing on the first card there is nothing to its left, so the identical
    // clone is slid under the pointer first and the animation runs from there.
    locked.current = true;
    setAnimated(false);
    move(CLONE);
    afterPaint(() => {
      setAnimated(true);
      move(CLONE - 1);
      later(() => {
        locked.current = false;
      }, WRAP_AFTER);
    });
  }, []);

  const goTo = useCallback((index: number) => {
    if (locked.current) return;
    setAnimated(true);
    move(index);
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
                    anywhere on it brings it to the centre. */}
                {!isActive && (
                  <button
                    className={styles.cardHit}
                    onClick={() => goTo(index)}
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
