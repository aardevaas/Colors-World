'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
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
} from '@/lib/visualizer/semantic-roles';
import { WCAG_AA_NORMAL, autoFixContrast } from '@/lib/visualizer/auto-fix';
import { TabNav } from '@/components/nav/TabNav';
import { TEMPLATES, templateById, type TemplateId } from './templates';
import styles from './visualizer.module.css';

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
          <div className={styles.stageInner} style={stageStyle}>
            <template.Component />
          </div>
          <p className={styles.stageCaption}>
            {template.label} — stresses {template.stresses}
          </p>
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
