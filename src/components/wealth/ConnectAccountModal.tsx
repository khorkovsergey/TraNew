'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  CONNECTION_PROVIDERS,
  CONNECTION_SYNC_STEPS,
  CONSENT_NOTE,
  defaultSelection,
  formatSigned,
  importTotal,
  NEVER_ABLE_TO,
  READ_ONLY_NOTE,
  selectedCount,
  VOYAGER_CONSENT_NOTE,
  type ConnectionProvider,
  type ProviderCategory,
} from '@/content/wealthConnections';
import styles from './Connections.module.css';

/**
 * Connecting an account, in three steps.
 *
 * The consent screen is the point of the whole flow. What a connection can
 * never do is stated as prominently as what it can, in a list that is fixed for
 * every provider and never collapsed, moved below the fold or shrunk — it is
 * what makes handing over a brokerage account a reasonable thing to do.
 *
 * Voyager consent is a separate checkbox, because connecting an account and
 * feeding it to the assistant are two decisions. Withdrawing the second must
 * not break the first.
 *
 * Nothing enters the Wealth Record without an explicit confirm, and the review
 * step arrives with the duplicate already unticked and explained rather than
 * silently double-counted.
 *
 * There is no aggregator behind this: no OAuth, no credentials, no live data.
 */

type Step = 'picker' | 'consent' | 'syncing' | 'review';

type Props = {
  /** Ids already connected; those rows are shown but not selectable. */
  connectedIds: string[];
  onClose: () => void;
  onConnected: (provider: ConnectionProvider, accountIds: string[], total: number) => void;
};

const FILTERS: Array<{ id: ProviderCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'bank', label: 'Banks' },
  { id: 'broker', label: 'Brokers' },
  { id: 'exchange', label: 'Crypto' },
];

export function ConnectAccountModal({ connectedIds, onClose, onConnected }: Props) {
  const [step, setStep] = useState<Step>('picker');
  const [filter, setFilter] = useState<ProviderCategory | 'all'>('all');
  const [provider, setProvider] = useState<ConnectionProvider | null>(null);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [voyagerConsent, setVoyagerConsent] = useState(true);
  const [progress, setProgress] = useState(0);

  const dialog = useRef<HTMLDivElement>(null);

  /*
   * Escape closes, and focus goes into the dialog on arrival. A modal that
   * cannot be dismissed from the keyboard is a modal that traps somebody in the
   * middle of a decision about their money.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);
    dialog.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /*
   * The sync checklist. Cleared on unmount and whenever the step changes, so
   * closing the dialog mid-sync cannot leave a timer advancing state that no
   * longer has a screen.
   */
  useEffect(() => {
    if (step !== 'syncing') return;

    if (progress >= CONNECTION_SYNC_STEPS.length) {
      const done = setTimeout(() => setStep('review'), 320);
      return () => clearTimeout(done);
    }

    const timer = setTimeout(() => setProgress((value) => value + 1), 620);
    return () => clearTimeout(timer);
  }, [step, progress]);

  const visible = useMemo(
    () => CONNECTION_PROVIDERS.filter((item) => filter === 'all' || item.kind === filter),
    [filter]
  );

  const pick = useCallback((chosen: ConnectionProvider) => {
    setProvider(chosen);
    // From the fixtures, not all-on: the duplicate and the demo account arrive
    // unticked with the reason beside them.
    setSelection(defaultSelection(chosen));
    setStep('consent');
  }, []);

  const total = provider ? importTotal(provider, selection) : 0;
  const count = provider ? selectedCount(provider, selection) : 0;

  const stepLine =
    step === 'picker'
      ? 'Step 1 of 3 · choose a provider'
      : step === 'consent'
        ? 'Step 2 of 3 · review permissions'
        : step === 'syncing'
          ? 'Step 3 of 3 · importing'
          : 'Step 3 of 3 · choose what to import';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Connect an account"
        tabIndex={-1}
        ref={dialog}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHead}>
          <div>
            <h2 className={styles.dialogTitle}>
              {step === 'picker'
                ? 'Connect an account'
                : step === 'consent'
                  ? `Authorise ${provider?.name}`
                  : step === 'syncing'
                    ? `Importing from ${provider?.name}`
                    : `${provider?.name} connected`}
            </h2>
            <p className={styles.stepLine}>{stepLine}</p>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close" title="Close">
            <Icon name="close" size={15} />
          </button>
        </header>

        <div className={styles.dialogBody}>
          {step === 'picker' && (
            <>
              {/* Looks like search and is not; labelled so nobody types into it
                  expecting results. */}
              <p className={styles.searchStub}>
                <Icon name="search" size={15} />
                Search for your bank, broker or exchange
              </p>

              <div className={styles.filterRow} role="group" aria-label="Provider category">
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    className={`${styles.filterChip} ${filter === item.id ? styles.filterChipOn : ''}`}
                    aria-pressed={filter === item.id}
                    onClick={() => setFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className={styles.providerList}>
                {visible.map((item) => {
                  const already = connectedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      className={`${styles.providerRow} ${already ? styles.providerRowDone : ''}`}
                      disabled={already}
                      onClick={() => pick(item)}
                    >
                      <span className={styles.mark} style={{ background: item.color }}>
                        {item.mark}
                      </span>
                      <span className={styles.providerText}>
                        <span className={styles.providerName}>{item.name}</span>
                        <span className={styles.providerSub}>{item.sub}</span>
                      </span>
                      <span className={styles.tagChip}>{already ? 'Connected' : item.tag}</span>
                    </button>
                  );
                })}
              </div>

              <p className={styles.footNote}>{READ_ONLY_NOTE}</p>
            </>
          )}

          {step === 'consent' && provider && (
            <>
              <div className={styles.identity}>
                <span className={styles.markLarge} style={{ background: provider.color }}>
                  {provider.mark}
                </span>
                <span>
                  <span className={styles.providerName}>{provider.name}</span>
                  <span className={styles.providerSub}>{provider.sub}</span>
                </span>
              </div>

              <h3 className={styles.consentLabel}>TradingNew will be able to</h3>
              <ul className={styles.consentList}>
                {provider.scopes.map((scope) => (
                  <li key={scope} className={styles.consentRow}>
                    <Icon name="check" size={15} strokeWidth={2.5} className={styles.canIcon} />
                    {scope}
                  </li>
                ))}
              </ul>

              {/*
                The list that makes this acceptable. Fixed for every provider,
                never collapsed and never below the fold.
              */}
              <h3 className={styles.consentLabel}>It will never be able to</h3>
              <ul className={styles.consentList}>
                {NEVER_ABLE_TO.map((item) => (
                  <li key={item} className={styles.consentRow}>
                    <span className={styles.cannotIcon} aria-hidden="true">
                      ✕
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              {/* A second decision, and separable from the first. */}
              <label className={styles.voyagerConsent}>
                <input
                  type="checkbox"
                  checked={voyagerConsent}
                  onChange={(event) => setVoyagerConsent(event.target.checked)}
                />
                <span>{VOYAGER_CONSENT_NOTE}</span>
              </label>

              <p className={styles.footNote}>{CONSENT_NOTE}</p>

              <div className={styles.dialogActions}>
                <button className={styles.secondaryButton} onClick={() => setStep('picker')}>
                  Back
                </button>
                <button
                  className={styles.primaryButton}
                  onClick={() => {
                    setProgress(0);
                    setStep('syncing');
                  }}
                >
                  Authorise with {provider.name}
                </button>
              </div>
            </>
          )}

          {step === 'syncing' && provider && (
            <div className={styles.syncing}>
              <span className={styles.spinner} aria-hidden="true" />
              {/* The spinner is decoration; this line is the status. */}
              <p className={styles.syncStatus} role="status">
                {CONNECTION_SYNC_STEPS[Math.min(progress, CONNECTION_SYNC_STEPS.length - 1)]}
              </p>

              <ul className={styles.syncList}>
                {CONNECTION_SYNC_STEPS.map((label, index) => (
                  <li key={label} className={index < progress ? styles.syncDone : styles.syncPending}>
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 'review' && provider && (
            <>
              <p className={styles.connectedStrip}>
                {provider.name} connected · {provider.accounts.length} accounts found
              </p>

              <h3 className={styles.reviewHeading}>
                Choose what enters your Wealth Record. Nothing is added until you confirm.
              </h3>

              <div className={styles.accountList}>
                {provider.accounts.map((account) => {
                  const checked = Boolean(selection[account.id]);
                  return (
                    <label
                      key={account.id}
                      className={`${styles.accountRow} ${checked ? styles.accountRowOn : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setSelection((current) => ({
                            ...current,
                            [account.id]: event.target.checked,
                          }))
                        }
                      />
                      <span className={styles.accountText}>
                        <span className={styles.accountName}>{account.name}</span>
                        <span className={styles.accountSub}>{account.sub}</span>
                        {/* Why it arrived unticked, on the row rather than in a
                            note somebody has to connect to it. */}
                        {account.note && <span className={styles.accountNote}>{account.note}</span>}
                      </span>
                      <span className={`${styles.accountValue} tn-num`}>{account.value}</span>
                    </label>
                  );
                })}
              </div>

              {provider.duplicate && <p className={styles.caveat}>{provider.duplicate}</p>}

              <div className={styles.dialogActions}>
                <span className={styles.totalBlock}>
                  <span className={styles.totalLabel}>Adds to Net Wealth</span>
                  <span className={`${styles.totalValue} tn-num`}>{formatSigned(total)}</span>
                </span>

                <button
                  className={styles.primaryButton}
                  disabled={count === 0}
                  onClick={() =>
                    onConnected(
                      provider,
                      provider.accounts.filter((a) => selection[a.id]).map((a) => a.id),
                      total
                    )
                  }
                >
                  Import {count} account{count === 1 ? '' : 's'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
