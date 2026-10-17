import type { BuilderDocument } from '../document/types';
import type { JsonValue } from '../json/json-value';

/** A two-region document: a hero tree and a FAQ + menu tree, both under the page root. */
export function seoFixture(lang: 'ar' | 'en'): BuilderDocument {
  const ar = lang === 'ar';
  const hero: JsonValue = {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        children: [
          { kind: 'element', tag: 'h1', text: ar ? 'قهوة تُحمّص كل صباح' : 'Coffee roasted every morning' },
          {
            kind: 'element',
            tag: 'p',
            text: ar
              ? 'محمصة صغيرة في جبل عمّان تقدّم قهوة مختصة.'
              : 'A small roastery in Amman serving specialty coffee.',
          },
          {
            kind: 'element',
            tag: 'img',
            attributes: { src: 'https://img.example/hero.jpg', alt: ar ? 'فنجان قهوة' : 'A cup', width: '1200', height: '800', loading: 'eager' },
          },
          {
            kind: 'element',
            tag: 'a',
            attributes: { href: '#menu' },
            children: [
              { kind: 'element', tag: 'span', text: ar ? 'اقرأ المزيد' : 'Read more' },
              { kind: 'icon', name: 'arrow-right' },
            ],
          },
        ],
      },
    ],
  };
  const faq: JsonValue = {
    kind: 'root',
    children: [
      { kind: 'element', tag: 'h2', text: ar ? 'أسئلة شائعة' : 'FAQ' },
      {
        kind: 'element',
        tag: 'details',
        children: [
          { kind: 'element', tag: 'summary', text: ar ? 'هل لديكم حليب نباتي؟' : 'Do you have oat milk?' },
          { kind: 'element', tag: 'p', text: ar ? 'نعم، حليب الشوفان واللوز.' : 'Yes, oat and almond.' },
        ],
      },
      { kind: 'element', tag: 'h3', text: ar ? 'لاتيه' : 'Latte' },
      { kind: 'element', tag: 'p', text: ar ? '3.5 د.أ' : '$4.50' },
    ],
  };
  const orphan: JsonValue = { kind: 'root', children: [{ kind: 'element', tag: 'h1', text: 'orphan' }] };
  return {
    schemaVersion: 1,
    surface: 'page',
    dir: ar ? 'rtl' : 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: ar ? 'الرئيسية' : 'Home', description: '', lang, slug: '' },
        slots: { default: ['hero', 'faq'] },
      },
      hero: { id: 'hero', type: 'customCode', props: { tree: hero } },
      faq: { id: 'faq', type: 'customCode', props: { tree: faq } },
      loose: { id: 'loose', type: 'customCode', props: { tree: orphan } },
    },
  };
}
