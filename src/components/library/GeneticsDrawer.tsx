'use client';

import { useState } from 'react';
import { isInGamut, type Gamut } from '@/lib/color-engine';
import { ColorValues } from '@/components/color-values/ColorValues';
import { psychologyProfile } from '@/lib/spectrum/color-psychology';
import { familyRamp, type FamilyAxis } from '@/lib/spectrum/swatch-family';
import type { GeneratedSwatch } from '@/lib/spectrum/generate-color';
import type { ColorRecord } from '@/lib/supabase/colors';
import styles from './library.module.css';

interface GeneticsDrawerProps {
  readonly swatch: GeneratedSwatch;
  readonly semanticMatch: ColorRecord | null;
  readonly onClose: () => void;
  /** Clicking a family-tree sibling re-targets the whole drawer at it,
   *  rather than just previewing — this is the drawer's "go inspect that
   *  one instead" action, distinct from the card's own transient stepper
   *  preview (LibraryCard.tsx), which never commits to a new swatch. */
  readonly onInspect: (swatch: GeneratedSwatch) => void;
}

const GAMUTS: readonly { readonly label: string; readonly gamut: Gamut }[] = [
  { label: 'sRGB', gamut: 'srgb' },
  { label: 'P3', gamut: 'p3' },
  { label: 'Rec2020', gamut: 'rec2020' },
];

const FAMILY_TABS: readonly { readonly label: string; readonly axis: FamilyAxis }[] = [
  { label: 'Lightness', axis: 'lightness' },
  { label: 'Chroma', axis: 'chroma' },
  { label: 'Hue-torsion', axis: 'hue' },
];

export function GeneticsDrawer({ swatch, semanticMatch, onClose, onInspect }: GeneticsDrawerProps) {
  const [familyAxis, setFamilyAxis] = useState<FamilyAxis>('lightness');
  const profile = psychologyProfile(swatch.oklch);
  const ramp = familyRamp(swatch.index, familyAxis);

  return (
    <div className={styles.drawer} role="dialog" aria-label={`Color inspector for ${swatch.hex}`}>
      <div className={styles.drawerHeader}>
        <button type="button" className={styles.drawerClose} onClick={onClose} aria-label="Close inspector">
          ×
        </button>
      </div>

      <div className={styles.drawerHero} style={{ background: swatch.hex }} />

      <div className={styles.drawerBody}>
        <div className={styles.drawerTitleRow}>
          <span className={styles.drawerHex}>{swatch.hex.toUpperCase()}</span>
          {semanticMatch !== null && (
            <span className={styles.drawerMatchName}>{semanticMatch.name}</span>
          )}
        </div>
        {semanticMatch?.provenance === 'seed' && (
          <p className={styles.drawerSeedNotice}>
            Name and tags are seed data from Color-Pedia, not verified fact.
          </p>
        )}

        <section className={styles.drawerSection}>
          <h2 className={styles.drawerSectionTitle}>Gamut</h2>
          <div className={styles.gamutBadgeRow}>
            {GAMUTS.map(({ label, gamut }) => {
              const inGamut = isInGamut(swatch.oklch, gamut);
              return (
                <span
                  key={gamut}
                  className={styles.gamutBadge}
                  data-in-gamut={inGamut}
                  title={inGamut ? `Displayable in ${label}` : `Outside the ${label} gamut`}
                >
                  {label} {inGamut ? '✓' : '—'}
                </span>
              );
            })}
          </div>
        </section>

        <section className={styles.drawerSection}>
          <h2 className={styles.drawerSectionTitle}>Values</h2>
          <ColorValues oklch={swatch.oklch} />
        </section>

        <section className={styles.drawerSection}>
          <div className={styles.familyTreeHead}>
            <h2 className={styles.drawerSectionTitle}>Family tree</h2>
            <div className={styles.familyTabRow} role="tablist" aria-label="Family tree axis">
              {FAMILY_TABS.map((tab) => (
                <button
                  key={tab.axis}
                  type="button"
                  role="tab"
                  aria-selected={familyAxis === tab.axis}
                  className={styles.familyTab}
                  data-active={familyAxis === tab.axis}
                  onClick={() => setFamilyAxis(tab.axis)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.familyRamp}>
            {ramp.map((sibling, i) => (
              <button
                key={sibling.index}
                type="button"
                className={styles.familyRampSwatch}
                style={{ background: sibling.hex }}
                data-current={sibling.index === swatch.index}
                onClick={() => onInspect(sibling)}
                title={sibling.hex}
                aria-label={`Inspect ${familyAxis} sibling ${i + 1} of 10, ${sibling.hex}`}
              />
            ))}
          </div>
        </section>

        <section className={styles.drawerSection}>
          <h2 className={styles.drawerSectionTitle}>Color psychology</h2>
          <p className={styles.psychologyArchetype}>{profile.archetype}</p>
          <div className={styles.psychologyTags}>
            {profile.emotionalTags.map((tag) => (
              <span key={tag} className={styles.psychologyTag}>
                {tag}
              </span>
            ))}
          </div>
          <p className={styles.psychologyNote}>{profile.culturalNotes}</p>
          <p className={styles.psychologyNote}>{profile.physiological}</p>
          <p className={styles.drawerSeedNotice}>
            Procedurally generated from hue/lightness/chroma heuristics, not verified
            psychological research.
          </p>
        </section>
      </div>
    </div>
  );
}
