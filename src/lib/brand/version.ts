/**
 * Which version of the system this guideline documents.
 *
 * Every serious manual carries an edition. NASA's Graphics Standards Manual is
 * dated and numbered; so is every university guideline in the sample. It is
 * not ceremony — two people holding two printouts need a way to know whether
 * they are holding the same rules, and "the one from the email" is not one.
 *
 * The 25-book study found nobody versioning their brand in a way a reader
 * could check. We can, because the System is the URL: the same bytes that
 * carry a guideline can be fingerprinted, so the stamp is DERIVED rather than
 * declared. Nobody has to remember to bump it, and it cannot be wrong.
 *
 * ## What this is not
 *
 * Not a history. A changelog needs somewhere to keep the previous versions,
 * which needs an account — `gov.version-changelog` says so plainly rather than
 * implying the stamp is more than it is. This identifies a system; it does not
 * remember one.
 *
 * Not a checksum either, in the security sense. It is a short non-cryptographic
 * fingerprint: strong enough that two systems a person would call different
 * stamp differently, and deliberately short enough to read down a phone.
 */

import { encodeSystem } from '@/lib/system/codec';
import type { System } from '@/lib/system/types';

export interface SystemVersion {
  /** Short readable fingerprint, or empty when there is nothing to stamp. */
  readonly id: string;
  /** What the stamp is derived from, in the reader's terms. */
  readonly covers: string;
  /** True when nothing has been configured, so a version would be a fiction. */
  readonly isEmpty: boolean;
}

/**
 * FNV-1a, run twice over the same bytes with different offset bases.
 *
 * One 32-bit pass is a coin-flip away from a collision at a few tens of
 * thousands of systems, which is a real number for a product people share
 * links with. Two passes combined give ~64 bits before truncation, and a
 * second constant costs one extra loop over a string that is rarely more than
 * 200 characters.
 *
 * Written out rather than pulled from a dependency because it has to be
 * STABLE FOREVER: a library that improves its hash in a minor release would
 * silently restamp every guideline in existence.
 */
function fingerprint(input: string): string {
  const round = (offset: number): number => {
    let hash = offset;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      // The FNV prime, 16777619, by shift-and-add — a plain multiply overflows
      // the 53-bit float mantissa and stops being the algorithm.
      hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }
    return hash >>> 0;
  };

  const a = round(0x811c9dc5);
  const b = round(0x01000193);
  return (a.toString(36) + b.toString(36).padStart(7, '0')).slice(0, 8);
}

/** A plain-language summary of what the stamp is taken over. */
function coverageOf(system: System): string {
  const colours = system.palette.length;
  const parts = [`${colours} colour${colours === 1 ? '' : 's'}`];

  const families = system.type.families;
  const chosen = families === undefined ? 0 : Object.values(families).filter(Boolean).length;
  if (chosen > 0) parts.push(`${chosen} chosen typeface${chosen === 1 ? '' : 's'}`);

  parts.push(`the ${system.type.ratio} scale`);
  parts.push(`${system.mode} polarity`);

  const overrides = Object.keys(system.roleOverrides).length;
  if (overrides > 0) parts.push(`${overrides} role override${overrides === 1 ? '' : 's'}`);
  if (Object.keys(system.proportions).length > 0) parts.push('a stated ratio');

  return parts.join(', ');
}

/**
 * The version stamp for a System.
 *
 * Taken over `encodeSystem`, which is the canonical form: roles are written in
 * a fixed order and hexes are lowercased, so two systems a person would call
 * identical produce identical bytes and therefore an identical stamp. That
 * also means the stamp survives a round trip through a link, which is the
 * property that matters — a guideline reopened from its own URL must not claim
 * to be a different version than the one that was sent.
 */
export function systemVersion(system: System): SystemVersion {
  const encoded = encodeSystem(system);
  if (encoded === '') {
    return { id: '', covers: 'Nothing is set yet.', isEmpty: true };
  }
  return { id: fingerprint(encoded), covers: coverageOf(system), isEmpty: false };
}
