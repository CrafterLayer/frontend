import { describe, expect, it } from 'vitest';

import { AR_PAGES, AR_SHARED_SOURCES, arabicCount } from './arabic-count';

describe('arabicCount', () => {
  it('agrees a page count in all four everyday forms, digits Latin', () => {
    expect(arabicCount(1, AR_PAGES)).toBe('صفحة واحدة');
    expect(arabicCount(2, AR_PAGES)).toBe('صفحتان');
    expect(arabicCount(3, AR_PAGES)).toBe('3 صفحات');
    expect(arabicCount(10, AR_PAGES)).toBe('10 صفحات');
    expect(arabicCount(11, AR_PAGES)).toBe('11 صفحة');
    expect(arabicCount(99, AR_PAGES)).toBe('99 صفحة');
  });

  it('follows the last two digits past a hundred, and turns the tamyīz genitive there', () => {
    expect(arabicCount(103, AR_PAGES)).toBe('103 صفحات');
    expect(arabicCount(111, AR_PAGES)).toBe('111 صفحة');
    expect(arabicCount(11, AR_SHARED_SOURCES)).toBe('11 مصدرًا مشتركًا');
    expect(arabicCount(100, AR_SHARED_SOURCES)).toBe('100 مصدر مشترك');
  });
});
