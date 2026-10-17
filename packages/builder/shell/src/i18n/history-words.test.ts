import { describe, expect, it } from 'vitest';

import { localHistoryLabel } from './history-words';

describe('localHistoryLabel', () => {
  it('returns English labels as recorded', () => {
    expect(localHistoryLabel('Edit text · Hero heading', 'en')).toBe('Edit text · Hero heading');
  });

  it('reads a part edit in Arabic: the verb, the part and its block', () => {
    expect(localHistoryLabel('Edit text · Hero heading', 'ar')).toBe(
      'تعديل النص · العنوان (واجهة رئيسية)',
    );
    expect(localHistoryLabel('Edit text · Rich Text', 'ar')).toBe('تعديل النص · نص منسّق');
    expect(localHistoryLabel('Replace image · Hero image 2', 'ar')).toBe(
      'استبدال الصورة · الصورة 2 (واجهة رئيسية)',
    );
  });

  it('translates the verb of a canvas text session whose name is already Arabic', () => {
    expect(localHistoryLabel('Text · زر', 'ar')).toBe('النص · زر');
  });

  it('keeps a segment it cannot read rather than guessing', () => {
    expect(localHistoryLabel('Frobnicate · Zork widget', 'ar')).toBe('Frobnicate · Zork widget');
    expect(localHistoryLabel('Edit text · Zork widget', 'ar')).toBe('تعديل النص · Zork widget');
  });
});
