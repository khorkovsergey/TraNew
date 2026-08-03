'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  duplicate,
  exportWorkspace,
  filterWorkspaces,
  KIND_LABEL,
  remove,
  rename,
  togglePin,
  WORKSPACE_KINDS,
  type SavedWorkspace,
  type WorkspaceKind,
} from '@/lib/voyager/workspace/record';
import styles from './VoyagerWorkspace.module.css';

/**
 * The library of saved work.
 *
 * Rows are work somebody did, so the row says what was asked as well as what it
 * was called — a list of names alone is a list nobody can search from memory,
 * and the search here reads the request for the same reason.
 *
 * Opening a workspace replays its request rather than restoring a picture of
 * the canvas, which is why the row carries the question and not a thumbnail.
 */

type Props = {
  workspaces: SavedWorkspace[];
  onChange: (next: SavedWorkspace[]) => void;
  onOpen: (workspace: SavedWorkspace) => void;
  onClose: () => void;
};

type Filter = WorkspaceKind | 'all' | 'pinned';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pinned', label: 'Pinned' },
  ...WORKSPACE_KINDS.map((kind) => ({ id: kind as Filter, label: KIND_LABEL[kind] })),
];

export function WorkspaceLibrary({ workspaces, onChange, onOpen, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const rows = useMemo(
    () => filterWorkspaces(workspaces, query, filter),
    [workspaces, query, filter]
  );

  /**
   * Export writes a file from a blob.
   *
   * An object URL rather than a data one: a long workspace can exceed what a
   * data URL is allowed to carry, and it is revoked so the blob does not
   * outlive the click.
   */
  const download = (workspace: SavedWorkspace) => {
    const blob = new Blob([exportWorkspace(workspace)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${workspace.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.confirmScrim} role="dialog" aria-modal="true" aria-label="Your workspaces">
      <div className={styles.libraryCard}>
        <header className={styles.libraryHead}>
          <h2 className={styles.confirmTitle}>Your workspaces</h2>
          <span className={styles.spacer} />
          <button className={styles.noticeClose} onClick={onClose} title="Close" aria-label="Close">
            <Icon name="close" size={14} />
          </button>
        </header>

        <input
          className={styles.librarySearch}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or by what you asked"
          aria-label="Search your workspaces"
        />

        <div className={styles.filterRow}>
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

        <div className={styles.libraryRows}>
          {rows.length === 0 ? (
            <p className={styles.zoneStubNote}>
              {workspaces.length === 0
                ? 'Nothing saved yet. Your first request creates a workspace, and saving it puts it here.'
                : 'Nothing matches that. Try a word from the question you asked.'}
            </p>
          ) : (
            rows.map((workspace) => (
              <div key={workspace.id} className={styles.libraryRow}>
                <div className={styles.libraryMain}>
                  {renaming === workspace.id ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        onChange(rename(workspaces, workspace.id, draftName));
                        setRenaming(null);
                      }}
                    >
                      <input
                        className={styles.librarySearch}
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        aria-label="New name"
                        autoFocus
                      />
                    </form>
                  ) : (
                    <button className={styles.libraryName} onClick={() => onOpen(workspace)}>
                      {workspace.name}
                      {workspace.pinned && <span className={styles.pinnedBadge}>Pinned</span>}
                      {/* Says whose name it is: a suggestion is not a decision. */}
                      {workspace.autoNamed && (
                        <span className={styles.namedBadge}>Named by Voyager</span>
                      )}
                    </button>
                  )}

                  <span className={styles.libraryAsked}>{workspace.request}</span>
                  <span className={styles.libraryMeta}>
                    {KIND_LABEL[workspace.kind]}
                    {workspace.summary ? ` · ${workspace.summary}` : ''}
                    {workspace.updatedAt ? ` · ${workspace.updatedAt.slice(0, 10)}` : ''}
                  </span>
                </div>

                <div className={styles.libraryActions}>
                  <button className={styles.historyUndo} onClick={() => onOpen(workspace)}>
                    Open
                  </button>
                  <button
                    className={styles.historyUndo}
                    onClick={() => {
                      setRenaming(workspace.id);
                      setDraftName(workspace.name);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className={styles.historyUndo}
                    onClick={() => onChange(togglePin(workspaces, workspace.id))}
                    aria-pressed={workspace.pinned}
                  >
                    {workspace.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    className={styles.historyUndo}
                    onClick={() =>
                      onChange(duplicate(workspaces, workspace.id, new Date().toISOString()))
                    }
                  >
                    Duplicate
                  </button>
                  <button className={styles.historyUndo} onClick={() => download(workspace)}>
                    Export
                  </button>
                  <button
                    className={styles.historyUndo}
                    onClick={() => onChange(remove(workspaces, workspace.id))}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
