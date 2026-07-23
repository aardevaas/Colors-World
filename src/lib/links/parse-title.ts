/**
 * Pure HTML `<title>` extraction — no DOM, no network, just a regex and a
 * small entity table. Kept separate from the fetch itself so this half is
 * trivially unit-testable.
 */

const TITLE_TAG = /<title[^>]*>([\s\S]*?)<\/title>/i;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z0-9]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = parseInt(entity.slice(2), 16);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
    if (entity.startsWith('#')) {
      const codePoint = parseInt(entity.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function extractTitleFromHtml(html: string): string | null {
  const match = TITLE_TAG.exec(html);
  if (match === null) return null;
  const decoded = decodeEntities(match[1]!).replace(/\s+/g, ' ').trim();
  return decoded.length > 0 ? decoded : null;
}
