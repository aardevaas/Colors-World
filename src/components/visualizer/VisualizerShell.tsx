'use client';

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CVD_TYPES, contrastRatio, formatHex, simulateCvd, type CvdType } from '@/lib/color-engine';
import { useSystem } from '@/lib/system/system-context';
import {
  INK_ROLES,
  SEMANTIC_ROLES,
  rolesToCssVars,
  type RoleColor,
  type SemanticRole,
} from '@/lib/roles/semantic-roles';
import { buildRoleContrastMatrix } from '@/lib/roles/role-contrast';
import { buildCvdReport } from '@/lib/roles/cvd-conflicts';
import { WCAG_AA_NORMAL, autoFixContrast } from '@/lib/visualizer/auto-fix';
import { appendWatermarkFooter } from '@/lib/visualizer/export-showcase';
import { downloadDataUrl } from '@/lib/studio/export-png';
import { TabNav } from '@/components/nav/TabNav';
import { AuditOverlay } from './AuditOverlay';
import { TEMPLATES, templateById, type TemplateId } from './templates';
import styles from './visualizer.module.css';
import { RoomMain, SkipLink } from '@/components/nav/SkipLink';

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

interface VisualizerShellProps {
  readonly accountSlot?: ReactNode;
}

export function VisualizerShell({ accountSlot }: VisualizerShellProps) {
  // Palette, role overrides and polarity all live in the System now, so a
  // link carries them and the other tabs see the same answer. Only genuinely
  // view-local state -- which template is on screen, which vision is being
  // simulated -- stays in this component.
  const { system, roles, setRoleOverride, clearRoleOverride, setMode } = useSystem();
  const [templateId, setTemplateId] = useState<TemplateId>('dashboard');
  const [cvd, setCvd] = useState<CvdMode>('none');
  const [assigningRole, setAssigningRole] = useState<SemanticRole | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const palette = useMemo<RoleColor[]>(
    () => system.palette.map((color) => ({ hex: color.hex, oklch: color.oklch })),
    [system.palette]
  );

  const overrides = system.roleOverrides;
  const isLight = system.mode === 'light';

  // CVD is applied to the resolved role colors rather than as an SVG filter
  // over the mockup: the filter approach also mangles the inspector's own
  // readouts, and simulating the *colors* means the contrast numbers shown
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

  // Every ordered pair, with the requirement each one actually carries. The
  // five pairs this used to check were the five that fitted in a sidebar, not
  // the five that matter: text on a filled button was never among them, and on
  // a three-color palette that is the worst failure in the whole system.
  const matrix = useMemo(() => buildRoleContrastMatrix(roles), [roles]);

  // Simulating one vision type at a time answers "what does this look like to
  // a deuteranope", which nobody with normal vision can act on. This answers
  // the question they can: which two of these colors just became one.
  const vision = useMemo(() => buildCvdReport(roles), [roles]);

  const template = templateById(templateId);
  const stageStyle = rolesToCssVars(shownRoles) as CSSProperties;

  function assign(role: SemanticRole, color: RoleColor) {
    setRoleOverride(role, color.hex);
    setAssigningRole(null);
  }

  function clearOverride(role: SemanticRole) {
    clearRoleOverride(role);
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
      <SkipLink />
      <TabNav current="visualizer">{accountSlot}</TabNav>
      <RoomMain className={styles.roomMain}>

      <div className={styles.controlBar}>
        <div className={styles.templateTabs}>
          {TEMPLATES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={`Stresses ${entry.stresses}`}
              /* Which template is showing was carried by a class name alone,
                 so it existed for people who can see the highlight and for
                 nobody else. */
              aria-pressed={entry.id === templateId}
              className={entry.id === templateId ? `${styles.templateTab} ${styles.templateTabActive}` : styles.templateTab}
              onClick={() => setTemplateId(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className={styles.controlGroup}>
          <button type="button" className={styles.toggleButton} onClick={() => setMode(isLight ? 'dark' : 'light')}>
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
              Collect colors in the Harmonic Dock and they map onto these roles
              automatically. Until then this is a neutral fallback set.
            </p>
          )}

          <ul className={styles.roleList}>
            {SEMANTIC_ROLES.map((role) => {
              /*
               * An ink is shown, not offered.
               *
               * These two rows used to carry the same "reassign" button as the
               * rest, which invited someone to drop any dock colour onto a
               * button label — the precise failure `inkOn` exists to prevent,
               * and one the audit would then have reported as unfixable. They
               * are a consequence of their fill, so the row says which fill
               * and leaves it at that.
               */
              const isInk = INK_ROLES.includes(role);
              return (
                <li key={role} className={styles.roleRow}>
                  {isInk ? (
                    <span
                      className={styles.roleSwatch}
                      style={{ background: shownRoles[role].hex }}
                      aria-hidden="true"
                    />
                  ) : (
                    <button
                      type="button"
                      className={styles.roleSwatch}
                      style={{ background: shownRoles[role].hex }}
                      onClick={() => setAssigningRole(assigningRole === role ? null : role)}
                      aria-label={`Reassign ${role}`}
                    />
                  )}
                  <span className={styles.roleName}>{role}</span>
                  <span className={styles.roleHex}>{shownRoles[role].hex}</span>
                  {isInk ? (
                    <span className={styles.derivedTag}>
                      follows {role === 'onPrimary' ? 'primary' : 'accent'}
                    </span>
                  ) : (
                    overrides[role] !== undefined && (
                      <button
                        type="button"
                        className={styles.resetButton}
                        onClick={() => clearOverride(role)}
                      >
                        reset
                      </button>
                    )
                  )}
                </li>
              );
            })}
          </ul>

          {assigningRole !== null && (
            <div className={styles.assignTray}>
              <span className={styles.hint}>Pick a color for {assigningRole}</span>
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

          <h2 className={styles.inspectorTitle}>
            Contrast
            <span className={styles.titleCount}>
              {matrix.failures.length === 0
                ? `${matrix.required.length} checked`
                : `${matrix.failures.length} of ${matrix.required.length} failing`}
            </span>
          </h2>
          <ul className={styles.auditList}>
            {matrix.required.map((cell) => (
              <li key={`${cell.foreground}-${cell.background}`} className={styles.auditRow}>
                <span className={styles.auditPair}>
                  {cell.foreground} <span className={styles.muted}>on</span> {cell.background}
                </span>
                <span className={cell.passes ? styles.ratioPass : styles.ratioFail}>
                  {cell.ratio.toFixed(2)}:1
                </span>
                {cell.passes ? (
                  <span className={styles.passTag}>
                    {cell.required === WCAG_AA_NORMAL ? 'AA' : 'UI'}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.fixButton}
                    onClick={() => handleAutoFix(cell.foreground, cell.background)}
                  >
                    auto-fix
                  </button>
                )}
              </li>
            ))}
          </ul>

          <h2 className={styles.inspectorTitle}>
            Color vision
            <span className={styles.titleCount}>
              {vision.safe ? '4 types clear' : 'conflicts found'}
            </span>
          </h2>
          {vision.safe ? (
            <p className={styles.hint}>
              No pair collapses under protanopia, deuteranopia, tritanopia or
              achromatopsia. Separating by lightness is what buys that.
            </p>
          ) : (
            <ul className={styles.auditList}>
              {vision.byType.flatMap((report) =>
                [...report.merged, ...report.weakened].map((finding) => (
                  <li key={`${report.type}-${finding.a}-${finding.b}`} className={styles.auditRow}>
                    <span className={styles.auditPair}>
                      {finding.a} <span className={styles.muted}>+</span> {finding.b}
                    </span>
                    <span className={finding.verdict === 'merged' ? styles.ratioFail : styles.ratioWarn}>
                      {Math.round(finding.retained * 100)}% kept
                    </span>
                    <span className={styles.visionTag}>{report.type.slice(0, 6)}</span>
                  </li>
                ))
              )}
            </ul>
          )}
          {vision.alreadyClose.length > 0 && (
            <p className={styles.hint}>
              {vision.alreadyClose.map((f) => `${f.a} and ${f.b}`).join('; ')} are already
              near-identical in normal vision — a palette question rather than a vision one.
            </p>
          )}

          <button
            type="button"
            className={styles.matrixToggle}
            onClick={() => setShowMatrix((v) => !v)}
            aria-expanded={showMatrix}
          >
            {showMatrix ? 'hide' : 'show'} every pair
          </button>

          {showMatrix && (
            <div className={styles.matrixScroll}>
              <table className={styles.matrix}>
                <caption className={styles.matrixCaption}>
                  Row on column. Pairs no standard has a rule about are shown for
                  reference rather than scored.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className={styles.srOnly}>Foreground</span>
                    </th>
                    {matrix.roles.map((role) => (
                      <th key={role} scope="col" title={role}>
                        {role.slice(0, 2)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((row, i) => (
                    <tr key={matrix.roles[i]}>
                      <th scope="row" title={matrix.roles[i]}>
                        {matrix.roles[i]!.slice(0, 2)}
                      </th>
                      {row.map((cell) => (
                        <td
                          key={`${cell.foreground}-${cell.background}`}
                          className={
                            cell.required === null
                              ? styles.cellAdvisory
                              : cell.passes
                                ? styles.cellPass
                                : styles.cellFail
                          }
                          title={`${cell.foreground} on ${cell.background} — ${cell.ratio.toFixed(2)}:1${
                            cell.required === null ? ' (no requirement)' : `, needs ${cell.required}`
                          }`}
                        >
                          {cell.foreground === cell.background ? '—' : cell.ratio.toFixed(1)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </aside>
      </div>
      </RoomMain>
    </div>
  );
}
