import styles from './templates.module.css';

const ROWS = [
  { title: 'Daily digest', meta: 'Every morning, 08:00', on: true },
  { title: 'Mentions', meta: 'Push + email', on: true },
  { title: 'Weekly summary', meta: 'Sundays', on: false },
  { title: 'Product updates', meta: 'Occasional', on: false },
] as const;

/**
 * A mobile settings screen — the template that stresses the *off* states.
 * A disabled toggle is drawn in `border`, so this is where a palette whose
 * border is nearly its surface produces controls that look broken rather than
 * merely subtle. Small type at small sizes also makes marginal text contrast
 * legible as a real problem instead of a number in a panel.
 */
export function MobileTemplate() {
  return (
    <div className={styles.frame}>
      <div className={styles.mobile}>
        <div className={styles.phone}>
          <div className={styles.statusBar} data-audit-fg="text" data-audit-bg="background">
            <span>9:41</span>
            <span aria-hidden="true">▮▮▮</span>
          </div>

          <div className={styles.phoneHeader}>
            <p className={styles.phoneTitle} data-audit-fg="text" data-audit-bg="background">
              Notifications
            </p>
            <span className={styles.badge} data-audit-fg="background" data-audit-bg="accent">
              2 on
            </span>
          </div>

          <div className={styles.phoneBody}>
            {ROWS.map((row) => (
              <div key={row.title} className={styles.listCard}>
                <div className={styles.listText}>
                  <span className={styles.listTitle} data-audit-fg="text" data-audit-bg="surface">
                    {row.title}
                  </span>
                  <span className={styles.listMeta} data-audit-fg="text" data-audit-bg="surface">
                    {row.meta}
                  </span>
                </div>
                <span
                  className={row.on ? `${styles.toggle} ${styles.toggleOn}` : styles.toggle}
                  role="switch"
                  aria-checked={row.on}
                  aria-label={row.title}
                >
                  <span className={styles.toggleKnob} />
                </span>
              </div>
            ))}
          </div>

          <div className={styles.tabBar} aria-label="Mobile tabs">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={index === 1 ? `${styles.tabIcon} ${styles.tabIconActive}` : styles.tabIcon}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
