import styles from './templates.module.css';

const BAR_HEIGHTS = [42, 68, 55, 82, 61, 94, 73] as const;
const NAV_ITEMS = ['Overview', 'Reports', 'Segments', 'Billing', 'Settings'] as const;

/**
 * A SaaS dashboard — the densest of the four templates, and the one that
 * exercises `surface` and `border` hardest: nested panels are where a palette
 * with too little separation between background and surface visibly falls
 * apart.
 *
 * `data-audit-fg` / `data-audit-bg` mark the text/background role pairs the
 * contrast overlay audits. They are declared here, next to the markup that
 * actually renders them, rather than inferred by the overlay walking computed
 * styles — the role a designer *meant* is not always recoverable from the
 * rendered pixels once transparency and stacking are involved.
 */
export function DashboardTemplate() {
  return (
    <div className={styles.frame}>
      <div className={styles.dashboard}>
        <div className={styles.sidebar}>
          <div className={styles.brandRow} data-audit-fg="text" data-audit-bg="surface">
            <span className={styles.brandDot} />
            Northwind
          </div>
          <div className={styles.navList}>
            {NAV_ITEMS.map((item, index) => (
              <span
                key={item}
                className={index === 0 ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
                data-audit-fg={index === 0 ? 'background' : 'text'}
                data-audit-bg={index === 0 ? 'primary' : 'surface'}
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <section className={styles.main}>
          <div className={styles.mainHead}>
            <p className={styles.title} data-audit-fg="text" data-audit-bg="background">
              Overview
            </p>
            <button type="button" className={styles.button} data-audit-fg="background" data-audit-bg="primary">
              New report
            </button>
          </div>

          <div className={styles.metricRow}>
            {[
              { label: 'Revenue', value: '£48.2k' },
              { label: 'Active users', value: '12,904' },
              { label: 'Churn', value: '1.8%' },
            ].map((metric) => (
              <div key={metric.label} className={styles.metricCard}>
                <div className={styles.metricLabel} data-audit-fg="text" data-audit-bg="surface">
                  {metric.label}
                </div>
                <div className={styles.metricValue} data-audit-fg="text" data-audit-bg="surface">
                  {metric.value}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.chartCard}>
            <div className={styles.mainHead}>
              <span className={styles.metricLabel} data-audit-fg="text" data-audit-bg="surface">
                Weekly signups
              </span>
              <span className={styles.badge} data-audit-fg="background" data-audit-bg="accent">
                +14%
              </span>
            </div>
            <div className={styles.bars} aria-hidden="true">
              {BAR_HEIGHTS.map((height, index) => (
                <span
                  key={index}
                  className={index === BAR_HEIGHTS.length - 1 ? `${styles.bar} ${styles.barAlt}` : styles.bar}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
