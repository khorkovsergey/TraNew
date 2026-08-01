import { Link } from '@/i18n/navigation';
import { CreateEventButton } from './CreateEventButton';
import styles from './Events.module.css';

/**
 * The hub header, shared by Learning and Events.
 *
 * The two tabs are links rather than a client-side toggle: Academy and Events are
 * separate pages with separate data, and pretending they are one component that
 * swaps its contents would mean loading both to show one.
 */

export function EventsHubHeader({ active }: { active: 'learning' | 'events' }) {
  return (
    <header>
      <Link className={styles.backHome} href="/">
        ← Home
      </Link>

      <p className={styles.eyebrow}>LEARNING &amp; EVENTS</p>
      <h1 className={styles.h1}>Learn, connect and navigate the markets with confidence</h1>
      <p className={styles.lede}>
        Build your knowledge with practical courses or join financial events hosted by TradingNew
        and the community.
      </p>

      <div className={styles.heroActions}>
        <CreateEventButton />
        <Link className={styles.secondary} href="/events/my">
          My events
        </Link>
      </div>

      <nav className={styles.hubTabs} aria-label="Learning and events">
        <Link
          className={`${styles.hubTab} ${active === 'learning' ? styles.hubTabActive : ''}`}
          href="/academy"
          aria-current={active === 'learning' ? 'page' : undefined}
        >
          Learning
        </Link>
        <Link
          className={`${styles.hubTab} ${active === 'events' ? styles.hubTabActive : ''}`}
          href="/events"
          aria-current={active === 'events' ? 'page' : undefined}
        >
          Events
        </Link>
      </nav>
    </header>
  );
}
