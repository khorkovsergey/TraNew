import { Icon } from '@/components/ui/Icon';
import { comparisonSet, verbFor, type AssetClass } from '@/content/assetClasses';
import { answerFor } from '@/lib/explore/answers';
import { compareHref } from '@/lib/explore/compareLink';
import { Link } from '@/i18n/navigation';
import { CompareMatrix } from './CompareMatrix';
import styles from './AssetClass.module.css';

/**
 * One asset class, at its own address.
 *
 * These six used to be `/tool/{slug}` — the generic placeholder that says a
 * high-fidelity build is in progress. "Learn more about Bonds" opening a page
 * that will not tell you anything about bonds is the specific failure this
 * replaces.
 *
 * The prose, the ratings and the questions all come from `assetClasses.ts`, so
 * this page and the Explore column can never disagree about what a bond is.
 */
export function AssetClassPage({ entry }: { entry: AssetClass }) {
  const comparison = comparisonSet(entry.key);
  const others = comparison.slice(1);
  const faq = entry.questions.map((question) => ({ question, answer: answerFor(question) }));

  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/explore">
        <Icon name="arrowLeft" size={14} strokeWidth={2.2} />
        Investment options
      </Link>

      <header className={styles.header}>
        <span className={`${styles.mark} ${styles[`mark_${entry.accent}`]}`}>
          <Icon name={entry.icon} size={28} strokeWidth={1.8} />
        </span>
        <div>
          <h1 className={styles.h1}>
            {entry.name}: what {entry.singular ? 'it is' : 'they are'} and how {entry.subject}{' '}
            {verbFor(entry)}
          </h1>
          <p className={styles.lead}>{entry.tagline}</p>
        </div>
      </header>

      <div className={styles.prose}>
        <Block term="What it is" icon="fileSearch" accent="blue" body={entry.longWhat} />
        <Block term="Why people use it" icon="checkCircle" accent="green" body={entry.longWhy} />
        {/* Its own block, at the same weight as the case for it. A risk written
            as a footnote to an argument is an argument. */}
        <Block term="Main risks" icon="alert" accent="amber" body={entry.longRisks} />
        <Block term="Who it may suit" icon="user" accent="purple" body={entry.longSuit} />
      </div>

      <section className={styles.section}>
        <h2 className={styles.h2}>How {entry.name} compare</h2>
        <p className={styles.sectionSub}>
          Beside {others.map((other) => other.name).join(' and ')} — the two {entry.name} are most
          often weighed against.
        </p>
        <CompareMatrix entries={comparison} linkToPages />
      </section>

      {faq.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.h2}>Questions people ask</h2>
          <dl className={styles.faq}>
            {faq.map((item) => (
              <div key={item.question} className={styles.faqItem}>
                <dt className={styles.faqQuestion}>{item.question}</dt>
                <dd className={styles.faqAnswer}>{item.answer}</dd>
              </div>
            ))}
          </dl>

          {/*
           * FAQPage structured data, generated from the same pairs rendered
           * above rather than written separately — a schema block that says
           * something the page does not is worse than none.
           */}
          <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger -- JSON-LD has no other insertion point.
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: faq.map((item) => ({
                  '@type': 'Question',
                  name: item.question,
                  acceptedAnswer: { '@type': 'Answer', text: item.answer },
                })),
              }),
            }}
          />
        </section>
      )}

      <div className={styles.ctaRow}>
        <Link className={styles.ctaPrimary} href={compareHref(entry.key)} prefetch={false}>
          Compare {entry.name} with the alternatives
          <Icon name="arrowRight" size={16} strokeWidth={2.4} />
        </Link>
        <Link
          className={styles.ctaGhost}
          href={{ pathname: '/voyager', query: { q: entry.questions[0] } }}
          prefetch={false}
        >
          Ask Voyager
          <Icon name="sparkle" size={15} strokeWidth={2} />
        </Link>
        <Link className={styles.ctaGhost} href="/markets/global" prefetch={false}>
          See today&rsquo;s market
          <Icon name="bars" size={15} strokeWidth={2} />
        </Link>
      </div>

      <p className={styles.disclaimer}>
        This page explains a category. It is not a recommendation, and nothing here takes account of
        your circumstances.
      </p>
    </div>
  );
}

function Block({
  term,
  icon,
  accent,
  body,
}: {
  term: string;
  icon: 'fileSearch' | 'checkCircle' | 'alert' | 'user';
  accent: string;
  body: string;
}) {
  return (
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>
        <Icon name={icon} size={18} strokeWidth={2} className={styles[`accent_${accent}`]} />
        {term}
      </h2>
      <p className={styles.blockBody}>{body}</p>
    </section>
  );
}
