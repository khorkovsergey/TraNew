'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './VoyagerIntro.module.css';

/**
 * The first-run introduction: a full-screen film that plays the first time someone
 * opens Voyager, then hands over to the assistant.
 *
 * Four things this has to get right, because a video in front of a tool is easy to
 * get wrong:
 *
 * - **It is skippable from the first frame.** Someone clicked the assistant because
 *   they have a question. Holding them for 58 seconds with no way out is how you
 *   teach people never to click it again.
 * - **It is fetched only when it will actually play.** The element mounts on the
 *   first open and never again, so the 7 MB is not part of anyone's page load —
 *   least of all a returning visitor's.
 * - **Sound is attempted, not assumed.** The click is a user gesture so audio is
 *   normally allowed, but if the browser refuses, playback restarts muted with an
 *   unmute control rather than failing silently to a black screen.
 * - **`prefers-reduced-motion` skips it entirely.** Someone who has asked their
 *   system for less motion should not be handed a full-screen film; the caller
 *   checks this before mounting.
 */

export function VoyagerIntro({ onFinish }: { onFinish: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.play().catch(() => {
      // Autoplay with sound was refused. Rather than show a still frame, start
      // over muted and let the person turn sound on if they want it.
      video.muted = true;
      setMuted(true);
      video.play().catch(() => setFailed(true));
    });
  }, []);

  // Escape leaves at any point, like any other full-screen overlay.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onFinish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFinish]);

  // If the file will not play at all, do not strand anyone on a black screen.
  useEffect(() => {
    if (failed) onFinish();
  }, [failed, onFinish]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Meet Voyager">
      <video
        ref={videoRef}
        className={styles.video}
        src="/video/voyager-intro.mp4"
        poster="/video/voyager-intro.jpg"
        playsInline
        preload="auto"
        onEnded={onFinish}
        onError={() => setFailed(true)}
      />

      <div className={styles.controls}>
        {muted && (
          <button
            className={styles.control}
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              video.muted = false;
              setMuted(false);
            }}
          >
            Turn on sound
          </button>
        )}
        <button className={styles.skip} onClick={onFinish}>
          Skip
        </button>
      </div>
    </div>
  );
}
