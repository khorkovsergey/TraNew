'use client';

import { useState, useTransition } from 'react';
import { saveVoyagerSettings } from '@/app/actions/voyagerSettings';
import {
  CITATION_OPTIONS,
  DEPTH_OPTIONS,
  MAX_CUSTOM_SOURCES,
  SOURCE_OPTIONS,
  URL_REFUSALS,
  checkUrl,
  type VoyagerSettings as Settings,
} from '@/lib/voyager/settings';
import styles from './Account.module.css';

/**
 * What Voyager may read, and how it should answer.
 *
 * Saved on change rather than behind a Save button. Every control here is one
 * decision that stands on its own — there is no half-filled state to protect,
 * and a settings screen that loses a toggle because somebody navigated away is
 * a settings screen people stop trusting.
 *
 * The failure is shown, not swallowed. A toggle that snaps back with no
 * explanation reads as a broken switch; one that says the write failed is a
 * thing somebody can act on.
 */

type Props = { initial: Settings };

export function VoyagerSettings({ initial }: Props) {
  const [settings, setSettings] = useState<Settings>(initial);
  const [draft, setDraft] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, startSaving] = useTransition();

  const commit = (next: Settings) => {
    const previous = settings;
    setSettings(next);
    setFailed(false);

    startSaving(async () => {
      const result = await saveVoyagerSettings(next).catch(() => null);
      if (!result || result.status !== 'saved') {
        // Put it back. A screen showing a setting the server does not have is
        // worse than one that admits the write did not land.
        setSettings(previous);
        setFailed(true);
        return;
      }
      // The server is the authority on what was stored — it drops any domain
      // that failed the second check, and the list has to show what it kept.
      setSettings(result.settings);
    });
  };

  const toggleSource = (id: (typeof SOURCE_OPTIONS)[number]['id']) => {
    const on = settings.sources.includes(id);
    commit({
      ...settings,
      sources: on ? settings.sources.filter((s) => s !== id) : [...settings.sources, id],
    });
  };

  const addDomain = () => {
    const verdict = checkUrl(draft, settings.customSources);
    if (!verdict.ok) {
      setUrlError(URL_REFUSALS[verdict.reason]);
      return;
    }
    if (settings.customSources.length >= MAX_CUSTOM_SOURCES) {
      setUrlError(`That is the ${MAX_CUSTOM_SOURCES}-domain limit.`);
      return;
    }

    setUrlError(null);
    setDraft('');
    commit({ ...settings, customSources: [...settings.customSources, verdict.domain] });
  };

  return (
    <div className={styles.stack}>
      {failed && (
        <p className={styles.note} role="status">
          That change did not save. Check your connection and try it again.
        </p>
      )}

      <h2 className={styles.h2}>What Voyager may read</h2>
      <p className={styles.note}>
        Turning a source off removes it from answers and from the Sources tab. It does not hide
        anything Voyager already told you.
      </p>

      {SOURCE_OPTIONS.map((option) => {
        const on = settings.sources.includes(option.id);
        return (
          <div className={styles.row} key={option.id}>
            <div>
              <strong>{option.label}</strong>
              <span className={styles.note}>{option.detail}</span>
            </div>
            <button
              className={`${styles.toggle} ${on ? styles.togglePurple : ''}`}
              role="switch"
              aria-checked={on}
              aria-label={option.label}
              disabled={saving}
              onClick={() => toggleSource(option.id)}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>
        );
      })}

      <h2 className={styles.h2}>Your own sources</h2>
      <p className={styles.note}>
        Publications Voyager should prefer when it looks something up. Stored as a domain, so a
        link to one article means the whole publication rather than that one page.
      </p>

      <div className={styles.row}>
        <input
          className={styles.input}
          value={draft}
          placeholder="ft.com"
          aria-label="Add a source domain"
          onChange={(event) => {
            setDraft(event.target.value);
            setUrlError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addDomain();
            }
          }}
        />
        <button className={styles.primary} onClick={addDomain} disabled={saving}>
          Add
        </button>
      </div>

      {urlError && (
        <p className={styles.note} role="alert">
          {urlError}
        </p>
      )}

      {settings.customSources.length === 0 ? (
        <p className={styles.note}>Nothing added. Voyager uses the sources above.</p>
      ) : (
        settings.customSources.map((domain) => (
          <div className={styles.row} key={domain}>
            <strong>{domain}</strong>
            <button
              className={styles.primary}
              disabled={saving}
              onClick={() =>
                commit({
                  ...settings,
                  customSources: settings.customSources.filter((d) => d !== domain),
                })
              }
            >
              Remove
            </button>
          </div>
        ))
      )}

      <h2 className={styles.h2}>How answers should read</h2>

      <div className={styles.row}>
        <div>
          <strong>Depth</strong>
          <span className={styles.note}>
            {DEPTH_OPTIONS.find((o) => o.id === settings.depth)?.detail}
          </span>
        </div>
        <div>
          {DEPTH_OPTIONS.map((option) => (
            <button
              key={option.id}
              className={`${styles.primary} ${
                settings.depth === option.id ? styles.chipPurple : styles.chipGrey
              }`}
              aria-pressed={settings.depth === option.id}
              disabled={saving}
              onClick={() => commit({ ...settings, depth: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <strong>Sources in answers</strong>
          <span className={styles.note}>
            {CITATION_OPTIONS.find((o) => o.id === settings.citations)?.detail}
          </span>
        </div>
        <div>
          {CITATION_OPTIONS.map((option) => (
            <button
              key={option.id}
              className={`${styles.primary} ${
                settings.citations === option.id ? styles.chipPurple : styles.chipGrey
              }`}
              aria-pressed={settings.citations === option.id}
              disabled={saving}
              onClick={() => commit({ ...settings, citations: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <strong>Remember across chats</strong>
          <span className={styles.note}>
            What you tell Voyager in one conversation carries to the next. Off means each chat
            starts from nothing.
          </span>
        </div>
        <button
          className={`${styles.toggle} ${settings.remember ? styles.togglePurple : ''}`}
          role="switch"
          aria-checked={settings.remember}
          aria-label="Remember across chats"
          disabled={saving}
          onClick={() => commit({ ...settings, remember: !settings.remember })}
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>
    </div>
  );
}
