/**
 * Turning the System's type half into the shapes §4 and the exports render from.
 *
 * The colour half has `colour.ts` for exactly this reason, and type needed the
 * same thing for a sharper one: **the stack a guideline states and the stack a
 * token file emits have to be the same string.** A guideline that prints
 * `"Source Serif 4", Georgia, "Times New Roman", serif` in its Fallback stack
 * block while its own `--font-body` token says something else is not a
 * guideline, it is two guesses — and that divergence is invisible in review
 * because the two live in different files.
 *
 * `resolvedStacks` and §4's `type.fallbacks` now call the same function, so
 * they cannot disagree.
 *
 * Server-only in practice: `font-catalogue` carries the ~385KB snapshot. The
 * Book resolves here on the server and hands plain strings to anything that
 * runs in a browser.
 */

import { fontStack, get, getByFamily } from '@/lib/typography/font-catalogue';
import { presetById } from '@/lib/typography/font-sources';
import type { ResolvedStacks } from '@/lib/exporters/guideline-tokens';
import type { BrandState } from './types';

/** The three roles a System sets a face for, in the order a manual lists them. */
export const TYPE_ROLES = ['display', 'body', 'mono'] as const;
export type TypeRole = (typeof TYPE_ROLES)[number];

export interface ResolvedFace {
  /** The System's own key for this role — total, so lookups need no fallback. */
  readonly key: TypeRole;
  /** Title case — this is the label the book prints. */
  readonly role: string;
  readonly family: string;
  /** The Fontsource slug, or null for a face the open catalogue does not carry. */
  readonly id: string | null;
}

/**
 * Generic fallbacks for a face the catalogue cannot resolve.
 *
 * A display face falling back to a serif and a body face to the system UI font
 * is the conventional pairing, and it is what the book stated before this was
 * extracted.
 */
const GENERIC_FALLBACK: Readonly<Record<TypeRole, string>> = {
  display: 'Georgia, serif',
  body: 'system-ui, -apple-system, sans-serif',
  mono: 'ui-monospace, monospace',
};

/**
 * One role's face: the slug the System chose, or the preset's if it chose none.
 *
 * The Book has to state the face the person CHOSE — printing the preset's name
 * next to type set in something else is the exact class of untruth a guideline
 * exists to prevent.
 */
export function faceFor(state: BrandState, key: TypeRole): ResolvedFace {
  const preset = presetById(state.system.type.presetId);
  const slug = state.system.type.families?.[key];
  const chosen = slug === undefined ? null : get(slug);
  return {
    key,
    role: key.charAt(0).toUpperCase() + key.slice(1),
    family: chosen?.family ?? preset[key],
    id: chosen?.id ?? getByFamily(preset[key])?.id ?? null,
  };
}

/** The three faces actually in play, in the order a manual lists them. */
export function facesOf(state: BrandState): readonly ResolvedFace[] {
  return TYPE_ROLES.map((key) => faceFor(state, key));
}

/** One face's full CSS stack: the family, then something real behind it. */
export function stackFor(face: ResolvedFace): string {
  return (
    (face.id === null ? null : fontStack(face.id)) ??
    `"${face.family}", ${GENERIC_FALLBACK[face.key]}`
  );
}

/**
 * The three stacks, keyed for the token exporters.
 *
 * The one function that lets `guideline-tokens.ts` stay free of the catalogue
 * while still emitting the same strings §4 prints. Written out per role rather
 * than destructured off `facesOf` so the result is total by construction — an
 * array destructure would make each stack `string | undefined` and invite a
 * fallback that can never fire.
 */
export function resolvedStacks(state: BrandState): ResolvedStacks {
  return {
    display: stackFor(faceFor(state, 'display')),
    body: stackFor(faceFor(state, 'body')),
    mono: stackFor(faceFor(state, 'mono')),
  };
}
