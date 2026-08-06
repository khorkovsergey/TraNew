'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from '@/i18n/navigation';
import styles from './SearchForm.module.css';

/**
 * The one search box, used in two places: the header overlay and the empty
 * research page.
 *
 * Both submit to `/research?q=…`, so the question is in the URL and the page can
 * answer it. The empty page used to show a finished answer with sources beside
 * a heading that admitted no question had been asked — on a product about
 * telling facts from opinions, an answer to a question nobody asked is the worst
 * thing on the screen.
 */

const SUGGESTIONS: Array<{ label: string; icon: 'trendUp' | 'layers' | 'percent' | 'scale' }> = [
  { label: 'What is an ETF?', icon: 'layers' },
  { label: 'Compare ETFs, bonds and cash deposits', icon: 'scale' },
  { label: 'What does inflation do to savings?', icon: 'percent' },
  { label: 'Why are markets falling?', icon: 'trendUp' },
];

export function SearchForm({
  autoFocus = false,
  initial = '',
  onNavigate,
}: {
  autoFocus?: boolean;
  initial?: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  const go = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    onNavigate?.();
    router.push({ pathname: '/research', query: { q: trimmed } });
  };

  return (
    <div className={styles.wrap}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          go(value);
        }}
        role="search"
      >
        <Icon name="search" size={18} strokeWidth={2.2} className={styles.glass} />
        <input
          ref={input}
          className={styles.input}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search a company, or ask a question"
          aria-label="Search TradingNew"
        />
        <button className={styles.submit} type="submit" disabled={!value.trim()}>
          Search
        </button>
      </form>

      <div className={styles.suggestLabel}>Or start from one of these</div>
      <div className={styles.suggestions}>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.label}
            className={styles.suggestion}
            onClick={() => go(suggestion.label)}
          >
            <Icon name={suggestion.icon} size={14} strokeWidth={2} className={styles.glass} />
            {suggestion.label}
          </button>
        ))}
      </div>
    </div>
  );
}
