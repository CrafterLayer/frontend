import { describe, expect, it } from 'vitest';

import type { BuilderDocument } from '@craftkit/builder-schema';

import { blocks, checkQuality, type QualityCheck } from '../quality';
import { altFor } from './alt-text';
import { checkSeo, type SeoIssue } from './check-seo';
import {
  AR_DESCRIPTION,
  AR_TITLE,
  CAFE_PHOTO,
  cleanArabicRegions,
  dirtyArabicRegions,
  el,
  pageDocument,
  tree,
} from './seo.fixtures';

const AR_ROOT = { title: AR_TITLE, description: AR_DESCRIPTION, lang: 'ar' };

const clean = (root: Record<string, unknown> = {}): BuilderDocument =>
  pageDocument(cleanArabicRegions(), { ...AR_ROOT, ...root });
const dirty = (root: Record<string, unknown> = {}): BuilderDocument =>
  pageDocument(dirtyArabicRegions(), { ...AR_ROOT, ...root });

const of = (issues: readonly SeoIssue[], check: QualityCheck): SeoIssue[] =>
  issues.filter((issue) => issue.check === check);

describe('checkSeo on an Arabic page (lang ar, dir rtl)', () => {
  it('passes the clean page with no issue at all', () => {
    expect(checkSeo(clean())).toEqual([]);
  });

  describe('seo-title / seo-description', () => {
    it('flags a missing title with no h1 to take one from', () => {
      const document = pageDocument(
        [{ id: 'body', tree: tree(el('section', { children: [el('p', { text: 'نص قصير عن المحمصة.' })] })) }],
        { lang: 'ar', description: AR_DESCRIPTION },
      );
      const issue = of(checkSeo(document), 'seo-title')[0];
      expect(issue?.message).toContain('no title');
      expect(issue?.fix).toBeUndefined();
    });

    it('offers the h1 as the title, marked unsafe', () => {
      const issue = of(checkSeo(clean({ title: '' })), 'seo-title')[0];
      expect(issue?.fix?.safe).toBe(false);
      expect(issue?.fix?.steps[0]).toEqual({
        command: 'setProp',
        args: { id: 'root', key: 'title', value: 'قهوة تُحمّص كل صباح' },
      });
    });

    it('clamps a title wider than a result shows, as a safe fix', () => {
      const long = `${AR_TITLE} ${AR_TITLE}`;
      const issue = of(checkSeo(clean({ title: long })), 'seo-title').find((one) => one.fix?.safe === true);
      const value = (issue?.fix?.steps[0]?.args as { value: string }).value;
      expect(value.length).toBeLessThan(long.length);
      expect(long.startsWith(value)).toBe(true);
    });

    it('clamps a long description the same way', () => {
      const issue = of(checkSeo(clean({ description: `${AR_DESCRIPTION} ${AR_DESCRIPTION}` })), 'seo-description')[0];
      expect(issue?.fix?.safe).toBe(true);
    });

    it('flags an Arabic title on an English page (English secondary)', () => {
      const document = pageDocument(
        [{ id: 'hero', tree: tree(el('section', { attributes: { 'aria-label': 'Hero' }, children: [el('h1', { text: 'Fresh coffee every morning' })] })) }],
        { title: AR_TITLE, description: 'Small-batch roastery in Amman serving specialty coffee roasted every morning, with homemade sweets.', lang: 'en' },
        'ltr',
      );
      const messages = of(checkSeo(document), 'seo-title').map((issue) => issue.message);
      expect(messages.some((message) => message.includes("page's language (en)"))).toBe(true);
    });

    it('does not flag an English title on an English page', () => {
      const document = pageDocument(
        [{ id: 'hero', tree: tree(el('section', { attributes: { 'aria-label': 'Hero' }, children: [el('h1', { text: 'Fresh coffee every morning' })] })) }],
        { title: 'Bunn Specialty Coffee in Amman, roasted daily', description: 'Small-batch roastery in Amman serving specialty coffee roasted every morning, with homemade sweets.', lang: 'en' },
        'ltr',
      );
      expect(of(checkSeo(document), 'seo-title')).toEqual([]);
    });

    it('flags a title another page of the site already uses', () => {
      const document = clean();
      const other = clean();
      const issues = checkSeo(document, {
        pages: [
          { address: '/', document },
          { address: '/menu', document: other },
        ],
      });
      expect(of(issues, 'seo-title')[0]?.message).toContain('/menu');
    });
  });

  describe('seo-h1', () => {
    it('demotes a second h1 to h2 as a safe fix', () => {
      const issue = of(checkSeo(dirty()), 'seo-h1')[0];
      expect(issue?.nodeId).toBe('menu');
      expect(issue?.fix?.safe).toBe(true);
      const value = issue?.fix?.steps[0]?.args['value'] as { children: { children: { tag: string }[] }[] };
      expect(value.children[0]?.children[0]?.tag).toBe('h2');
    });

    it('flags a page with no h1', () => {
      const document = pageDocument(
        [{ id: 'a', tree: tree(el('section', { attributes: { 'aria-label': 'x' }, children: [el('h2', { text: 'عن المحمصة' }), el('p', { text: 'نص' })] })) }],
        AR_ROOT,
      );
      expect(of(checkSeo(document), 'seo-h1')[0]?.message).toContain('no h1');
    });

    it('passes exactly one h1', () => {
      expect(of(checkSeo(clean()), 'seo-h1')).toEqual([]);
    });
  });

  describe('images', () => {
    it('writes Arabic alt from the catalog entry for a missing alt', () => {
      const issue = of(checkSeo(dirty()), 'seo-img-alt')[0];
      const value = issue?.fix?.steps[0]?.args['value'] as { children: { children: { attributes: Record<string, string> }[] }[] };
      expect(value.children[0]?.children[2]?.attributes['alt']).toBe(CAFE_PHOTO.alt.ar);
    });

    it('leaves a decorative image alone', () => {
      const document = clean();
      const hero = document.nodes['hero']?.props['tree'] as { children: { children: { attributes: Record<string, string> }[] }[] };
      const image = hero.children[0]?.children[2];
      if (image !== undefined) image.attributes = { ...image.attributes, alt: '', 'aria-hidden': 'true' };
      expect(of(checkSeo(document), 'seo-img-alt')).toEqual([]);
    });

    it('sets a catalog image’s intrinsic size, and only flags an unknown one', () => {
      const issues = of(checkSeo(dirty()), 'seo-img-size');
      expect(issues).toHaveLength(2);
      expect(issues.every((issue) => issue.fix?.safe === true)).toBe(true);
      const foreign = pageDocument(
        [{ id: 'a', tree: tree(el('section', { attributes: { 'aria-label': 'x' }, children: [el('h1', { text: 'عنوان' }), el('img', { attributes: { src: 'https://example.com/a.jpg', alt: 'صورة', loading: 'eager', fetchpriority: 'high' } })] })) }],
        AR_ROOT,
      );
      const unknown = of(checkSeo(foreign), 'seo-img-size');
      expect(unknown).toHaveLength(1);
      expect(unknown[0]?.fix).toBeUndefined();
    });

    it('makes the hero eager with fetchpriority=high and the image below it lazy', () => {
      const issues = of(checkSeo(dirty()), 'seo-lcp');
      expect(issues.map((issue) => issue.nodeId)).toEqual(['hero', 'menu']);
      const hero = issues[0]?.fix?.steps[0]?.args['value'] as { children: { children: { attributes: Record<string, string> }[] }[] };
      expect(hero.children[0]?.children[2]?.attributes).toMatchObject({ loading: 'eager', fetchpriority: 'high' });
      const below = issues[1]?.fix?.steps[0]?.args['value'] as { children: { children: { attributes: Record<string, string> }[] }[] };
      expect(below.children[0]?.children[2]?.attributes['loading']).toBe('lazy');
    });

    it('passes a page whose hero and lower images load correctly', () => {
      expect(of(checkSeo(clean()), 'seo-lcp')).toEqual([]);
    });
  });

  describe('seo-link-text', () => {
    it('flags «اقرأ المزيد» and rewrites it from the section heading in Arabic', () => {
      const issue = of(checkSeo(dirty()), 'seo-link-text')[0];
      expect(issue?.fix?.safe).toBe(true);
      const value = issue?.fix?.steps[0]?.args['value'] as { children: { children: { text?: string }[] }[] };
      expect(value.children[0]?.children[3]?.text).toBe('اقرأ المزيد عن قائمة المشروبات');
    });

    it('flags English "Read more" and rewrites it in English', () => {
      const document = pageDocument(
        [{ id: 'a', tree: tree(el('section', { attributes: { 'aria-label': 'x' }, children: [el('h1', { text: 'Our roasts' }), el('a', { text: 'Read more', attributes: { href: '#a' } })] })) }],
        { lang: 'en' },
        'ltr',
      );
      const value = of(checkSeo(document), 'seo-link-text')[0]?.fix?.steps[0]?.args['value'] as { children: { children: { text?: string }[] }[] };
      expect(value.children[0]?.children[1]?.text).toBe('Learn more about Our roasts');
    });

    it('passes descriptive link text', () => {
      expect(of(checkSeo(clean()), 'seo-link-text')).toEqual([]);
    });
  });

  describe('seo-section-label', () => {
    it('names an unlabelled section by its heading', () => {
      const issue = of(checkSeo(dirty()), 'seo-section-label').find((one) => one.nodeId === 'hero');
      const value = issue?.fix?.steps[0]?.args['value'] as { children: { attributes: Record<string, string>; children: { attributes: Record<string, string> }[] }[] };
      expect(value.children[0]?.attributes['aria-labelledby']).toBe('hero-title');
      expect(value.children[0]?.children[0]?.attributes['id']).toBe('hero-title');
    });

    it('passes a labelled section', () => {
      expect(of(checkSeo(clean()), 'seo-section-label')).toEqual([]);
    });
  });

  describe('seo-lang-dir', () => {
    it('flags lang ar reading left to right, with an unsafe direction fix', () => {
      const document = pageDocument(cleanArabicRegions(), AR_ROOT, 'ltr');
      const issue = of(checkSeo(document), 'seo-lang-dir')[0];
      expect(issue?.fix).toEqual({ safe: false, steps: [{ command: 'setDocMeta', args: { dir: 'rtl' } }] });
    });

    it('sets a missing lang on an Arabic page as a safe fix', () => {
      const issue = of(checkSeo(clean({ lang: '' })), 'seo-lang-dir')[0];
      expect(issue?.fix?.safe).toBe(true);
      expect(issue?.fix?.steps[0]?.args).toEqual({ id: 'root', key: 'lang', value: 'ar' });
    });

    it('flags lang en over Arabic text', () => {
      const messages = of(checkSeo(clean({ lang: 'en' })), 'seo-lang-dir').map((issue) => issue.message);
      expect(messages.some((message) => message.includes('mostly Arabic'))).toBe(true);
    });

    it('passes lang ar, rtl, Arabic text', () => {
      expect(of(checkSeo(clean()), 'seo-lang-dir')).toEqual([]);
    });
  });

  describe('site-level checks', () => {
    it('flags a page with no slug when the origin is known', () => {
      const issue = of(checkSeo(clean(), { origin: 'https://bunn.jo', address: '/menu', pages: [] }), 'seo-canonical')[0];
      expect(issue?.fix?.safe).toBe(false);
      expect(issue?.fix?.steps[0]?.args['key']).toBe('slug');
      expect(of(checkSeo(clean({ slug: 'قائمة' }), { origin: 'https://bunn.jo', address: '/menu', pages: [] }), 'seo-canonical')).toEqual([]);
    });

    it('flags an hreflang alternate that does not point back', () => {
      const ar = clean({ seo: { alternates: [{ lang: 'en', path: '/en' }] } });
      const en = clean();
      const pages = [
        { address: '/', document: ar },
        { address: '/en', document: en },
      ];
      expect(of(checkSeo(ar, { pages }), 'seo-hreflang')[0]?.message).toContain('reciprocal');
      const back = clean({ seo: { alternates: [{ lang: 'ar', path: '/' }] } });
      expect(
        of(checkSeo(ar, { pages: [{ address: '/', document: ar }, { address: '/en', document: back }] }), 'seo-hreflang'),
      ).toEqual([]);
    });

    it('flags a sample phone in business data, and passes the real one', () => {
      const business = {
        type: 'CafeOrCoffeeShop',
        name: 'بُن',
        telephone: '+962 79 000 0000',
        address: { city: 'عمّان', country: 'JO' },
      };
      const flagged = of(checkSeo(clean({ seo: { samples: ['+962790000000'], site: { business } } })), 'seo-jsonld');
      expect(flagged[0]?.severity).toBe('error');
      expect(flagged[0]?.message).toContain('sample value');
      expect(of(checkSeo(clean({ seo: { site: { business } } })), 'seo-jsonld')).toEqual([]);
    });

    it('asks for FAQPage when the page has FAQ details but seo.schemaKinds lacks it, as a safe fix', () => {
      const faq = {
        id: 'faq',
        tree: tree(
          el('section', {
            attributes: { 'aria-label': 'أسئلة' },
            children: [
              el('h2', { text: 'أسئلة شائعة' }),
              el('details', { children: [el('summary', { text: 'هل توصلون؟' }), el('p', { text: 'نعم، داخل عمّان.' })] }),
            ],
          }),
        ),
      };
      const document = pageDocument([...cleanArabicRegions(), faq], { ...AR_ROOT, seo: { keyword: 'قهوة' } });
      const issue = of(checkSeo(document), 'seo-jsonld').find((one) => one.message.includes('FAQPage'));
      expect(issue?.fix?.safe).toBe(true);
      expect(issue?.fix?.steps[0]).toEqual({
        command: 'setProp',
        args: { id: 'root', key: 'seo', value: { keyword: 'قهوة', schemaKinds: ['FAQPage'] } },
      });
      const fixed = pageDocument([...cleanArabicRegions(), faq], {
        ...AR_ROOT,
        seo: { keyword: 'قهوة', schemaKinds: ['FAQPage'] },
      });
      expect(of(checkSeo(fixed), 'seo-jsonld')).toEqual([]);
    });

    it('flags a local business with no city', () => {
      const issues = of(checkSeo(clean({ seo: { site: { business: { type: 'Restaurant', name: 'بُن', telephone: '+96264000000' } } } })), 'seo-jsonld');
      expect(issues[0]?.message).toContain('city');
    });

    it('flags noindex on the home page only', () => {
      expect(of(checkSeo(clean({ noIndex: true }), { address: '/' }), 'seo-noindex-home')).toHaveLength(1);
      expect(of(checkSeo(clean({ noIndex: true }), { address: '/thanks' }), 'seo-noindex-home')).toEqual([]);
    });

    it('flags a page no other page links to', () => {
      const home = clean();
      const menu = clean();
      expect(
        of(checkSeo(menu, { pages: [{ address: '/', document: home }, { address: '/menu', document: menu }] }), 'seo-orphan'),
      ).toHaveLength(1);
      const linking = pageDocument(
        [...cleanArabicRegions(), { id: 'nav', tree: tree(el('nav', { children: [el('a', { text: 'القائمة', attributes: { href: '/menu' } })] })) }],
        AR_ROOT,
      );
      expect(
        of(checkSeo(menu, { pages: [{ address: '/', document: linking }, { address: '/menu', document: menu }] }), 'seo-orphan'),
      ).toEqual([]);
    });
  });

  it('is advisory: blocks() ignores SEO issues even at error severity', () => {
    const issues = checkSeo(pageDocument([], { lang: 'ar' }));
    expect(issues.some((issue) => issue.severity === 'error')).toBe(true);
    expect(blocks(issues)).toEqual([]);
    expect(checkQuality(dirty()).issues.every((issue) => !issue.check.startsWith('seo-'))).toBe(true);
  });
});

describe('altFor', () => {
  it('uses the catalog description in the page language', () => {
    expect(altFor({ src: CAFE_PHOTO.url }, 'القائمة', 'ar')).toBe(CAFE_PHOTO.alt.ar);
    expect(altFor({ src: CAFE_PHOTO.url.replace('&', '&amp;') }, 'Menu', 'en')).toBe(CAFE_PHOTO.alt.en);
  });

  it('falls back to the topic label plus heading, then the heading, never empty', () => {
    expect(altFor({ src: 'https://example.com/x.jpg', topic: 'cafe' }, 'القائمة', 'ar')).toBe('مقهى وقهوة مختصة — القائمة');
    expect(altFor({ src: 'https://example.com/x.jpg' }, 'Our roasts', 'en')).toBe('Image: Our roasts');
    expect(altFor({ src: 'https://example.com/x.jpg' }, '', 'ar')).toBe('صورة');
  });
});
