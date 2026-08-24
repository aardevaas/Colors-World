'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseColor, type Oklch } from '@/lib/color-engine';
import { buildRoleContrastMatrix, TEXT_MINIMUM } from '@/lib/roles/role-contrast';
import { deriveRoles } from '@/lib/roles/semantic-roles';
import { HARMONY_RULES, type ChromaStrategy, type HarmonyRule } from '@/lib/harmony/harmony';
import { PALETTE_SIZES, generatePalette, type PaletteColor } from '@/lib/harmony/palette';
import { nextSeedAwayFrom, randomSeed } from '@/lib/harmony/seed';
import {
  describeShortfall,
  solvePalette,
  unmetFromMatrix,
  type UnmetTarget,
} from '@/lib/harmony/solver';
import { useSystem } from '@/lib/system/system-context';
import { HarmonyWheel } from './HarmonyWheel';
import { PaletteExport } from './PaletteExport';
import styles from './palette-composer.module.css';

/**
 * Compose — where a palette gets made.
 *
 * This is the half of the product that never existed. Everything downstream
 * assumed you had already arrived with colors; nothing anywhere turned one
 * color into a set, which is the loop every competitor opens with and the
 * reason a collector named the Harmonic Dock had no harmony in it.
 *
 * The interaction is the one Coolors proved: roll, lock what you like, roll
 * again. What differs is underneath — the roll is constrained to seeds worth
 * building from, and the harmony is reconciled against the gamut so a locked
 * color never shifts under you.
 *
 * The draft is deliberately *not* the System. Rolling is exploration and
 * should not rewrite the URL, push history, or repaint the other four tabs on
 * every press of the spacebar. It becomes the System only when applied.
 *
 * This lived as a strip above the Builder's scales until it was measured at
 * 6 of that page's 112 controls and 7% of its height -- the thing that makes
 * the palette, crowded into the margin of the room named after refining it.
 * It has its own room now, which is also what lets the wheel exist.
 */

const CHROMA_STRATEGIES: readonly { readonly id: ChromaStrategy; readonly label: string; readonly hint: string }[] = [
  { id: 'proportional', label: 'proportional', hint: 'Each hue as saturated as it can be' },
  { id: 'equal', label: 'equal weight', hint: 'One chroma for all, capped by the weakest hue' },
  { id: 'preserve', label: 'preserve seed', hint: "Keep the seed's chroma, map what cannot reach it" },
];

const RULE_HINTS: Readonly<Record<HarmonyRule, string>> = {
  monochromatic: 'One hue, built from its own tones',
  analogous: 'Neighbours on the wheel — quiet, cohesive',
  complementary: 'Opposites — maximum separation',
  'split-complementary': 'An opposite, softened',
  triad: 'Three evenly spaced hues',
  tetrad: 'Two complementary pairs',
  square: 'Four evenly spaced hues',
};

export function PaletteComposer() {
  const { system, setPalette } = useSystem();

  const [rule, setRule] = useState<HarmonyRule>('triad');
  const [strategy, setStrategy] = useState<ChromaStrategy>('proportional');
  const [count, setCount] = useState(6);
  const [seed, setSeed] = useState<Oklch | null>(null);
  const [draft, setDraft] = useState<readonly PaletteColor[]>([]);
  const [locked, setLocked] = useState<ReadonlySet<string>>(new Set());
  const [enforce, setEnforce] = useState(true);
  const [unmet, setUnmet] = useState<readonly UnmetTarget[]>([]);

  const build = useCallback(
    (nextSeed: Oklch, keep: ReadonlySet<string>, previous: readonly PaletteColor[]) => {
      // With targets on, the palette is solved rather than rolled: the ladder
      // is adjusted until the contrast requirements hold. This is what fixes
      // the invisible panel edge that no amount of rolling ever could, because
      // it is a property of the ladder rather than the seed.
      const generated = enforce
        ? solveInto(nextSeed, rule, strategy, count, setUnmet)
        : rollInto(nextSeed, rule, strategy, count, setUnmet);
      // Locked colors hold their slot; the rest are replaced. Matching by
      // position rather than by color is what makes a lock feel like a lock —
      // the swatch under your cursor does not move when you roll.
      const merged = generated.colors.map((color, index) => {
        const held = previous[index];
        return held !== undefined && keep.has(held.hex) ? held : color;
      });
      setSeed(nextSeed);
      setDraft(dedupe(merged));
    },
    [rule, strategy, count, enforce]
  );

  /** Picking a hue keeps everything else about the current seed. */
  const pickHue = useCallback(
    (hue: number) => {
      const base = seed ?? randomSeed(Math.random);
      build({ ...base, h: hue }, locked, draft);
    },
    [seed, locked, draft, build]
  );

  const roll = useCallback(() => {
    const from = seed?.h;
    const nextSeed =
      from === undefined ? randomSeed(Math.random) : nextSeedAwayFrom(from, Math.random);
    build(nextSeed, locked, draft);
  }, [seed, locked, draft, build]);

  /*
   * START FROM THE COLOUR YOU ARRIVED WITH.
   *
   * The headline over this room promises "start from one color, get a whole
   * system", and library now has a control that says "build a system from it"
   * and sends you here carrying one. The composer ignored it completely: the
   * seed began as null and the first roll called `randomSeed`. Carry in vivid
   * magenta and press the button and you got greens — the colour you had
   * deliberately chosen was not in the result, was not on the screen, and was
   * not asked about.
   *
   * Only when there is nothing in progress. Adopting a new anchor mid-work
   * would throw away a palette someone is in the middle of building, and the
   * anchor changes every time a colour is docked from anywhere.
   */
  const anchorSeed = useMemo(() => {
    if (system.anchorHex === null) return null;
    return system.palette.find((color) => color.hex === system.anchorHex)?.oklch ?? null;
  }, [system.anchorHex, system.palette]);

  useEffect(() => {
    if (seed !== null) return;
    /*
     * And with nothing to start from, start from something anyway.
     *
     * Cold, this room was a headline, a control bar and a line of grey text over
     * five hundred pixels of empty black — a page that looks unfinished, gating
     * everything it can do behind a button the visitor has no reason yet to
     * trust. Nothing is committed by rolling: the draft is local until "Apply to
     * System" is pressed. So the room shows its work immediately and the first
     * question becomes "what would I change" rather than "what is this".
     */
    build(anchorSeed ?? randomSeed(Math.random), locked, draft);
    // Deliberately not keyed on `locked`/`draft`: this runs once, on arrival,
    // and both are empty at that point by construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorSeed, seed, build]);

  // Regenerate when the rule, strategy or size changes, so the controls read
  // as live rather than as settings that need a separate roll to take effect.
  useEffect(() => {
    if (seed === null) return;
    build(seed, locked, draft);
    // Intentionally keyed on the controls alone: including draft or locked
    // would rebuild on every roll and every lock, undoing both.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule, strategy, count, enforce]);

  // Spacebar rolls, the way it does everywhere else in this category. Guarded
  // against firing while a control has focus — pressing space on a focused
  // select or button must do what that control does, not reroll the palette
  // out from under it.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      // Both spellings: `code` is the physical key and survives alternative
      // layouts, `key` is what some synthetic and remote-input paths populate
      // instead. Requiring only one of them silently loses the shortcut for
      // whichever path does not set it.
      const isSpace = event.code === 'Space' || event.key === ' ';
      if (!isSpace || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target !== null && isFormControl(target)) return;
      event.preventDefault();
      roll();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [roll]);

  function toggleLock(hex: string) {
    setLocked((previous) => {
      const next = new Set(previous);
      if (next.has(hex)) next.delete(hex);
      else next.add(hex);
      return next;
    });
  }

  function apply() {
    setPalette(draft.map((color) => ({ hex: color.hex, oklch: color.oklch })));
  }

  const isApplied = draft.length > 0 && samePalette(draft, system.palette);
  const audit = useMemo(() => (draft.length > 0 ? auditOf(draft) : null), [draft]);
  /*
   * The sentence explains the LIST, not the solver's private target set.
   *
   * `unmet` is what the solver was asked to move and could not; the matrix is
   * what the palette actually is. While those were different lists the
   * shortfall line could name a constraint that did not appear in the rows
   * above it — so the explanation is read off the same audit as the rows, and
   * the solver's own miss is only consulted when the audit is clean and there
   * is still something to say about the request.
   */
  const shortfall =
    audit !== null && audit.failures.length > 0
      ? describeShortfall(unmetFromMatrix(audit))
      : describeShortfall(unmet);

  return (
    <section className={styles.composer} aria-label="Compose a palette">
      <div className={styles.controls}>
        <span className={styles.title}>Compose</span>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Harmony</span>
          <select
            className={styles.select}
            value={rule}
            onChange={(event) => setRule(event.target.value as HarmonyRule)}
          >
            {HARMONY_RULES.map((entry) => (
              <option key={entry} value={entry}>
                {entry.replace('-', ' ')}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Chroma</span>
          <select
            className={styles.select}
            value={strategy}
            onChange={(event) => setStrategy(event.target.value as ChromaStrategy)}
          >
            {CHROMA_STRATEGIES.map((entry) => (
              <option key={entry.id} value={entry.id} title={entry.hint}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Colors</span>
          <select
            className={styles.select}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          >
            {PALETTE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={enforce}
            onChange={(event) => setEnforce(event.target.checked)}
          />
          <span>Meet contrast targets</span>
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.rollButton} onClick={roll}>
            {draft.length === 0 ? 'Generate a palette' : 'Roll'}
            <kbd className={styles.kbd}>space</kbd>
          </button>
          <button
            type="button"
            className={styles.applyButton}
            onClick={apply}
            disabled={draft.length === 0 || isApplied}
          >
            {isApplied ? 'Applied' : 'Apply to System'}
          </button>
        </div>
      </div>

      {draft.length === 0 ? (
        <p className={styles.empty}>
          {RULE_HINTS[rule]}. Roll for a starting point, or pick a hue on the wheel.
        </p>
      ) : (
        <>
          <div className={styles.stage}>
            <HarmonyWheel
              seed={seed}
              rule={rule}
              lightness={seed?.l ?? 0.62}
              gamut="srgb"
              onPickHue={pickHue}
            />
            <div className={styles.stageMain}>
          <ul className={styles.strip}>
            {draft.map((color) => {
              const isLocked = locked.has(color.hex);
              return (
                <li key={color.hex} className={styles.slot}>
                  <button
                    type="button"
                    className={styles.swatch}
                    style={{ background: color.hex }}
                    onClick={() => toggleLock(color.hex)}
                    aria-pressed={isLocked}
                    aria-label={
                      isLocked
                        ? `${color.hex}, locked. Unlock to let it change when you roll`
                        : `${color.hex}. Lock to keep it when you roll`
                    }
                    data-locked={isLocked}
                  >
                    <span className={styles.lockMark} aria-hidden="true">
                      {isLocked ? '◉' : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.hexCopy}
                    onClick={() => void navigator.clipboard?.writeText(color.hex.toUpperCase())}
                    aria-label={`Copy ${color.hex.toUpperCase()}`}
                    title="Copy"
                  >
                    {color.hex.toUpperCase()}
                  </button>
                  <span className={styles.origin}>{color.origin}</span>
                </li>
              );
            })}
          </ul>

          <div className={styles.readout}>
            <span>{RULE_HINTS[rule]}</span>
            {audit !== null && (
              /* The verdict, in the visualizer's own words, so the two rooms
                 cannot be read as disagreeing when they agree. */
              <span className={audit.failures.length === 0 ? styles.pass : styles.fail}>
                {audit.failures.length === 0
                  ? `${audit.required.length} of ${audit.required.length} pass`
                  : `${audit.failures.length} of ${audit.required.length} failing`}
              </span>
            )}
            {draft.some((c) => locked.has(c.hex)) && (
              <span className={styles.muted}>
                {[...locked].filter((hex) => draft.some((c) => c.hex === hex)).length} locked
              </span>
            )}
          </div>

          {/* The room's second exit. Before this there was exactly one — "Apply
              to System" — which made a destination behave like a waypoint. */}
          <PaletteExport palette={draft} />

          {audit !== null && (
            /*
             * Shown whether or not the targets are being enforced. Enforcing
             * changes what the SOLVER chases; it does not change what the
             * palette is, and a draft rolled freely deserves the same honest
             * reading as one that was solved.
             */
            <div className={styles.targets}>
              <ul className={styles.targetList}>
                {audit.required.map((cell) => (
                  <li
                    key={`${cell.foreground}-${cell.background}`}
                    className={styles.target}
                  >
                    <span
                      className={cell.passes ? styles.tick : styles.cross}
                      aria-hidden="true"
                    >
                      {cell.passes ? '\u2713' : '\u2717'}
                    </span>
                    <span className={styles.targetLabel}>
                      {cell.foreground} on {cell.background}
                    </span>
                    <span className={cell.passes ? styles.pass : styles.fail}>
                      {cell.ratio.toFixed(2)}:1
                    </span>
                    <span className={styles.muted}>
                      needs {cell.required === TEXT_MINIMUM ? '4.5 AA' : '3 UI'}
                    </span>
                  </li>
                ))}
              </ul>
              {shortfall !== null && <p className={styles.shortfall}>{shortfall}</p>}
            </div>
          )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function solveInto(
  seed: Oklch,
  rule: HarmonyRule,
  chroma: ChromaStrategy,
  count: number,
  report: (unmet: readonly UnmetTarget[]) => void
) {
  const result = solvePalette(seed, { rule, chroma, count });
  report(result.unmet);
  return result.palette;
}

function rollInto(
  seed: Oklch,
  rule: HarmonyRule,
  chroma: ChromaStrategy,
  count: number,
  report: (unmet: readonly UnmetTarget[]) => void
) {
  report([]);
  return generatePalette(seed, { rule, chroma, count });
}

/**
 * THE SAME AUDIT THE VISUALIZER RUNS.
 *
 * This room used to grade a draft against four hand-picked pairs and the
 * verdict badge against exactly one of them (text on a panel). The visualizer
 * grades eleven. So the room that MAKES the palette could call it clean and
 * the room that SHOWS it could call the very same System "3 of 11 failing" —
 * and both numbers were correct, which is worse than one of them being wrong.
 *
 * Measured over 400 solved palettes, every single one this room called green
 * had at least one failure the visualizer would report: 240 of 240. Not an
 * edge case, and not a wording problem. The rooms were holding different
 * rulers.
 *
 * There is one ruler now. `buildRoleContrastMatrix` is the instrument in both
 * places, so a palette that reads clean here reads clean there, and a number
 * that appears in this room can be found again in the next one.
 *
 * Graded off `parseColor(hex)` rather than the generator's own OKLCH, because
 * the hex is what SHIPS. A System serialises to six-digit hex and every other
 * room parses it back (see `codec.ts`), so grading the draft at full float
 * precision reported a palette very slightly better than the one being saved —
 * 14.95:1 here against 14.91:1 one room later, from the same colors. Small,
 * but it is the same bug as the four-versus-eleven one in miniature: a number
 * the next room cannot reproduce.
 */
function auditOf(colors: readonly PaletteColor[]) {
  return buildRoleContrastMatrix(
    deriveRoles(colors.map((c) => ({ hex: c.hex, oklch: parseColor(c.hex) })))
  );
}

function samePalette(
  draft: readonly PaletteColor[],
  palette: readonly { readonly hex: string }[]
): boolean {
  if (draft.length !== palette.length) return false;
  return draft.every((color, index) => color.hex === palette[index]?.hex.toLowerCase());
}

/**
 * Merging a locked color back in can collide with one the new harmony
 * produced. A repeated hex would give two slots the same identity, and the
 * second would be unlockable because the key already exists.
 */
function dedupe(colors: readonly PaletteColor[]): PaletteColor[] {
  const seen = new Set<string>();
  const out: PaletteColor[] = [];
  for (const color of colors) {
    if (seen.has(color.hex)) continue;
    seen.add(color.hex);
    out.push(color);
  }
  return out;
}

function isFormControl(element: HTMLElement): boolean {
  const tag = element.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'SELECT' ||
    tag === 'TEXTAREA' ||
    tag === 'BUTTON' ||
    element.isContentEditable
  );
}
