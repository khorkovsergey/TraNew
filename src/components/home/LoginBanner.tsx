'use client';

import { useTranslations } from 'next-intl';
import { useLoginModal } from '@/components/shell/LoginModalProvider';
import styles from './Home.module.css';

export function LoginBanner() {
  const t = useTranslations('home');
  const { openLogin } = useLoginModal();

  return (
    <div className={styles.banner}>
      <div className={styles.bannerLeft}>
        <div className={styles.bannerMark} aria-hidden="true">
          TN
        </div>
        <div>
          <div className={styles.bannerTitle}>{t('bannerTitle')}</div>
          <div className={styles.bannerSub}>{t('bannerSub')}</div>
        </div>
      </div>
      <button className={styles.bannerCta} onClick={openLogin}>
        {t('bannerCta')}
      </button>
    </div>
  );
}
