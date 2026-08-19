/**
 * Where fonts come from in Tab 05, and how they get loaded.
 *
 * Three sources, all zero-cost by design — no font hosting, no licensing
 * exposure:
 *   · **Google Fonts** and **Fontshare** load from their own CDNs.
 *   · **Local fonts** never leave the machine. `queryLocalFonts()` gives the
 *     browser's font list only after an explicit permission prompt, and the
 *     preview renders with the font already installed on that device. Nothing
 *     is uploaded, so there is nothing to license or store.
 *
 * The presets are named combinations rather than a search box: pairing type is
 * a taste problem, and a search field lets someone build something discordant
 * exactly as easily as something good.
 */

export type FontSource = 'google' | 'fontshare' | 'local';

export interface TypePreset {
  readonly id: string;
  readonly label: string;
  readonly source: Exclude<FontSource, 'local'>;
  readonly display: string;
  readonly body: string;
  readonly mono: string;
  /** Why this pairing exists — the character it gives a page. */
  readonly character: string;
}

export const TYPE_PRESETS: readonly TypePreset[] = [
  {
    id: 'neo-tech',
    label: 'Neo-Tech',
    source: 'google',
    display: 'Unbounded',
    body: 'Plus Jakarta Sans',
    mono: 'Geist Mono',
    character: 'Wide, geometric, deliberately synthetic',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    source: 'google',
    display: 'Playfair Display',
    body: 'Source Sans 3',
    mono: 'JetBrains Mono',
    character: 'High-contrast serif against a quiet humanist sans',
  },
  {
    id: 'swiss',
    label: 'Swiss',
    source: 'google',
    display: 'Archivo',
    body: 'Inter',
    mono: 'Fira Code',
    character: 'Neutral, gridded, gets out of the way',
  },
  {
    id: 'brutalist',
    label: 'Brutalist',
    source: 'fontshare',
    display: 'Clash Display',
    body: 'Satoshi',
    mono: 'Space Mono',
    character: 'Blunt display weight, no apology',
  },
];

export const DEFAULT_PRESET_ID = TYPE_PRESETS[0]!.id;

export function presetById(id: string): TypePreset {
  return TYPE_PRESETS.find((p) => p.id === id) ?? TYPE_PRESETS[0]!;
}

/** Weights every preview needs — one request covers the whole specimen. */
const PREVIEW_WEIGHTS = [300, 400, 500, 600, 700, 800];

export function googleStylesheetUrl(preset: TypePreset): string {
  const families = [preset.display, preset.body]
    .map((family) => `family=${encodeURIComponent(family)}:wght@${PREVIEW_WEIGHTS.join(';')}`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

export function fontshareStylesheetUrl(preset: TypePreset): string {
  const families = [preset.display, preset.body]
    .map((family) => `${family.toLowerCase().replace(/\s+/g, '-')}@400,500,700`)
    .join('&f[]=');
  return `https://api.fontshare.com/v2/css?f[]=${families}&display=swap`;
}

export function stylesheetUrlFor(preset: TypePreset): string {
  return preset.source === 'fontshare'
    ? fontshareStylesheetUrl(preset)
    : googleStylesheetUrl(preset);
}

const injected = new Set<string>();

/** Injects a preset's stylesheet at most once per page load. */
export function ensurePresetLoaded(preset: TypePreset): void {
  const url = stylesheetUrlFor(preset);
  if (injected.has(url)) return;
  injected.add(url);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

export interface LocalFont {
  readonly family: string;
  readonly fullName: string;
}

export type LocalFontOutcome =
  | { readonly status: 'ok'; readonly fonts: readonly LocalFont[] }
  | { readonly status: 'unsupported' }
  | { readonly status: 'denied' }
  | { readonly status: 'failed'; readonly message: string };

interface LocalFontData {
  readonly family: string;
  readonly fullName: string;
}

/**
 * Reads the machine's installed fonts via the Local Font Access API.
 *
 * Every failure mode is reported distinctly rather than collapsed into "no
 * fonts": a Firefox user who *cannot* use this needs different guidance from
 * someone who clicked Block, and both need something other than an empty list
 * that looks like a bug.
 */
export async function queryLocalFonts(): Promise<LocalFontOutcome> {
  const api = (window as unknown as {
    queryLocalFonts?: () => Promise<LocalFontData[]>;
  }).queryLocalFonts;

  if (typeof api !== 'function') return { status: 'unsupported' };

  try {
    const fonts = await api();
    // One entry per family — the raw list has a row per style, so a machine
    // with a dozen Helvetica cuts would otherwise flood the picker.
    const byFamily = new Map<string, LocalFont>();
    for (const font of fonts) {
      if (!byFamily.has(font.family)) {
        byFamily.set(font.family, { family: font.family, fullName: font.fullName });
      }
    }
    return {
      status: 'ok',
      fonts: [...byFamily.values()].sort((a, b) => a.family.localeCompare(b.family)),
    };
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return { status: 'denied' };
    return { status: 'failed', message: cause instanceof Error ? cause.message : String(cause) };
  }
}
