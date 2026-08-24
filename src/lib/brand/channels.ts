/**
 * Where the type actually goes, and what breaks when it gets there.
 *
 * `type.channels` was `renderAuthored` — prose someone types into a Project.
 * For the visitor this product is built around, who has no account, it
 * therefore said "not set" and would have said "not set" forever, while every
 * fact it needed was already computable: the stack that survives each channel,
 * the floor each one imposes, and whether the licence even permits the face
 * there. It computes now, for the same reason `colour.proportions` does.
 *
 * ## Each channel gets the rule it actually has
 *
 * The tempting shape is four channels with four floors in one uniform table.
 * Three of the four numbers would have to be invented. Web has a floor with a
 * source; email has one this repo has asserted for a while; print and
 * presentation genuinely do not have one that survives contact with a
 * standard, because neither is sized in pixels — print is points on paper and
 * a deck is read across a room.
 *
 * So a channel states a floor only where a floor can be defended, and each
 * line carries its own evidence tag. What print gets instead is the two things
 * that ARE computable and that nobody checks: the body size converted to
 * points, and whether the licence permits print use at all. "Can I put this
 * typeface in a printed report" is a real question with a real answer sitting
 * in the catalogue's licence data, and no brand manual in the sample answers it.
 */

import { licenceOf } from '@/lib/typography/font-catalogue';
import { ROOT_PX } from '@/lib/typography/type-scale';
import type { Evidence } from './types';
import type { BrandState } from './types';
import { faceFor, stackFor } from './typography';

export type ChannelId = 'web' | 'email' | 'print' | 'presentation';

export interface Channel {
  readonly id: ChannelId;
  readonly name: string;
  /** Minimum body size in px, where one can be defended. Absent otherwise. */
  readonly minBodyPx?: number;
  /** Where that floor comes from. Present exactly when `minBodyPx` is. */
  readonly floorSource?: string;
  readonly floorEvidence?: Evidence;
  /** Whether the chosen typeface reaches this channel at all. */
  readonly rendersBrandFace: boolean;
  readonly why: string;
}

/** CSS pixels per point: 96dpi over 72 points to the inch. */
const PT_PER_PX = 72 / 96;

export const CHANNELS: readonly Channel[] = [
  {
    id: 'web',
    name: 'Web',
    minBodyPx: 16,
    floorSource: 'The U.S. Web Design System sets 16px as the floor for running text.',
    floorEvidence: 'cited',
    rendersBrandFace: true,
    why: 'The only channel where the stack you chose is the stack that renders.',
  },
  {
    id: 'email',
    name: 'Email',
    minBodyPx: 14,
    floorSource:
      'Practitioner floor, not a published standard: below 14px the fallback face — which is what most clients actually show — stops being comfortable.',
    floorEvidence: 'declared',
    rendersBrandFace: false,
    why: 'Most clients strip webfonts, so the brand face never arrives and the fallback is what people read.',
  },
  {
    id: 'print',
    name: 'Print',
    rendersBrandFace: true,
    why: 'Sized in points on paper, so a pixel floor says nothing. The licence is the constraint that actually bites.',
  },
  {
    id: 'presentation',
    name: 'Presentation',
    rendersBrandFace: false,
    why: 'Read across a room and usually opened on a machine that does not have the face installed, so it falls back like email does.',
  },
];

export interface PrintLicence {
  readonly name: string;
  readonly allowed: boolean;
}

export interface ChannelRule {
  readonly channel: Channel;
  /** The stack that survives to this channel. */
  readonly stack: string;
  /** This system's body size in px. */
  readonly bodyPx: number;
  /** The same size in points, which is how print and decks are specified. */
  readonly bodyPt: number;
  /** True/false against the channel's floor, or null where it states none. */
  readonly holds: boolean | null;
  /** Whether the body face may be used in print. Only on the print channel. */
  readonly printLicence?: PrintLicence;
}

/**
 * What actually renders in email and on a projector.
 *
 * Not the brand stack, and not a guess: this is the same string §4's fallback
 * block already prints for the email row, because a client that strips
 * webfonts leaves whatever the machine has.
 */
const STRIPPED_STACK = 'Arial, Helvetica, sans-serif';

/** Every channel's rule for the System as it currently stands. */
export function channelRules(state: BrandState): readonly ChannelRule[] {
  const body = faceFor(state, 'body');
  const brandStack = stackFor(body);
  const bodyPx = state.system.type.baseRem * ROOT_PX;
  const bodyPt = Math.round(bodyPx * PT_PER_PX * 100) / 100;

  return CHANNELS.map((channel) => {
    const licence = body.id === null ? null : licenceOf(body.id);
    return {
      channel,
      stack: channel.rendersBrandFace ? brandStack : STRIPPED_STACK,
      bodyPx,
      bodyPt,
      holds: channel.minBodyPx === undefined ? null : bodyPx >= channel.minBodyPx,
      ...(channel.id === 'print' && licence !== null
        ? { printLicence: { name: licence.name, allowed: licence.print } }
        : {}),
    };
  });
}

/** Channels whose floor this system's body size does not clear. */
export function floorBreaches(rules: readonly ChannelRule[]): readonly ChannelRule[] {
  return rules.filter((r) => r.holds === false);
}
