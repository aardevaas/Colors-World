import { formatOklchCss, parseColor } from '@/lib/color-engine';
import { REPO_URL, repoStats } from '@/lib/landing/repo-stats';
import { TEXT_MIN_RATIO, solveForeground } from '@/lib/landing/room-theme';
import styles from './credibility-strip.module.css';

/**
 * The section that converts a visitor into someone who trusts this.
 *
 * Every claim here is one they can check — the licence, the color space, the
 * standards, and a link to the code that demonstrably does all three. Nothing
 * on this page is an adjective.
 *
 * ## Why it is the one light section
 *
 * It used to be flat near-black, on the reasoning that the page had just spent
 * three screens being spectacular and the section whose job is to be believed
 * should not compete. The reasoning was right and its premise is gone: the
 * spectacle it was deferring to was the globe, which was removed, and what now
 * precedes it is six saturated flooded bands. Dropping from those into grey
 * text on black read as the page giving up rather than resolving.
 *
 * So it flips the ground instead — the one paper-white surface on the page.
 * That is the same device GF Smith uses to separate sections, and it does more
 * work here than a color would: after six color arguments, a white sheet says
 * the arguing is over and these are the facts. It is also the register the
 * content wants, which is a spec sheet rather than a pitch.
 *
 * ## A server component
 *
 * So the star count is rendered rather than popped in after hydration, and so a
 * slow or rate-limited GitHub never becomes a slow page: see repo-stats for the
 * timeout and the fallback.
 */

/**
 * Below this, the star count is left out.
 *
 * Not a technical limit — an editorial one, and the founder's call to change.
 * A star count reads as a credential when it says other people have found this
 * and stayed; at single digits it says the opposite, on the one section of the
 * page whose entire job is to be believed. The repository currently shows 2,
 * and printing "2" under a heading about being worth trusting actively costs
 * more than the row is worth.
 *
 * Nothing is faked and nothing is hidden that would mislead: the row appears on
 * its own once the number is an argument, and `repo-stats` was already built to
 * render correctly without it.
 */
const STARS_WORTH_SHOWING = 25;

/**
 * The colours the options are told apart by, solved rather than picked.
 *
 * The values used to be one string with middots between them — "sRGB · Display
 * P3 · Rec2020" — which makes a reader parse a list before they can count it.
 * Colour does that job instantly and without punctuation.
 *
 * Solved against this section's paper by the same function the six rooms use,
 * so every one of them clears 4.5:1 on it by construction. Hand-picking six
 * accents to sit on a near-white ground is exactly the job this codebase
 * already has a solver for, and picking them by eye on the page that sells the
 * solver would be the wrong way round.
 */
const PAPER = parseColor('oklch(96.5% 0.004 95)');

const OPTION_HUES = [25, 150, 262, 88, 320, 200] as const;

/*
 * Each hue is solved against PAPER — against paper's own lightness carried to
 * that hue, which is the same thing here because paper is all but neutral at
 * c: 0.004.
 *
 * The first attempt passed `{ l: 0.5, c: 0.12, h }` as the background, which is
 * a mid-tone of the hue and not the ground these sit on at all. The solver
 * dutifully returned foregrounds that clear 4.5:1 against THAT, and they came
 * out as pale tints — barely legible on a near-white sheet, in a section whose
 * subject is contrast. `side: 'darker'` then keeps the whole set as inks rather
 * than letting some solve light and some dark.
 */
const OPTION_COLORS: readonly string[] = OPTION_HUES.map((hue) =>
  formatOklchCss(
    solveForeground({ l: PAPER.l, c: PAPER.c, h: hue }, TEXT_MIN_RATIO, undefined, 'darker')
  )
);

interface Fact {
  readonly label: string;
  /** Split into its options rather than joined — see OPTION_COLORS. */
  readonly value: readonly string[];
  readonly note: string;
}

export async function CredibilityStrip() {
  const stats = await repoStats();

  /*
   * Every row is checkable in the repository, and the list is what the engine
   * actually does rather than what sounds impressive.
   *
   * "Color space: OKLCH" used to be the whole of it, which undersold the engine
   * badly — OKLCH is the space it *works* in, not the extent of what it speaks.
   * Separating the working space from the gamuts it maps into and the formats
   * it reads and writes is both more accurate and a stronger claim.
   */
  const facts: readonly Fact[] = [
    {
      label: 'Licence',
      value: ['MIT'],
      note: 'Depend on the color engine in your own work.',
    },
    {
      label: 'Working space',
      value: ['OKLCH'],
      note: 'Perceptually uniform end to end, which is what makes ordering by lightness mean anything.',
    },
    {
      label: 'Gamuts',
      value: ['sRGB', 'Display P3', 'Rec2020'],
      note: 'Every step of every ramp marked in all three, with a separate mapping for what print can hold.',
    },
    {
      label: 'Formats',
      value: ['HEX', 'RGB', 'HSL', 'CMYK'],
      note: 'Read in and written out around the same OKLCH core, so nothing drifts on the round trip.',
    },
    {
      label: 'Standards',
      value: ['WCAG 2.2', 'APCA'],
      note: 'The compliance number and the perceptual one, carried together rather than one standing in for the other — with ΔEOK for difference and four models of color blindness.',
    },
    ...(stats.stars !== null && stats.stars >= STARS_WORTH_SHOWING
      ? [
          {
            label: 'Stars',
            value: [stats.stars.toLocaleString('en')],
            note: 'On GitHub, where the whole thing lives.',
          },
        ]
      : []),
  ];

  return (
    <section className={styles.strip} aria-labelledby="credibility-heading">
      {/*
        Six cells across three columns.

        The claim is one of them rather than a column of its own: with five
        facts beside it, a two-column split left the specification tall and
        narrow while most of the width went unused. Three and three fills the
        measure and puts everything on the same footing.
      */}
      <div className={styles.inner}>
        <div className={styles.lead}>
          <h2 id="credibility-heading" className={styles.heading}>
            Open-source, you&rsquo;re welcome.
          </h2>

          <a className={styles.action} href={REPO_URL} target="_blank" rel="noopener noreferrer">
            <span className={styles.actionLabel}>Read the source</span>
            {/* The same square mark the rooms use, so the page has one arrow
                rather than a rounded pill here and a hard box above. */}
            <span className={styles.actionArrow} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" focusable="false">
                <path
                  d="M4 12h15M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="square"
                />
              </svg>
            </span>
          </a>

          <p className={styles.note}>No account, no trial, nothing to cancel.</p>
        </div>

        {facts.map((fact) => (
          <dl className={styles.fact} key={fact.label}>
            <dt className={styles.factLabel}>{fact.label}</dt>
            <dd className={styles.factValue}>
              {fact.value.map((option, index) => (
                <span
                  key={option}
                  className={styles.option}
                  style={
                    {
                      '--option-color':
                        OPTION_COLORS[index % OPTION_COLORS.length] ?? 'currentColor',
                    } as React.CSSProperties
                  }
                >
                  {option}
                </span>
              ))}
            </dd>
            <dd className={styles.factNote}>{fact.note}</dd>
          </dl>
        ))}
      </div>
    </section>
  );
}
