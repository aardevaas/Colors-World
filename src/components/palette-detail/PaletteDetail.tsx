'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PaletteSnapshot } from '@/lib/versioning';
import { BranchPanel } from './BranchPanel';
import styles from './palette-detail.module.css';

interface BranchData {
  readonly id: string;
  readonly name: string;
  readonly snapshot: PaletteSnapshot;
}

interface PaletteDetailProps {
  readonly paletteId: string;
  readonly paletteName: string;
  readonly branches: readonly BranchData[];
}

export function PaletteDetail({ paletteId, paletteName, branches }: PaletteDetailProps) {
  const router = useRouter();
  const [ours, setOurs] = useState(branches[0]?.name ?? '');
  const [theirs, setTheirs] = useState(branches[1]?.name ?? branches[0]?.name ?? '');

  const canMerge = ours !== '' && theirs !== '' && ours !== theirs;
  const mergeHref = canMerge
    ? `/merge?palette=${paletteId}&ours=${encodeURIComponent(ours)}&theirs=${encodeURIComponent(theirs)}`
    : '#';

  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <h1 className={styles.wordmark}>
          Colors World <span className={styles.wordmarkDim}>/ {paletteName}</span>
        </h1>
        <nav>
          <Link href="/palettes" className={styles.navLink}>
            ← all palettes
          </Link>
        </nav>
      </header>

      <div className={styles.body}>
        <section>
          <p className={styles.sectionLabel}>
            Branches — {branches.length}. Click a swatch to edit it, fork to create a new
            independent line of history.
          </p>
          {branches.map((branch) => (
            <BranchPanel
              key={branch.id}
              paletteId={paletteId}
              branchName={branch.name}
              snapshot={branch.snapshot}
              onMutated={() => router.refresh()}
            />
          ))}
        </section>

        {branches.length >= 2 && (
          <section>
            <p className={styles.sectionLabel}>Merge two branches</p>
            <div className={styles.mergePicker}>
              <select
                className={styles.select}
                value={ours}
                onChange={(event) => setOurs(event.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
              <span>←</span>
              <select
                className={styles.select}
                value={theirs}
                onChange={(event) => setTheirs(event.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
              <Link href={mergeHref} className={styles.mergeButton} aria-disabled={!canMerge}>
                preview merge
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
