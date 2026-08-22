import styles from './templates.module.css';

/**
 * An editorial hero — large type on a mostly empty field, which is the hardest
 * test of the `text`/`background` pair specifically. At this size a ratio that
 * technically passes AA-large can still read as weak, so this is the template
 * where the contrast overlay earns its keep.
 *
 * The glow uses the primary role at low opacity: it is the one place a brand
 * color appears as atmosphere rather than as an element, and a palette whose
 * primary is too close to its background loses it entirely here.
 */
export function EditorialTemplate() {
  return (
    <div className={styles.frame}>
      <div className={styles.editorial}>
        <div className={styles.editorialGlow} aria-hidden="true" />

        <div className={styles.pillRow}>
          <span className={`${styles.pill} ${styles.pillAccent}`} data-audit-fg="background" data-audit-bg="accent">
            Issue 04
          </span>
          <span className={styles.pill} data-audit-fg="text" data-audit-bg="background">
            Field notes
          </span>
        </div>

        <p className={styles.headline} data-audit-fg="text" data-audit-bg="background">
          Color is a place, not a list.
        </p>

        <p className={styles.subcopy} data-audit-fg="text" data-audit-bg="background">
          Sixteen million shades, computed rather than stored — so you can wander
          the whole space instead of scrolling someone else&rsquo;s shortlist.
        </p>

        <div className={styles.ctaRow}>
          <button type="button" className={styles.button} data-audit-fg="background" data-audit-bg="primary">
            Start exploring
          </button>
          <button type="button" className={styles.ctaGlass} data-audit-fg="text" data-audit-bg="surface">
            Read the notes
          </button>
        </div>
      </div>
    </div>
  );
}
