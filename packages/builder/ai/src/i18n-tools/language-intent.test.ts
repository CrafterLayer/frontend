import { describe, expect, it } from 'vitest';

import { languageIntent } from './language-intent';
import {
  foldWord,
  isLanguageTag,
  languageDirection,
  siteLanguage,
  SITE_LANGUAGES,
} from './languages';

function read(request: string): string | undefined {
  const intent = languageIntent(request);
  return intent === undefined
    ? undefined
    : `${intent.action} ${intent.scope} ${intent.languages.map(({ tag }) => tag).join(',')}`;
}

describe('site languages', () => {
  it('knows each tag once, with its direction and three names', () => {
    const tags = SITE_LANGUAGES.map(({ tag }) => tag);
    expect(new Set(tags).size).toBe(tags.length);
    for (const language of SITE_LANGUAGES) {
      expect(isLanguageTag(language.tag)).toBe(true);
      expect(language.words.every((word) => word === foldWord(word))).toBe(true);
    }
    expect(siteLanguage('pt-BR')?.english).toBe('Portuguese');
    expect(siteLanguage('xx')).toBeUndefined();
  });

  it('reads right to left for Arabic, Hebrew, Persian and Urdu only', () => {
    expect(['ar', 'ar-JO', 'he', 'fa', 'ur'].map(languageDirection)).toEqual([
      'rtl',
      'rtl',
      'rtl',
      'rtl',
      'rtl',
    ]);
    expect(['en', 'fr', 'tr', 'zh', 'xx'].map(languageDirection)).toEqual([
      'ltr',
      'ltr',
      'ltr',
      'ltr',
      'ltr',
    ]);
    expect(isLanguageTag('Arabic!')).toBe(false);
  });
});

describe('languageIntent', () => {
  it.each([
    ['Translate the page to French', 'translate page fr'],
    ['translate it into Spanish', 'translate page es'],
    ['Translate my website to Arabic', 'translate site ar'],
    ['Translate this page from English to German', 'translate page de'],
    ['ترجم الصفحة للإنجليزي', 'translate page en'],
    ['ترجم الموقع إلى الفرنسية', 'translate site fr'],
    ['خلي الموقع بالعربي', 'translate site ar'],
    ['اكتب نصوص الصفحة بالإنجليزي', 'translate page en'],
    ['Make the site in English and Arabic', 'versions site en,ar'],
    ['I want my website bilingual: Arabic and English', 'versions site ar,en'],
    ['Add a French version', 'versions site fr'],
    ['Build a restaurant website in Arabic, English and Turkish', 'versions site ar,en,tr'],
    ['translate the page to French and Spanish', 'versions page fr,es'],
    ['Add an English version of this page', 'versions page en'],
    ['أضف نسخة فرنسية لهذه الصفحة', 'versions page fr'],
    ['أضف نسخة إنجليزية من الموقع', 'versions site en'],
    ['بدي الموقع عربي وإنجليزي', 'versions site ar,en'],
    ['اعمل الموقع بالعربي والإنجليزي والفرنسي', 'versions site ar,en,fr'],
    ['موقع متعدد اللغات: عربي وإنجليزي', 'versions site ar,en'],
  ])('«%s» → %s', (request, expected) => {
    expect(read(request)).toBe(expected);
  });

  it.each([
    'Add a section about Arabic coffee',
    'Arabic and French menu items',
    'Translate the hero to French',
    'ترجم الزر للإنجليزي',
    'Make the hero darker',
    'Build a landing page for my clinic',
    'أضف قسم عن القهوة التركية',
    'What languages do you support?',
  ])('«%s» is not about the page language', (request) => {
    expect(read(request)).toBeUndefined();
  });
});
