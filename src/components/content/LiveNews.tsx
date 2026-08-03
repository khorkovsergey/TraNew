import { TrustLabel } from '@/components/ui/TrustLabel';
import { SYMBOLS } from '@/content/symbols';
import { Link } from '@/i18n/navigation';
import type { NewsFeed } from '@/lib/market/newsShape';
import styles from './Content.module.css';

/**
 * The live wire, above the written analysis.
 *
 * A server component, so the vendor key is read on the server and never reaches
 * a browser — the same rule the rest of the data layer follows.
 *
 * These stories deliberately look different from the curated ones. A wire item
 * carries no "why it matters" line, because nobody wrote one against reporting,
 * and generating one would be exactly the fabrication the section was built to
 * avoid. What it carries instead is the thing a wire item is good for: a
 * timestamp and a link to the publisher.
 */

type Props = {
  feed: NewsFeed | null;
  /** Shown when the feed is off, so the page never silently omits a section. */
  configured: boolean;
  title: string;
};

/** How old a story is, in words. "09:12" tells nobody whether that was today. */
function age(publishedAt: string, now: number): string {
  const minutes = Math.round((now - new Date(publishedAt).getTime()) / 60_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function LiveNews({ feed, configured, title }: Props) {
  if (!configured) {
    /*
     * Said out loud rather than hidden. A section that quietly disappears when
     * a key is missing looks like a product that does not have the feature.
     */
    return (
      <section className={styles.liveSection}>
        <div className={styles.liveHead}>
          <h2 className={styles.h2}>{title}</h2>
          <span className={styles.liveOff}>Not connected</span>
        </div>
        <p className={styles.cardSummary}>
          The live wire is not configured on this deployment, so what follows is the written
          analysis only. Nothing below is a real-time headline.
        </p>
      </section>
    );
  }

  if (!feed) {
    return (
      <section className={styles.liveSection}>
        <div className={styles.liveHead}>
          <h2 className={styles.h2}>{title}</h2>
          <span className={styles.liveOff}>Unavailable</span>
        </div>
        <p className={styles.cardSummary}>
          The news provider did not answer just now. The written analysis below is unaffected, and
          this will fill in on the next refresh.
        </p>
      </section>
    );
  }

  const now = Date.parse(feed.fetchedAt);

  return (
    <section className={styles.liveSection}>
      <div className={styles.liveHead}>
        <h2 className={styles.h2}>{title}</h2>
        <span className={styles.liveDot} aria-hidden="true" />
        {/*
          The fetch time is absolute, not "N minutes ago".
          *
          * The page is cached for as long as the feed is, so a relative age
          * computed at render would freeze at whatever it said when the page
          * was built and then quietly lie for ten minutes. A timestamp stays
          * true however long the render is reused.
        */}
        <span className={styles.liveMeta}>
          {feed.stories.length} headlines · fetched {feed.fetchedAt.slice(11, 16)} UTC
        </span>
      </div>

      <div className={styles.cardList}>
        {feed.stories.map((story) => (
          <article className={styles.liveCard} key={story.id}>
            <div className={styles.cardMeta}>
              <TrustLabel kind="fact" small />
              <span>
                {story.source} · {age(story.publishedAt, now)}
              </span>
            </div>

            {/*
              The headline is the link. `noopener` because a page opened with
              `target="_blank"` can otherwise reach back through `window.opener`,
              and `nofollow` because a wire feed is not an endorsement.
            */}
            <h3 className={styles.cardTitle}>
              <a
                className={styles.liveLink}
                href={story.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                {story.title}
              </a>
            </h3>

            {story.summary && <p className={styles.cardSummary}>{story.summary}</p>}

            <div className={styles.cardActions}>
              {story.related
                .filter((ticker) => ticker in SYMBOLS)
                .slice(0, 3)
                .map((ticker) => (
                  <Link
                    className={styles.chip}
                    key={ticker}
                    href={{ pathname: '/symbols/[ticker]', params: { ticker } }}
                  >
                    {ticker}
                  </Link>
                ))}
              <a
                className={styles.chip}
                href={story.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                Read at {story.source} ↗
              </a>
            </div>
          </article>
        ))}
      </div>

      {/* Attribution is a term of use, not a courtesy. */}
      <p className={styles.liveAttribution}>{feed.attribution}</p>
    </section>
  );
}
