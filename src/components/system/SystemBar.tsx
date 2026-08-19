'use client';

import { useState, type DragEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSystem } from '@/lib/system/system-context';
import { SEMANTIC_ROLES } from '@/lib/roles/semantic-roles';
import { readSwatchDragPayload } from '@/lib/system/drag-payload';
import styles from './system-bar.module.css';

/**
 * The System Bar — the document, made visible on every route.
 *
 * This replaces the Harmonic Dock, and the change is not cosmetic. The dock
 * was a tray: it held colours and rendered nothing at all until you had
 * collected one, which meant the single mechanism tying five tabs together was
 * invisible precisely when a new visitor most needed to see it. The bar shows
 * the whole System — the palette, what each colour is currently doing, the
 * polarity, and a link that carries all of it — and it shows an invitation
 * when the System is empty rather than hiding.
 *
 * Not shown on the landing page, which is its own composed experience and gets
 * rebuilt around the System separately.
 */
export function SystemBar() {
  const {
    system,
    roles,
    addColor,
    removeColor,
    setAnchor,
    setMode,
    shareUrl,
  } = useSystem();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);

  if (pathname === '/') return null;

  const { palette, anchorHex, mode } = system;

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragOver(true);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragOver(false);
    const payload = readSwatchDragPayload(event);
    if (payload !== null) addColor(payload.hex, payload.oklch);
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked by permissions or an insecure origin. The
      // URL in the address bar is already correct, so there is nothing to
      // recover — only a confirmation we cannot honestly show.
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        className={styles.collapsedPill}
        onClick={() => setExpanded(true)}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        data-drag-over={dragOver}
        aria-label={
          palette.length === 0
            ? 'Open the System — no colours collected yet'
            : `Open the System — ${palette.length} colour${palette.length === 1 ? '' : 's'}`
        }
      >
        <span className={styles.stack} aria-hidden="true">
          {palette.length === 0
            ? SEMANTIC_ROLES.slice(0, 3).map((role) => (
                <span
                  key={role}
                  className={styles.stackSwatch}
                  style={{ background: roles[role].hex }}
                />
              ))
            : palette.slice(-5).map((color) => (
                <span
                  key={color.hex}
                  className={styles.stackSwatch}
                  style={{ background: color.hex }}
                />
              ))}
        </span>
        <span className={styles.count}>
          {palette.length === 0 ? 'System' : palette.length}
        </span>
      </button>
    );
  }

  return (
    <div
      className={styles.panel}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      data-drag-over={dragOver}
      role="region"
      aria-label="The System"
    >
      <header className={styles.panelHead}>
        <span className={styles.panelTitle}>
          System
          {palette.length > 0 && <span className={styles.panelCount}> · {palette.length}</span>}
        </span>
        <div className={styles.headActions}>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} polarity`}
          >
            {mode === 'dark' ? '☾ dark' : '☀ light'}
          </button>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => void handleShare()}
          >
            {copied ? 'copied' : 'share'}
          </button>
          <button
            type="button"
            className={styles.collapseButton}
            onClick={() => setExpanded(false)}
            aria-label="Collapse the System"
          >
            &times;
          </button>
        </div>
      </header>

      {palette.length === 0 ? (
        <p className={styles.empty}>
          Every tab reads from here. Collect a colour in{' '}
          <Link href="/library" className={styles.inlineLink}>
            Library
          </Link>{' '}
          and it becomes your palette, your roles and your type colours at once.
        </p>
      ) : (
        <>
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Palette</span>
            <div className={styles.itemRow}>
              {palette.map((color) => {
                const isAnchor = color.hex === anchorHex;
                return (
                  <div key={color.hex} className={styles.item} data-anchor={isAnchor}>
                    <button
                      type="button"
                      className={styles.swatch}
                      style={{ background: color.hex }}
                      onClick={() => setAnchor(color.hex)}
                      aria-pressed={isAnchor}
                      aria-label={
                        isAnchor
                          ? `${color.hex}, the anchor scales are built from`
                          : `${color.hex}. Make this the anchor`
                      }
                    >
                      {isAnchor && (
                        <span className={styles.anchorMark} aria-hidden="true">
                          &#9733;
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => removeColor(color.hex)}
                      aria-label={`Remove ${color.hex} from the System`}
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionLabel}>Roles</span>
            <ul className={styles.roleRow}>
              {SEMANTIC_ROLES.map((role) => (
                <li key={role} className={styles.role}>
                  <span
                    className={styles.roleSwatch}
                    style={{ background: roles[role].hex }}
                    aria-hidden="true"
                  />
                  <span className={styles.roleName}>{role}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <Link href="/builder" className={styles.primaryAction}>
        Open in Builder
      </Link>
    </div>
  );
}
