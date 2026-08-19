'use client';

import { useCallback, useEffect, useState } from 'react';
import { contrastRatio, type Oklch } from '@/lib/color-engine';
import { deriveRoles } from '@/lib/roles/semantic-roles';
import { HARMONY_RULES, type ChromaStrategy, type HarmonyRule } from '@/lib/harmony/harmony';
import { PALETTE_SIZES, generatePalette, type PaletteColor } from '@/lib/harmony/palette';
import { nextSeedAwayFrom, randomSeed } from '@/lib/harmony/seed';
import { useSystem } from '@/lib/system/system-context';
import styles from './palette-composer.module.css';

/**
 * Compose — where a palette gets made.
 *
 * This is the half of the product that never existed. Everything downstream
 * assumed you had already arrived with colours; nothing anywhere turned one
 * colour into a set, which is the loop every competitor opens with and the
 * reason a collector named the Harmonic Dock had no harmony in it.
 *
 * The interaction is the one Coolors proved: roll, lock what you like, roll
 * again. What differs is underneath — the roll is constrained to seeds worth
 * building from, and the harmony is reconciled against the gamut so a locked
 * colour never shifts under you.
 *
 * The draft is deliberately *not* the System. Rolling is exploration and
 * should not rewrite the URL, push history, or repaint the other four tabs on
 * every press of the spacebar. It becomes the System only when applied.
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

  const build = useCallback(
    (nextSeed: Oklch, keep: ReadonlySet<string>, previous: readonly PaletteColor[]) => {
      const generated = generatePalette(nextSeed, { rule, chroma: strategy, count });
      // Locked colours hold their slot; the rest are replaced. Matching by
      // position rather than by colour is what makes a lock feel like a lock —
      // the swatch under your cursor does not move when you roll.
      const merged = generated.colors.map((color, index) => {
        const held = previous[index];
        return held !== undefined && keep.has(held.hex) ? held : color;
      });
      setSeed(nextSeed);
      setDraft(dedupe(merged));
    },
    [rule, strategy, count]
  );

  const roll = useCallback(() => {
    const from = seed?.h;
    const nextSeed =
      from === undefined ? randomSeed(Math.random) : nextSeedAwayFrom(from, Math.random);
    build(nextSeed, locked, draft);
  }, [seed, locked, draft, build]);

  // Regenerate when the rule, strategy or size changes, so the controls read
  // as live rather than as settings that need a separate roll to take effect.
  useEffect(() => {
    if (seed === null) return;
    build(seed, locked, draft);
    // Intentionally keyed on the controls alone: including draft or locked
    // would rebuild on every roll and every lock, undoing both.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule, strategy, count]);

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

  const preview = draft.length > 0 ? previewRoles(draft) : null;
  const isApplied = draft.length > 0 && samePalette(draft, system.palette);

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
          <span className={styles.fieldLabel}>Colours</span>
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
          Start from one colour and get a whole system — a ground, a surface, text that
          reads on both, and a brand colour with an accent. {RULE_HINTS[rule]}.
        </p>
      ) : (
        <>
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
                  <span className={styles.hex}>{color.hex.toUpperCase()}</span>
                  <span className={styles.origin}>{color.origin}</span>
                </li>
              );
            })}
          </ul>

          <div className={styles.readout}>
            <span>{RULE_HINTS[rule]}</span>
            {preview !== null && (
              <span className={preview.passes ? styles.pass : styles.fail}>
                text on surface {preview.ratio.toFixed(2)}:1
              </span>
            )}
            {seed !== null && draft.some((c) => locked.has(c.hex)) && (
              <span className={styles.muted}>
                {[...locked].filter((hex) => draft.some((c) => c.hex === hex)).length} locked
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** A generated palette should never be judged only by its swatches — this is
 *  the number that decides whether it is usable, shown before it is applied. */
function previewRoles(colors: readonly PaletteColor[]): { ratio: number; passes: boolean } {
  const roles = deriveRoles(colors.map((c) => ({ hex: c.hex, oklch: c.oklch })));
  const ratio = contrastRatio(roles.text.oklch, roles.surface.oklch);
  return { ratio, passes: ratio >= 4.5 };
}

function samePalette(
  draft: readonly PaletteColor[],
  palette: readonly { readonly hex: string }[]
): boolean {
  if (draft.length !== palette.length) return false;
  return draft.every((color, index) => color.hex === palette[index]?.hex.toLowerCase());
}

/**
 * Merging a locked colour back in can collide with one the new harmony
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
