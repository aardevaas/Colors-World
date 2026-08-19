import styles from './templates.module.css';

const VARIANTS = ['primary', 'accent', 'border'] as const;

/**
 * A product card — the template that shows what a palette does when a colour
 * has to sell something. The image area is a primary→accent gradient rather
 * than a photo on purpose: it puts the two brand colours directly beside each
 * other at full saturation, which is where clashing pairs become obvious.
 */
export function CommerceTemplate() {
  return (
    <div className={styles.frame}>
      <div className={styles.commerce}>
        <article className={styles.productCard}>
          <div className={styles.productImage}>
            <span className={`${styles.badge} ${styles.productImageBadge}`} data-audit-fg="background" data-audit-bg="accent">
              New
            </span>
          </div>

          <div className={styles.productBody}>
            <h3 className={styles.productName} data-audit-fg="text" data-audit-bg="surface">
              Cassette Field Recorder
            </h3>

            <div className={styles.stars} data-audit-fg="text" data-audit-bg="surface">
              <span className={styles.starFilled} aria-hidden="true">
                ★★★★
              </span>
              <span className={styles.muted} aria-hidden="true">
                ★
              </span>
              <span className={styles.muted}>4.2 · 318 reviews</span>
            </div>

            <div className={styles.price} data-audit-fg="text" data-audit-bg="surface">
              £249.00
            </div>

            <div className={styles.variants} aria-label="Colour variants">
              {VARIANTS.map((variant, index) => (
                <span
                  key={variant}
                  className={index === 0 ? `${styles.variant} ${styles.variantSelected}` : styles.variant}
                  style={{ background: `var(--ui-${variant})` }}
                />
              ))}
            </div>

            <button type="button" className={styles.button} data-audit-fg="background" data-audit-bg="primary">
              Add to cart
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}
