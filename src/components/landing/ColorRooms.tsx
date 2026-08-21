'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef } from 'react';
import { formatOklchCss } from '@/lib/color-engine';
import type { RoomColor } from '@/lib/landing/room-palette';
import { roomTheme } from '@/lib/landing/room-theme';
import { useTextureRipple } from '@/lib/landing/use-texture-ripple';
import { TABS, type TabId } from '@/lib/nav/tabs';
import styles from './color-rooms.module.css';

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
 * lets the color do the work, which is the correct move for a color tool.
 *
 * ## The architecture, taken from GF Smith
 *
 * Their site has 21 Colorplan papers combined into 42 pair utilities. Each pair
 * sets nothing but a background and a foreground; a single rule then re-points
 * every semantic token — heading, text, link, even the site header — at that
 * pair; and every component is written against the semantics and never names a
 * color. One class re-skins a whole section.
 *
 * The same three layers are here. The pair arrives as inline custom properties
 * (it has to: the colors are generated per visit and cannot be in a
 * stylesheet), `.room` maps pair to semantics, and everything below reads only
 * the semantics. The hover state is one rule that swaps the pair — which is why
 * a band, its type, its rule and its arrow all turn together.
 *
 * ## The part GF Smith cannot do
 *
 * Their 42 pairs are hand-picked against physical swatches, which is available
 * to you when your colors shipped in 2011 and never change. Ours are generated
 * from a seed on every visit, so no one can check them. They are solved instead
 * — see `room-theme.ts` — against a 4.5:1 floor that holds for every hue and
 * every hover state.
 *
 * The bands used to print the ratio each pair achieved, as the page showing its
 * working. It was cut: a bare "4.57:1" beside a room name is a number a visitor
 * has no way to read, and the guarantee is worth more as something that is
 * simply true than as something announced. The solver and its tests are
 * unchanged.
 */

interface ColorRoomsProps {
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
    'One color in, a whole system out — reconciled against the gamut rather than clipped to it.',
  scales:
    'Every color deepened into a ramp, with sRGB, Display P3 and Rec2020 marked on every step.',
  visualizer:
    'Proof on real interfaces rather than swatches, audited live as you change it.',
  typography:
    'Because contrast is a property of type, not just of color. The boundary, drawn.',
  studio:
    'Where the system stops being yours and becomes something you can hand over.',
};

/**
 * Which pattern each room owns. A `Record` keyed by `TabId` rather than an array
 * or an `nth-child` rule, so adding a room is a type error here instead of a
 * band that silently comes out plain.
 *
 * Applied to the BAND, not to the texture layer. The ripple is a sibling of the
 * texture rather than a child, so a pattern declared on the texture never
 * reached it — which is why all six rooms used to ripple identically. On the
 * band, both read the same source.
 */
const ROOM_PATTERN: Record<TabId, string | undefined> = {
  library: styles.patDots,
  compose: styles.patHatch,
  scales: styles.patSteps,
  visualizer: styles.patGrid,
  typography: styles.patRules,
  studio: styles.patGrain,
};

/**
 * The room count as a word.
 *
 * The heading reads better spelled out, and the count still comes from the
 * manifest rather than the copy. Falls back to the digits for any number the
 * list does not cover — a seventh room should read oddly for a moment, not
 * crash or silently say six.
 */
function spellCount(count: number): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
  const word = words[count];
  if (word === undefined) return String(count);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function ColorRooms({ rooms }: ColorRoomsProps) {
  const listRef = useRef<HTMLOListElement>(null);

  /**
   * Solving six pairs costs around 10ms, which is worth paying once and never
   * again. `rooms` is regenerated only when the seed changes, so this recomputes
   * exactly when the colors actually change.
   */
  const themes = useMemo(
    () => rooms.map((room) => ({ room, theme: roomTheme(room.oklch) })),
    [rooms]
  );

  useRevealOnEnter(listRef);
  useTextureRipple(listRef);

  return (
    <section className={styles.section} aria-labelledby="rooms-heading">
      <header className={styles.header}>
        {/* Two lines, set as two blocks rather than one string with a <br>, so
            the break is a layout decision the stylesheet can undo at narrow
            widths rather than a character baked into the copy.

            The count is still read from the manifest rather than written down —
            this said "Five tools" for a while after a sixth room shipped. */}
        <h2 className={styles.heading} id="rooms-heading">
          <span className={styles.headingLine}>{spellCount(TABS.length)} rooms.</span>
          <span className={styles.headingLine}>One system</span>
        </h2>
      </header>

      <ol className={styles.list} ref={listRef}>
        {themes.map(({ room, theme }, index) => {
          const tab = TABS[index];
          if (tab === undefined) return null;

          return (
            <li
              key={room.room}
              className={`${styles.room} ${ROOM_PATTERN[tab.id] ?? ''}`}
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
              <span className={styles.texture} aria-hidden="true" />

              {/* A ring of this room's own pattern, spreading from the
                  pointer — both layers read `--pattern-image` /
                  `--ripple-image` off the band. */}
              <span className={styles.ripple} aria-hidden="true">
                <span className={styles.wave} />
                <span className={styles.wave} />
              </span>

              <Link href={tab.href} className={styles.link}>
                <span className={styles.index}>
                  {String(index + 1).padStart(2, '0')}
                </span>

                {/* A container, so the display type can be sized against the
                    column it actually occupies rather than the viewport — see
                    the note on `.name`. */}
                <div className={styles.nameCell}>
                  {/*
                    The typography room carries a second copy of its own name in
                    Rubik Wet Paint, stacked over the first and cross-faded on
                    hover.

                    Two copies rather than swapping `font-family`, because a
                    swap cannot be transitioned and would resize the word on the
                    frame it happened. The house copy stays in flow and owns the
                    box; the painted one is absolute, so it can be a different
                    width without moving anything. It is `aria-hidden`, since
                    the word is already in the heading once.

                    This replaces a version that set every letter in a different
                    face. Every other room uses the house type, and the room
                    only departs from it under the pointer — which is the more
                    typographic idea anyway: the demonstration is the change,
                    not the ransom note.
                  */}
                  <h3 className={styles.name}>
                    {tab.id === 'typography' ? (
                      <span className={styles.paintable}>
                        <span className={styles.faceHouse}>{tab.label}</span>
                        <span className={styles.facePaint} aria-hidden="true">
                          {tab.label}
                        </span>
                      </span>
                    ) : (
                      tab.label
                    )}
                  </h3>
                </div>

                <p className={styles.line}>{ROOM_LINE[tab.id]}</p>

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

/** Gap between two bands that arrive in the same callback. Widened with the
 *  slower wipe so the cascade stays legible as one-after-the-next. */
const STAGGER_MS = 190;

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

export default ColorRooms;
