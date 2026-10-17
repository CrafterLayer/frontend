import { describe, expect, it } from 'vitest';

import { normalizeArabic, normalizeIntentText } from './normalize-arabic';

describe('normalizeArabic', () => {
  it('folds taa marbuta into haa, so صفحة and صفحه are one word', () => {
    // The audit's measured miss (agent-audit §2 P1-5): "صفحه هبوط" never matched "صفحة".
    expect(normalizeArabic('صفحة')).toBe(normalizeArabic('صفحه'));
    expect(normalizeArabic('صفحة')).toBe('صفحه');
  });

  it('folds every hamza-carrying alif into bare alif', () => {
    expect(normalizeArabic('أضف إلكتروني آخر ٱلموقع')).toBe('اضف الكتروني اخر الموقع');
  });

  it('folds alif maqsura into yaa', () => {
    expect(normalizeArabic('على مستوى')).toBe('علي مستوي');
  });

  it('drops tatweel, which stretches a word without changing it', () => {
    expect(normalizeArabic('مـوقـــع')).toBe('موقع');
  });

  it('drops harakat, tanween, shadda, sukun and the dagger alif', () => {
    expect(normalizeArabic('مَوْقِعٌ غيّر')).toBe('موقع غير');
    expect(normalizeArabic('هٰذا')).toBe('هذا');
  });

  it('folds the Persian yeh and keheh a pasted request can carry', () => {
    expect(normalizeArabic('ی ک')).toBe('ي ك');
  });

  it('leaves Latin text exactly as it was', () => {
    expect(normalizeArabic('Build A Website')).toBe('Build A Website');
  });
});

describe('normalizeIntentText', () => {
  it('lowercases English and trims', () => {
    expect(normalizeIntentText('  BUILD A Website  ')).toBe('build a website');
  });

  it('reads Arabic-Indic and extended digits as ASCII digits', () => {
    expect(normalizeIntentText('موقع من ٤ صفحات و۵')).toBe('موقع من 4 صفحات و5');
  });

  it('reads Arabic punctuation as its Latin twin', () => {
    expect(normalizeIntentText('هل الصفحة متجاوبة؟')).toBe('هل الصفحه متجاوبه?');
    expect(normalizeIntentText('الرئيسية، من نحن؛ تواصل')).toBe('الرئيسيه, من نحن; تواصل');
  });

  it('collapses whitespace, including newlines and no-break spaces', () => {
    expect(normalizeIntentText('a\n\tb\u00a0 c')).toBe('a b c');
  });

  it("straightens curly apostrophes, so “I’d” and “I'd” are one token", () => {
    expect(normalizeIntentText('I’d like')).toBe("i'd like");
  });

  it('decomposes Arabic presentation forms a shaping editor pastes', () => {
    // U+FEE3 U+FEEE U+FED7 U+FECA — "موقع" in its shaped glyphs.
    expect(normalizeIntentText('ﻣﻮﻗﻊ')).toBe('موقع');
  });

  it('applies every Arabic fold as well', () => {
    expect(normalizeIntentText('إنشاء صفحةٍ')).toBe('انشاء صفحه');
  });
});
