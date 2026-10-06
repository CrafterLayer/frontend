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
      // media-motion (2026-10-06)
      'gallery',
      'video-player',
      'bg-video',
      'embed-facade',
      'compare',
      'toggle-group',
      'mailto-form',
    ]);
    expect(isCustomCodeBehavior('marquee')).toBe(true);
    expect(isCustomCodeBehavior('parallax')).toBe(false);
  });

  it('data-ck-behavior: a value in the enum; whatsapp-form only on a form or button', () => {
    // media-motion (2026-10-06): the tag-bound media behaviours are judged in their own block below.
    const tagBound = new Set(['whatsapp-form', 'embed-facade', 'mailto-form']);
    for (const behavior of CUSTOM_CODE_BEHAVIORS.filter((name) => !tagBound.has(name))) {
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

// ── media-motion (2026-10-06): the media behaviours, engine markers and their params ──
describe('media and motion in the custom-code door', () => {
  const tree = (...children: unknown[]) => ({ kind: 'root', children });
  const node = (tag: string, attributes: Record<string, string>, children: unknown[] = []) => ({
    kind: 'element',
    tag,
    attributes,
    ...(children.length > 0 ? { children } : {}),
  });
  const messages = (value: unknown) => customCodeTreeProblems(value).map((problem) => problem.message);

  it('data-ck-timeline: a recipe name on an html element', () => {
    ok('h2', 'data-ck-timeline', 'split-reveal');
    ok('section', 'data-ck-timeline', 'horizontal-scroll');
    bad('h2', 'data-ck-timeline', 'fade-up');
    bad('h2', 'data-ck-timeline', '');
    bad('path', 'data-ck-timeline', 'stagger-in');
  });

  it('data-ck-scene: a scene name, on a div only', () => {
    ok('div', 'data-ck-scene', 'mural');
    ok('div', 'data-ck-scene', 'particles');
    bad('div', 'data-ck-scene', 'fire');
    expect(customCodeAttributeProblem('section', 'data-ck-scene', 'mural')).toMatch(/<div>/u);
  });

  it('data-ck-lottie: bare, on a div; data-ck-src: an https .json of at most 2048 characters', () => {
    ok('div', 'data-ck-lottie', '');
    bad('div', 'data-ck-lottie', 'true');
    bad('span', 'data-ck-lottie', '');
    ok('div', 'data-ck-src', 'https://assets.example.com/hero.json');
    bad('div', 'data-ck-src', 'http://assets.example.com/hero.json');
    bad('div', 'data-ck-src', '/hero.json');
    bad('div', 'data-ck-src', 'https://assets.example.com/hero.gif');
    bad('div', 'data-ck-src', 'https://assets.example.com/a b.json');
    bad('div', 'data-ck-src', `https://example.com/${'a'.repeat(2_040)}.json`);
    bad('span', 'data-ck-src', 'https://assets.example.com/hero.json');
  });

  it('data-ck-email: one mailbox, on a form', () => {
    ok('form', 'data-ck-email', 'hello@example.com');
    ok('form', 'data-ck-email', 'sales.team+web@shop.example.co');
    bad('form', 'data-ck-email', 'hello');
    bad('form', 'data-ck-email', 'a@b.com,c@d.com');
    bad('form', 'data-ck-email', 'a@b.com?bcc=x@y.com');
    bad('form', 'data-ck-email', 'hello @example.com');
    bad('div', 'data-ck-email', 'hello@example.com');
  });

  it('the closed media params: option, indicator, autoplay, scrub, depth, density, palette, hidden', () => {
    ok('span', 'data-ck-option', 'a');
    ok('span', 'data-ck-option', 'b');
    bad('span', 'data-ck-option', 'c');
    for (const value of ['dots', 'counter', 'none']) ok('div', 'data-ck-indicator', value);
    bad('div', 'data-ck-indicator', 'bars');
    ok('div', 'data-ck-autoplay', 'true');
    ok('div', 'data-ck-autoplay', 'false');
    bad('div', 'data-ck-autoplay', '');
    ok('h2', 'data-ck-scrub', 'true');
    bad('h2', 'data-ck-scrub', 'yes');
    for (const value of ['1', '2', '3']) ok('img', 'data-ck-depth', value);
    bad('img', 'data-ck-depth', '4');
    for (const value of ['low', 'medium', 'high']) ok('div', 'data-ck-density', value);
    bad('div', 'data-ck-density', 'max');
    bad('section', 'data-ck-density', 'low');
    for (const value of ['theme', 'accent', 'mono']) ok('div', 'data-ck-palette', value);
    bad('div', 'data-ck-palette', '#ff0000');
    ok('span', 'hidden', '');
    bad('span', 'hidden', 'false');
  });

  it('binds the tag-bound media behaviours to their tags', () => {
    ok('a', 'data-ck-behavior', 'embed-facade');
    expect(customCodeAttributeProblem('div', 'data-ck-behavior', 'embed-facade')).toMatch(/<a>/u);
    ok('form', 'data-ck-behavior', 'mailto-form');
    expect(customCodeAttributeProblem('button', 'data-ck-behavior', 'mailto-form')).toMatch(/<form>/u);
    ok('figure', 'data-ck-behavior', 'video-player');
    bad('section', 'data-ck-behavior', 'video-player');
    ok('section', 'data-ck-behavior', 'bg-video');
    ok('div', 'data-ck-behavior', 'gallery');
  });

  it('refuses data-ck-motion and data-ck-timeline on the same element, and says to choose one', () => {
    const problems = customCodeTreeProblems(
      tree(node('h2', { 'data-ck-motion': 'fade-up', 'data-ck-timeline': 'split-reveal' })),
    );
    expect(problems.map((problem) => problem.path)).toEqual([
      ['children', 0, 'attributes', 'data-ck-timeline'],
    ]);
    expect(problems[0]?.message).toMatch(/choose one/u);
    expect(problems[0]?.message).toMatch(/drop data-ck-motion/u);
  });

  it('lets a timeline reuse ease, delay, stagger and speed, but not the preset-only params', () => {
    expect(
      messages(
        tree(
          node('div', {
            'data-ck-timeline': 'stagger-in',
            'data-ck-ease': 'emphasized',
            'data-ck-delay': '2',
            'data-ck-stagger': 'md',
            'data-ck-speed': 'slow',
            'data-ck-scrub': 'false',
          }),
        ),
      ),
    ).toEqual([]);
    expect(messages(tree(node('div', { 'data-ck-timeline': 'stagger-in', 'data-ck-trigger': 'view' })))).toEqual([
      expect.stringMatching(/write data-ck-motion or data-ck-hover/u),
    ]);
  });

  it('refuses an engine param without its marker', () => {
    expect(messages(tree(node('h2', { 'data-ck-scrub': 'true' })))).toEqual([
      expect.stringMatching(/data-ck-scrub tunes data-ck-timeline/u),
    ]);
    expect(messages(tree(node('div', { 'data-ck-density': 'low', 'data-ck-palette': 'mono' })))).toHaveLength(2);
    expect(messages(tree(node('div', { 'data-ck-src': 'https://a.example/x.json' })))).toEqual([
      expect.stringMatching(/tunes data-ck-lottie/u),
    ]);
    expect(messages(tree(node('div', { 'data-ck-lottie': '' })))).toEqual([
      expect.stringMatching(/write data-ck-src/u),
    ]);
  });

  it('refuses a carousel or mailto param on another behaviour, or alone', () => {
    expect(messages(tree(node('div', { 'data-ck-indicator': 'dots' })))).toEqual([
      expect.stringMatching(/write data-ck-behavior on the same element/u),
    ]);
    expect(
      messages(tree(node('div', { 'data-ck-behavior': 'marquee', 'data-ck-autoplay': 'true' }))),
    ).toEqual([expect.stringMatching(/tunes data-ck-behavior='carousel'/u)]);
    expect(messages(tree(node('form', { 'data-ck-behavior': 'mailto-form' })))).toEqual([
      expect.stringMatching(/write data-ck-email/u),
    ]);
  });

  it('accepts a whole tree of media markup', () => {
    const result = customCodeTreeSchema.safeParse(
      tree(
        node('section', { 'data-ck-behavior': 'bg-video', lang: 'ar', dir: 'rtl' }, [
          node('div', { 'data-ck-scene': 'mural', 'data-ck-density': 'medium', 'data-ck-palette': 'theme', 'aria-hidden': 'true' }, [
            node('img', { src: 'https://images.example.com/a.jpg', alt: '' }),
          ]),
          node('div', { 'data-ck-behavior': 'carousel', 'data-ck-indicator': 'dots', 'data-ck-autoplay': 'true', 'data-ck-speed': 'slow' }, [
            node('div', {}, [node('img', { src: '/a.webp', alt: 'صورة', 'data-ck-depth': '2' })]),
          ]),
          node('div', { 'data-ck-behavior': 'toggle-group' }, [
            { kind: 'element', tag: 'span', text: '10', attributes: { 'data-ck-option': 'a' } },
            { kind: 'element', tag: 'span', text: '100', attributes: { 'data-ck-option': 'b', hidden: '' } },
          ]),
          node('h2', { 'data-ck-timeline': 'split-reveal', 'data-ck-scrub': 'true' }),
          node('div', { 'data-ck-lottie': '', 'data-ck-src': 'https://assets.example.com/hero.json' }),
          node('form', { 'data-ck-behavior': 'mailto-form', 'data-ck-email': 'hello@example.com' }),
        ]),
      ),
    );
    expect(result.success).toBe(true);
  });

  it('names the engine markers and part markers when it refuses an unknown data attribute', () => {
    const message = customCodeAttributeProblem('div', 'data-ck-engine', 'x') ?? '';
    expect(message).toMatch(/only data attributes/u);
    expect(message).toMatch(/data-ck-timeline, data-ck-scene, data-ck-lottie/u);
    expect(message).toMatch(/data-ck-option, data-ck-depth/u);
  });

  it('admits the keyless Google Maps embed, and keeps refusing other Maps addresses', () => {
    ok('iframe', 'src', 'https://www.google.com/maps?q=Amman%20Citadel&output=embed');
    ok('iframe', 'src', 'https://www.google.com/maps?q=%D8%B9%D9%85%D8%A7%D9%86&output=embed');
    ok('iframe', 'src', 'https://www.google.com/maps/embed?pb=!1m18!1m12');
    bad('iframe', 'src', 'https://www.google.com/maps?q=Amman');
    bad('iframe', 'src', 'https://www.google.com/maps/place/Amman');
    bad('iframe', 'src', 'https://www.google.com/maps?q=Amman&output=embed&evil=1');
    bad('iframe', 'src', 'https://www.google.com/maps?q=a&b=c&output=embed');
    bad('iframe', 'src', 'https://www.google.com/maps?q=a b&output=embed');
    bad('iframe', 'src', 'https://www.google.com/maps?q="x"&output=embed');
    bad('iframe', 'src', 'https://maps.google.com/maps?q=Amman&output=embed');
    bad('iframe', 'src', 'http://www.google.com/maps?q=Amman&output=embed');
  });
});
