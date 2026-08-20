import { describe, expect, it } from 'vitest';
import { generateScale, parseColor, type GeneratedScale } from '@/lib/color-engine';
import { deriveRoles } from '@/lib/roles/semantic-roles';
import { EMPTY_SYSTEM } from '@/lib/system/defaults';
import type { System } from '@/lib/system/types';
import { systemFilename, toSystemReadme } from '../system-readme';

function systemFrom(hexes: readonly string[]): System {
  return {
    ...EMPTY_SYSTEM,
    palette: hexes.map((hex, i) => ({ hex, oklch: parseColor(hex), addedAt: i })),
    anchorHex: hexes[0] ?? null,
  };
}

function rolesFrom(hexes: readonly string[]) {
  return deriveRoles(hexes.map((hex) => ({ hex, oklch: parseColor(hex) })));
}

const SAFE = ['#0B0B0C', '#17171A', '#2A2A30', '#7C5CFF', '#FFB454', '#F2F2F5'];
/** Red and green at similar lightness — the pair deuteranopia collapses. */
const RISKY = ['#0B0B0C', '#17171A', '#2A2A30', '#C0392B', '#27AE60', '#F2F2F5'];

const SCALES: readonly GeneratedScale[] = [
  generateScale({ name: 'primary', anchors: [{ color: '#7C5CFF', step: 5 }] }),
];

function documentFor(hexes: readonly string[], scales = SCALES): string {
  return toSystemReadme({ system: systemFrom(hexes), roles: rolesFrom(hexes), scales });
}

describe('toSystemReadme — it has to be valid Markdown', () => {
  it('puts a blank line above every table, or they render as plain text', () => {
    // Not pedantry: an earlier version filtered empty strings to drop one
    // optional line and stripped every deliberate blank with it, which turned
    // the typography table into a paragraph of pipes.
    const lines = documentFor(SAFE).split('\n');
    lines.forEach((line, i) => {
      if (!line.startsWith('|')) return;
      const previous = lines[i - 1] ?? '';
      if (previous.startsWith('|')) return;
      expect(previous.trim()).toBe('');
    });
  });

  it('closes every code fence it opens', () => {
    const fences = documentFor(SAFE).split('\n').filter((l) => l.startsWith('```'));
    expect(fences.length % 2).toBe(0);
  });

  it('starts with a single top-level heading', () => {
    const document = documentFor(SAFE);
    expect(document.startsWith('# ')).toBe(true);
    expect(document.split('\n').filter((l) => l.startsWith('# '))).toHaveLength(1);
  });
});

describe('toSystemReadme — it has to be true', () => {
  it('names the colour that actually took each role', () => {
    const roles = rolesFrom(SAFE);
    const document = documentFor(SAFE);
    for (const hex of [roles.background.hex, roles.text.hex, roles.primary.hex]) {
      expect(document).toContain(hex.toUpperCase());
    }
  });

  it('reports failing pairs rather than only the flattering ones', () => {
    // The whole value of the document is that it is honest about the system
    // it describes. A palette that fails has to say so in the file its author
    // hands to somebody else.
    const document = documentFor(SAFE);
    expect(document).toContain('**FAILS**');
    expect(document).toMatch(/\d+ of \d+ required pairs fall short/);
  });

  it('says so plainly when nothing fails', () => {
    const clean = ['#0B0B0C', '#2A2A30', '#6D6D7A', '#8167FF', '#FFB454', '#F2F2F5'];
    const document = documentFor(clean);
    if (!document.includes('**FAILS**')) {
      expect(document).toMatch(/All \d+ required pairs meet their threshold/);
    }
  });

  it('reports a colour-vision conflict when there is one', () => {
    const document = documentFor(RISKY);
    expect(document).toMatch(/deuteranopia/);
    expect(document).toMatch(/Separation kept/);
  });

  it('states the vision result is clean when it is', () => {
    expect(documentFor(SAFE)).toContain('No pair of roles collapses');
  });

  it('carries the legibility verdict, not just a ratio', () => {
    // A ratio alone is what every other tool exports. The useful sentence is
    // what that ratio permits.
    expect(documentFor(SAFE)).toMatch(/carries body text at any size and weight|only carries \*\*large\*\*|carries text at \*\*no\*\*/);
  });

  it('includes the token formats an engineer will actually paste', () => {
    const document = documentFor(SAFE);
    expect(document).toContain('```css');
    expect(document).toContain('```json');
    expect(document).toContain('@theme');
  });

  it('carries a reopen link when one is given, and no dangling label when not', () => {
    const withLink = toSystemReadme({
      system: systemFrom(SAFE),
      roles: rolesFrom(SAFE),
      scales: SCALES,
      shareUrl: 'https://example.test/compose?c=abc',
    });
    expect(withLink).toContain('https://example.test/compose?c=abc');
    expect(documentFor(SAFE)).not.toContain('Reopen this system');
  });
});

describe('toSystemReadme — degenerate input', () => {
  it('produces a document for an empty system rather than throwing', () => {
    const document = toSystemReadme({
      system: EMPTY_SYSTEM,
      roles: deriveRoles([]),
      scales: [],
    });
    expect(document).toContain('# Colour system');
    // No scales means no token dump and no gamut section, but the roles and
    // contrast of the fallback set are still worth stating.
    expect(document).toContain('## Roles');
    expect(document).not.toContain('## Tokens');
  });

  it('handles a single-colour system', () => {
    expect(() => documentFor(['#7C5CFF'])).not.toThrow();
    expect(documentFor(['#7C5CFF'])).toContain('1 colour,');
  });
});

describe('systemFilename', () => {
  it('describes the system it belongs to', () => {
    expect(systemFilename(systemFrom(SAFE))).toBe('colour-system-6-colour-dark.md');
  });

  it('follows the polarity', () => {
    expect(systemFilename({ ...systemFrom(SAFE), mode: 'light' })).toContain('light');
  });

  it('is always a safe filename', () => {
    expect(systemFilename(systemFrom(SAFE))).toMatch(/^[a-z0-9.-]+\.md$/);
  });
});
