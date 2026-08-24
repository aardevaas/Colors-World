'use client';

import { useEffect, useState } from 'react';
import {
  guidelineTokenFilename,
  toGuidelineTokens,
  type GuidelineTokenFormat,
  type GuidelineTokenInput,
} from '@/lib/exporters/guideline-tokens';
import styles from './book.module.css';

/**
 * The three ways out of the guideline.
 *
 * The founder answered "both" to document-versus-living-link, so all three
 * ship, and they are deliberately not three versions of the same thing:
 *
 * - **The link IS the guideline.** Not an export of it — the System lives in
 *   the query string, so the address in the bar is already the whole document
 *   and anyone who opens it gets this page rebuilt from scratch on the server.
 *   Nothing is uploaded, nothing expires, and there is no account. This block
 *   exists because that was true and completely invisible.
 * - **Tokens** are the guideline as something a build reads.
 * - **Print** is the guideline as something a meeting reads. It goes through
 *   the browser's own print pipeline rather than a PDF library, so the PDF is
 *   this page — real text, real links, and no second renderer to drift from
 *   the first.
 *
 * The only client component in the Book besides the URL bridge, and the budget
 * it is held to is the reason the token exporter takes resolved font stacks as
 * strings: the ~385KB catalogue must not follow it into the browser.
 */

interface GuidelineExportProps {
  readonly tokens: GuidelineTokenInput;
  /** The System re-encoded by the codec — canonical, not whatever was typed. */
  readonly query: string;
}

const FORMATS: readonly { readonly value: GuidelineTokenFormat; readonly label: string }[] = [
  { value: 'css', label: 'CSS variables' },
  { value: 'tailwind', label: 'Tailwind v4' },
  { value: 'json', label: 'W3C / Figma JSON' },
];

const MIME: Readonly<Record<GuidelineTokenFormat, string>> = {
  css: 'text/css;charset=utf-8',
  tailwind: 'text/css;charset=utf-8',
  json: 'application/json;charset=utf-8',
};

const COPIED_FEEDBACK_MS = 1500;

export function GuidelineExport({ tokens, query }: GuidelineExportProps) {
  const path = query === '' ? '/brand' : `/brand?${query}`;

  // Starts as the path so the server and the first client render agree, then
  // becomes the absolute URL once there is a window to ask. Showing the real
  // thing matters here: the address IS the artifact, and a person who never
  // sees it has no reason to believe that.
  const [href, setHref] = useState(path);
  useEffect(() => setHref(`${window.location.origin}${path}`), [path]);

  const [format, setFormat] = useState<GuidelineTokenFormat>('css');
  const [copied, setCopied] = useState<string | null>(null);

  const code = toGuidelineTokens(tokens, format);

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), COPIED_FEEDBACK_MS);
    } catch {
      // Clipboard denied or unavailable — the button simply does not confirm,
      // rather than claiming a copy that did not happen.
    }
  }

  function download() {
    const blob = new Blob([code], { type: MIME[format] });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = guidelineTokenFilename(format);
    link.click();
    // Revoking immediately can cancel the download in some browsers; a frame
    // is enough for the click to have been handled.
    requestAnimationFrame(() => URL.revokeObjectURL(url));
  }

  return (
    <section className={styles.export} id="export" aria-labelledby="export-head">
      <h2 className={styles.sectionTitle} id="export-head">
        Take this with you
      </h2>

      <div className={styles.exportRow}>
        <div className={styles.exportWhat}>
          <h3 className={styles.exportTitle}>The link is the guideline</h3>
          <p className={styles.exportWhy}>
            Not a copy of it. The whole system travels in the address, so anyone who opens
            this rebuilds the same document — no account, no upload, nothing to expire.
          </p>
        </div>
        <div className={styles.exportDo}>
          <code className={styles.exportUrl}>{href}</code>
          <button
            type="button"
            className={styles.exportAction}
            onClick={() => void copy(href, 'link')}
          >
            {copied === 'link' ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>

      <div className={styles.exportRow}>
        <div className={styles.exportWhat}>
          <h3 className={styles.exportTitle}>Tokens</h3>
          <p className={styles.exportWhy}>
            The rules above as something a build reads: every role, every colour and the
            whole type ladder. Names, not values — <code>--color-primary</code>, so the
            colour can change without the code changing.
          </p>
        </div>
        <div className={styles.exportDo}>
          <div className={styles.exportTabs} role="tablist" aria-label="Token format">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                className={styles.exportTab}
                data-active={format === f.value}
                aria-selected={format === f.value}
                onClick={() => setFormat(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <pre className={styles.exportCode} tabIndex={0} aria-label={`${format} tokens`}>
            {code}
          </pre>
          <div className={styles.exportActions}>
            <button
              type="button"
              className={styles.exportAction}
              onClick={() => void copy(code, 'tokens')}
            >
              {copied === 'tokens' ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className={styles.exportAction} onClick={download}>
              Download {guidelineTokenFilename(format)}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.exportRow}>
        <div className={styles.exportWhat}>
          <h3 className={styles.exportTitle}>Print, or save as PDF</h3>
          <p className={styles.exportWhy}>
            This page, through the browser&rsquo;s own print pipeline — so the PDF has real
            text and real links, and there is no second renderer that could ever print
            something the page does not say.
          </p>
        </div>
        <div className={styles.exportDo}>
          <button type="button" className={styles.exportAction} onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>
    </section>
  );
}
