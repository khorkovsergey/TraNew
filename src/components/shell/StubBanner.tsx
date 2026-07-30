import { anyStubActive, stubSummary } from '@/lib/stubMode';
import styles from './StubBanner.module.css';

/**
 * States plainly which integrations are simulated. A stub that looks like the real
 * thing is the failure mode worth designing against: anyone testing the site should
 * know at a glance that no email left the building.
 */
export function StubBanner() {
  if (!anyStubActive()) return null;

  return (
    <div className={styles.banner} role="status">
      <span className={styles.label}>Demo integrations</span>
      <span className={styles.text}>{stubSummary().join(' ')}</span>
    </div>
  );
}
