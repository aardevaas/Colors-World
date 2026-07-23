import Link from 'next/link';
import { countColors, getSpectrumWindow } from '@/lib/supabase/colors';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';
import { SpectrumBrowser } from '@/components/spectrum/SpectrumBrowser';
import styles from '@/components/spectrum/spectrum.module.css';

const INITIAL_ROWS = 200;

export default async function SpectrumPage() {
  const supabase = await createServerSupabaseClient();
  const [total, initialRows] = await Promise.all([
    countColors(supabase),
    getSpectrumWindow(0, INITIAL_ROWS, supabase),
  ]);

  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <h1 className={styles.wordmark}>
          Colors World <span className={styles.wordmarkDim}>/ spectrum</span>
        </h1>
        <nav className={styles.navGroup}>
          <Link href="/" className={styles.navLink}>
            studio
          </Link>
          <Link href="/scale-lab" className={styles.navLink}>
            scale lab
          </Link>
          <Link href="/library" className={styles.navLink}>
            library
          </Link>
          <Link href="/assets" className={styles.navLink}>
            assets
          </Link>
        </nav>
        <p className={styles.specLine}>{total.toLocaleString()} colours, ordered by hue</p>
      </header>

      {total === 0 ? (
        <p className={styles.empty}>
          The library is empty and there is nothing to browse — run the ingestion script, then
          the spectrum_index backfill in supabase/schema.sql, first.
        </p>
      ) : (
        <SpectrumBrowser total={total} initialRows={initialRows} />
      )}
    </div>
  );
}
