import { SECTION_LABELS, type SectionId } from '@/lib/brand/ids';
import { componentsInSection, validateBook } from '@/lib/brand/registry';
import { systemRoles } from '@/lib/brand/colour';
import { resolvedStacks } from '@/lib/brand/typography';
import type { BookBlock, BookEntry, BrandState, Evidence, Finding } from '@/lib/brand/types';
import { DEFAULT_BOOK_VIEW, visibleBlocks, type BookView } from '@/lib/brand/view';
import { encodeSystem } from '@/lib/system/codec';
import { GuidelineExport } from './GuidelineExport';
import styles from './book.module.css';

/**
 * The guideline itself — one continuous document, rendered on the server.
 *
 * Server on purpose, and it is not an optimisation. The registry pulls in the
 * ~385KB font catalogue and every component's renderer; shipping that to draw
 * a document nobody interacts with would cost more than the rest of the product
 * combined. Everything here is plain markup and anchors, so it needs no
 * client JavaScript at all.
 *
 * ## What this is NOT
 *
 * Not a checklist, and not a wizard. There is no completeness percentage,
 * because a number like "18 of 98" is hostile to the largest group this product
 * will ever have — the person who wanted a palette and got one. What is not
 * set is shown quietly, says what would fill it, and is otherwise left alone.
 */

interface BookDocumentProps {
  readonly state: BrandState;
  /** Defaults to the whole internal document — see `lib/brand/view.ts`. */
  readonly view?: BookView;
}

const EVIDENCE_LABEL: Readonly<Record<Evidence, string>> = {
  measured: 'measured',
  cited: 'cited',
  declared: 'declared',
};

/** Sections in the order the book presents them. */
const SECTION_ORDER: readonly SectionId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function anchorFor(section: SectionId): string {
  return `section-${section}`;
}

function EntryRow({ entry, fallback }: { entry: BookEntry; fallback: Evidence }) {
  const evidence = entry.evidence ?? fallback;
  return (
    <>
      <dt className={styles.entryKey}>{entry.label}</dt>
      <dd className={styles.entryValue}>
        {entry.href === undefined ? (
          <span className={styles.entryText}>{entry.value}</span>
        ) : (
          <a className={`${styles.entryText} ${styles.entryLink}`} href={entry.href}>
            {entry.value}
          </a>
        )}
        {entry.evidence !== undefined && (
          // Only when the line differs from its block — a swatch's hex is
          // declared while the ratio beside it is measured, and that
          // difference is the whole point of the field.
          <span className={styles.entryTag} data-evidence={evidence}>
            {EVIDENCE_LABEL[evidence]}
          </span>
        )}
        {entry.note !== undefined && <span className={styles.entryNote}>{entry.note}</span>}
      </dd>
    </>
  );
}

function Block({ block, findings }: { block: BookBlock; findings: readonly Finding[] }) {
  if (block.kind === 'absent') {
    return (
      <article className={styles.block} data-state="absent">
        <header className={styles.blockHead}>
          <h3 className={styles.blockTitle}>{block.title}</h3>
          <span className={styles.tag} data-evidence="none">
            not set
          </span>
        </header>
        <p className={styles.absentWhy}>{block.reason}</p>
      </article>
    );
  }

  const failures = findings.filter((f) => f.severity === 'fail');
  const warnings = findings.filter((f) => f.severity === 'warn');

  return (
    <article className={styles.block} data-state="present" id={block.id}>
      <header className={styles.blockHead}>
        <h3 className={styles.blockTitle}>{block.title}</h3>
        <span className={styles.tag} data-evidence={block.evidence}>
          {EVIDENCE_LABEL[block.evidence]}
        </span>
        {failures.length > 0 && (
          <span className={styles.tag} data-evidence="fail">
            {failures.length} failing
          </span>
        )}
        {warnings.length > 0 && (
          <span className={styles.tag} data-evidence="warn">
            {warnings.length} to check
          </span>
        )}
      </header>

      <dl className={styles.entries}>
        {block.entries.map((entry, i) => (
          <EntryRow key={`${entry.label}-${i}`} entry={entry} fallback={block.evidence} />
        ))}
      </dl>

      {findings.map((finding, i) => (
        <p key={i} className={styles.finding} data-severity={finding.severity}>
          <span className={styles.findingNumbers}>
            {finding.measured ?? '—'}
            {finding.expected !== undefined && ` / ${finding.expected}`}
          </span>
          <span>{finding.message}</span>
        </p>
      ))}
    </article>
  );
}

export function BookDocument({ state, view = DEFAULT_BOOK_VIEW }: BookDocumentProps) {
  const findings = validateBook(state);
  const findingsFor = (id: string): readonly Finding[] =>
    findings.filter((f) => f.componentId === id);

  const sections = SECTION_ORDER.map((section) => {
    const rendered = componentsInSection(section).map((component) => component.render(state));
    return {
      section,
      // Filtered for display; counted before filtering. "9 of 15 specified"
      // has to keep meaning nine of fifteen even in the trimmed view — a count
      // that silently became "9 of 9" would turn an export choice into a claim
      // that nothing is missing.
      blocks: visibleBlocks(rendered, view),
      present: rendered.filter((b) => b.kind === 'present').length,
      total: rendered.length,
    };
  });

  const failing = findings.filter((f) => f.severity === 'fail').length;

  return (
    <div className={styles.book}>
      <nav className={styles.rail} aria-label="Guideline sections">
        <div className={styles.railInner}>
          <p className={styles.railHead}>Guideline</p>
          <ul className={styles.railList}>
            {sections
              .filter(({ blocks }) => blocks.length > 0)
              .map(({ section, present, total }) => (
              <li key={section}>
                <a className={styles.railLink} href={`#${anchorFor(section)}`}>
                  <span
                    className={styles.pip}
                    data-fill={present === 0 ? 'none' : present === total ? 'full' : 'part'}
                    aria-hidden="true"
                  />
                  <span className={styles.railLabel}>{SECTION_LABELS[section]}</span>
                  <span className={styles.railCount}>
                    {present}/{total}
                  </span>
                </a>
              </li>
              ))}
          </ul>

          {findings.length > 0 && (
            <>
              <p className={styles.railHead}>Checks</p>
              <a className={styles.railLink} href="#findings">
                <span className={styles.pip} data-fill="alarm" aria-hidden="true" />
                <span className={styles.railLabel}>Findings</span>
                <span className={styles.railCount}>{findings.length}</span>
              </a>
            </>
          )}

          <p className={styles.railHead}>Export</p>
          <a className={styles.railLink} href="#export">
            <span className={styles.pip} data-fill="full" aria-hidden="true" />
            <span className={styles.railLabel}>Take it with you</span>
          </a>
        </div>
      </nav>

      <div className={styles.doc}>
        <header className={styles.docHead}>
          <h1 className={styles.docTitle}>Internal brand guideline</h1>
          <p className={styles.docMeta}>
            <span>Draft</span>
            <span>
              {sections.reduce((n, s) => n + s.present, 0)} of{' '}
              {sections.reduce((n, s) => n + s.total, 0)} specified
            </span>
            {failing > 0 && <span className={styles.docMetaAlarm}>{failing} failing</span>}
          </p>
          <p className={styles.docLede}>
            Every rule below is derived from the system you built, and the measured ones are
            re-checked each time this page renders. Nothing here was typed in that could be
            computed.
          </p>
        </header>

        {findings.length > 0 && (
          <section className={styles.findingsPanel} id="findings" aria-labelledby="findings-head">
            <h2 className={styles.findingsHead} id="findings-head">
              What this guideline can prove is wrong
            </h2>
            <ul className={styles.findingsList}>
              {findings.map((finding, i) => (
                <li key={i} className={styles.finding} data-severity={finding.severity}>
                  <span className={styles.findingNumbers}>
                    {finding.measured ?? '—'}
                    {finding.expected !== undefined && ` / ${finding.expected}`}
                  </span>
                  <span>
                    <a className={styles.findingLink} href={`#${finding.componentId}`}>
                      {finding.componentId}
                    </a>{' '}
                    {finding.message}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {sections
          .filter(({ blocks }) => blocks.length > 0)
          .map(({ section, blocks, present, total }) => (
          <section
            key={section}
            className={styles.section}
            id={anchorFor(section)}
            aria-labelledby={`${anchorFor(section)}-head`}
          >
            <header className={styles.sectionHead}>
              <h2 className={styles.sectionTitle} id={`${anchorFor(section)}-head`}>
                {SECTION_LABELS[section]}
              </h2>
              <span className={styles.sectionCount}>
                {present} of {total} specified
              </span>
            </header>
            {blocks.map((block) => (
              <Block key={block.id} block={block} findings={findingsFor(block.id)} />
            ))}
          </section>
          ))}

        {/* Resolved here, on the server, and handed down as plain strings and
            numbers. `resolvedStacks` reaches into the ~385KB font catalogue,
            which this component already pays for and the browser must not. */}
        <GuidelineExport
          view={view}
          query={encodeSystem(state.system)}
          tokens={{
            roles: systemRoles(state.system),
            palette: state.system.palette,
            type: state.system.type,
            stacks: resolvedStacks(state),
            mode: state.system.mode,
          }}
        />
      </div>
    </div>
  );
}
