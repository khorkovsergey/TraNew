import { formatPrice, type ChartMarketProduct } from '@/content/chartMarket';
import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import { filtersToQuery, type CatalogFilters } from '@/lib/chartMarket/filters';
import { ChartPreview } from './ChartPreview';
import styles from './Tools.module.css';

/**
 * A product page.
 *
 * The source panel is the part worth reading twice. When the viewer does not own
 * the script, `source` is null — not blurred, not truncated, not present. The
 * server decided that before rendering, so there is nothing in the markup, the
 * RSC payload or the network tab to uncover. The blurred bars underneath the
 * lock are bars.
 */

const PATH = '/marketplace/tools/chart-market' as const;

/**
 * A rating as five glyphs.
 *
 * Earned stars are filled and the rest are outlines. Distinguishing them by
 * opacity alone — which is what the first version did — makes 4.9 and 3.1 look
 * the same at a glance, and identical to somebody who cannot see the
 * difference at all. The figure beside them is the authority either way.
 */
function stars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => (
    <Icon
      key={index}
      name="star"
      size={12}
      strokeWidth={2}
      fill={index < rating ? 'currentColor' : 'none'}
      style={{ opacity: index < rating ? 1 : 0.4 }}
    />
  ));
}

export function ScriptDetail({
  product,
  filters,
  owned,
  source,
  demoPurchase,
}: {
  product: ChartMarketProduct;
  filters: CatalogFilters;
  owned: boolean;
  /** Present only when `owned`. Enforced by `sourceFor`, not by this component. */
  source: string | null;
  /** The entitlement was granted without a payment, because no provider exists. */
  demoPurchase: boolean;
}) {
  const backHref = { pathname: PATH, query: filtersToQuery(filters) };
  const buyHref = {
    pathname: PATH,
    query: filtersToQuery(filters, { script: product.id, step: 'checkout' }),
  };

  const updated = new Date(product.updatedAt).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <>
      <Link className={styles.linkButton} href={backHref}>
        ← Back to Chart Market
      </Link>

      <div className={styles.detail}>
        <div className={styles.detailMain}>
          <div className={styles.badgeRow}>
            <span className={`${styles.badge} ${styles.badgeType}`}>{product.type}</span>
            <span className={`${styles.badge} ${styles.mono}`}>Pine Script v{product.pine}</span>
            {product.tag && (
              <span className={`${styles.badge} ${styles.badgeTag}`}>{product.tag}</span>
            )}
          </div>

          <h1 className={styles.detailH1}>{product.title}</h1>
          <p className={styles.detailLead}>{product.short}</p>

          <div className={styles.identityRow}>
            <div className={styles.identity}>
              <span className={`${styles.avatar} ${styles.avatarLarge}`}>
                {product.creator.slice(0, 1)}
              </span>
              <div>
                <div className={styles.identityName}>
                  {product.creator}
                  {product.creatorVerified && (
                    <>
                      <Icon
                        name="checkCircle"
                        size={13}
                        strokeWidth={2.4}
                        className={styles.verified}
                      />
                      <span className="tn-sr-only">Verified creator</span>
                    </>
                  )}
                </div>
                <div className={styles.identityMeta}>{product.creatorMeta}</div>
              </div>
            </div>

            <span className={styles.rule} />

            <div className={styles.identity}>
              <span className={styles.rating}>{stars(Math.round(product.rating))}</span>
              <b className="tn-num">{product.rating.toFixed(1)}</b>
              <span className={styles.identityMeta}>{product.reviews} reviews</span>
            </div>

            <span className={styles.rule} />

            <div className={styles.identityMeta}>
              <b className="tn-num">{product.installs.toLocaleString('en-GB')}</b> installs
            </div>
          </div>

          <ChartPreview
            seed={product.seed}
            accent={product.accent}
            bars={44}
            className={`${styles.detailPreview} ${styles.previewBordered}`}
          />

          <section className={styles.section}>
            <h2 className={styles.sectionH2}>What it does</h2>
            <p className={styles.prose}>{product.overview}</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionH2}>Features</h2>
            <div className={styles.featureGrid}>
              {product.features.map((feature) => (
                <div className={styles.feature} key={feature}>
                  <Icon name="check" size={15} strokeWidth={2.6} />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionH2}>Source code</h2>
            <div className={styles.sourcePanel}>
              {source ? (
                <pre className={styles.sourceCode}>
                  <code>{source}</code>
                </pre>
              ) : (
                <>
                  <div className={styles.sourceSkeleton} aria-hidden="true">
                    {[92, 74, 58, 81, 46, 67, 88, 52].map((width, index) => (
                      <div
                        className={styles.skeletonLine}
                        key={index}
                        style={{ width: `${width}%` }}
                      />
                    ))}
                  </div>
                  <div className={styles.sourceLock}>
                    <Icon name="lock" size={22} strokeWidth={1.9} />
                    <div className={styles.sourceLockTitle}>
                      The source is delivered after purchase
                    </div>
                    <p className={styles.sourceLockText}>
                      You will get the full Pine Script, install instructions and the creator&rsquo;s
                      future updates. Nothing above this lock is the script — the code is not sent to
                      this page at all until you own it.
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionH2}>Reviews</h2>
            <p className={styles.identityMeta} style={{ marginBottom: 12 }}>
              Sample reviews, part of the demonstration catalogue.
            </p>
            <div className={styles.reviewList}>
              {product.reviewList.map((review) => (
                <div className={styles.review} key={review.name}>
                  <div className={styles.reviewHead}>
                    <span className={styles.reviewStars}>{stars(review.rating)}</span>
                    <span className={styles.reviewName}>{review.name}</span>
                    <span className={styles.reviewWhen}>{review.when}</span>
                  </div>
                  <p className={styles.reviewText}>{review.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className={styles.buyColumn}>
          <div className={styles.buyCard}>
            {owned ? (
              <>
                <div className={styles.ownedLine}>
                  <Icon name="check" size={16} strokeWidth={2.6} />
                  You own this script
                </div>
                <div className={styles.buyNote}>
                  {demoPurchase
                    ? 'Granted as a demo purchase — no payment was taken. The source below is unlocked.'
                    : 'The source below is unlocked, along with install instructions.'}
                </div>
                <Link className={styles.blueButton} href="/supercharts">
                  Add it to a chart
                </Link>
                <Link className={styles.secondaryButton} href="/account/purchases">
                  Open in My Purchases
                </Link>
              </>
            ) : (
              <>
                <div className={styles.buyPrice}>{formatPrice(product.amountCents)}</div>
                <div className={styles.buyNote}>
                  {product.amountCents === 0
                    ? 'Free · lifetime access and updates'
                    : 'One-time purchase · lifetime access and updates'}
                </div>
                <Link className={styles.primaryButton} href={buyHref}>
                  {product.amountCents === 0 ? 'Get this script' : 'Buy now'}
                </Link>
              </>
            )}

            <div className={styles.metaList}>
              <div className={styles.metaEntry}>
                <span className={styles.metaKey}>Type</span>
                <span className={styles.metaValue}>{product.type}</span>
              </div>
              <div className={styles.metaEntry}>
                <span className={styles.metaKey}>Pine Script</span>
                <span className={styles.metaValue}>v{product.pine}</span>
              </div>
              <div className={styles.metaEntry}>
                <span className={styles.metaKey}>Compatibility</span>
                <span className={styles.metaValue}>Supercharts</span>
              </div>
              <div className={styles.metaEntry}>
                <span className={styles.metaKey}>Updated</span>
                <span className={styles.metaValue}>{updated}</span>
              </div>
              <div className={styles.metaEntry}>
                <span className={styles.metaKey}>Updates</span>
                <span className={styles.metaValue}>Included</span>
              </div>
              <div className={styles.metaEntry}>
                <span className={styles.metaKey}>Licence</span>
                <span className={styles.metaValue}>Personal use</span>
              </div>
            </div>
          </div>

          <div className={styles.voyagerCard}>
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative, fixed size. */}
            <img src="/redesign/voyager-robot.png" alt="" aria-hidden="true" />
            <div className={styles.voyagerText}>
              Not sure whether this fits your setup? Ask Voyager what this kind of indicator does and
              when it helps.
              <br />
              <Link className={styles.linkButton} href="/voyager" style={{ marginTop: 9 }}>
                Ask Voyager →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
