import Link from 'next/link';
import { TOTAL_SPECTRUM_SIZE } from '@/lib/spectrum/generate-color';
import { SpectrumBrowser } from '@/components/spectrum/SpectrumBrowser';
import styles from '@/components/spectrum/spectrum.module.css';

export default function SpectrumPage() {
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
        <p className={styles.specLine}>
          {TOTAL_SPECTRUM_SIZE.toLocaleString()} colours — the full 8-bit-per-channel space,
          generated, not stored
        </p>
      </header>

      <SpectrumBrowser />
    </div>
  );
}
