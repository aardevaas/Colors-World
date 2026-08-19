import styles from './typography.module.css';

/**
 * The three specimen views.
 *
 * Every size comes from the generated scale via CSS custom properties
 * (--type-display, --type-h1, …), so changing ratio or base size repaints all
 * three without a re-render — same technique as the /visualizer templates.
 *
 * `data-audit-size` / `data-audit-weight` mark what the legibility panel
 * measures. A specimen is the only place where a size that technically passes
 * an audit still reads badly, so the numbers need to be attached to real
 * rendered text rather than to abstract tokens.
 */

export type SpecimenId = 'magazine' | 'document' | 'ladder';

export interface SpecimenEntry {
  readonly id: SpecimenId;
  readonly label: string;
  readonly Component: () => React.JSX.Element;
}

function Magazine() {
  return (
    <article className={styles.magazine}>
      <p className={styles.kicker}>Field notes · Issue 04</p>
      <h1 className={styles.magazineHeadline} data-audit-size="display" data-audit-weight="700">
        The quiet argument for slower type
      </h1>
      <p className={styles.standfirst} data-audit-size="h4" data-audit-weight="400">
        Every typeface is a set of decisions someone already made for you. Reading
        slowly is how you find out which ones you disagree with.
      </p>

      <div className={styles.columns}>
        <p className={styles.dropCapParagraph} data-audit-size="body" data-audit-weight="400">
          <span className={styles.dropCap}>T</span>
          here is a moment, somewhere between the third and fourth revision, when a
          page stops being a collection of elements and starts being a voice. It is
          rarely the moment anyone plans for. The grid was settled weeks ago; the
          palette was argued over and signed off. What changes is smaller than that
          and harder to point at.
        </p>
        <p data-audit-size="body" data-audit-weight="400">
          Type carries the argument because it is the only part of a design that has
          to be read rather than merely seen. A colour can be admired at a glance. A
          sentence has to be walked through, one word at a time, at whatever pace the
          letterforms allow. Set it too tight and the reader hurries. Set it too
          loose and they drift.
        </p>
      </div>

      <blockquote className={styles.pullQuote} data-audit-size="h2" data-audit-weight="500">
        “Set it too tight and the reader hurries.”
      </blockquote>
    </article>
  );
}

function Document() {
  return (
    <article className={styles.document}>
      <h2 className={styles.docHeading} data-audit-size="h2" data-audit-weight="700">
        Installing the engine
      </h2>
      <p data-audit-size="body" data-audit-weight="400">
        The colour engine ships as an MIT-licensed module. Install it, then import
        only what you need — every export is individually tree-shakeable.
      </p>

      <pre className={styles.codeBlock}>
        <code>
          {`import { generateScale, contrastRatio } from '@colorsworld/engine';

const ramp = generateScale({
  name: 'primary',
  steps: 10,
  anchors: [{ step: 6, color: '#7C5CFF' }],
  gamut: 'p3',
});`}
        </code>
      </pre>

      <p data-audit-size="body" data-audit-weight="400">
        Use <code className={styles.inlineCode}>contrastRatio()</code> for WCAG and{' '}
        <code className={styles.inlineCode}>apcaContrast()</code> when polarity
        matters — APCA is directional, so swapping text and background changes the
        answer.
      </p>

      <aside className={styles.callout} data-audit-size="small" data-audit-weight="500">
        Note: scales are computed, never stored. The same spec always produces the
        same ramp on every device.
      </aside>
    </article>
  );
}

const LADDER_ROWS = [
  { token: 'display', sample: 'Display' },
  { token: 'h1', sample: 'Heading one' },
  { token: 'h2', sample: 'Heading two' },
  { token: 'h3', sample: 'Heading three' },
  { token: 'h4', sample: 'Heading four' },
  { token: 'body', sample: 'Body copy' },
  { token: 'small', sample: 'Small print' },
  { token: 'caption', sample: 'Caption' },
] as const;

function Ladder() {
  return (
    <div className={styles.ladder}>
      {LADDER_ROWS.map((row) => (
        <div key={row.token} className={styles.ladderRow}>
          <span
            className={styles.ladderSample}
            style={{ fontSize: `var(--type-${row.token})` }}
            data-audit-size={row.token}
            data-audit-weight={row.token === 'body' || row.token === 'small' || row.token === 'caption' ? '400' : '600'}
          >
            {row.sample}
          </span>
          <span className={styles.ladderMeta} data-token={row.token} />
        </div>
      ))}
    </div>
  );
}

export const SPECIMENS: readonly SpecimenEntry[] = [
  { id: 'magazine', label: 'Magazine', Component: Magazine },
  { id: 'document', label: 'Docs & code', Component: Document },
  { id: 'ladder', label: 'Hierarchy ladder', Component: Ladder },
];

export function specimenById(id: SpecimenId): SpecimenEntry {
  const entry = SPECIMENS.find((s) => s.id === id);
  if (entry === undefined) throw new Error(`Unknown specimen id: ${id}`);
  return entry;
}
