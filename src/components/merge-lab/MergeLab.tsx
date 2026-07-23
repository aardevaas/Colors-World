'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { formatConflictReport, type MergeConflict, type PaletteSnapshot } from '@/lib/versioning';
import { commitResolution } from '@/app/merge/actions';
import { ConflictRow } from './ConflictRow';
import styles from './merge-lab.module.css';

interface MergeLabProps {
  readonly paletteId: string;
  readonly oursVersionId: string;
  readonly theirsVersionId: string;
  readonly targetBranchId: string;
  readonly snapshot: PaletteSnapshot;
  readonly conflicts: readonly MergeConflict[];
}

export function MergeLab({
  paletteId,
  oursVersionId,
  theirsVersionId,
  targetBranchId,
  snapshot,
  conflicts,
}: MergeLabProps) {
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [committedVersionId, setCommittedVersionId] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [isCommitting, startCommit] = useTransition();

  const unresolvedConflicts = conflicts.filter(
    (conflict) => resolutions[conflict.token] === undefined
  );

  // The report is the same function that would run in a CLI or CI check —
  // proving the UI and a headless workflow tell the same story.
  const report = formatConflictReport(unresolvedConflicts);

  const finalSnapshot: PaletteSnapshot = { ...snapshot, ...resolutions };

  const cleanTokens = Object.keys(snapshot).filter(
    (token) => !conflicts.some((conflict) => conflict.token === token)
  );

  const canCommit =
    conflicts.length > 0 && unresolvedConflicts.length === 0 && committedVersionId === null;

  function handleCommit() {
    setCommitError(null);
    startCommit(async () => {
      try {
        const result = await commitResolution({
          paletteId,
          oursVersionId,
          theirsVersionId,
          targetBranchId,
          resolvedSnapshot: finalSnapshot,
        });
        setCommittedVersionId(result.versionId);
      } catch (error) {
        setCommitError(error instanceof Error ? error.message : String(error));
      }
    });
  }

  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <h1 className={styles.wordmark}>
          Colors World <span className={styles.wordmarkDim}>/ merge lab</span>
        </h1>
        <nav>
          <Link href="/" className={styles.navLink}>
            ← studio
          </Link>
        </nav>
        <p className={styles.statusLine}>
          {committedVersionId !== null ? (
            <span className={styles.statusClean}>
              committed as version {committedVersionId.slice(0, 8)}
            </span>
          ) : (
            <span
              className={
                unresolvedConflicts.length > 0 ? styles.statusPending : styles.statusClean
              }
            >
              {unresolvedConflicts.length > 0
                ? `${unresolvedConflicts.length} conflict(s) unresolved`
                : conflicts.length > 0
                  ? `all ${conflicts.length} conflicts resolved — ready to commit`
                  : 'no conflicts'}
            </span>
          )}
        </p>
      </header>

      <div className={styles.body}>
        <main className={styles.main}>
          <section>
            <p className={styles.sectionLabel}>
              Conflicts — {conflicts.length} token(s) diverged
            </p>
            <div className={styles.conflictList}>
              {conflicts.map((conflict) => (
                <ConflictRow
                  key={conflict.token}
                  conflict={conflict}
                  resolution={resolutions[conflict.token] ?? null}
                  onResolve={(token, value) =>
                    setResolutions((prev) => ({ ...prev, [token]: value }))
                  }
                />
              ))}
            </div>

            {canCommit && (
              <button
                type="button"
                className={styles.commitButton}
                onClick={handleCommit}
                disabled={isCommitting}
              >
                {isCommitting ? 'committing…' : 'commit merge'}
              </button>
            )}
            {commitError !== null && <p className={styles.error}>⚠ {commitError}</p>}
            {committedVersionId !== null && (
              <p className={styles.metaLine}>
                Written as a merge commit with two parents, branch head fast-forwarded. Reload
                this page to preview the next merge from the new state.
              </p>
            )}
          </section>

          <section>
            <p className={styles.sectionLabel}>
              Merged cleanly — {cleanTokens.length} token(s), no conflict
            </p>
            <div className={styles.cleanGrid}>
              {cleanTokens.map((token) => (
                <div key={token} className={styles.cleanCard}>
                  <div className={styles.cleanSwatch} style={{ background: snapshot[token] }} />
                  <div className={styles.cleanLabel}>{token}</div>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className={styles.panel}>
          <div>
            <p className={styles.sectionLabel}>Conflict report</p>
            <pre className={styles.code}>{report}</pre>
          </div>
          <div>
            <p className={styles.sectionLabel}>
              Resolved snapshot ({Object.keys(finalSnapshot).length} tokens)
            </p>
            <pre className={styles.code}>{JSON.stringify(finalSnapshot, null, 2)}</pre>
          </div>
        </aside>
      </div>
    </div>
  );
}
