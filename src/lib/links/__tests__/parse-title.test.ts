import { describe, expect, test } from 'vitest';
import { extractTitleFromHtml } from '../parse-title';

describe('extractTitleFromHtml', () => {
  test('extracts a plain title', () => {
    expect(extractTitleFromHtml('<html><head><title>Hello World</title></head></html>')).toBe(
      'Hello World'
    );
  });

  test('decodes common HTML entities', () => {
    expect(extractTitleFromHtml('<title>Fish &amp; Chips &mdash; &quot;Best&quot;</title>')).toBe(
      'Fish & Chips &mdash; "Best"'
    );
  });

  test('decodes numeric character references', () => {
    expect(extractTitleFromHtml('<title>Caf&#233; &#x2014; menu</title>')).toBe('Café — menu');
  });

  test('collapses internal whitespace and trims', () => {
    expect(extractTitleFromHtml('<title>\n   Padded   Title  \n</title>')).toBe('Padded Title');
  });

  test('is case-insensitive on the tag itself', () => {
    expect(extractTitleFromHtml('<TITLE>Shouting</TITLE>')).toBe('Shouting');
  });

  test('handles attributes on the title tag', () => {
    expect(extractTitleFromHtml('<title lang="en">Attributed</title>')).toBe('Attributed');
  });

  test('returns null when there is no title tag', () => {
    expect(extractTitleFromHtml('<html><body>No title here</body></html>')).toBeNull();
  });

  test('returns null for an empty title', () => {
    expect(extractTitleFromHtml('<title>   </title>')).toBeNull();
  });
});
