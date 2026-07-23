import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getColor } from '@/lib/supabase/colors';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';
import { auditContrast, formatOklchCss, parseColor } from '@/lib/color-engine';
import styles from '@/components/library/library.module.css';

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

const WHITE = parseColor('#ffffff');
const BLACK = parseColor('#000000');

const TAG_FIELDS: readonly { label: string; key: 'category' | 'description' | 'emotion' | 'personality' | 'mood' | 'symbolism' | 'useCase' | 'keywords' | 'contrastLevel' }[] = [
  { label: 'Category', key: 'category' },
  { label: 'Description', key: 'description' },
  { label: 'Emotion', key: 'emotion' },
  { label: 'Personality', key: 'personality' },
  { label: 'Mood', key: 'mood' },
  { label: 'Symbolism', key: 'symbolism' },
  { label: 'Use case', key: 'useCase' },
  { label: 'Keywords', key: 'keywords' },
];

export default async function ColorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const color = await getColor(id, supabase);
  if (color === null) notFound();

  const onWhite = auditContrast(color.oklch, WHITE);
  const onBlack = auditContrast(color.oklch, BLACK);

  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <h1 className={styles.wordmark}>
          Colors World <span className={styles.wordmarkDim}>/ {color.name}</span>
        </h1>
        <nav>
          <Link href="/library" className={styles.navLink}>
            ← library
          </Link>
        </nav>
      </header>

      <div className={styles.detailBody}>
        <div>
          <div className={styles.hero} style={{ background: color.hex }} />
          <div className={styles.meta}>
            {color.provenance === 'seed' && (
              <span className={styles.provenanceBadge}>unverified seed data</span>
            )}
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Hex</span>
              <span className={styles.metaValue}>{color.hex.toUpperCase()}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>OKLCH</span>
              <span className={styles.metaValue}>{formatOklchCss(color.oklch)}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Contrast</span>
              <div className={styles.contrastRow}>
                <span>
                  on white {onWhite.ratio.toFixed(2)}:1{onWhite.normalText.aa ? ' AA' : ''}
                </span>
                <span>
                  on black {onBlack.ratio.toFixed(2)}:1{onBlack.normalText.aa ? ' AA' : ''}
                </span>
              </div>
            </div>
            {color.contrastLevel !== null && (
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Dataset contrast level</span>
                <span className={styles.metaValue}>{color.contrastLevel}</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.tagGrid}>
          {TAG_FIELDS.map(
            ({ label, key }) =>
              color[key] !== null && (
                <div key={key} className={styles.metaRow}>
                  <span className={styles.metaLabel}>{label}</span>
                  <span className={styles.metaValue}>{color[key]}</span>
                </div>
              )
          )}
        </div>
      </div>
    </div>
  );
}
