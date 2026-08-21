import type { Oklch } from '@/lib/color-engine';
import { HUE_FAMILIES, hueFamilyName } from './hue-family';

/**
 * The offline fallback for the Library's Color Psychology Profile — a
 * procedural OKLCH -> archetype/tag mapping, not a lookup table or an LLM
 * call. This has to exist regardless of Gemini: 16.7M generated swatches
 * can't each get a real API call (cost, latency, rate limits), so this
 * *is* the psychology profile for the vast majority of cards a visitor will
 * ever see. Gemini (see gemini-vibe-search.ts) only ever translates a
 * natural-language search prompt into target OKLCH ranges — it never
 * generates this per-card text.
 *
 * Deliberately hedged, not asserted as fact — "color psychology" beyond the
 * physics of wavelength perception is genuinely contested territory, not a
 * settled science, and this project already has a stated policy (see
 * supabase/schema.sql's note on the seeded Color-Pedia corpus) of never
 * presenting unverified bulk claims as authoritative. The physiological
 * notes stick to what's actually measurable — wavelength, energy, scatter —
 * and stop short of the medical/behavioural claims that field is full of.
 */

export interface PsychologyProfile {
  readonly archetype: string;
  readonly emotionalTags: readonly string[];
  readonly culturalNotes: string;
  readonly physiological: string;
  readonly intensity: 'subtle' | 'balanced' | 'bold';
  readonly temperature: 'light' | 'mid' | 'dark';
}

interface HueProfile {
  readonly archetype: string;
  readonly emotionalTags: readonly string[];
  readonly culturalNotes: string;
  readonly physiological: string;
}

/** Keyed by hue-family name (see hue-family.ts) rather than a raw hue range
 *  of its own — one family naming source, not two that could drift apart. */
const HUE_PROFILES: Record<string, HueProfile> = {
  reds: {
    archetype: 'The Alarm',
    emotionalTags: ['urgent', 'passionate', 'appetite-stimulating', 'commanding attention'],
    culturalNotes:
      'Across most cultures red reads as the most physiologically urgent hue — used for stop signs, sales tags, and alarms because it is genuinely the hardest color to look away from. It also carries opposite associations (luck and celebration in East Asian traditions, danger and prohibition in Western signage), so cultural context changes the read more than most hues.',
    physiological:
      'Longest visible wavelength (~625-740nm), which scatters least in the atmosphere — the reason it stays visible at distance and low light long after other hues fade. Its long wavelength means it is perceived at the outer edge of foveal cone sensitivity, one reason it reads as advancing/close rather than receding.',
  },
  oranges: {
    archetype: 'The Enthusiast',
    emotionalTags: ['sociable', 'warm', 'energetic', 'accessible'],
    culturalNotes:
      'Orange sits between red\'s urgency and yellow\'s brightness without red\'s alarm connotation, which is why it shows up so often in casual/friendly branding (fast food, sport, youth-oriented products) rather than luxury or authority contexts.',
    physiological:
      'A mid-long wavelength (~590-625nm) that overlaps both the long- and medium-wavelength cone response curves, which is part of why orange reads as an active blend rather than a pure primary the way red or blue do.',
  },
  ambers: {
    archetype: 'The Hearth',
    emotionalTags: ['cozy', 'nostalgic', 'golden-hour', 'grounded'],
    culturalNotes:
      'Amber sits close to the color of firelight and late-day sun, which is most of why it reads as warm and domestic rather than energetic the way a purer orange does — the association is with a specific quality of light, not just a hue position.',
    physiological:
      'Close to the peak wavelength incandescent light sources emit, which is part of why interiors lit that way read as "warm" independent of the objects in them — the light source itself is amber-shifted.',
  },
  yellows: {
    archetype: 'The Signal',
    emotionalTags: ['optimistic', 'attention-grabbing', 'cautionary', 'high-visibility'],
    culturalNotes:
      'Yellow is the highest-luminance hue in the visible spectrum at equal lightness, which is exactly why it is used for both "happy" branding and hazard signage — the same visibility that reads as cheerful in one context reads as a warning in another.',
    physiological:
      'Sits at the peak of human photopic (daylight) luminous efficiency — the wavelength range the eye is most sensitive to in bright conditions, which is the actual reason it appears to glow rather than a property of the pigment itself.',
  },
  greens: {
    archetype: 'The Steward',
    emotionalTags: ['natural', 'restorative', 'growth-oriented', 'safe'],
    culturalNotes:
      'The most consistently "calm/natural/safe" hue across cultures, tracking its near-universal association with vegetation and, more recently, financial growth and permission (go signals, approval states in software UI).',
    physiological:
      'Sits at the centre of the visible spectrum and the peak of scotopic (low-light) sensitivity — human night vision is most responsive here, part of why green was chosen for early radar/sonar/night-vision displays.',
  },
  teals: {
    archetype: 'The Clarifier',
    emotionalTags: ['clean', 'composed', 'balanced', 'contemporary'],
    culturalNotes:
      'A relatively recent branding favourite precisely because it sits outside the more culturally loaded pure blues and greens — read as clean/modern/tech-adjacent without red\'s urgency or blue\'s corporate coolness.',
    physiological:
      'Falls in the narrow band where the medium- and short-wavelength cone responses cross over, which is part of why teal is unusually sensitive to small hue shifts — a few degrees reads as distinctly "more green" or "more blue" faster than most other hues.',
  },
  cyans: {
    archetype: 'The Current',
    emotionalTags: ['fluid', 'refreshing', 'digital', 'crisp'],
    culturalNotes:
      'Strongly associated with water and, since the rise of screens, with digital/technical contexts — a large share of software "info" and "link" states land in this range.',
    physiological:
      'Close to the wavelength scattered most by clear water and thin atmosphere, which is the direct physical reason both the sky and clear shallow water read in this range.',
  },
  blues: {
    archetype: 'The Anchor',
    emotionalTags: ['trustworthy', 'calm', 'corporate', 'distant'],
    culturalNotes:
      'The most consistently "trusted" hue in cross-cultural branding studies, and the most common corporate/institutional color worldwide — partly cultural convention reinforcing itself over a century of use, partly because it reads as the least appetite-associated hue (very few naturally blue foods).',
    physiological:
      'Short wavelength (~450-495nm), higher photon energy than the rest of the visible spectrum, and the wavelength most implicated in circadian light-sensitivity research — noted here as a documented area of study, not a claim about this specific swatch.',
  },
  violets: {
    archetype: 'The Threshold',
    emotionalTags: ['introspective', 'transitional', 'unconventional', 'cool'],
    culturalNotes:
      'Sits at the boundary of the visible spectrum, which may be part of why it reads as "unusual" or "otherworldly" across many cultures — the rarest hue in nature outside flowers, which is also why it carried luxury/rarity associations historically before synthetic dye.',
    physiological:
      'Near-shortest visible wavelength (~380-450nm) — the extreme edge of typical photopic sensitivity, where perceived brightness at equal luminance starts to drop off for most viewers.',
  },
  purples: {
    archetype: 'The Sovereign',
    emotionalTags: ['luxurious', 'creative', 'regal', 'rare'],
    culturalNotes:
      'Historically the most expensive dye to produce (Tyrian purple required thousands of sea snails per gram), which is the actual origin of its royalty/luxury association — a manufacturing-cost artifact that outlived the manufacturing constraint by centuries.',
    physiological:
      'A non-spectral mixture the eye constructs from simultaneous long- and short-wavelength cone stimulation (unlike most hues here, it is not one single wavelength) — part of why purple hues vary so much in exactly how "warm" or "cool" they read.',
  },
  magentas: {
    archetype: 'The Provocateur',
    emotionalTags: ['bold', 'unconventional', 'high-energy', 'attention-seeking'],
    culturalNotes:
      'Among the most recently mainstreamed hues in branding — synthetic magenta dye is a 19th-century invention, so it carries far less historical/cultural baggage than most of this list, which is part of why it reads as "modern" almost by default.',
    physiological:
      'Also non-spectral (see purples) — magenta is the eye/brain\'s own construction when red and blue wavelengths are both present with green absent, not a single-wavelength color at all.',
  },
  pinks: {
    archetype: 'The Softener',
    emotionalTags: ['gentle', 'approachable', 'playful', 'tender'],
    culturalNotes:
      'A high-lightness, lower-chroma relative of red that inherits red\'s attention-getting quality without its urgency — the gender-coding common in some cultures is a 20th-century marketing artifact, not a cross-cultural universal, and has flipped at least once (pink was marketed as the "strong" boys\' color in parts of the early 1900s West).',
    physiological:
      'Same long-wavelength base as red, perceived as "softened" primarily because of reduced chroma and increased lightness relative to the eye\'s highest-sensitivity range, not a different wavelength mechanism.',
  },
};

/** Falls back to reds' profile only if hueFamilyName somehow returns a name
 *  not in HUE_PROFILES — defensive, since HUE_FAMILIES and HUE_PROFILES are
 *  two separate objects that must stay in sync by hand. */
function hueProfileFor(hue: number): HueProfile {
  const name = hueFamilyName(hue);
  return HUE_PROFILES[name] ?? HUE_PROFILES[HUE_FAMILIES[0]!.name]!;
}

function temperatureFor(lightness: number): PsychologyProfile['temperature'] {
  if (lightness >= 0.75) return 'light';
  if (lightness <= 0.35) return 'dark';
  return 'mid';
}

function intensityFor(chroma: number): PsychologyProfile['intensity'] {
  if (chroma >= 0.15) return 'bold';
  if (chroma <= 0.06) return 'subtle';
  return 'balanced';
}

const TEMPERATURE_QUALIFIER: Record<PsychologyProfile['temperature'], string> = {
  light: 'airy and approachable at this lightness',
  mid: 'grounded at this mid lightness',
  dark: 'weighty and dramatic at this depth',
};

const INTENSITY_QUALIFIER: Record<PsychologyProfile['intensity'], string> = {
  subtle: 'muted enough to read as sophisticated rather than loud',
  balanced: 'saturated without tipping into visual shouting',
  bold: 'vivid enough to dominate whatever it sits next to',
};

export function psychologyProfile(oklch: Oklch): PsychologyProfile {
  const hueProfile = hueProfileFor(oklch.h);
  const temperature = temperatureFor(oklch.l);
  const intensity = intensityFor(oklch.c);

  return {
    archetype: hueProfile.archetype,
    emotionalTags: [
      ...hueProfile.emotionalTags,
      TEMPERATURE_QUALIFIER[temperature],
      INTENSITY_QUALIFIER[intensity],
    ],
    culturalNotes: hueProfile.culturalNotes,
    physiological: hueProfile.physiological,
    intensity,
    temperature,
  };
}
