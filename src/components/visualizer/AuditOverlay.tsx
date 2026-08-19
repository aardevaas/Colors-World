'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import { contrastRatio } from '@/lib/color-engine';
import { WCAG_AA_NORMAL, WCAG_AA_LARGE } from '@/lib/visualizer/auto-fix';
import type { RoleAssignment, SemanticRole } from '@/lib/visualizer/semantic-roles';
import styles from './visualizer.module.css';

interface Badge {
  readonly key: string;
  readonly left: number;
  readonly top: number;
  readonly ratio: number;
  readonly passes: boolean;
  readonly isLarge: boolean;
}

interface AuditOverlayProps {
  readonly stageRef: RefObject<HTMLDivElement | null>;
  readonly roles: RoleAssignment;
  /** Bumped by the caller whenever the rendered template changes, so the
   *  overlay re-measures against the new markup rather than stale rects. */
  readonly measureKey: string;
}

/** Anything at or above this rendered px size gets judged against AA-large. */
const LARGE_TEXT_PX = 24;

function isRole(value: string | undefined): value is SemanticRole {
  return (
    value === 'background' ||
    value === 'surface' ||
    value === 'primary' ||
    value === 'text' ||
    value === 'accent' ||
    value === 'border'
  );
}

/**
 * Overlays live WCAG readouts on the mockup itself.
 *
 * Badges are positioned by measuring the real rendered boxes rather than being
 * placed by hand, so they stay correct when a template reflows. The role pair
 * for each element comes from the `data-audit-fg`/`data-audit-bg` attributes
 * the templates declare, not from reading computed styles — once transparency,
 * gradients and stacking are involved, the colour a designer *meant* is not
 * reliably recoverable from rendered pixels.
 *
 * Failures are loud, passes are quiet. Showing 25 equally-prominent badges
 * would bury the two that matter.
 */
export function AuditOverlay({ stageRef, roles, measureKey }: AuditOverlayProps) {
  const [badges, setBadges] = useState<readonly Badge[]>([]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (stage === null) return;

    function measure() {
      const host = stageRef.current;
      if (host === null) return;
      const hostRect = host.getBoundingClientRect();
      const found: Badge[] = [];

      host.querySelectorAll<HTMLElement>('[data-audit-fg]').forEach((el, index) => {
        const fg = el.dataset.auditFg;
        const bg = el.dataset.auditBg;
        if (!isRole(fg) || !isRole(bg)) return;

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const fontSize = Number.parseFloat(getComputedStyle(el).fontSize) || 0;
        const isLarge = fontSize >= LARGE_TEXT_PX;
        const ratio = contrastRatio(roles[fg].oklch, roles[bg].oklch);
        const threshold = isLarge ? WCAG_AA_LARGE : WCAG_AA_NORMAL;

        found.push({
          key: `${fg}-${bg}-${index}`,
          left: rect.left - hostRect.left,
          top: rect.top - hostRect.top,
          ratio,
          passes: ratio >= threshold,
          isLarge,
        });
      });

      setBadges(found);
    }

    measure();

    // Templates reflow with the stage; re-measure rather than letting badges
    // drift away from what they are describing.
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stageRef, roles, measureKey]);

  return (
    <div className={styles.auditOverlay} aria-hidden="true">
      {badges.map((badge) => (
        <span
          key={badge.key}
          className={badge.passes ? `${styles.auditBadge} ${styles.auditBadgePass}` : `${styles.auditBadge} ${styles.auditBadgeFail}`}
          style={{ left: badge.left, top: badge.top }}
        >
          {badge.ratio.toFixed(1)}:1 {badge.passes ? 'AA' : 'FAIL'}
          {badge.isLarge && <span className={styles.auditBadgeLarge}>lg</span>}
        </span>
      ))}
    </div>
  );
}
