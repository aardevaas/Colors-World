'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef } from 'react';
import { formatOklchCss } from '@/lib/color-engine';
import type { RoomColor } from '@/lib/landing/room-palette';
import { roomTheme } from '@/lib/landing/room-theme';
import { TABS, type TabId } from '@/lib/nav/tabs';
import styles from './colour-rooms.module.css';

/**
 * The six rooms, as six flooded bands. After GF Smith.
 *
 * ## What this replaces, and why
 *
 * A two-column grid of cards, each carrying a title, a subtitle and three
 * bullets. It was described as terrible twice, and the diagnosis in the
 * reference teardown was that the cards were fine as objects and wrong as an
 * argument: eighteen bullets across six boxes is a specification, and this is
 * the top of a landing page. GF Smith's site puts one idea on one ground and
 * lets the colour do the work, which is the correct move for a colour tool.
 *
 * ## The architecture, taken from GF Smith
 *
 * Their site has 21 Colorplan papers combined into 42 pair utilities. Each pair
 * sets nothing but a background and a foreground; a single rule then re-points
 * every semantic token — heading, text, link, even the site header — at that
 * pair; and every component is written against the semantics and never names a
 * colour. One class re-skins a whole section.
 *
 * The same three layers are here. The pair arrives as inline custom properties
 * (it has to: the colours are generated per visit and cannot be in a
 * stylesheet), `.room` maps pair to semantics, and everything below reads only
 * the semantics. The hover state is one rule that swaps the pair — which is why
 * a band, its type, its rule and its arrow all turn together.
 *
 * ## The part GF Smith cannot do
 *
 * Their 42 pairs are hand-picked against physical swatches, which is available
 * to you when your colours shipped in 2011 and never change. Ours are generated
 * from a seed on every visit, so no one can check them. They are solved instead
 * — see `room-theme.ts` — and the achieved ratio is printed on the band. A
 * colour tool that showed an unverified pair on its own front page would be
 * arguing against itself; showing the number is cheaper and more honest than
 * asking to be trusted.
 */

interface ColourRoomsProps {
  /** The generated six, in manifest order. */
  readonly rooms: readonly RoomColor[];
}

/**
 * One line per room, and one only.
 *
 * The previous version carried three bullets each. They are not lost — they are
 * the room's own case to make once someone is in it, and repeating them here
 * made the landing page a table of contents for a manual.
 */
const ROOM_LINE: Record<TabId, string> = {
  library:
    'All 16.7 million of them, computed on demand rather than pulled from a list somebody curated.',
  compose:
    'One colour in, a whole system out — reconciled against the gamut rather than clipped to it.',
  scales:
    'Every colour deepened into a ramp, with sRGB, Display P3 and Rec2020 marked on every step.',
  visualizer:
    'Proof on real interfaces rather than swatches, audited live as you change it.',
  typography:
    'Because contrast is a property of type, not just of colour. The boundary, drawn.',
  studio:
    'Where the system stops being yours and becomes something you can hand over.',
};

/**
 * The typography room sets its own name in mixed type — one face per letter,
 * as if the word had been hand-set from a case of loose sorts.
 *
 * Every other room uses the house display face, and that contrast is the point:
 * this is the room whose claim is that contrast is a property of type, so it
 * makes the claim in its own nameplate rather than only in its one line of copy.
 *
 * Each sort carries a size factor because the six families do not share an
 * x-height — Instrument Serif set at Archivo Black's size looks a third
 * smaller. The factors bring them to the same optical weight on the line rather
 * than the same nominal one.
 *
 * The rotation and baseline shift are small on purpose: enough to read as metal
 * type set by hand and locked up slightly out of true, not enough to look
 * broken. Cycled with `%` so the array is not coupled to the label's length.
 */
interface Sort {
  readonly family: string;
  readonly weight: number;
  readonly italic?: true;
  /** Multiplier on the band's display size. */
  readonly size: number;
  /** Degrees, as if the sort sat slightly askew in the forme. */
  readonly rotate: number;
  /** Baseline shift in em. */
  readonly shift: number;
}

const HAND_SET: readonly Sort[] = [
  { family: 'var(--font-display)', weight: 800, size: 1, rotate: -1.5, shift: 0 },
  { family: 'var(--font-serif)', weight: 400, italic: true, size: 1.34, rotate: 2, shift: 0.01 },
  { family: 'var(--font-grotesque)', weight: 400, size: 1.08, rotate: -0.5, shift: -0.015 },
  { family: 'var(--font-mono)', weight: 500, size: 1.02, rotate: 2.5, shift: 0.02 },
  { family: 'var(--font-hand)', weight: 700, size: 1.42, rotate: -3, shift: -0.01 },
  { family: 'var(--font-body)', weight: 600, size: 1.06, rotate: 1, shift: 0.015 },
  { family: 'var(--font-serif)', weight: 400, size: 1.34, rotate: -2, shift: 0 },
  { family: 'var(--font-display)', weight: 600, size: 0.98, rotate: 1.5, shift: -0.02 },
  { family: 'var(--font-grotesque)', weight: 400, size: 1.08, rotate: -1, shift: 0.01 },
  { family: 'var(--font-hand)', weight: 700, size: 1.42, rotate: 2.5, shift: -0.005 },
];

/**
 * Which texture each room wears. A `Record` keyed by `TabId` rather than an
 * array or an `nth-child` rule, so adding a room is a type error here instead
 * of a band that silently comes out plain.
 */
const ROOM_TEXTURE: Record<TabId, string | undefined> = {
  library: styles.texDots,
  compose: styles.texHatch,
  scales: styles.texSteps,
  visualizer: styles.texGrid,
  typography: styles.texRules,
  studio: styles.texGrain,
};

export function ColourRooms({ rooms }: ColourRoomsProps) {
  const listRef = useRef<HTMLOListElement>(null);

  /**
   * Solving six pairs costs around 10ms, which is worth paying once and never
   * again. `rooms` is regenerated only when the seed changes, so this recomputes
   * exactly when the colours actually change.
   */
  const themes = useMemo(
    () => rooms.map((room) => ({ room, theme: roomTheme(room.oklch) })),
    [rooms]
  );

  useRevealOnEnter(listRef);

  return (
    <section className={styles.section} aria-labelledby="rooms-heading">
      <header className={styles.header}>
        <p className={styles.eyebrow}>The rooms</p>
        {/* Counted from the manifest rather than written down: this said
            "Five tools" for a while after a sixth room shipped. */}
        <h2 className={styles.heading} id="rooms-heading">
          {TABS.length} rooms. One system running through all of them.
        </h2>
      </header>

      <ol className={styles.list} ref={listRef}>
        {themes.map(({ room, theme }, index) => {
          const tab = TABS[index];
          if (tab === undefined) return null;

          return (
            <li
              key={room.room}
              className={styles.room}
              style={
                {
                  // The pair, and nothing else. Every rule below this point
                  // reads a semantic token instead of one of these.
                  '--room-bg': formatOklchCss(theme.bg),
                  '--room-fg': formatOklchCss(theme.fg),
                  '--room-fg-quiet': formatOklchCss(theme.fgQuiet),
                  '--room-bg-hover': formatOklchCss(theme.bgHover),
                  '--room-fg-hover': formatOklchCss(theme.fgHover),
                } as React.CSSProperties
              }
            >
              <span
                className={`${styles.texture} ${ROOM_TEXTURE[tab.id] ?? ''}`}
                aria-hidden="true"
              />

              <Link href={tab.href} className={styles.link}>
                <span className={styles.index}>
                  {String(index + 1).padStart(2, '0')}
                </span>

                {/* A container, so the display type can be sized against the
                    column it actually occupies rather than the viewport — see
                    the note on `.name`. */}
                <div className={styles.nameCell}>
                  {/* `aria-label` so the word is announced as a word. Splitting
                      a heading into per-letter inline-blocks otherwise invites
                      a screen reader to spell it out. */}
                  <h3
                    className={
                      tab.id === 'typography'
                        ? `${styles.name} ${styles.handSet}`
                        : styles.name
                    }
                    aria-label={tab.id === 'typography' ? tab.label : undefined}
                  >
                    {tab.id === 'typography'
                      ? [...tab.label].map((letter, position) => {
                          const sort = HAND_SET[position % HAND_SET.length];
                          if (sort === undefined) return letter;
                          return (
                            <span
                              key={`${letter}-${position}`}
                              className={styles.sort}
                              style={
                                {
                                  '--sort-family': sort.family,
                                  '--sort-weight': sort.weight,
                                  '--sort-style': sort.italic === true ? 'italic' : 'normal',
                                  '--sort-size': sort.size,
                                  '--sort-rotate': `${sort.rotate}deg`,
                                  '--sort-shift': `${sort.shift}em`,
                                } as React.CSSProperties
                              }
                            >
                              {letter}
                            </span>
                          );
                        })
                      : tab.label}
                  </h3>
                </div>

                <p className={styles.line}>{ROOM_LINE[tab.id]}</p>

                <span className={styles.receipt}>
                  {/* The page showing its working. This pair was solved to
                      clear 4.5:1 and this is what it actually reached. */}
                  <span className={styles.ratio}>{theme.ratio.toFixed(2)}:1</span>
                  <span className={styles.receiptNote}>solved, not chosen</span>
                </span>

                <span className={styles.arrow} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" focusable="false">
                    <path
                      d="M4 12h15M13 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="square"
                    />
                  </svg>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Gap between two bands that arrive in the same callback. */
const STAGGER_MS = 130;

/**
 * Reveals each band as it arrives, wiping in from the left.
 *
 * An IntersectionObserver rather than `animation-timeline: view()` for the same
 * reason the cards used one: scroll timelines never advance in the headless
 * contexts this page is verified in, and a band that stays at `opacity: 0`
 * because a timeline is inactive is a far worse failure than one that appears
 * without ceremony.
 *
 * That principle is why the hidden state is applied at the moment the reveal is
 * already committed rather than on mount. No callback means no hidden state,
 * and the band simply renders.
 */
function useRevealOnEnter(ref: React.RefObject<HTMLOListElement | null>): void {
  useEffect(() => {
    const list = ref.current;
    if (list === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // CSS-module lookups are typed as possibly undefined. If the stylesheet
    // somehow did not provide these, skip the reveal rather than throw: the
    // bands then render plainly, which is the same fallback the missed-callback
    // case relies on.
    const { willReveal, isRevealing } = styles;
    if (willReveal === undefined || isRevealing === undefined) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Staggered across whatever arrived together, in document order.
        //
        // On a short viewport two or three bands cross the threshold in the
        // same callback, and revealing them simultaneously loses the
        // one-after-the-next reading entirely. Ordering by position rather
        // than by the entries array matters: IntersectionObserver makes no
        // promise about the order it reports, and scrolling up delivers them
        // bottom-first.
        const arrived = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target as HTMLElement)
          .sort((a, b) => a.offsetTop - b.offsetTop);

        arrived.forEach((band, position) => {
          observer.unobserve(band);

          band.style.setProperty('--reveal-delay', `${position * STAGGER_MS}ms`);
          band.classList.add(willReveal);
          // Flush the hidden state before the animating class lands; without
          // this the browser coalesces both into one change and there is
          // nothing to animate from.
          void band.offsetWidth;
          band.classList.add(isRevealing);
        });
      },
      { rootMargin: '0px 0px -15% 0px', threshold: 0.08 }
    );

    for (const band of list.children) observer.observe(band);
    return () => observer.disconnect();
  }, [ref]);
}

export default ColourRooms;
