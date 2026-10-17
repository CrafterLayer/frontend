import { describe, expect, it } from 'vitest';

import { FIELD_LABELS_AR, FIELD_LABELS_EN } from './field-labels';
import { summarizeValue } from './value-summary';

describe('summarizeValue', () => {
  it('describes values the way a person would, never as JSON', () => {
    expect(summarizeValue(undefined, FIELD_LABELS_EN)).toBe('Empty');
    expect(summarizeValue('', FIELD_LABELS_EN)).toBe('Empty');
    expect(summarizeValue([1, 2, 3], FIELD_LABELS_EN)).toBe('3 items');
    expect(summarizeValue([], FIELD_LABELS_EN)).toBe('Empty');
    expect(summarizeValue({ a: 1, b: 2, c: 3, d: 4 }, FIELD_LABELS_EN)).toBe('4 fields');
    expect(summarizeValue({}, FIELD_LABELS_EN)).toBe('Empty');
    expect(summarizeValue(true, FIELD_LABELS_EN)).toBe('Yes');
    expect(summarizeValue(7, FIELD_LABELS_EN)).toBe('7');
  });

  it('shows a rich-text document as its words', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world.' }] }],
    };
    const summary = summarizeValue(doc, FIELD_LABELS_EN);
    expect(summary).toBe('Hello world.');
    expect(summary).not.toContain('{');
  });

  it('speaks Arabic when the labels are Arabic', () => {
    expect(summarizeValue(undefined, FIELD_LABELS_AR)).toBe('فارغ');
    expect(summarizeValue([1, 2, 3], FIELD_LABELS_AR)).toBe('3 عناصر');
    expect(summarizeValue({ a: 1, b: 2 }, FIELD_LABELS_AR)).toBe('حقلان');
    expect(
      summarizeValue(
        Array.from({ length: 11 }, () => 0),
        FIELD_LABELS_AR,
      ),
    ).toBe('11 عنصرًا');
  });

  it('clips long text to one readable line', () => {
    const long = 'word '.repeat(60);
    const summary = summarizeValue(long, FIELD_LABELS_EN);
    expect(summary.length).toBeLessThanOrEqual(80);
    expect(summary.endsWith('…')).toBe(true);
  });
});
