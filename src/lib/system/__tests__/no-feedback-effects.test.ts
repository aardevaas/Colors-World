import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * No effect may depend on the part of the System it writes to.
 *
 * This is the shape of a real bug, not a style rule. `BuilderShell` had an
 * effect that wrote scale settings into the System and another that read them
 * back and applied them over the Builder's own state. Each looked correct;
 * together they were a feedback loop. It survived review, two equality guards
 * and a full test suite, and surfaced only when someone DRAGGED a slider — a
 * single click never produced enough nested updates to trip React's limit,
 * and the same loop was silently reverting the value even when it did not
 * crash.
 *
 * ## What this catches, and what it does not — read this before trusting it
 *
 * It catches ONE effect that writes a System slice and also depends on it.
 * That found a live hazard the day it was written: the effect writing
 * `setScaleGlobals` also depended on `system.scales.steps`, and converged only
 * because the reducer happens to store that value verbatim. The day anything
 * clamps on the way in, that is the slider bug again.
 *
 * **It does NOT catch the two-effect cycle that motivated it.** Falsified
 * directly: putting `system.scales.byHex` back into the sync effect's
 * dependencies — the original bug, exactly — passes this test, because that
 * effect calls `dispatch` into local state rather than a System setter.
 * Neither half matches the rule on its own; only the pair is wrong.
 *
 * The obvious stricter rule — no effect may depend on any slice any effect in
 * the same component writes — flags working code, including BuilderShell's
 * once-guarded hydrate. A tripwire that fires on correct code gets suppressed,
 * and a suppressed tripwire catches nothing.
 *
 * So this is a narrow guard on a narrow mistake. The two-effect cycle needs a
 * browser, a real event stream and a drag; that sweep is documented in
 * `docs/interaction-sweep.md` and is not something a unit test replaces.
 *
 * Source-level, so an effect reaching a setter through two layers of
 * indirection slips past it too.
 */

/** Which slice of the System each setter writes. */
const WRITES: Readonly<Record<string, readonly string[]>> = {
  addColor: ['system.palette'],
  removeColor: ['system.palette'],
  setPalette: ['system.palette'],
  clearPalette: ['system.palette'],
  setAnchor: ['system.anchorHex'],
  setRoleOverride: ['system.roleOverrides'],
  clearRoleOverride: ['system.roleOverrides'],
  setType: ['system.type'],
  setMode: ['system.mode'],
  setScale: ['system.scales.byHex', 'system.scales'],
  setScaleGlobals: ['system.scales.steps', 'system.scales.gamut', 'system.scales'],
  setProportions: ['system.proportions'],
};

interface Effect {
  readonly body: string;
  readonly deps: string;
}

/** Every `useEffect(...)` in a file, with its body and dependency array. */
function effectsIn(source: string): readonly Effect[] {
  const out: Effect[] = [];
  for (const match of source.matchAll(/useEffect\(/g)) {
    const open = source.indexOf('{', match.index + match[0].length);
    if (open === -1) continue;
    let depth = 0;
    let i = open;
    for (; i < source.length; i++) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const deps = /\}\s*,\s*\[([^\]]*)\]/.exec(source.slice(i, i + 400));
    out.push({ body: source.slice(open, i), deps: deps?.[1] ?? '' });
  }
  return out;
}

const COMPONENT_ROOT = join(process.cwd(), 'src/components');
const files = globSync('**/*.tsx', { cwd: COMPONENT_ROOT })
  .map((f) => join(COMPONENT_ROOT, f))
  .filter((f) => readFileSync(f, 'utf8').includes('useSystem()'));

describe('effects must not depend on what they write', () => {
  test('there are components to check, so a broken glob cannot pass silently', () => {
    expect(files.length).toBeGreaterThan(3);
  });

  test.each(files.map((f) => [relative(COMPONENT_ROOT, f), f] as const))(
    '%s',
    (_name, file) => {
      const source = readFileSync(file, 'utf8');
      const offences: string[] = [];

      for (const effect of effectsIn(source)) {
        for (const [setter, slices] of Object.entries(WRITES)) {
          if (!new RegExp(`\\b${setter}\\s*\\(`).test(effect.body)) continue;
          for (const slice of slices) {
            // `system.scales` in the deps also covers `system.scales.byHex`.
            if (effect.deps.includes(slice)) {
              offences.push(
                `an effect calls ${setter}() and also depends on ${slice} — ` +
                  `that is a feedback loop waiting for a fast enough input stream`
              );
            }
          }
        }
      }

      expect(offences).toEqual([]);
    }
  );
});
