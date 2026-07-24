import Link from 'next/link';
import { searchColors, countColors } from '@/lib/supabase/colors';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';
import styles from '@/components/library/library.module.css';

interface PageProps {
  readonly searchParams: Promise<{ q?: string }>;
}

export default async function LibraryPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = q ?? '';
  const supabase = await createServerSupabaseClient();
  const [results, total] = await Promise.all([
    searchColors(query, undefined, supabase),
    countColors(supabase),
  ]);

  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <h1 className={styles.wordmark}>
          Colors World <span className={styles.wordmarkDim}>/ library</span>
        </h1>
        <nav>
          <Link href="/studio" className={styles.navLink}>
            studio
          </Link>{' '}
          <Link href="/spectrum" className={styles.navLink}>
            spectrum
          </Link>{' '}
          <Link href="/scale-lab" className={styles.navLink}>
            scale lab
          </Link>{' '}
          <Link href="/assets" className={styles.navLink}>
            assets
          </Link>
        </nav>
      </header>

      <form className={styles.searchForm} action="/library" method="get">
        <input
          className={styles.searchInput}
          type="text"
          name="q"
          defaultValue={query}
          placeholder="search by name, emotion, mood, symbolism, keywords…"
          autoFocus
        />
        <p className={styles.resultMeta}>
          {results.length} shown of {total} colours — seed data from Color-Pedia, not
          verified fact
        </p>
      </form>

      {results.length === 0 ? (
        <p className={styles.empty}>
          No matches
          {total === 0 ? ' — the library is empty. Run the ingestion script first.' : '.'}
        </p>
      ) : (
        <div className={styles.grid}>
          {results.map((color) => (
            <Link key={color.id} href={`/library/${color.id}`} className={styles.card}>
              <div className={styles.cardSwatch} style={{ background: color.hex }} />
              <div className={styles.cardBody}>
                <div className={styles.cardName}>{color.name}</div>
                <div className={styles.cardTag}>{color.emotion ?? color.category ?? ''}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
