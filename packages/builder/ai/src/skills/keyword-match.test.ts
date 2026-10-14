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

  it('reads the dialect "for me", glued or apart (2026-10-14)', () => {
    expect(holds('سويلي لعبة تجمع فيها نجوم', 'سوي لعبة')).toBe(true);
    expect(holds('اعمل لي لعبة', 'اعمل لعبة')).toBe(true);
    expect(holds('صمملي شعار', 'صمم شعار')).toBe(true);
    expect(holds('سوي لنا لعبة', 'سوي لعبة')).toBe(true);
    // A keyword that names «لي» still matches it; «لي» never starts a keyword's match.
    expect(holds('صمم لي صفحة', 'صمم لي')).toBe(true);
    expect(holds('لي لعبة', 'لعبة')).toBe(true);
    // One skipped word only, and only «لي»/«لنا»: other words still break a phrase.
    expect(holds('اعمل لي لي لعبة', 'اعمل لعبة')).toBe(false);
    expect(holds('اعمل له لعبة', 'اعمل لعبة')).toBe(false);
    // A two-letter stem is never read: «عملي» (practical) is not «عم».
    expect(holds('حل عملي', 'عم')).toBe(false);
  });
});
