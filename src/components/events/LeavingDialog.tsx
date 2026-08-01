'use client';

import { EXTERNAL_LINK_ATTRS } from '@/lib/events/externalUrl';
import { Dialog } from './Dialog';
import styles from './Events.module.css';

/**
 * Shown before sending someone to a domain nobody here has vetted.
 *
 * It names the domain in plain text rather than only linking it, because the
 * thing worth checking is where the link goes, and a link is the one element
 * whose destination you cannot read. The wording says what TradingNew is not
 * doing — handling the registration or the money — since that is precisely the
 * assumption a familiar-looking flow would create.
 */

export function LeavingDialog({
  domain,
  url,
  onClose,
}: {
  domain: string;
  url: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      title="You are leaving TradingNew"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Stay here
          </button>
          <a
            className={styles.primary}
            href={url}
            target={EXTERNAL_LINK_ATTRS.target}
            rel={EXTERNAL_LINK_ATTRS.rel}
            onClick={onClose}
          >
            Continue to {domain}
          </a>
        </>
      }
    >
      <div className={`${styles.notice} ${styles.noticeWarn}`}>
        <p style={{ margin: 0 }}>
          This event is run by an organizer TradingNew has not verified. Registration, payment and
          any personal details you enter are handled entirely by <strong>{domain}</strong> under
          their own terms.
        </p>
      </div>

      <p className={styles.dialogHint}>
        We never process tickets or take payment for external events. If the site asks you for
        anything that looks unrelated to attending, close it and report the listing.
      </p>
    </Dialog>
  );
}
