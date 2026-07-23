'use client';

import { useState } from 'react';
import { getOrCreateShareLinkAction, revokeShareLinkAction } from '@/app/actions';
import type { ShareLinkRecord } from '@/lib/supabase/sharing';
import styles from './studio-wall.module.css';

/**
 * "Send a board to a client or supplier who has no account and never will."
 * A get-or-create button: the first click mints a link, later clicks just
 * reveal the same one until it's explicitly revoked.
 */
export function ShareControl() {
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState<ShareLinkRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleOpen() {
    setOpen(true);
    if (share !== null) return;
    setLoading(true);
    try {
      setShare(await getOrCreateShareLinkAction());
    } finally {
      setLoading(false);
    }
  }

  function shareUrl(token: string): string {
    return `${window.location.origin}/share/${token}`;
  }

  async function handleCopy() {
    if (share === null) return;
    await navigator.clipboard.writeText(shareUrl(share.token));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleRevoke() {
    if (share === null) return;
    setLoading(true);
    try {
      await revokeShareLinkAction(share.id);
      setShare(null);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.shareControl}>
      <button type="button" className={styles.navLink} onClick={() => void handleOpen()}>
        share
      </button>
      {open && (
        <div className={styles.sharePopover}>
          {loading && share === null ? (
            <p className={styles.sharePopoverStatus}>Creating link…</p>
          ) : share !== null ? (
            <>
              <input
                type="text"
                readOnly
                className={styles.shareUrlInput}
                value={shareUrl(share.token)}
                onFocus={(event) => event.currentTarget.select()}
              />
              <div className={styles.sharePopoverActions}>
                <button type="button" className={styles.shareActionButton} onClick={() => void handleCopy()}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  className={styles.shareActionButton}
                  onClick={() => void handleRevoke()}
                  disabled={loading}
                >
                  Revoke
                </button>
                <button type="button" className={styles.shareActionButton} onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
              <p className={styles.sharePopoverStatus}>Anyone with this link can view — not edit — the wall.</p>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
