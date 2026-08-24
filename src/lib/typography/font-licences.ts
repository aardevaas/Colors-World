/**
 * What each font licence actually permits, per use case.
 *
 * An internal brand guideline does not state "this font is open source". It
 * states whether you may embed it on the web, set it in print, bundle it into
 * a product you ship, and sell it — because those are **four different
 * permissions and not every licence grants all four**. Priority's guideline is
 * the one in the grain study that gets this right; most do not state licensing
 * at all, which is how a team discovers the problem at the printer.
 *
 * Every licence in the Fontsource catalogue is permissive — 2,052 of 2,096
 * families are OFL-1.1 — so the interesting column is not "may I use this" but
 * the two that trip people up: whether attribution is required, and whether the
 * font may be sold on its own.
 *
 * This is `cited` evidence in the registry's sense: the licence text is the
 * citation, and it is named so anyone can go and read it.
 */

export type LicenceId = 'OFL-1.1' | 'Apache-2.0' | 'UFL-1.0' | 'CC0-1.0' | 'mit' | 'Unlicense';

export interface FontLicence {
  readonly id: LicenceId;
  /** The name a guideline should print, not the SPDX identifier. */
  readonly name: string;
  readonly url: string;
  /** Serve the font on a website. */
  readonly webEmbed: boolean;
  /** Set it in print collateral. */
  readonly print: boolean;
  /** Bundle it into an application or product you distribute. */
  readonly bundleInProduct: boolean;
  /**
   * Sell the font FILES themselves, as the product.
   *
   * The one that catches people out. OFL and UFL both permit bundling a font
   * into something you sell while forbidding selling the font on its own, so a
   * single "commercial use" flag would be wrong in both directions.
   */
  readonly sellStandalone: boolean;
  readonly attributionRequired: boolean;
  /** The clause a designer actually needs to know about. */
  readonly note: string;
}

const LICENCES: Readonly<Record<LicenceId, FontLicence>> = {
  'OFL-1.1': {
    id: 'OFL-1.1',
    name: 'SIL Open Font License 1.1',
    url: 'https://openfontlicense.org',
    webEmbed: true,
    print: true,
    bundleInProduct: true,
    sellStandalone: false,
    attributionRequired: false,
    note: 'May be bundled and sold with a product, but never sold on its own. A modified version must not use the original Reserved Font Name, and must itself stay under the OFL.',
  },
  'Apache-2.0': {
    id: 'Apache-2.0',
    name: 'Apache License 2.0',
    url: 'https://www.apache.org/licenses/LICENSE-2.0',
    webEmbed: true,
    print: true,
    bundleInProduct: true,
    sellStandalone: true,
    attributionRequired: true,
    note: 'Requires the licence notice to travel with any redistribution, and carries an explicit patent grant.',
  },
  'UFL-1.0': {
    id: 'UFL-1.0',
    name: 'Ubuntu Font Licence 1.0',
    url: 'https://ubuntu.com/legal/font-licence',
    webEmbed: true,
    print: true,
    bundleInProduct: true,
    sellStandalone: false,
    attributionRequired: false,
    note: 'Close to the OFL. A modified version must be renamed before it is distributed.',
  },
  'CC0-1.0': {
    id: 'CC0-1.0',
    name: 'CC0 1.0 Universal (public domain)',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    webEmbed: true,
    print: true,
    bundleInProduct: true,
    sellStandalone: true,
    attributionRequired: false,
    note: 'Placed in the public domain. Nothing is required of you.',
  },
  mit: {
    id: 'mit',
    name: 'MIT License',
    url: 'https://opensource.org/license/mit',
    webEmbed: true,
    print: true,
    bundleInProduct: true,
    sellStandalone: true,
    attributionRequired: true,
    note: 'Requires the copyright notice to be kept with any copy.',
  },
  Unlicense: {
    id: 'Unlicense',
    name: 'The Unlicense (public domain)',
    url: 'https://unlicense.org',
    webEmbed: true,
    print: true,
    bundleInProduct: true,
    sellStandalone: true,
    attributionRequired: false,
    note: 'Dedicated to the public domain. Nothing is required of you.',
  },
};

/** Every licence the catalogue actually contains. */
export const KNOWN_LICENCES: readonly LicenceId[] = Object.keys(LICENCES) as LicenceId[];

/**
 * The licence facts for an identifier, or null when it is one we have not
 * checked.
 *
 * Null rather than a permissive default on purpose. Guessing that an unknown
 * licence permits everything is exactly the kind of assertion this product
 * exists to stop; a guideline that says "not recorded" is more useful than one
 * that says "fine" and is wrong.
 */
export function licenceFor(id: string): FontLicence | null {
  return LICENCES[id as LicenceId] ?? null;
}

/** The four permissions, as a guideline states them. */
export function permissionsFor(licence: FontLicence): readonly { use: string; allowed: boolean }[] {
  return [
    { use: 'Web embedding', allowed: licence.webEmbed },
    { use: 'Print', allowed: licence.print },
    { use: 'Bundled in a product', allowed: licence.bundleInProduct },
    { use: 'Sold on its own', allowed: licence.sellStandalone },
  ];
}
