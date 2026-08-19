'use client';

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CVD_TYPES, contrastRatio, formatHex, simulateCvd, type CvdType } from '@/lib/color-engine';
import { useDock } from '@/lib/dock/dock-context';
import {
  SEMANTIC_ROLES,
  deriveRoles,
  flipPolarity,
  rolesToCssVars,
  type RoleColor,
  type RoleOverrides,
  type SemanticRole,
} from '@/lib/roles/semantic-roles';
import { WCAG_AA_NORMAL, autoFixContrast } from '@/lib/visualizer/auto-fix';
import { appendWatermarkFooter } from '@/lib/visualizer/export-showcase';
import { downloadDataUrl } from '@/lib/studio/export-png';
import { TabNav } from '@/components/nav/TabNav';
import { AuditOverlay } from './AuditOverlay';
import { TEMPLATES, templateById, type TemplateId } from './templates';
import styles from './visualizer.module.css';

const EXPORT_DPR = 2;
const EXPORT_TIMEOUT_MS = 15_000;
const PAINT_WAIT_MS = 120;
const WATERMARK = 'Colors World by: aardevaas';

type CvdMode = 'none' | CvdType;

const CVD_LABELS: Record<CvdType, string> = {
  protanopia: 'Protanopia',
  deuteranopia: 'Deuteranopia',
  tritanopia: 'Tritanopia',
  achromatopsia: 'Achromatopsia',
};

/** Role pairs the inspector audits, in the order they matter for readability. */
const AUDIT_PAIRS: readonly (readonly [SemanticRole, SemanticRole])[] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['background', 'primary'],
  ['background', 'accent'],
  ['border', 'surface'],
];

interface VisualizerShellProps {
  readonly accountSlot?: ReactNode;
}

export function VisualizerShell({ accountSlot }: VisualizerShellProps) {
  const dock = useDock();
  const [templateId, setTemplateId] = useState<TemplateId>('dashboard');
  const [overrides, setOverrides] = useState<RoleOverrides>({});
  const [isLight, setIsLight] = useState(false);
  const [cvd, setCvd] = useState<CvdMode>('none');
  const [assigningRole, setAssigningRole] = useState<SemanticRole | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const palette = useMemo<RoleColor[]>(
    () => dock.items.map((item) => ({ hex: item.hex, oklch: item.oklch })),
    [dock.items]
  );

  const roles = useMemo(() => {
    const base = deriveRoles(palette, overrides);
    return isLight ? flipPolarity(base) : base;
  }, [palette, overrides, isLight]);

  // CVD is applied to the resolved role colours rather than as an SVG filter
  // over the mockup: the filter approach also mangles the inspector's own
  // readouts, and simulating the *colours* means the contrast numbers shown
  // are the ones a person with that vision actually experiences.
  const shownRoles = useMemo(() => {
    if (cvd === 'none') return roles;
    const mapped = Object.fromEntries(
      SEMANTIC_ROLES.map((role) => {
        const simulated = simulateCvd(roles[role].oklch, cvd);
        return [role, { hex: formatHex(simulated), oklch: simulated }];
      })
    );
    return mapped as typeof roles;
  }, [roles, cvd]);

  const template = templateById(templateId);
  const stageStyle = rolesToCssVars(shownRoles) as CSSProperties;

  function assign(role: SemanticRole, color: RoleColor) {
    setOverrides((prev) => ({ ...prev, [role]: color }));
    setAssigningRole(null);
  }

  function clearOverride(role: SemanticRole) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[role];
      return next;
    });
  }

  /**
   * Captures the stage only — not the surrounding instrument — then appends the
   * credit bar underneath. The audit badges are hidden for the duration: they
   * are a working tool, not something anyone wants baked into a shared image.
   */
  async function handleExport() {
    const stage = stageRef.current;
    if (stage === null || isExporting) return;

    const wasShowingAudit = showAudit;
    setShowAudit(false);
    setIsExporting(true);
    setExportError(null);
    try {
      // Let the badge removal actually paint before capturing — but never
      // *depend* on a frame arriving. Browsers pause requestAnimationFrame in
      // backgrounded tabs, so a bare rAF await hangs indefinitely the moment
      // someone switches tab mid-export, with no timeout inside the try block
      // able to rescue it. Racing a timer makes the wait best-effort.
      await Promise.race([
        new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        new Promise((resolve) => setTimeout(resolve, PAINT_WAIT_MS)),
      ]);
      const { domToPng } = await import('modern-screenshot');

      // Bounded rather than open-ended. domToPng inlines every external
      // resource it finds, so one unreachable font or image otherwise leaves
      // the button disabled and spinning forever with nothing to diagnose —
      // a hang is a worse failure than an error message.
      const raw = await Promise.race([
        domToPng(stage, { scale: EXPORT_DPR, timeout: EXPORT_TIMEOUT_MS }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Capture timed out.')), EXPORT_TIMEOUT_MS)
        ),
      ]);

      const withCredit = await appendWatermarkFooter(raw, WATERMARK);
      downloadDataUrl(withCredit, `colors-world-${templateId}-${Date.now()}.png`);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsExporting(false);
      setShowAudit(wasShowingAudit);
    }
  }

  function handleAutoFix(fg: SemanticRole, bg: SemanticRole) {
    const outcome = autoFixContrast(roles[fg].oklch, roles[bg].oklch);
    if (outcome.status !== 'fixed') return;
    assign(fg, { hex: outcome.hex, oklch: outcome.color });
  }

  return (
    <div className={styles.shell}>
      <TabNav current="visualizer">{accountSlot}</TabNav>

      <div className={styles.controlBar}>
        <div className={styles.templateTabs}>
          {TEMPLATES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={`Stresses ${entry.stresses}`}
              className={entry.id === templateId ? `${styles.templateTab} ${styles.templateTabActive}` : styles.templateTab}
              onClick={() => setTemplateId(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className={styles.controlGroup}>
          <button type="button" className={styles.toggleButton} onClick={() => setIsLight((v) => !v)}>
            {isLight ? '☾ dark' : '☀ light'}
          </button>

          <button
            type="button"
            className={showAudit ? `${styles.toggleButton} ${styles.toggleButtonOn}` : styles.toggleButton}
            onClick={() => setShowAudit((v) => !v)}
          >
            ◎ audit
          </button>

          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => void handleExport()}
            disabled={isExporting}
          >
            {isExporting ? 'exporting…' : '⬇ export'}
          </button>

          <label className={styles.selectField}>
            <span>Vision</span>
            <select
              className={styles.select}
              value={cvd}
              onChange={(event) => setCvd(event.target.value as CvdMode)}
            >
              <option value="none">Normal vision</option>
              {CVD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CVD_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className={styles.body}>
        <section className={styles.stage}>
          <div className={styles.stageFrame}>
            <div ref={stageRef} className={styles.stageInner} style={stageStyle}>
              <template.Component />
            </div>
            {showAudit && (
              <AuditOverlay
                stageRef={stageRef}
                roles={shownRoles}
                measureKey={`${templateId}-${isLight}-${cvd}`}
              />
            )}
          </div>
          <p className={styles.stageCaption}>
            {template.label} — stresses {template.stresses}
          </p>
          {exportError !== null && <p className={styles.exportError}>Export failed: {exportError}</p>}
        </section>

        <aside className={styles.inspector}>
          <h2 className={styles.inspectorTitle}>Roles</h2>
          {palette.length === 0 && (
            <p className={styles.hint}>
              Collect colours in the Harmonic Dock and they map onto these roles
              automatically. Until then this is a neutral fallback set.
            </p>
          )}

          <ul className={styles.roleList}>
            {SEMANTIC_ROLES.map((role) => (
              <li key={role} className={styles.roleRow}>
                <button
                  type="button"
                  className={styles.roleSwatch}
                  style={{ background: shownRoles[role].hex }}
                  onClick={() => setAssigningRole(assigningRole === role ? null : role)}
                  aria-label={`Reassign ${role}`}
                />
                <span className={styles.roleName}>{role}</span>
                <span className={styles.roleHex}>{shownRoles[role].hex}</span>
                {overrides[role] !== undefined && (
                  <button type="button" className={styles.resetButton} onClick={() => clearOverride(role)}>
                    reset
                  </button>
                )}
              </li>
            ))}
          </ul>

          {assigningRole !== null && (
            <div className={styles.assignTray}>
              <span className={styles.hint}>Pick a colour for {assigningRole}</span>
              <div className={styles.assignSwatches}>
                {palette.length === 0 && <span className={styles.hint}>Dock is empty.</span>}
                {palette.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    className={styles.assignSwatch}
                    style={{ background: color.hex }}
                    title={color.hex}
                    onClick={() => assign(assigningRole, color)}
                  />
                ))}
              </div>
            </div>
          )}

          <h2 className={styles.inspectorTitle}>Contrast</h2>
          <ul className={styles.auditList}>
            {AUDIT_PAIRS.map(([fg, bg]) => {
              const ratio = contrastRatio(roles[fg].oklch, roles[bg].oklch);
              const passes = ratio >= WCAG_AA_NORMAL;
              return (
                <li key={`${fg}-${bg}`} className={styles.auditRow}>
                  <span className={styles.auditPair}>
                    {fg} <span className={styles.muted}>on</span> {bg}
                  </span>
                  <span className={passes ? styles.ratioPass : styles.ratioFail}>
                    {ratio.toFixed(2)}:1
                  </span>
                  {passes ? (
                    <span className={styles.passTag}>AA</span>
                  ) : (
                    <button type="button" className={styles.fixButton} onClick={() => handleAutoFix(fg, bg)}>
                      auto-fix
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
