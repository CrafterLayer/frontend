import { describe, expect, it } from 'vitest';

import {
  CUSTOM_CODE_ATTRIBUTES,
  CUSTOM_CODE_BEHAVIORS,
  customCodeAttributeProblem,
  customCodeAttributeSpelling,
  customCodeTreeProblems,
  customCodeTreeSchema,
  isCustomCodeBehavior,
} from './custom-code-tree';

const ok = (tag: string, name: string, value: string) =>
  { expect(customCodeAttributeProblem(tag, name, value)).toBeUndefined(); };
const bad = (tag: string, name: string, value: string) =>
  { expect(customCodeAttributeProblem(tag, name, value)).toEqual(expect.any(String)); };

describe('site behaviours in the custom-code vocabulary', () => {
  it('admits the behaviour attribute, its params and fetchpriority', () => {
    for (const name of [
      'data-ck-behavior',
      'data-ck-to',
      'data-ck-until',
      'data-ck-speed',
      'data-ck-phone',
      'data-ck-text',
      'fetchpriority',
    ]) {
      expect(CUSTOM_CODE_ATTRIBUTES).toContain(name);
    }
    expect(customCodeAttributeSpelling('dataCkBehavior')).toBe('data-ck-behavior');
    expect(customCodeAttributeSpelling('fetchPriority')).toBe('fetchpriority');
  });

  it('holds the closed enum', () => {
    expect(CUSTOM_CODE_BEHAVIORS).toEqual([
      'reveal',
      'stagger',
      'count-up',
      'countdown',
      'marquee',
      'carousel',
      'tabs',
      'sticky-header',
      'lightbox',
      'whatsapp-form',
      'copy-text',
      'ticker',
      'layout',
    ]);
    expect(isCustomCodeBehavior('marquee')).toBe(true);
    expect(isCustomCodeBehavior('parallax')).toBe(false);
  });

  it('data-ck-behavior: a value in the enum; whatsapp-form only on a form or button', () => {
    for (const behavior of CUSTOM_CODE_BEHAVIORS.filter((name) => name !== 'whatsapp-form')) {
      ok('div', 'data-ck-behavior', behavior);
    }
    bad('div', 'data-ck-behavior', 'parallax');
    bad('div', 'data-ck-behavior', 'alert(1)');
    ok('button', 'data-ck-behavior', 'whatsapp-form');
    ok('form', 'data-ck-behavior', 'whatsapp-form');
    expect(customCodeAttributeProblem('div', 'data-ck-behavior', 'whatsapp-form')).toMatch(
      /<form> or <button>/u,
    );
    bad('path', 'data-ck-behavior', 'reveal');
  });

  it('data-ck-to: a finite number of at most 12 characters', () => {
    ok('span', 'data-ck-to', '1500');
    ok('span', 'data-ck-to', '4.8');
    ok('span', 'data-ck-to', '-20');
    bad('span', 'data-ck-to', '1,500');
    bad('span', 'data-ck-to', 'Infinity');
    bad('span', 'data-ck-to', '');
    bad('span', 'data-ck-to', '1234567890123');
    bad('span', 'data-ck-to', ' 12');
  });

  it('data-ck-until: an ISO 8601 datetime', () => {
    ok('span', 'data-ck-until', '2026-12-31T23:59:00+03:00');
    ok('span', 'data-ck-until', '2026-12-31T23:59Z');
    ok('span', 'data-ck-until', '2026-12-31T23:59:59.500Z');
    bad('span', 'data-ck-until', '2026-12-31');
    bad('span', 'data-ck-until', 'next friday');
    bad('span', 'data-ck-until', '2026-13-45T99:99');
  });

  it('data-ck-speed: slow, normal or fast', () => {
    ok('div', 'data-ck-speed', 'slow');
    ok('div', 'data-ck-speed', 'normal');
    ok('div', 'data-ck-speed', 'fast');
    bad('div', 'data-ck-speed', '3s');
  });

  it('data-ck-phone: an optional + and 7 to 15 digits', () => {
    ok('button', 'data-ck-phone', '+962790000000');
    ok('button', 'data-ck-phone', '0790000');
    bad('button', 'data-ck-phone', '+962 79 000 0000');
    bad('button', 'data-ck-phone', '123456');
    bad('button', 'data-ck-phone', '1234567890123456');
    bad('button', 'data-ck-phone', 'tel:+962790000000');
  });

  it('data-ck-text: at most 200 characters, Arabic included', () => {
    ok('button', 'data-ck-text', 'مرحبا، أود حجز طاولة لشخصين الليلة');
    ok('button', 'data-ck-text', 'ع'.repeat(200));
    bad('button', 'data-ck-text', 'ع'.repeat(201));
  });

  it('fetchpriority: high, low or auto, and only on an img', () => {
    ok('img', 'fetchpriority', 'high');
    ok('img', 'fetchpriority', 'low');
    ok('img', 'fetchpriority', 'auto');
    bad('img', 'fetchpriority', 'urgent');
    expect(customCodeAttributeProblem('div', 'fetchpriority', 'high')).toMatch(/<img>/u);
  });

  it('never admits a handler or another data attribute, and says what to write instead', () => {
    expect(customCodeAttributeProblem('button', 'onclick', 'alert(1)')).toMatch(/data-ck-behavior/u);
    expect(customCodeAttributeProblem('div', 'data-foo', 'x')).toMatch(/only data attributes/u);
    expect(customCodeAttributeProblem('div', 'data-ck-carousel-prev', '')).toEqual(expect.any(String));
    const onTree = customCodeTreeSchema.safeParse({
      kind: 'root',
      children: [{ kind: 'element', tag: 'button', attributes: { onclick: 'x()' } }],
    });
    expect(onTree.success).toBe(false);
  });

  it('refuses a param without data-ck-behavior on the same element', () => {
    const problems = customCodeTreeProblems({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'div',
          attributes: { 'data-ck-behavior': 'reveal' },
          children: [{ kind: 'element', tag: 'span', text: '0', attributes: { 'data-ck-to': '120' } }],
        },
      ],
    });
    expect(problems.map((problem) => problem.path)).toEqual([
      ['children', 0, 'children', 0, 'attributes', 'data-ck-to'],
    ]);
    expect(problems[0]?.message).toMatch(/write data-ck-behavior on the same element/u);
  });

  it('accepts a whole tree that names behaviours', () => {
    const result = customCodeTreeSchema.safeParse({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          attributes: { 'data-ck-behavior': 'stagger', 'data-ck-speed': 'fast', lang: 'ar' },
          children: [
            {
              kind: 'element',
              tag: 'span',
              text: '+0',
              attributes: { 'data-ck-behavior': 'count-up', 'data-ck-to': '1500' },
            },
            {
              kind: 'element',
              tag: 'button',
              text: 'احجز عبر واتساب',
              attributes: {
                'data-ck-behavior': 'whatsapp-form',
                'data-ck-phone': '+962790000000',
                'data-ck-text': 'مرحبا، أود الحجز',
              },
            },
            {
              kind: 'element',
              tag: 'img',
              attributes: { src: '/hero.webp', alt: '', fetchpriority: 'high' },
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
