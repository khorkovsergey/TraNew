import { completeDemoPurchase } from '@/app/actions/chartMarket';
import { formatPrice, type ChartMarketProduct } from '@/content/chartMarket';
import { Icon } from '@/components/ui/Icon';
import { Link } from '@/i18n/navigation';
import { filtersToQuery, filtersToSearch, type CatalogFilters } from '@/lib/chartMarket/filters';
import { ChartPreview } from './ChartPreview';
import styles from './Tools.module.css';

/**
 * The three steps after "Buy now", each of them a URL.
 *
 * The checkout is not a modal held in React state. It is `?step=checkout` on the
 * product page, rendered by the server, which is what lets somebody sign in and
 * come straight back to it: the intent is the address, and an address survives a
 * round trip through the auth pages. A modal would have to be rebuilt from a
 * remembered flag, and the flag is the part that gets lost.
 *
 * Nothing here takes a card. There is no payment provider connected to this
 * portal, the notice says so above the button, and the button says what it does.
 */

const PATH = '/marketplace/tools/chart-market' as const;

type Props = {
  product: ChartMarketProduct;
  filters: CatalogFilters;
  signedIn: boolean;
  viewerEmail: string | null;
};

function closeHref(filters: CatalogFilters, product: ChartMarketProduct) {
  return { pathname: PATH, query: filtersToQuery(filters, { script: product.id }) };
}

/**
 * The gate.
 *
 * Shown instead of the checkout when nobody is signed in — not before it, and
 * never in front of the catalogue or a product page. The `next` parameter is
 * this exact URL, so signing in lands back on the checkout for the same script.
 */
export function AuthGate({ product, filters }: Omit<Props, 'signedIn' | 'viewerEmail'>) {
  const intent = `/en${PATH}${filtersToSearch(filters, { script: product.id, step: 'checkout' })}`;

  return (
    <div className={styles.overlay}>
      <div
        className={`${styles.dialog} ${styles.dialogNarrow}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tn-auth-gate-title"
      >
        <div className={styles.dialogBody}>
          <div className={styles.dialogTitle} id="tn-auth-gate-title">
            Sign in to complete your purchase
          </div>
          <p className={styles.emptyText} style={{ margin: '9px 0 0', textAlign: 'left' }}>
            Your selection is kept. You will come straight back to the checkout for{' '}
            <b>{product.title}</b>.
          </p>

          <Link
            className={styles.primaryButton}
            href={{ pathname: '/sign-in', query: { next: intent } }}
          >
            Sign in
          </Link>
          <Link
            className={styles.secondaryButton}
            href={{ pathname: '/sign-up', query: { next: intent } }}
          >
            Create an account
          </Link>
          <Link className={styles.secondaryButton} href={closeHref(filters, product)}>
            Keep browsing instead
          </Link>

          <p className={styles.fineprint}>
            Browsing Chart Market never requires an account — only buying does.
          </p>
        </div>
      </div>
    </div>
  );
}

export function CheckoutDialog({ product, filters, viewerEmail }: Omit<Props, 'signedIn'>) {
  const price = formatPrice(product.amountCents);

  return (
    <div className={styles.overlay}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tn-checkout-title"
      >
        <div className={styles.dialogHead}>
          <div>
            <div className={styles.dialogTitle} id="tn-checkout-title">
              Checkout
            </div>
            {viewerEmail && <div className={styles.dialogSub}>Signed in as {viewerEmail}</div>}
          </div>
          <Link
            className={styles.dialogClose}
            href={closeHref(filters, product)}
            aria-label="Close checkout"
          >
            <Icon name="close" size={15} strokeWidth={2.4} />
          </Link>
        </div>

        <div className={styles.dialogBody}>
          <div className={styles.lineItem}>
            <ChartPreview
              seed={product.seed}
              accent={product.accent}
              bars={14}
              label={false}
              className={styles.lineItemPreview}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={styles.reviewName}>{product.title}</div>
              <div className={styles.identityMeta}>
                {product.creator} · {product.type} · Pine Script v{product.pine}
              </div>
            </div>
          </div>

          <div className={styles.totals}>
            <div className={styles.totalRow}>
              <span className={styles.metaKey}>Script licence</span>
              <span>{price}</span>
            </div>
            <div className={styles.totalRow}>
              <span className={styles.metaKey}>VAT</span>
              <span className={styles.metaKey}>Calculated by the provider</span>
            </div>
            <div className={`${styles.totalRow} ${styles.totalRowFinal}`}>
              <span>Total</span>
              <span className={styles.totalFigure}>{price}</span>
            </div>
          </div>

          {/*
            * No payment methods listed.
            *
            * The mockup offers card, PayPal and a TNW balance. None of the three
            * exists here, and a radio group of three ways to not pay is a longer
            * way of saying the same thing this notice says.
            */}
          <div className={styles.notice}>
            <Icon name="alert" size={15} strokeWidth={2} />
            <span>
              <b>Demo checkout.</b> No payment provider is connected. Nothing is charged, no card
              details are collected or stored, and the entitlement this creates is recorded as a
              demo purchase.
            </span>
          </div>

          <form action={completeDemoPurchase}>
            <input type="hidden" name="script" value={product.id} />
            <button className={styles.primaryButton} type="submit">
              Unlock as a demo purchase
            </button>
          </form>

          <p className={styles.fineprint}>
            Licensed for your own charts. Redistributing the source is not permitted.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PurchaseDone({ product, filters }: Omit<Props, 'signedIn' | 'viewerEmail'>) {
  return (
    <div className={styles.overlay}>
      <div
        className={`${styles.dialog} ${styles.dialogNarrow}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tn-done-title"
      >
        <div className={styles.doneBody}>
          <span className={styles.doneIcon}>
            <Icon name="check" size={30} strokeWidth={3} />
          </span>
          <div className={styles.doneTitle} id="tn-done-title">
            Script unlocked
          </div>
          <p className={styles.doneText}>
            <b>{product.title}</b> is in My Purchases with its full source, and the source panel on
            this page is open.
          </p>

          <Link className={styles.blueButton} href="/supercharts">
            Add it to a chart
          </Link>
          <Link className={styles.secondaryButton} href="/account/purchases">
            Go to My Purchases
          </Link>
          <Link className={styles.secondaryButton} href={closeHref(filters, product)}>
            Back to the script
          </Link>
        </div>
      </div>
    </div>
  );
}
