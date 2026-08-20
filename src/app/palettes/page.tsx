import Link from 'next/link';
import { listPalettes } from '@/lib/supabase/palettes';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';
import styles from '@/components/palette-detail/palette-list.module.css';

export default async function PalettesPage() {
  const supabase = await createServerSupabaseClient();
  const palettes = await listPalettes(supabase);

  return (
    <main className={styles.shell}>
      <header className={styles.masthead}>
        <h1 className={styles.wordmark}>
          Colors World <span className={styles.wordmarkDim}>/ palettes</span>
        </h1>
      </header>

      {palettes.length === 0 ? (
        <p className={styles.empty}>
          No palettes yet — save one from{' '}
          <Link href="/scales" className={styles.link}>
            Builder
          </Link>
          .
        </p>
      ) : (
        <ul className={styles.list}>
          {palettes.map((palette) => (
            <li key={palette.id} className={styles.row}>
              <Link href={`/palettes/${palette.id}`} className={styles.rowName}>
                {palette.name}
              </Link>
              <span className={styles.rowMeta}>
                {new Date(palette.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
