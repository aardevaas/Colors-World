'use client';

import { useMemo, type PointerEvent } from 'react';
import { formatHex, type Gamut, type Oklch } from '@/lib/color-engine';
import { ceilingAt, chromaCeilingProfile } from '@/lib/harmony/ceiling';
import { harmonyHues, type HarmonyRule } from '@/lib/harmony/harmony';
import styles from './harmony-wheel.module.css';

/**
 * The hue wheel, drawn honestly.
 *
 * Every colour tool draws this as a perfect circle, which quietly asserts that
 * every hue is equally saturable. It is not. The perimeter here is the actual
 * chroma ceiling of the working gamut at the palette's brand lightness, so it
 * comes out visibly lopsided — at L=0.5 the reachable chroma swings 3.4x
 * between hue 200 and hue 285.
 *
 * That lopsidedness is the whole argument for this engine in one picture. It
 * is why a triad taken at constant chroma clips in HSL tools and does not
 * here, and it is not a claim about our maths — it is a measurement of the
 * display the person is looking at it on. Nobody else can draw it, because
 * nobody else computes it.
 */

const SIZE = 240;
const CENTRE = SIZE / 2;
const RADIUS = SIZE / 2 - 18;
/** Hue segments used to fill the ring. Fine enough to read as continuous. */
const RING_SEGMENTS = 96;

interface HarmonyWheelProps {
  readonly seed: Oklch | null;
  readonly rule: HarmonyRule;
  readonly lightness: number;
  readonly gamut: Gamut;
  readonly onPickHue: (hue: number) => void;
}

export function HarmonyWheel({ seed, rule, lightness, gamut, onPickHue }: HarmonyWheelProps) {
  const profile = useMemo(
    () => chromaCeilingProfile(lightness, gamut),
    [lightness, gamut]
  );

  const perimeter = useMemo(() => {
    const points = profile.samples.map((sample) => {
      const r = (sample.maxChroma / profile.strongest.maxChroma) * RADIUS;
      return polar(sample.hue, r);
    });
    return `M ${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')} Z`;
  }, [profile]);

  const ring = useMemo(
    () =>
      Array.from({ length: RING_SEGMENTS }, (_, i) => {
        const hue = (i * 360) / RING_SEGMENTS;
        const reach = ceilingAt(profile, hue);
        return {
          hue,
          // Each wedge is filled with the most saturated colour that hue can
          // actually hold, so the ring is a sample of the gamut rather than a
          // decorative rainbow.
          hex: formatHex({ l: lightness, c: reach, h: hue }),
        };
      }),
    [profile, lightness]
  );

  const spokes = useMemo(() => {
    if (seed === null) return [];
    return harmonyHues(rule, seed.h).map((hue, index) => {
      const reach = ceilingAt(profile, hue);
      const r = (reach / profile.strongest.maxChroma) * RADIUS;
      return {
        hue,
        isSeed: index === 0,
        end: polar(hue, r),
        hex: formatHex({ l: lightness, c: reach, h: hue }),
      };
    });
  }, [seed, rule, profile, lightness]);

  function handlePick(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * SIZE - CENTRE;
    const y = ((event.clientY - rect.top) / rect.height) * SIZE - CENTRE;
    // Screen y grows downward; hue grows anticlockwise from the right.
    const degrees = (Math.atan2(-y, x) * 180) / Math.PI;
    onPickHue(((degrees % 360) + 360) % 360);
  }

  return (
    <figure className={styles.wheel}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Hue wheel at lightness ${lightness.toFixed(2)}. Reachable chroma varies ${profile.spread.toFixed(1)} times across hue in ${gamut}; weakest at ${Math.round(profile.weakest.hue)} degrees.`}
        onPointerDown={handlePick}
        className={styles.svg}
      >
        <defs>
          <clipPath id="wheel-reach">
            <path d={perimeter} />
          </clipPath>
        </defs>

        {/* The gamut itself, clipped to its own ragged edge. */}
        <g clipPath="url(#wheel-reach)">
          {ring.map((segment) => {
            const a = polar(segment.hue - 180 / RING_SEGMENTS, RADIUS);
            const b = polar(segment.hue + 180 / RING_SEGMENTS, RADIUS);
            return (
              <path
                key={segment.hue}
                d={`M ${CENTRE} ${CENTRE} L ${a.x} ${a.y} L ${b.x} ${b.y} Z`}
                fill={segment.hex}
              />
            );
          })}
        </g>

        {/* A true circle behind it, so the gap between what a wheel usually
            claims and what the gamut actually offers is visible. */}
        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={RADIUS}
          className={styles.idealCircle}
        />
        <path d={perimeter} className={styles.reachEdge} />

        {spokes.map((spoke) => (
          <g key={spoke.hue}>
            <line
              x1={CENTRE}
              y1={CENTRE}
              x2={spoke.end.x}
              y2={spoke.end.y}
              className={spoke.isSeed ? styles.spokeSeed : styles.spoke}
            />
            <circle
              cx={spoke.end.x}
              cy={spoke.end.y}
              r={spoke.isSeed ? 7 : 5}
              fill={spoke.hex}
              className={styles.spokeDot}
            />
          </g>
        ))}
      </svg>

      <figcaption className={styles.caption}>
        <strong>{profile.spread.toFixed(1)}&times;</strong> difference in reachable chroma
        across the wheel at this lightness. The dotted circle is the perfect wheel every
        other tool draws; the filled shape is what {gamut} can actually show.
      </figcaption>
    </figure>
  );
}

/** Hue 0 at the right, increasing anticlockwise, matching the OKLCH convention. */
function polar(hue: number, radius: number): { x: number; y: number } {
  const radians = (hue * Math.PI) / 180;
  return {
    x: CENTRE + Math.cos(radians) * radius,
    y: CENTRE - Math.sin(radians) * radius,
  };
}
