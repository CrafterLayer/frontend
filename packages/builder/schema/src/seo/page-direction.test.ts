import { describe, expect, it } from 'vitest';

import { languageSetDirection } from './page-direction';

const SET = { alternates: [{ lang: 'ar', path: '/' }, { lang: 'en', path: '/en' }] };

describe('languageSetDirection', () => {
  it('reads a page in a language set in its own language direction', () => {
    expect(languageSetDirection({ lang: 'en', seo: SET })).toBe('ltr');
    expect(languageSetDirection({ lang: 'ar-JO', seo: SET })).toBe('rtl');
    expect(languageSetDirection({ lang: 'fa', seo: SET })).toBe('rtl');
  });

  it('leaves every other page to the document direction', () => {
    expect(languageSetDirection(undefined)).toBeUndefined();
    expect(languageSetDirection({ lang: 'en' })).toBeUndefined();
    expect(languageSetDirection({ lang: 'en', seo: { alternates: [] } })).toBeUndefined();
    expect(languageSetDirection({ lang: '', seo: SET })).toBeUndefined();
    expect(languageSetDirection({ seo: SET })).toBeUndefined();
  });
});
