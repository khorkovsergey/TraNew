import { formatPrice, type ChartMarketProduct } from '@/content/chartMarket';
import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import { filtersToQuery, type CatalogFilters } from '@/lib/chartMarket/filters';
import { ChartPreview } from './ChartPreview';
import styles from './Tools.module.css';

/**
 * One product in the grid.
 *
 * The link keeps the current filters in its query, so opening a script and
 * pressing back returns to the catalogue as it was rather than to its default.
 */
export function ScriptCard({
  product,
  filters,
  owned,
}: {
  product: ChartMarketProduct;
  filters: CatalogFilters;
  owned: boolean;
}) {
  const href = {
    pathname: '/marketplace/tools/chart-market' as const,
    query: filtersToQuery(filters, { script: product.id }),
  };

  return (
    <article className={styles.card}>
      <Link className={styles.cardPreview} href={href} aria-label={`Open ${product.title}`}>
        <ChartPreview seed={product.seed} accent={product.accent} label={false} />
        {product.tag && (
          <span
            className={`${styles.tagBadge} ${
              product.tag === 'Bestseller' ? styles.tagBestseller : ''
            }`}
          >
            {product.tag}
          </span>
        )}
        {owned && <span className={styles.ownedBadge}>Owned</span>}
      </Link>

      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>
          <Link href={href}>{product.title}</Link>
        </h3>
        <p className={styles.cardText}>{product.short}</p>

        <div className={styles.creatorRow}>
          <span className={styles.avatar}>{product.creator.slice(0, 1)}</span>
          {product.creator}
          {product.creatorVerified && (
            <>
              <Icon name="checkCircle" size={12} strokeWidth={2.4} className={styles.verified} />
              <span className="tn-sr-only">Verified creator</span>
            </>
          )}
        </div>

        <div className={styles.metaRow}>
          <span className={styles.rating}>
            <Icon name="star" size={11} strokeWidth={2} fill="currentColor" />
            {product.rating.toFixed(1)}
          </span>
          <span>({product.reviews})</span>
          <span className={styles.dot}>·</span>
          <span>{product.type}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.mono}>Pine v{product.pine}</span>
        </div>

        <div className={styles.cardFoot}>
          <span
            className={`${styles.price} ${product.amountCents === 0 ? styles.priceFree : ''}`}
          >
            {formatPrice(product.amountCents)}
          </span>
          <Link className={styles.ghostButton} href={href}>
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}
