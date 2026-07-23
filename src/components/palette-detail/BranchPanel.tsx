'use client';

import { useState, useTransition } from 'react';
import type { PaletteSnapshot } from '@/lib/versioning';
import { editSwatchAction, forkBranchAction } from '@/app/palettes/actions';
import styles from './palette-detail.module.css';

interface BranchPanelProps {
  readonly paletteId: string;
  readonly branchName: string;
  readonly snapshot: PaletteSnapshot;
  readonly onMutated: () => void;
}

export function BranchPanel({ paletteId, branchName, snapshot, onMutated }: BranchPanelProps) {
  const [forkName, setForkName] = useState('');
  const [editingToken, setEditingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFork() {
    if (forkName.trim() === '') return;
    setError(null);
    startTransition(async () => {
      try {
        await forkBranchAction(paletteId, branchName, forkName.trim());
        setForkName('');
        onMutated();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });
  }

  function handleEditCommit(token: string, hex: string) {
    setEditingToken(null);
    if (hex === snapshot[token]) return;
    setError(null);
    startTransition(async () => {
      try {
        await editSwatchAction(paletteId, branchName, token, hex);
        onMutated();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });
  }

  const tokens = Object.keys(snapshot).sort();

  return (
    <div className={styles.branch}>
      <div className={styles.branchHeader}>
        <span className={styles.branchName}>{branchName}</span>
        <div className={styles.forkForm}>
          <input
            className={styles.input}
            placeholder="new branch name"
            value={forkName}
            onChange={(event) => setForkName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleFork()}
          />
          <button
            type="button"
            className={styles.smallButton}
            onClick={handleFork}
            disabled={isPending || forkName.trim() === ''}
          >
            fork
          </button>
        </div>
      </div>

      <div className={styles.swatchGrid}>
        {tokens.map((token) =>
          editingToken === token ? (
            <div key={token} className={styles.swatchEditing}>
              <input
                className={styles.swatchInput}
                defaultValue={snapshot[token]}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleEditCommit(token, event.currentTarget.value);
                  }
                  if (event.key === 'Escape') setEditingToken(null);
                }}
                onBlur={(event) => handleEditCommit(token, event.currentTarget.value)}
              />
            </div>
          ) : (
            <button
              key={token}
              type="button"
              className={styles.swatch}
              style={{ background: snapshot[token] }}
              onClick={() => setEditingToken(token)}
              title="Click to edit"
            >
              {token}
            </button>
          )
        )}
      </div>

      {error !== null && <p className={styles.error}>⚠ {error}</p>}
    </div>
  );
}
