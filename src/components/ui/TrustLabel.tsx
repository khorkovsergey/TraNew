import { useTranslations } from 'next-intl';
import type { TrustLabel as TrustLabelKind } from '@/content/types';
import styles from './TrustLabel.module.css';

/**
 * The content-type badge required on every content block. Colour carries meaning:
 * green for data and facts, blue for analysis and technical readings, purple for
 * AI, amber for community opinion, grey for sponsored.
 */
export function TrustLabel({ kind, small = false }: { kind: TrustLabelKind; small?: boolean }) {
  const t = useTranslations('labels');

  return (
    <span className={`${styles.label} ${styles[kind]} ${small ? styles.small : ''}`}>
      {t(kind)}
    </span>
  );
}
