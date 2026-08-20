import { REPO_URL, repoStats } from '@/lib/landing/repo-stats';
import styles from './credibility-strip.module.css';

/**
 * The section that converts a visitor into someone who trusts this.
 *
 * The audit named its absence as the single gap that most directly cost the
 * stated goal: a person scrolled past a beautiful globe and was never told the
 * engine is MIT, that the colours are computed rather than curated, or that
 * there is a repository to look at. Every claim here is one they can check —
 * the star count comes from GitHub, and the engine claims are things the code
 * demonstrably does rather than adjectives.
 *
 * A server component so the count is rendered rather than popped in after
 * hydration, and so a slow or rate-limited GitHub never becomes a slow page:
 * see repo-stats for the timeout and the fallback.
 */
export async function CredibilityStrip() {
  const stats = await repoStats();

  return (
    <section className={styles.strip} aria-labelledby="credibility-heading">
      <div className={styles.inner}>
        <h2 id="credibility-heading" className={styles.heading}>
          Open source, and the engine is the point.
        </h2>

        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt className={styles.factLabel}>Licence</dt>
            <dd className={styles.factValue}>MIT</dd>
            <p className={styles.factNote}>Depend on the colour engine in your own work.</p>
          </div>

          {stats.stars !== null && (
            <div className={styles.fact}>
              <dt className={styles.factLabel}>Stars</dt>
              <dd className={styles.factValue}>{stats.stars.toLocaleString('en')}</dd>
              <p className={styles.factNote}>On GitHub, where the whole thing lives.</p>
            </div>
          )}

          <div className={styles.fact}>
            <dt className={styles.factLabel}>Colour space</dt>
            <dd className={styles.factValue}>OKLCH</dd>
            <p className={styles.factNote}>
              Perceptually uniform end to end, which is what makes ordering by lightness
              mean anything.
            </p>
          </div>

          <div className={styles.fact}>
            <dt className={styles.factLabel}>Standards</dt>
            <dd className={styles.factValue}>WCAG + APCA</dd>
            <p className={styles.factNote}>
              The compliance number and the perceptual one, carried together rather than
              one standing in for the other.
            </p>
          </div>
        </dl>

        <div className={styles.actions}>
          <a
            className={styles.primary}
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the source
          </a>
          <span className={styles.actionsNote}>
            No account, no trial, nothing to cancel.
          </span>
        </div>
      </div>
    </section>
  );
}
