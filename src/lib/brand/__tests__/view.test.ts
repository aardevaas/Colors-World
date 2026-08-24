import { describe, expect, test } from 'vitest';
import type { BookBlock } from '../types';
import {
  BOOK_VIEW_PARAM,
  parseBookView,
  viewQuery,
  visibleBlocks,
  type BookView,
} from '../view';

const present: BookBlock = {
  kind: 'present',
  id: 'colour.palette',
  title: 'Palette',
  evidence: 'declared',
  entries: [{ label: 'Primary', value: '#0A5CFF' }],
};
const absent: BookBlock = {
  kind: 'absent',
  id: 'logo.primary',
  title: 'Primary logo',
  reason: 'No mark uploaded yet.',
};

const INTERNAL: BookView = { audience: 'internal', hideUnset: false };
const TRIMMED: BookView = { audience: 'internal', hideUnset: true };

describe('parseBookView', () => {
  test('defaults to the whole internal document', () => {
    expect(parseBookView(new URLSearchParams())).toEqual(INTERNAL);
  });

  test('reads the hide-unset flag', () => {
    expect(parseBookView(new URLSearchParams(`${BOOK_VIEW_PARAM}=unset`))).toEqual(TRIMMED);
  });

  test('an unrecognised value shows everything rather than hiding something', () => {
    expect(parseBookView(new URLSearchParams(`${BOOK_VIEW_PARAM}=everything`))).toEqual(INTERNAL);
    expect(parseBookView(new URLSearchParams(`${BOOK_VIEW_PARAM}=`))).toEqual(INTERNAL);
  });

  test('ignores the System’s own parameters', () => {
    expect(parseBookView(new URLSearchParams('c=0a5cff&m=light'))).toEqual(INTERNAL);
  });
});

describe('visibleBlocks', () => {
  test('the internal document shows what is missing — that is the point of it', () => {
    expect(visibleBlocks([present, absent], INTERNAL)).toHaveLength(2);
  });

  test('hide-unset drops absent blocks and keeps every present one', () => {
    const out = visibleBlocks([present, absent, present], TRIMMED);
    expect(out).toHaveLength(2);
    expect(out.every((b) => b.kind === 'present')).toBe(true);
  });

  test('never reorders what it keeps', () => {
    const a = { ...present, id: 'colour.palette' } as BookBlock;
    const b = { ...present, id: 'type.families' } as BookBlock;
    expect(visibleBlocks([a, absent, b], TRIMMED).map((x) => x.id)).toEqual([
      'colour.palette',
      'type.families',
    ]);
  });
});

describe('viewQuery', () => {
  test('round-trips through parseBookView', () => {
    for (const view of [INTERNAL, TRIMMED]) {
      expect(parseBookView(new URLSearchParams(viewQuery(view)))).toEqual(view);
    }
  });

  test('the default view adds nothing to the URL', () => {
    expect(viewQuery(INTERNAL)).toBe('');
  });

  test('preserves the System it is given, so the toggle never drops the palette', () => {
    const q = viewQuery(TRIMMED, 'c=0a5cff-ff6b35&m=light');
    const params = new URLSearchParams(q);
    expect(params.get('c')).toBe('0a5cff-ff6b35');
    expect(params.get('m')).toBe('light');
    expect(parseBookView(params).hideUnset).toBe(true);
  });
});
