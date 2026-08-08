import { Link } from '@/i18n/navigation';
import { CreateEventButton } from './CreateEventButton';
import styles from './Events.module.css';

/**
 * The Events header.
 *
 * It used to be a shared hub header with Learning and Events tabs across the
 * top. The Learning half was a second door to Academy, which has its own
 * section in the main navigation — so the tab strip offered a way to leave the
 * page you had just chosen, and the headline had to describe both halves at
 * once and therefore described neither.
 *
 * What is left says what this section is, and the two actions are the two
 * things someone can do here that they cannot do by scrolling.
 */

export function EventsHubHeader() {
  return (
    <header>
      <Link className={styles.backHome} href="/">
        ← Home
      </Link>

      <p className={styles.eyebrow}>EVENTS NEAR YOU</p>
      <h1 className={styles.h1}>
        Meet the people behind <span className={styles.h1Accent}>the markets</span>
      </h1>
      <p className={styles.lede}>
        Workshops, meetups and webinars hosted by TradingNew and verified organizers — online and
        near you.
      </p>

      <div className={styles.heroActions}>
        <CreateEventButton />
        <Link className={styles.secondary} href="/events/my">
          My events
        </Link>
      </div>
    </header>
  );
}
