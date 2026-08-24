/**
 * Published colour ratios a brand can adopt, and the ones it cannot.
 *
 * A proportion rule is the brand's to state — that is why `System.proportions`
 * starts empty and nothing is checked until it is filled. But "state a ratio"
 * is a blank page, and the manuals studied for the grain research already
 * contain real ones, so the guideline offers the rules that map onto this role
 * model exactly and is explicit about the ones that do not.
 *
 * **Only exact mappings are offered.** Monash writes "minimum 25% primary",
 * and `{ primary: { min: 0.25 } }` is that sentence with nothing added or
 * dropped. IRBA's 50/20/20 and Regus's 60/20/10/5/5 are deliberately absent
 * from this list: both state fixed shares across their own tier vocabulary,
 * where "secondary" is a brand tier rather than a UI role, and mapping a tier
 * onto `surface` would be inventing the correspondence and then citing a
 * manual for it. Their numbers are printed in the book as context; they are
 * not offered as a rule, because we would be making the rule up.
 */

import type { ProportionTarget } from '@/lib/system/types';

export interface ProportionPreset {
  readonly id: string;
  readonly label: string;
  /** What adopting it means, in the reader's terms. */
  readonly summary: string;
  /** Where it comes from, quoted closely enough to be checked. */
  readonly source: string;
  readonly target: ProportionTarget;
}

export const PROPORTION_PRESETS: readonly ProportionPreset[] = [
  {
    id: 'monash',
    label: 'Adopt Monash’s floor',
    summary: 'At least 25% primary, on every surface',
    source:
      'Monash University brand guidelines mandate a minimum 25% primary across all audiences.',
    target: { primary: { min: 0.25 } },
  },
];
