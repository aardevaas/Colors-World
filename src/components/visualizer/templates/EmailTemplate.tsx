import styles from './templates.module.css';

/**
 * An email, and the only template that shows the system as it actually
 * arrives rather than as it was designed.
 *
 * The other four render in the brand face. This one deliberately does not:
 * most clients strip webfonts, so the stack that reaches a reader is whatever
 * the machine already has. Setting it in the fallback is the point — a palette
 * chosen against a display face and never seen in Arial is a palette that has
 * not been tested in the channel most brands send the most words through.
 *
 * It also carries the signature block, which is the fifth of §8's collateral
 * pieces and the only one that is not printed. Everything in it — the rule,
 * the accent, the constrained measure — is drawn in role colours, so it
 * repaints with the rest.
 */
export function EmailTemplate() {
  return (
    <div className={styles.frame}>
      <div className={styles.email}>
        <div className={styles.emailChrome}>
          <span className={styles.emailFrom} data-audit-fg="text" data-audit-bg="background">
            Northwind &lt;hello@northwind.example&gt;
          </span>
          <span className={styles.emailDate} data-audit-fg="text" data-audit-bg="background">
            08:02
          </span>
        </div>

        <div className={styles.emailSheet}>
          <p className={styles.emailSubject} data-audit-fg="text" data-audit-bg="surface">
            Your February summary is ready
          </p>

          <p className={styles.emailBody} data-audit-fg="text" data-audit-bg="surface">
            Revenue closed the month up 6.2% against January, and churn held under two
            percent for the fourth month running. The full breakdown is in your dashboard.
          </p>

          <span className={styles.emailCta} data-audit-fg="background" data-audit-bg="primary">
            Open the summary
          </span>

          <div className={styles.emailRule} />

          <div className={styles.signature}>
            <span className={styles.signatureAccent} />
            <div className={styles.signatureText}>
              <span className={styles.signatureName} data-audit-fg="text" data-audit-bg="surface">
                Ada Reyes
              </span>
              <span className={styles.signatureRole} data-audit-fg="text" data-audit-bg="surface">
                Head of Operations · Northwind
              </span>
            </div>
          </div>
        </div>

        <p className={styles.emailFooter} data-audit-fg="text" data-audit-bg="background">
          You are receiving this because you have an account. Unsubscribe.
        </p>
      </div>
    </div>
  );
}
