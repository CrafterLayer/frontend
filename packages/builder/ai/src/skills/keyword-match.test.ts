/**
 * A keyword's last word and its endings (2026-10-12): the Arabic indefinite accusative —
 * «أضف مخططًا», «صمّم شعارًا» — holds its noun once the tanween is folded away, as the
 * feminine and nisba endings already did; the plural ات still does not.
 */
import { describe, expect, it } from 'vitest';

import { compileKeyword, readRequestWords, requestHasKeyword } from './keyword-match';

const holds = (request: string, keyword: string) =>
  requestHasKeyword(readRequestWords(request), compileKeyword(keyword));

describe('requestHasKeyword', () => {
  it('reads the accusative alif as the noun it ends', () => {
    expect(holds('أضف مخططًا للحجوزات الشهرية', 'مخطط')).toBe(true);
    expect(holds('صمّم شعارًا لمقهى', 'شعار')).toBe(true);
    expect(holds('أضف جدولا للأسعار', 'جدول')).toBe(true);
  });

  it('keeps the feminine and nisba endings and the bare word', () => {
    expect(holds('صفحة عقارية', 'عقار')).toBe(true);
    expect(holds('أضف مخطط', 'مخطط')).toBe(true);
  });

  it('does not take the plural ات, or a match inside another word', () => {
    expect(holds('رحلات الصيف', 'رحلة')).toBe(false);
    expect(holds('أضف مخططات', 'مخطط')).toBe(false);
    expect(holds('a page for Reid Allen', 'eid al')).toBe(false);
  });
});
