'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { formatHex, parseColor, type Oklch } from '@/lib/color-engine';
import { useDock } from '@/lib/dock/dock-context';
import { DEFAULT_RATIO, SCALE_RATIOS, buildScale, ROOT_PX } from '@/lib/typography/type-scale';
import { fluidClamp, toCssVariables, type FluidToken } from '@/lib/typography/fluid-clamp';
import { assessLegibility, suggestLegibilityFix } from '@/lib/typography/legibility';
import {
  DEFAULT_PRESET_ID,
  TYPE_PRESETS,
  ensurePresetLoaded,
  presetById,
  queryLocalFonts,
  type LocalFont,
  type LocalFontOutcome,
} from '@/lib/typography/font-sources';
import { TabNav } from '@/components/nav/TabNav';
import { SPECIMENS, specimenById, type SpecimenId } from './specimens';
import styles from './typography.module.css';

/** Viewport range the fluid scale interpolates across. */
const MIN_VIEWPORT = 360;
const MAX_VIEWPORT = 1440;
/** How much smaller the whole scale gets at the narrow end. */
const MOBILE_SHRINK = 0.8;

const FALLBACK_TEXT = '#F2F2F5';
const FALLBACK_BG = '#0B0B0C';

interface TypographyShellProps {
  readonly accountSlot?: ReactNode;
}

export function TypographyShell({ accountSlot }: TypographyShellProps) {
  const dock = useDock();
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [specimenId, setSpecimenId] = useState<SpecimenId>('magazine');
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const [baseRem, setBaseRem] = useState(1);
  const [lineHeight, setLineHeight] = useState(1.55);
  const [tracking, setTracking] = useState(0);
  const [weight, setWeight] = useState(400);
  const [localFonts, setLocalFonts] = useState<LocalFontOutcome | null>(null);
  const [localFamily, setLocalFamily] = useState<string | null>(null);

  const preset = presetById(presetId);

  useEffect(() => {
    ensurePresetLoaded(preset);
  }, [preset]);

  // Colours come from the dock so type is judged in the palette it will ship
  // in — the whole reason this tab shares a dock with the others.
  const textColor: Oklch = useMemo(
    () => (dock.items[0] ? dock.items[0].oklch : parseColor(FALLBACK_TEXT)),
    [dock.items]
  );
  const bgColor: Oklch = useMemo(
    () => (dock.items[1] ? dock.items[1].oklch : parseColor(FALLBACK_BG)),
    [dock.items]
  );

  const scale = useMemo(() => buildScale(baseRem, ratio), [baseRem, ratio]);

  // Each rung gets its own clamp: the same ratio applied at both ends, scaled
  // down for narrow viewports, so the *whole ladder* stays proportional rather
  // than each size drifting independently.
  const fluidTokens = useMemo<FluidToken[]>(
    () =>
      scale.map((entry) => ({
        name: entry.token,
        result: fluidClamp({
          minRem: entry.rem * MOBILE_SHRINK,
          maxRem: entry.rem,
          minViewportPx: MIN_VIEWPORT,
          maxViewportPx: MAX_VIEWPORT,
        }),
      })),
    [scale]
  );

  const specimenStyle = useMemo(() => {
    const vars: Record<string, string> = {
      '--type-display-family': localFamily ?? `"${preset.display}"`,
      '--type-body-family': localFamily ?? `"${preset.body}"`,
      '--type-mono-family': `"${preset.mono}"`,
      '--type-leading': String(lineHeight),
      '--type-tracking': `${tracking}em`,
      '--type-weight': String(weight),
      '--type-fg': formatHex(textColor),
      '--type-bg': formatHex(bgColor),
    };
    for (const token of fluidTokens) vars[`--type-${token.name}`] = token.result.css;
    return vars as CSSProperties;
  }, [fluidTokens, preset, localFamily, lineHeight, tracking, weight, textColor, bgColor]);

  // Body copy is the honest test: if that fails, the page fails, whatever the
  // headline scores.
  const bodyEntry = scale.find((e) => e.token === 'body')!;
  const bodyAssessment = assessLegibility(textColor, bgColor, bodyEntry.px, weight);
  const bodyFix = suggestLegibilityFix(textColor, bgColor, bodyEntry.px, weight);

  async function handleScanLocalFonts() {
    setLocalFonts(await queryLocalFonts());
  }

  function applyFix() {
    if (bodyFix.status === 'thicken') setWeight(bodyFix.weight);
    // A recolour is a palette change, not a type change — surfaced as advice
    // rather than silently rewriting the dock from this tab.
  }

  const specimen = specimenById(specimenId);
  const cssOutput = toCssVariables(fluidTokens);

  return (
    <div className={styles.shell}>
      <TabNav current="typography">{accountSlot}</TabNav>

      <div className={styles.controlBar}>
        <div className={styles.pillRow}>
          {TYPE_PRESETS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={entry.character}
              className={entry.id === presetId && localFamily === null ? `${styles.pill} ${styles.pillActive}` : styles.pill}
              onClick={() => {
                setPresetId(entry.id);
                setLocalFamily(null);
              }}
            >
              {entry.label}
            </button>
          ))}
          <button type="button" className={styles.pill} onClick={() => void handleScanLocalFonts()}>
            ⌕ local fonts
          </button>
        </div>

        <div className={styles.pillRow}>
          {SPECIMENS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={entry.id === specimenId ? `${styles.pill} ${styles.pillActive}` : styles.pill}
              onClick={() => setSpecimenId(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {localFonts !== null && (
        <div className={styles.localTray}>
          <LocalFontTray
            outcome={localFonts}
            active={localFamily}
            onPick={(family) => setLocalFamily(family)}
            onClear={() => setLocalFamily(null)}
          />
        </div>
      )}

      <div className={styles.body}>
        <section className={styles.stage}>
          <div className={styles.specimen} style={specimenStyle}>
            <specimen.Component />
          </div>
        </section>

        <aside className={styles.inspector}>
          <h2 className={styles.inspectorTitle}>Scale</h2>

          <label className={styles.field}>
            <span>
              Ratio <em className={styles.fieldNote}>{SCALE_RATIOS.find((r) => r.value === ratio)?.use}</em>
            </span>
            <select
              className={styles.select}
              value={ratio}
              onChange={(event) => setRatio(Number(event.target.value))}
            >
              {SCALE_RATIOS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.value.toFixed(3)} · {entry.name}
                </option>
              ))}
            </select>
          </label>

          <SliderField
            label="Base size"
            value={baseRem}
            min={0.75}
            max={1.5}
            step={0.0625}
            format={(v) => `${(v * ROOT_PX).toFixed(0)}px`}
            onChange={setBaseRem}
          />
          <SliderField
            label="Leading"
            value={lineHeight}
            min={1}
            max={2}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={setLineHeight}
          />
          <SliderField
            label="Tracking"
            value={tracking}
            min={-0.05}
            max={0.15}
            step={0.005}
            format={(v) => `${v.toFixed(3)}em`}
            onChange={setTracking}
          />
          <SliderField
            label="Weight"
            value={weight}
            min={100}
            max={900}
            step={100}
            format={(v) => String(v)}
            onChange={setWeight}
          />

          <h2 className={styles.inspectorTitle}>Legibility</h2>
          <div className={styles.legibility}>
            <div className={styles.legibilityRow}>
              <span>body @ {bodyEntry.px}px / {weight}</span>
              <span className={bodyAssessment.passes ? styles.pass : styles.fail}>
                {bodyAssessment.ratio.toFixed(2)}:1
              </span>
            </div>
            <p className={styles.hint}>
              needs {bodyAssessment.required}:1
              {bodyAssessment.isLarge ? ' (large text)' : ''}
            </p>
            {bodyFix.status === 'thicken' && (
              <button type="button" className={styles.fixButton} onClick={applyFix}>
                thicken to {bodyFix.weight} — no colour change
              </button>
            )}
            {bodyFix.status === 'recolour' && (
              <p className={styles.hint}>
                No weight fixes this at {bodyEntry.px}px. Nearest passing text colour:{' '}
                <span className={styles.mono}>{bodyFix.hex}</span>
              </p>
            )}
            {bodyFix.status === 'unreachable' && (
              <p className={styles.hint}>
                Unreachable at any lightness — best {bodyFix.bestRatio.toFixed(2)}:1.
              </p>
            )}
          </div>

          <h2 className={styles.inspectorTitle}>Fluid CSS</h2>
          <pre className={styles.cssOutput}>
            <code>{cssOutput}</code>
          </pre>
          <button
            type="button"
            className={styles.fixButton}
            onClick={() => void navigator.clipboard?.writeText(cssOutput)}
          >
            copy CSS
          </button>
        </aside>
      </div>
    </div>
  );
}

interface SliderFieldProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly format: (value: number) => string;
  readonly onChange: (value: number) => void;
}

function SliderField({ label, value, min, max, step, format, onChange }: SliderFieldProps) {
  return (
    <label className={styles.field}>
      <span>
        {label} <em className={styles.fieldValue}>{format(value)}</em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

interface LocalFontTrayProps {
  readonly outcome: LocalFontOutcome;
  readonly active: string | null;
  readonly onPick: (family: string) => void;
  readonly onClear: () => void;
}

/** Each failure mode gets its own message — an empty list looks like a bug. */
function LocalFontTray({ outcome, active, onPick, onClear }: LocalFontTrayProps) {
  if (outcome.status === 'unsupported') {
    return (
      <p className={styles.hint}>
        This browser has no Local Font Access API. Chrome and Edge support it; Safari
        and Firefox do not — the CDN presets above work everywhere.
      </p>
    );
  }
  if (outcome.status === 'denied') {
    return <p className={styles.hint}>Permission declined — nothing was read. Re-run the scan to try again.</p>;
  }
  if (outcome.status === 'failed') {
    return <p className={styles.hint}>Could not read local fonts: {outcome.message}</p>;
  }

  return (
    <>
      <p className={styles.hint}>
        {outcome.fonts.length} families on this machine — nothing leaves your device.
        {active !== null && (
          <button type="button" className={styles.inlineButton} onClick={onClear}>
            back to preset
          </button>
        )}
      </p>
      <div className={styles.localList}>
        {outcome.fonts.slice(0, 60).map((font: LocalFont) => (
          <button
            key={font.family}
            type="button"
            className={font.family === active ? `${styles.localChip} ${styles.pillActive}` : styles.localChip}
            style={{ fontFamily: `"${font.family}"` }}
            onClick={() => onPick(font.family)}
          >
            {font.family}
          </button>
        ))}
      </div>
    </>
  );
}
