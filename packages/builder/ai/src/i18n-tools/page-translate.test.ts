import { describe, expect, it } from 'vitest';

import type { BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { serializeTreeMarkup } from '../plan/tree-markup';
import { validateAiPlan } from '../plan/validate-plan';
import { partsKernel } from '../style-tools/part-tools.fixtures';
import { fixtureKernel, liveContext } from '../tools/agent/agent-tools.fixtures';
import { languageSetSteps } from './language-set';
import { pageTexts } from './page-texts';
import { pageTranslateTool, type PageTranslateInput } from './page-translate';

const CAFE_AR: Readonly<Record<string, string>> = {
  Brew: 'بُن',
  'Old menu': 'القائمة القديمة',
  Gone: 'انتهى',
  Order: 'اطلب',
  'Fresh coffee daily': 'قهوة طازجة كل يوم',
  'Roasted every morning.': 'نحمّصها كل صباح.',
  Coffee: 'قهوة',
  'See the menu': 'تصفّح القائمة',
  'Our menu': 'قائمتنا',
  Espresso: 'إسبريسو',
  Latte: 'لاتيه',
  'Our story': 'قصتنا',
  'Since 1998.': 'منذ 1998.',
  Menu: 'القائمة',
  '© Brew': '© بُن',
};

/** Run the tool, then judge its steps with the real door; the accepted writes by `<id>.<key>`. */
function translate(kernel: BuilderKernel, input: PageTranslateInput) {
  const parsed = pageTranslateTool.parse(input);
  if (!parsed.ok) throw new Error(parsed.error);
  const run = pageTranslateTool.run(parsed.value, liveContext(kernel));
  if (!run.ok) return { error: run.error, writes: new Map<string, unknown>(), note: undefined };
  const result = validateAiPlan({ rationale: 'translate', commands: [...run.steps] }, kernel, {
    clock: fixedClock(2),
    ids: seededIds('i18n-door'),
  });
  const writes = new Map<string, unknown>();
  if (!result.ok) throw new Error(result.issues.map(({ message }) => message).join('; '));
  for (const step of result.plan.commands) {
    const args = step.args as { id?: string; key?: string; value?: unknown };
    writes.set(
      step.command === 'setProp' ? `${args.id ?? ''}.${args.key ?? ''}` : step.command,
      step.command === 'setProp' ? args.value : step.args,
    );
  }
  return { error: undefined, writes, note: run.note };
}

const markup = (value: unknown) => serializeTreeMarkup(value) ?? '';

/** The map without some of its texts. */
function without(texts: Readonly<Record<string, string>>, ...left: readonly string[]) {
  return Object.fromEntries(Object.entries(texts).filter(([from]) => !left.includes(from)));
}

describe('page.translate', () => {
  it('reads only an object with a language tag and a map of texts', () => {
    expect(pageTranslateTool.parse({ lang: 'arabic!', texts: { a: 'b' } }).ok).toBe(false);
    expect(pageTranslateTool.parse({ lang: 'ar', texts: {} }).ok).toBe(false);
    expect(pageTranslateTool.parse({ lang: 'ar', texts: { a: '' } }).ok).toBe(false);
    expect(pageTranslateTool.parse({ lang: 'ar', texts: { a: 'b' }, keep: [] }).ok).toBe(false);
    expect(pageTranslateTool.parse({ lang: 'AR', texts: { a: 'b' } })).toEqual({
      ok: true,
      value: { lang: 'ar', texts: { a: 'b' } },
    });
  });

  it('lists every text a visitor reads, each once, and nothing without letters', () => {
    const texts = pageTexts(liveContext(fixtureKernel()));
    expect(texts).toEqual(
      expect.arrayContaining(['Fresh coffee daily', 'Coffee', 'See the menu', '© Brew']),
    );
    expect(texts.filter((text) => text === 'Brew')).toHaveLength(1);
    expect(texts.every((text) => /\p{L}/u.test(text))).toBe(true);
  });

  it('turns an English page Arabic in one step the door accepts: words, lang, direction, faces', () => {
    const { error, writes, note } = translate(fixtureKernel(), { lang: 'ar', texts: CAFE_AR });
    expect(error).toBeUndefined();
    const hero = markup(writes.get('r-hero.tree'));
    expect(hero).toContain('قهوة طازجة كل يوم');
    expect(hero).toContain("alt='قهوة'");
    expect(hero).toContain('text-start');
    expect(hero).toContain("name='arrow-left'");
    expect(hero).toContain("href='#menu'");
    expect(markup(writes.get('r-footer.tree'))).toContain('© بُن');
    expect(writes.get('root.title')).toBe('بُن');
    expect(writes.get('root.lang')).toBe('ar');
    expect(writes.get('setDocMeta')).toEqual({ dir: 'rtl' });
    expect(String(writes.get('root.pageCss'))).toContain("'Readex Pro'");
    expect(note).toMatch(/^\d+ texts in Arabic$/u);
  });

  it('refuses a half translation and names what is left, so the repair adds exactly that', () => {
    const texts = without(CAFE_AR, 'Fresh coffee daily', 'Roasted every morning.');
    const { error } = translate(fixtureKernel(), { lang: 'ar', texts });
    expect(error).toContain('2 texts are still untranslated');
    expect(error).toContain('"Fresh coffee daily"');
    expect(error).toContain('"Roasted every morning."');
  });

  it('keeps single words such as a brand as written and says so', () => {
    const { error, note } = translate(fixtureKernel(), {
      lang: 'ar',
      texts: without(CAFE_AR, 'Brew'),
    });
    expect(error).toBeUndefined();
    expect(note).toContain('kept as written: "Brew"');
  });

  it('refuses a map that matches nothing on the page', () => {
    expect(
      translate(fixtureKernel(), { lang: 'fr', texts: { 'Not here': 'Pas ici' } }).error,
    ).toContain('no key of "texts"');
  });

  it('translates an Arabic page to English and turns it left to right', () => {
    const kernel = fixtureKernel({ locale: 'ar' });
    const english = Object.fromEntries(Object.entries(CAFE_AR).map(([en, ar]) => [ar, en]));
    const extra = {
      'قهوة تُحمّص كل صباح': 'Coffee roasted every morning',
      'من المزرعة إلى فنجانك.': 'From the farm to your cup.',
      'اطلب الآن': 'Order now',
      الأسعار: 'Prices',
      'منذ ١٩٩٨.': 'Since 1998.',
    };
    const { error, writes } = translate(kernel, { lang: 'en', texts: { ...english, ...extra } });
    expect(error).toBeUndefined();
    expect(writes.get('setDocMeta')).toEqual({ dir: 'ltr' });
    expect(writes.get('root.lang')).toBe('en');
    expect(markup(writes.get('r-hero.tree'))).toContain('Coffee roasted every morning');
    expect(markup(writes.get('r-hero.tree'))).toContain("name='arrow-right'");
  });

  it('turns a version in a language set by its own lang, never the site direction', () => {
    const kernel = fixtureKernel({ locale: 'ar' });
    const alternates = [
      { lang: 'en', path: '/' },
      { lang: 'ar', path: '/ar' },
    ];
    kernel.dispatch('setProp', { id: 'root', key: 'seo', value: { alternates } });
    const english = Object.fromEntries(Object.entries(CAFE_AR).map(([en, ar]) => [ar, en]));
    const extra = {
      'قهوة تُحمّص كل صباح': 'Coffee roasted every morning',
      'من المزرعة إلى فنجانك.': 'From the farm to your cup.',
      'اطلب الآن': 'Order now',
      الأسعار: 'Prices',
      'منذ ١٩٩٨.': 'Since 1998.',
    };
    const { error, writes } = translate(kernel, { lang: 'en', texts: { ...english, ...extra } });
    expect(error).toBeUndefined();
    expect(writes.has('setDocMeta')).toBe(false);
    expect(writes.get('root.lang')).toBe('en');
    expect(markup(writes.get('r-hero.tree'))).toContain("name='arrow-right'");
  });

  it('leaves the language switcher as written: each language keeps its own name', () => {
    const kernel = fixtureKernel();
    const members = [
      { lang: 'en', address: '/' },
      { lang: 'ar', address: '/ar' },
    ];
    for (const { command, args } of languageSetSteps(kernel, { members, lang: 'en' }))
      kernel.dispatch(command, args);
    const { error, writes } = translate(kernel, { lang: 'ar', texts: CAFE_AR });
    expect(error).toBeUndefined();
    expect(markup(writes.get('r-header.tree'))).toContain("lang='en'>English</a>");
  });

  it('translates block parts: text, link labels, list items, image alt and rich text', () => {
    const kernel = partsKernel();
    const texts = {
      'THE PROFESSIONAL WEBSITE BUILDER': 'منشئ المواقع الاحترافي',
      welcom: 'أهلًا',
      'Blocks that grow with your site.': 'أقسام تكبر مع موقعك.',
      'Every edit becomes one undo.': 'كل تعديل تراجع واحد.',
      'Get started': 'ابدأ الآن',
      'Why teams pick it': 'لماذا تختاره الفرق',
      Fast: 'سريع',
      'Ships in a day.': 'يُطلق في يوم.',
      Safe: 'آمن',
      'One door for every edit.': 'باب واحد لكل تعديل.',
      'Twice, on purpose.': 'مرتان، عن قصد.',
      'See all features': 'كل المزايا',
      'A builder at work': 'منشئ أثناء العمل',
      'Our story': 'قصتنا',
      'Since 2019.': 'منذ 2019.',
      Parts: 'الأجزاء',
    };
    const { error, writes } = translate(kernel, { lang: 'ar', texts });
    expect(error).toBeUndefined();
    expect(writes.get('hero-1.heading')).toBe('أهلًا');
    expect(writes.get('hero-1.trustLine')).toBe('كل تعديل تراجع واحد.');
    expect(writes.get('cta-1.label')).toBe('ابدأ الآن');
    expect(writes.has('cta-2.label')).toBe(false);
    expect(writes.get('features-1.items')).toEqual([
      { title: 'سريع', body: 'يُطلق في يوم.' },
      { title: 'آمن', body: 'باب واحد لكل تعديل.' },
      { title: 'سريع', body: 'مرتان، عن قصد.' },
    ]);
    expect(writes.get('features-1.link')).toEqual({ label: 'كل المزايا', href: '/features' });
    expect(writes.get('features-1.imageAlt')).toBe('منشئ أثناء العمل');
    expect(writes.get('text-1.content')).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'كل تعديل تراجع واحد.' }] }],
    });
    expect(writes.get('root.title')).toBe('الأجزاء');
  });
});
