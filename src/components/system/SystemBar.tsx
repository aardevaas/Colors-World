'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { usePathname } from 'next/navigation';
import { useSystem } from '@/lib/system/system-context';
import { SEMANTIC_ROLES } from '@/lib/roles/semantic-roles';
import { readSwatchDragPayload } from '@/lib/system/drag-payload';
import { SystemLink } from './SystemLink';
import styles from './system-bar.module.css';

/**
 * The System Bar — the document, made visible on every route.
 *
 * This replaces the Harmonic Dock, and the change is not cosmetic. The dock
 * was a tray: it held colors and rendered nothing at all until you had
 * collected one, which meant the single mechanism tying five tabs together was
 * invisible precisely when a new visitor most needed to see it. The bar shows
 * the whole System — the palette, what each color is currently doing, the
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

  /*
   * Did the collection just grow?
   *
   * The one question a visitor has after pressing "+ Dock" on a card at the top
   * of a grid is whether anything happened, and the answer was a 126px pill at
   * the foot of the page quietly changing a word into a digit. Nothing moved,
   * nothing drew the eye, and the honest reading of that is "the button is
   * broken". This is the acknowledgement.
   */
  const [justAdded, setJustAdded] = useState(false);
  // Read off `system` rather than the destructured `palette`: that binding is
  // below the landing-page early return, and a hook cannot sit after one.
  const count = system.palette.length;
  const lastCountRef = useRef(count);
  useEffect(() => {
    if (count > lastCountRef.current) {
      setJustAdded(true);
      const clear = window.setTimeout(() => setJustAdded(false), 700);
      lastCountRef.current = count;
      return () => window.clearTimeout(clear);
    }
    lastCountRef.current = count;
  }, [count]);
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
        data-chrome="app"
        onClick={() => setExpanded(true)}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        data-drag-over={dragOver}
        data-added={justAdded}
        title={
          palette.length === 0
            ? 'Your System — collect colors here, or drop one in'
            : `Your System — ${palette.length} color${palette.length === 1 ? '' : 's'}`
        }
        aria-label={
          palette.length === 0
            ? 'Open the System — no colors collected yet'
            : `Open the System — ${palette.length} color${palette.length === 1 ? '' : 's'}`
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
        {/*
          The pill keeps its NAME once it has something in it.

          It used to swap the word "System" for a bare digit on the first colour
          — so the control shed the one label that said what it was at the exact
          moment it started to matter, and shrank while doing it. A thing that
          gains contents should not get smaller and quieter.
        */}
        <span className={styles.count}>
          System{palette.length > 0 && <span className={styles.countNumber}>{palette.length}</span>}
        </span>
      </button>
    );
  }

  return (
    <div
      className={styles.panel}
      data-chrome="app"
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
          Every tab reads from here. Collect a color in{' '}
          <SystemLink href="/library" className={styles.inlineLink}>
            Library
          </SystemLink>{' '}
          and it becomes your palette, your roles and your type colors at once.
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

      <SystemLink href="/scales" className={styles.primaryAction}>
        Open in Scales
      </SystemLink>
    </div>
  );
}
