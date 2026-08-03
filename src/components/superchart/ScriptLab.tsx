'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { saveScriptAction } from '@/app/actions/scripts';
import { diagnose, statusFor, statusLabel } from '@/lib/superchart/scripts/diagnostics';
import { fixesFor, type ScriptFix } from '@/lib/superchart/scripts/fixes';
import { runPreview, type PreviewOutcome } from '@/lib/superchart/pine/client';
import type { Bar } from '@/lib/superchart/chart-engine/types';
import {
  commitVersion,
  createDocument,
  diffLines,
  diffSummary,
  parseDocument,
  pineForStudies,
  SCRIPT_STORAGE_KEY,
  type ScriptDocument,
} from '@/lib/superchart/scripts/document';
import type { StudyChoice } from '@/lib/superchart/layouts/schema';
import styles from './Superchart.module.css';

/**
 * Script Lab — the Pine v6 half of the workspace.
 *
 * Three things here are load-bearing.
 *
 * The script is generated from the same registry that draws the studies, so it
 * cannot describe a study the chart is not drawing. A script that says
 * something different is worse than none, because it will be pasted somewhere
 * that does run it.
 *
 * Every change writes a version, and any version can be compared with the one
 * on screen. The moment something else can rewrite your work, "what changed"
 * and "give me back what I had" stop being conveniences.
 *
 * And nothing here executes. The diagnostics read the text; they do not
 * evaluate Pine, and the panel says so rather than reporting "valid".
 */

type Props = {
  studies: StudyChoice[];
  symbolTicker: string;
  /** The series the preview runs against — the same bars the chart is drawing. */
  bars: Bar[];
  onPreview: (plots: Array<{ title: string; values: (number | null)[] }> | null) => void;
};

export function ScriptLab({ studies, symbolTicker, bars, onPreview }: Props) {
  const [document, setDocument] = useState<ScriptDocument | null>(null);
  const [compareTo, setCompareTo] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** A repair being considered. Never applied without its diff on screen. */
  const [proposedFix, setProposedFix] = useState<ScriptFix | null>(null);
  const [outcome, setOutcome] = useState<PreviewOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const autosave = useRef<ReturnType<typeof setTimeout> | null>(null);

  const diagnostics = useMemo(
    () => (document ? diagnose(document.source) : []),
    [document]
  );
  const status = useMemo(() => statusFor(diagnostics), [diagnostics]);

  const fixes = useMemo(
    () => (document ? fixesFor(document.source, diagnostics) : []),
    [document, diagnostics]
  );

  /*
   * The diff for a proposed repair, against the source as it stands.
   *
   * Computed rather than described, and shown before anything is applied — the
   * whole point of the flow. A model rewriting a script to make a warning go
   * away is the failure this guards: the warning disappears, the script now
   * does something else, and nobody read the change.
   */
  const fixPreview = useMemo(() => {
    if (!document || !proposedFix) return null;
    const after = proposedFix.apply(document.source);
    const diff = diffLines(document.source, after);
    return { after, diff, summary: diffSummary(diff) };
  }, [document, proposedFix]);

  const comparison = useMemo(() => {
    if (!document || compareTo === null) return null;
    const version = document.versions.find((entry) => entry.number === compareTo);
    if (!version) return null;
    const diff = diffLines(version.source, document.source);
    return { diff, summary: diffSummary(diff), version };
  }, [document, compareTo]);

  /*
   * Restored once, on arrival. A stored document is untrusted input like any
   * other, so it goes through `parseDocument` rather than straight into state.
   *
   * Read in an effect rather than in a lazy initialiser: the server has no
   * localStorage, so reading it during render would produce markup that does
   * not match what hydration builds. The layout restore in the workspace has
   * the same shape for the same reason.
   */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCRIPT_STORAGE_KEY);
      if (!raw) return;
      const restored = parseDocument(JSON.parse(raw));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (restored) setDocument(restored);
    } catch {
      /* Unreadable storage means starting fresh, which is the safe default. */
    }
    // Once, deliberately: a starting point, not a subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Autosave writes the browser copy on a pause, not on every keystroke.
   *
   * The version history is separate and deliberately coarser — a version per
   * keystroke pause would bury the three that mattered under two hundred that
   * did not.
   */
  useEffect(() => {
    if (!document) return;

    if (autosave.current) clearTimeout(autosave.current);
    autosave.current = setTimeout(() => {
      try {
        localStorage.setItem(SCRIPT_STORAGE_KEY, JSON.stringify(document));
      } catch {
        /* Private mode. The account copy is a separate, explicit action. */
      }
    }, 800);

    return () => {
      if (autosave.current) clearTimeout(autosave.current);
    };
  }, [document]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const generate = useCallback(() => {
    const source = pineForStudies(studies);
    const name = `${symbolTicker} studies`;

    setDocument((current) =>
      current
        ? commitVersion(current, {
            source,
            author: 'voyager',
            note: `Regenerated from ${studies.length} stud${studies.length === 1 ? 'y' : 'ies'} on the chart`,
          })
        : createDocument({
            id: `script_${name}`,
            name,
            source,
            author: 'voyager',
            note: 'Generated from the studies on the chart',
          })
    );
    setCompareTo(null);
  }, [studies, symbolTicker]);

  const edit = useCallback((source: string) => {
    setDocument((current) => (current ? { ...current, source } : current));
  }, []);

  /*
   * Runs the script in the worker and puts the result on the chart.
   *
   * The plots are drawn as drafts — dashed, and stripped from any saved layout
   * — because a preview is a proposal about what the script does, not a study
   * somebody added. Pressing Run twice replaces the previous result rather than
   * stacking two.
   */
  const run = useCallback(async () => {
    if (!document || running) return;

    setRunning(true);
    setOutcome(null);

    const result = await runPreview({
      source: document.source,
      bars: {
        open: bars.map((bar) => bar.open),
        high: bars.map((bar) => bar.high),
        low: bars.map((bar) => bar.low),
        close: bars.map((bar) => bar.close),
        volume: bars.map((bar) => bar.volume ?? 0),
        time: bars.map((bar) => bar.time),
      },
    });

    setOutcome(result);
    setRunning(false);

    // A failed run clears whatever the last successful one left on the chart.
    // Leaving old lines up beside a new error is how somebody reads the wrong
    // result as the current one.
    onPreview(result.status === 'ok' ? result.result.plots : null);
  }, [document, bars, running, onPreview]);

  const clearPreview = useCallback(() => {
    setOutcome(null);
    onPreview(null);
  }, [onPreview]);

  /** Applying a repair writes a version, so it can be walked back like any edit. */
  const acceptFix = useCallback(() => {
    if (!fixPreview || !proposedFix) return;

    setDocument((current) =>
      current
        ? commitVersion(current, {
            source: fixPreview.after,
            author: 'voyager',
            note: proposedFix.title,
          })
        : current
    );
    setProposedFix(null);
    setNotice('Applied. The previous version is in the history.');
  }, [fixPreview, proposedFix]);

  /** A version is written on demand, so the history is what somebody chose to keep. */
  const keepVersion = useCallback(() => {
    setDocument((current) =>
      current ? commitVersion(current, { source: current.source, author: 'user', note: 'Edited' }) : current
    );
    setNotice('Version saved in this browser.');
  }, []);

  const saveToAccount = useCallback(async () => {
    if (!document) return;
    const result = await saveScriptAction({ document }).catch(() => null);

    setNotice(
      result?.status === 'saved'
        ? 'Saved to your account.'
        : result?.status === 'sign_in_required'
          ? 'Saved in this browser. An account keeps it anywhere.'
          : 'Saved in this browser.'
    );
  }, [document]);

  /**
   * Export writes a `.pine` file from a blob.
   *
   * A data: URL would be simpler and is capped by the browser at a size a long
   * script can reach. An object URL has no such limit, and it is revoked so the
   * blob does not outlive the click.
   */
  const exportScript = useCallback(() => {
    if (!document) return;

    const blob = new Blob([document.source], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');

    link.href = url;
    link.download = `${document.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pine`;
    link.click();

    URL.revokeObjectURL(url);
    setNotice('Exported as Pine v6.');
  }, [document]);

  if (!document) {
    return (
      <div className={styles.labEmpty}>
        <p className={styles.voyagerNote}>
          Script Lab generates Pine v6 from the studies on the chart, using the same definitions
          that draw them. Nothing here is executed — the checks read the text.
        </p>
        <button className={styles.planApply} onClick={generate}>
          Generate from the chart
        </button>
      </div>
    );
  }

  return (
    <div className={styles.lab}>
      <div className={styles.labEditor}>
        <div className={styles.labBar}>
          <strong className={styles.labName}>{document.name}</strong>
          <span className={`${styles.labStatus} ${styles[`labStatus_${status}`] ?? ''}`}>
            {statusLabel(status)}
          </span>
          <span className={styles.spacer} />
          <button className={styles.labButton} onClick={generate}>
            Regenerate
          </button>
          <button className={styles.labButton} onClick={keepVersion}>
            Keep version
          </button>
          <button className={styles.labButton} onClick={() => void saveToAccount()}>
            Save
          </button>
          <button className={styles.labButton} onClick={() => void run()} disabled={running}>
            {running ? 'Running…' : 'Run preview'}
          </button>
          {outcome && (
            <button className={styles.labButton} onClick={clearPreview}>
              Clear
            </button>
          )}
          <button className={styles.labButton} onClick={exportScript}>
            Export .pine
          </button>
        </div>

        <textarea
          className={styles.labSource}
          value={document.source}
          onChange={(event) => edit(event.target.value)}
          spellCheck={false}
          aria-label="Pine script source"
        />

        {notice && (
          <p className={styles.labNotice} role="status">
            {notice}
          </p>
        )}

        {outcome?.status === 'ok' && (
          <p className={styles.labNotice} role="status">
            Previewing {outcome.result.plots.length} plot
            {outcome.result.plots.length === 1 ? '' : 's'} on the chart, dashed.{' '}
            {outcome.result.operations.toLocaleString('en-US')} operations. Nothing was saved and
            the script was not executed as code — it was interpreted.
          </p>
        )}

        {outcome?.status === 'failed' && (
          <p className={styles.labFailure} role="status">
            <strong>Line {outcome.line}:</strong> {outcome.message}
          </p>
        )}

        {outcome?.status === 'unavailable' && (
          <p className={styles.labFailure} role="status">
            {outcome.message} The script is unchanged, and Export still works.
          </p>
        )}
      </div>

      <div className={styles.labSide}>
        <div className={styles.dataTitle}>
          DIAGNOSTICS ({diagnostics.length})
        </div>

        {diagnostics.length === 0 ? (
          <p className={styles.voyagerNote}>
            Nothing here was recognised as a problem. That is not the same as verified — these
            checks read the source, they do not run Pine.
          </p>
        ) : (
          diagnostics.map((item, index) => (
            <div key={`${item.line}-${index}`} className={styles.diagnostic}>
              <span className={`${styles.diagSeverity} ${styles[`diag_${item.severity}`]}`}>
                {item.severity}
              </span>
              <span>
                <span className={styles.diagLine}>Line {item.line}</span>
                <span className={styles.referenceDetail}>{item.message}</span>
                {fixes
                  .filter((fix) => fix.diagnostic === item)
                  .map((fix) => (
                    <button
                      key={fix.title}
                      className={styles.fixButton}
                      onClick={() => setProposedFix(fix)}
                    >
                      Fix with Voyager
                    </button>
                  ))}
              </span>
            </div>
          ))
        )}

        {proposedFix && fixPreview && (
          <div className={styles.fixCard}>
            <div className={styles.planHead}>
              <span className={styles.planBadge}>Fix</span>
              <strong className={styles.planTitle}>{proposedFix.title}</strong>
            </div>

            <p className={styles.referenceDetail}>{proposedFix.detail}</p>

            <pre className={styles.diffBlock}>
              {fixPreview.diff
                .filter((line) => line.kind !== 'same')
                .map((line, index) => (
                  <div
                    key={index}
                    className={line.kind === 'added' ? styles.diffAdded : styles.diffRemoved}
                  >
                    {line.kind === 'added' ? '+' : '−'} {line.text}
                  </div>
                ))}
            </pre>

            <div className={styles.planActions}>
              <button className={styles.planApply} onClick={acceptFix}>
                Apply this change
              </button>
              <button className={styles.planCancel} onClick={() => setProposedFix(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className={styles.dataTitle} style={{ marginTop: 14 }}>
          VERSIONS ({document.versions.length})
        </div>

        {[...document.versions].reverse().map((version) => (
          <button
            key={version.number}
            className={`${styles.versionRow} ${compareTo === version.number ? styles.versionOn : ''}`}
            onClick={() => setCompareTo(compareTo === version.number ? null : version.number)}
          >
            <span className={styles.versionNumber}>v{version.number}</span>
            <span>
              <span className={styles.referenceTitle}>{version.note}</span>
              <span className={styles.referenceDetail}>
                {version.author === 'voyager' ? 'Voyager' : 'You'} ·{' '}
                {version.createdAt.slice(11, 16)}
              </span>
            </span>
          </button>
        ))}

        {comparison && (
          <>
            <div className={styles.dataTitle} style={{ marginTop: 14 }}>
              v{comparison.version.number} → now
              <span className={styles.voyagerSize}>
                +{comparison.summary.added} −{comparison.summary.removed}
              </span>
            </div>

            <pre className={styles.diffBlock}>
              {comparison.diff.map((line, index) => (
                <div
                  key={index}
                  className={
                    line.kind === 'added'
                      ? styles.diffAdded
                      : line.kind === 'removed'
                        ? styles.diffRemoved
                        : styles.diffSame
                  }
                >
                  {line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' '} {line.text}
                </div>
              ))}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
