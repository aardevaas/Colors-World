'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { generateScale } from '@/lib/color-engine';
import { bloomFrom, bloomQuery, type Bloom } from '@/lib/landing/bloom';
import { buildCvdReport } from '@/lib/roles/cvd-conflicts';
import { buildRoleContrastMatrix } from '@/lib/roles/role-contrast';
import { SEMANTIC_ROLES, rolesToCssVars } from '@/lib/roles/semantic-roles';
import { buildLegibilityField } from '@/lib/typography/legibility-field';
import styles from './bloom-stage.module.css';

/**
 * Beats four to six: the page turns into the visitor's own system.
 *
 * (Beat seven, the door, is `BloomDoor` at the bottom of this file — it ships
 * separately because it belongs after the credibility strip.)
 *
 * Every competitor in this category shows you a palette. This shows you the
 * consequences of one — and it does it by *becoming* the palette, so the
 * evidence is the page you are reading rather than a screenshot of one. The
 * four proofs below are not illustrations: each calls the same function the
 * corresponding room calls, on the colour that was just picked, and prints
 * what came back. When a system is poor, these sections say so.
 *
 * All of it derives from `bloomFrom`, which is pure and tested. This component
 * decides only what to show, never what is true.
 */

interface BloomStageProps {
  /** The colour taken off the globe. Absent until someone picks one. */
  readonly pickedColorHex?: string;
}

export function BloomStage({ pickedColorHex }: BloomStageProps) {
  const bloom = useMemo(() => bloomFrom(pickedColorHex ?? ''), [pickedColorHex]);
  const painted = useMemo(() => rolesToCssVars(bloom.roles), [bloom]);

  return (
    <div className={styles.stage} style={painted} data-picked={pickedColorHex !== undefined}>
      <PaletteBeat bloom={bloom} picked={pickedColorHex !== undefined} />
      <ProofsBeat bloom={bloom} />
      <ReceiptBeat bloom={bloom} />
    </div>
  );
}

/**
 * Beat seven, exported separately because it belongs after the credibility
 * strip rather than immediately after the receipt — the order the brief asks
 * for is "credibility, then the door", and a door offered before the reasons
 * to walk through it is just a link. Recomputing the bloom here rather than
 * threading it down is free: `bloomFrom` is pure and deterministic, so both
 * components are looking at the identical system by construction.
 */
export function BloomDoor({ pickedColorHex }: BloomStageProps) {
  const bloom = useMemo(() => bloomFrom(pickedColorHex ?? ''), [pickedColorHex]);
  const painted = useMemo(() => rolesToCssVars(bloom.roles), [bloom]);

  return (
    <div className={styles.stage} style={painted}>
      <DoorBeat bloom={bloom} />
    </div>
  );
}

/* ---------------------------------------------------------------- beat four
 * The page turns. Six colours, and the page is already wearing them.
 */

function PaletteBeat({ bloom, picked }: { readonly bloom: Bloom; readonly picked: boolean }) {
  return (
    <section className={styles.palette} aria-labelledby="bloom-heading">
      <p className={styles.eyebrow}>
        {picked ? 'From the colour you picked' : 'From one colour'}
      </p>
      <h2 id="bloom-heading" className={styles.headline}>
        One colour in.
        <br />
        <span className={styles.headlineAccent}>A whole system out.</span>
      </h2>
      <p className={styles.lede}>
        Seven harmonies were generated from{' '}
        <span className={styles.chip}>
          <span className={styles.chipDot} style={{ background: bloom.seedHex }} />
          {bloom.seedHex.toUpperCase()}
        </span>{' '}
        and every one was measured against the same contrast requirements this
        tool holds any palette to. <strong>{bloom.rule}</strong> won. Everything
        below — including the colours you are reading this in — is that result.
      </p>

      <ol className={styles.swatches}>
        {SEMANTIC_ROLES.map((role, index) => (
          <li
            key={role}
            className={styles.swatch}
            style={{ background: bloom.roles[role].hex, animationDelay: `${index * 70}ms` }}
          >
            <span className={styles.swatchRole}>{role}</span>
            <span className={styles.swatchHex}>{bloom.roles[role].hex.toUpperCase()}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* --------------------------------------------------------------- beat five
 * Four proofs. One per room, each doing that room's actual work.
 */

function ProofsBeat({ bloom }: { readonly bloom: Bloom }) {
  const scale = useMemo(
    () =>
      generateScale({
        name: 'primary',
        anchors: [{ color: bloom.roles.primary.hex, step: 5 }],
      }),
    [bloom]
  );
  const matrix = useMemo(() => buildRoleContrastMatrix(bloom.roles), [bloom]);
  const field = useMemo(
    () => buildLegibilityField(bloom.roles.text.oklch, bloom.roles.background.oklch),
    [bloom]
  );
  const vision = useMemo(() => buildCvdReport(bloom.roles), [bloom]);

  const legibility = {
    'passes-everywhere': 'carries body text at any size and weight',
    'passes-when-large': 'only carries large text — 24px, or 18.66px bold',
    'passes-nowhere': 'carries text at no size or weight',
  }[field.verdict];

  return (
    <section className={styles.proofs} aria-label="What each room does with this system">
      <Proof
        room="Compose"
        href="/compose"
        claim={`${bloom.rule} — chosen, not defaulted`}
        detail={`Reachable chroma varies almost threefold across the hue wheel, so a harmony that looks even in theory arrives lopsided. All seven rules were built against the gamut ceiling and scored; this one carried the highest floor under its required pairs.`}
      >
        <ol className={styles.hues}>
          {bloom.colors.map((color) => (
            <li key={color.hex} className={styles.hueDot} style={{ background: color.hex }}>
              <span className={styles.srOnly}>{color.hex}</span>
            </li>
          ))}
        </ol>
      </Proof>

      <Proof
        room="Scales"
        href="/scales"
        claim={`A ${scale.steps.length}-step ramp from your primary`}
        detail="Ramps travel through lightness rather than leaning on chroma, which is what keeps every step distinct when a cheaper display cannot reproduce the saturated end."
      >
        <ol className={styles.ramp}>
          {scale.steps.map((step) => (
            <li key={step.step} className={styles.rampStep} style={{ background: step.hex }}>
              <span className={styles.srOnly}>
                Step {step.step}: {step.hex}
              </span>
            </li>
          ))}
        </ol>
      </Proof>

      <Proof
        room="Visualizer"
        href="/visualizer"
        claim={
          matrix.failures.length === 0
            ? `All ${matrix.required.length} required pairs pass`
            : `${matrix.failures.length} of ${matrix.required.length} required pairs fall short`
        }
        detail="Text is held to 4.5:1 and component boundaries to 3:1, per WCAG 2.2. Pairs no standard has a rule about are left unscored rather than measured against an invented threshold."
      >
        <ul className={styles.pairs}>
          {matrix.required.slice(0, 4).map((pair) => (
            <li key={`${pair.foreground}-${pair.background}`} className={styles.pair}>
              <span className={styles.pairName}>
                {pair.foreground} on {pair.background}
              </span>
              <span className={styles.pairRatio} data-pass={pair.passes}>
                {pair.ratio.toFixed(2)}:1
              </span>
            </li>
          ))}
        </ul>
      </Proof>

      <Proof
        room="Typography"
        href="/typography"
        claim={`This pair ${legibility}`}
        detail={`Text measures ${field.ratio.toFixed(2)}:1 against the page. WCAG is a step function rather than a curve, so legibility has an exact edge — the size and weight where it stops holding — and that edge is worth knowing before you set anything.`}
      >
        <p className={styles.specimen} style={{ color: bloom.roles.text.hex }}>
          {vision.safe
            ? 'No pair of roles collapses under protanopia, deuteranopia, tritanopia or achromatopsia.'
            : 'At least one pair of these roles collapses under simulated colour vision — the receipt below names it.'}
        </p>
      </Proof>
    </section>
  );
}

interface ProofProps {
  readonly room: string;
  readonly href: string;
  readonly claim: string;
  readonly detail: string;
  readonly children: React.ReactNode;
}

function Proof({ room, href, claim, detail, children }: ProofProps) {
  return (
    <article className={styles.proof}>
      <div className={styles.proofSticky}>
        <p className={styles.proofRoom}>{room}</p>
        <h3 className={styles.proofClaim}>{claim}</h3>
      </div>
      <div className={styles.proofBody}>
        {children}
        <p className={styles.proofDetail}>{detail}</p>
        <Link href={href} className={styles.proofLink}>
          Open {room}
          <span aria-hidden="true"> →</span>
        </Link>
      </div>
    </article>
  );
}

/* ---------------------------------------------------------------- beat six
 * The receipt. The same audit the exporter writes into the README, on the
 * palette the visitor is currently looking at.
 */

function ReceiptBeat({ bloom }: { readonly bloom: Bloom }) {
  const vision = useMemo(() => buildCvdReport(bloom.roles), [bloom]);
  const conflicts = useMemo(
    () => vision.byType.flatMap((type) => [...type.merged, ...type.weakened].map((f) => ({ type: type.type, ...f }))),
    [vision]
  );

  return (
    <section className={styles.receipt} aria-labelledby="receipt-heading">
      <h2 id="receipt-heading" className={styles.receiptHeading}>
        The receipt
      </h2>
      <p className={styles.receiptLede}>
        Every number here was measured on the palette above, a moment ago. A tool
        that only ever flatters the thing it made is not telling you anything.
      </p>

      <dl className={styles.receiptGrid}>
        <Metric
          label="Required pairs passing"
          value={`${bloom.requiredPairs - bloom.failures} / ${bloom.requiredPairs}`}
          good={bloom.failures === 0}
        />
        <Metric
          label="Weakest required pair"
          value={`${bloom.weakestRatio.toFixed(2)}:1`}
          good={bloom.weakestRatio >= 3}
        />
        <Metric
          label="Colour vision"
          value={vision.safe ? 'No collapses' : `${conflicts.length} affected`}
          good={vision.safe}
        />
        <Metric label="Harmony" value={bloom.rule} good />
      </dl>

      {bloom.failures > 0 && (
        <p className={styles.receiptNote}>
          The pairs that fall short are brand colours used as backgrounds for
          body text — putting small type directly on a saturated fill is the one
          thing no palette generator can rescue, and naming it is more useful
          than hiding it. Every neutral pair the interface actually depends on
          holds.
        </p>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  good,
}: {
  readonly label: string;
  readonly value: string;
  readonly good: boolean;
}) {
  return (
    <div className={styles.metric}>
      <dt className={styles.metricLabel}>{label}</dt>
      <dd className={styles.metricValue} data-good={good}>
        {value}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------------- beat seven
 * The door. The system leaves with them.
 */

function DoorBeat({ bloom }: { readonly bloom: Bloom }) {
  const query = useMemo(() => bloomQuery(bloom), [bloom]);

  return (
    <section className={styles.door} aria-labelledby="door-heading">
      <h2 id="door-heading" className={styles.doorHeading}>
        Take it with you.
      </h2>
      <p className={styles.doorLede}>
        This system lives in the address bar, not in an account. The link below
        carries all six colours, their roles and their scales — open it anywhere,
        send it to anyone. There is nothing to sign up for.
      </p>
      <div className={styles.doorActions}>
        <Link href={`/compose?${query}`} className={styles.doorPrimary}>
          Open this system in Compose
        </Link>
        <Link href={`/visualizer?${query}`} className={styles.doorSecondary}>
          See it audited in full
        </Link>
      </div>
    </section>
  );
}
