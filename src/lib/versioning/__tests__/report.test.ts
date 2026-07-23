import { describe, test, expect } from 'vitest';
import { formatConflictReport } from '../report';
import type { MergeConflict } from '../types';

describe('formatConflictReport', () => {
  test('empty conflicts list', () => {
    expect(formatConflictReport([])).toBe('No conflicts.');
  });

  test('single conflict with all values present', () => {
    const conflicts: MergeConflict[] = [
      { token: 'brand-5', base: '#3b82f6', ours: '#2563eb', theirs: '#1d4ed8' },
    ];
    expect(formatConflictReport(conflicts)).toBe(
      '✕ brand-5\n  base    #3b82f6\n  ours    #2563eb\n  theirs  #1d4ed8\n\n1 conflict(s) require resolution.'
    );
  });

  test('conflict with a null value showing <deleted>', () => {
    const conflicts: MergeConflict[] = [
      { token: 'brand-5', base: '#3b82f6', ours: null, theirs: '#1d4ed8' },
    ];
    expect(formatConflictReport(conflicts)).toBe(
      '✕ brand-5\n  base    #3b82f6\n  ours    <deleted>\n  theirs  #1d4ed8\n\n1 conflict(s) require resolution.'
    );
  });

  test('multiple conflicts are separated by a blank line, with a trailing summary', () => {
    const conflicts: MergeConflict[] = [
      { token: 'brand-5', base: '#3b82f6', ours: '#2563eb', theirs: null },
      { token: 'accent-3', base: null, ours: '#ef4444', theirs: '#f97316' },
    ];
    expect(formatConflictReport(conflicts)).toBe(
      '✕ brand-5\n  base    #3b82f6\n  ours    #2563eb\n  theirs  <deleted>\n\n' +
        '✕ accent-3\n  base    <deleted>\n  ours    #ef4444\n  theirs  #f97316\n\n' +
        '2 conflict(s) require resolution.'
    );
  });

  test('no line in the report has trailing whitespace', () => {
    const conflicts: MergeConflict[] = [
      { token: 'brand-5', base: '#3b82f6', ours: '#2563eb', theirs: '#1d4ed8' },
    ];
    const lines = formatConflictReport(conflicts).split('\n');
    for (const line of lines) {
      expect(line).toBe(line.trimEnd());
    }
  });
});
