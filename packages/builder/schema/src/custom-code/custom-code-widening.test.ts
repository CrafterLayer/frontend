import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  CUSTOM_CODE_ATTRIBUTES,
  CUSTOM_CODE_ICON_NAME,
  CUSTOM_CODE_REGION_CSS_MAX,
  CUSTOM_CODE_TAGS,
  customCodeAttributeProblem,
  customCodeAttributeSpelling,
  customCodeTreeProblems,
  customCodeTreeSchema,
  customCss,
  isAllowedIframeSrc,
  isCustomCodeIconName,
  parseCustomCodeIconName,
  setCustomCodeComponentSchemaResolver,
  type CustomCodeNode,
} from './custom-code-tree';
import {
  isTablerIconName,
  tablerFilledIconNames,
  tablerOutlineIconNames,
} from './tabler-icon-names';

/*
  style-manager DESIGN §D.1 (2026-10-05): the door widened for forms, dialogs,
  allowlisted embeds, audio, the svg text/filter family, accessibility, link
  relationships and editor metadata — each admission paired with its guard.
*/

const ok = (tag: string, name: string, value: string) => {
  expect(customCodeAttributeProblem(tag, name, value), `${tag} ${name}=${value}`).toBeUndefined();
};
const bad = (tag: string, name: string, value: string) => {
  expect(customCodeAttributeProblem(tag, name, value), `${tag} ${name}=${value}`).toEqual(
    expect.any(String),
  );
};

const root = (...children: CustomCodeNode[]) => ({ kind: 'root' as const, children });
const el = (
  tag: string,
  attributes: Record<string, string> = {},
  children: unknown[] = [],
  extra: Record<string, unknown> = {},
) => ({ kind: 'element', tag, attributes, children, ...extra }) as unknown as CustomCodeNode;

function messages(tree: unknown): string[] {
  return customCodeTreeProblems(tree).map((problem) => problem.message);
}

describe('the widened tag vocabulary', () => {
  it('admits forms, dialog, iframe, audio + track and the svg text/filter family', () => {
    for (const tag of [
      'form',
      'input',
      'textarea',
      'select',
      'option',
      'label',
      'fieldset',
      'legend',
      'dialog',
      'iframe',
      'audio',
      'source',
      'track',
      'text',
      'tspan',
      'textPath',
      'clipPath',
      'mask',
      'pattern',
      'filter',
      'feGaussianBlur',
      'feOffset',
      'feBlend',
      'feColorMatrix',
      'feTurbulence',
      'feDisplacementMap',
      'feMerge',
      'feMergeNode',
      'feFlood',
      'feComposite',
    ]) {
      expect(CUSTOM_CODE_TAGS).toContain(tag);
    }
  });

  it('still refuses script, style, object, embed, canvas, use, image and foreignObject', () => {
    for (const tag of [
      'script',
      'style',
      'object',
      'embed',
      'canvas',
      'use',
      'image',
      'foreignObject',
      'animate',
    ]) {
      expect(CUSTOM_CODE_TAGS as readonly string[]).not.toContain(tag);
      expect(customCodeTreeSchema.safeParse(root(el(tag))).success).toBe(false);
    }
  });

  it('keeps refusing style, on* handlers and arbitrary data-*', () => {
    bad('div', 'style', 'color:red');
    expect(customCodeAttributeProblem('div', 'style', 'x')).toMatch(/className/u);
    bad('button', 'onclick', 'alert(1)');
    bad('div', 'data-anything', 'x');
    expect(CUSTOM_CODE_ATTRIBUTES as readonly string[]).not.toContain('style');
  });
});

describe('forms', () => {
  it('admits the form attributes on the controls they belong to', () => {
    ok('input', 'name', 'email');
    ok('input', 'type', 'email');
    ok('input', 'placeholder', 'you@example.com');
    ok('input', 'required', '');
    ok('input', 'autocomplete', 'email');
    ok('input', 'inputmode', 'numeric');
    ok('input', 'min', '0');
    ok('input', 'max', '2026-12-31');
    ok('input', 'step', 'any');
    ok('input', 'step', '0.5');
    ok('input', 'minlength', '2');
    ok('input', 'maxlength', '120');
    ok('input', 'value', 'Amman');
    ok('input', 'checked', '');
    ok('input', 'disabled', '');
    ok('textarea', 'rows', '4');
    ok('textarea', 'placeholder', 'رسالتك');
    ok('select', 'multiple', '');
    ok('option', 'value', 'small');
    ok('label', 'for', 'contact-email');
    ok('fieldset', 'disabled', '');
    ok('button', 'type', 'submit');
  });

  it('refuses what a form must never carry, and values outside the closed lists', () => {
    bad('form', 'action', 'https://evil.example/collect');
    expect(customCodeAttributeProblem('form', 'action', '/x')).toMatch(/whatsapp-form/u);
    bad('form', 'method', 'post');
    bad('form', 'target', '_blank');
    bad('button', 'formaction', '/x');
    bad('input', 'formaction', '/x');
    bad('input', 'type', 'password');
    bad('input', 'type', 'file');
    bad('input', 'type', 'submit');
    bad('input', 'autocomplete', 'current-password');
    bad('input', 'inputmode', 'everything');
    bad('input', 'step', '-1');
    bad('textarea', 'rows', '0');
    bad('input', 'placeholder', '<b>x</b>');
    bad('input', 'checked', 'yes');
    bad('div', 'placeholder', 'x');
    bad('button', 'type', 'reset');
  });

  it('a WhatsApp form is a form now: the behaviour binding validates', () => {
    const tree = root(
      el('form', { 'data-ck-behavior': 'whatsapp-form', 'data-ck-phone': '+962790000000' }, [
        el('label', { for: 'name' }, [], { text: 'الاسم' }),
        el('input', { id: 'name', name: 'name', type: 'text', required: '' }),
        el('select', { name: 'size' }, [el('option', { value: 's' }, [], { text: 'S' })]),
        el('textarea', { name: 'message', rows: '3' }),
        el('button', { type: 'submit' }, [], { text: 'أرسل' }),
      ]),
    );
    expect(customCodeTreeSchema.safeParse(tree).success).toBe(true);
    expect(messages(tree)).toEqual([]);
  });

  it('refuses a form inside a form, an option outside a select and a legend outside a fieldset', () => {
    expect(messages(root(el('form', {}, [el('div', {}, [el('form')])])))).toEqual([
      'A <form> never sits inside another <form>',
    ]);
    expect(messages(root(el('option', { value: 'x' })))).toEqual([
      '<option> belongs inside a <select>',
    ]);
    expect(messages(root(el('legend')))).toEqual(['<legend> belongs inside a <fieldset>']);
    expect(messages(root(el('fieldset', {}, [el('legend')])))).toEqual([]);
  });
});

describe('iframes', () => {
  const embeds = [
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30&rel=0',
    'https://player.vimeo.com/video/76979871',
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3384.6!2d35.9!3d31.95!2m3!1f0!2f0!3f0',
    'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC',
    'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator',
  ];
  const hostile = [
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'http://www.youtube-nocookie.com/embed/x',
    'https://www.youtube-nocookie.com.evil.example/embed/x',
    'https://evil.example/?https://player.vimeo.com/video/1',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'https://player.vimeo.com/video/1"><script>',
    'https://www.google.com/maps/embed?pb=x onload=alert(1)',
    'https://open.spotify.com/embed/track/x/../../evil',
    '/relative/frame.html',
  ];

  it('admits exactly the four allowlisted embed hosts', () => {
    for (const src of embeds) {
      expect(isAllowedIframeSrc(src), src).toBe(true);
      ok('iframe', 'src', src);
    }
  });

  it('refuses a hostile or unlisted src', () => {
    for (const src of hostile) {
      expect(isAllowedIframeSrc(src), src).toBe(false);
      bad('iframe', 'src', src);
    }
  });

  it('requires a title and a src; sandbox and allow are never authored', () => {
    expect(messages(root(el('iframe', { src: embeds[0] ?? '' })))).toEqual([
      "<iframe> needs a title naming what it shows, such as title='Map to our office'",
    ]);
    expect(messages(root(el('iframe', { title: 'Video' })))[0]).toMatch(/needs a src/u);
    expect(
      messages(root(el('iframe', { src: embeds[2] ?? '', title: 'Our story', loading: 'lazy' }))),
    ).toEqual([]);
    bad('iframe', 'sandbox', 'allow-top-navigation');
    bad('iframe', 'allow', 'camera');
    bad('iframe', 'srcdoc', '<p>x</p>');
  });
});

describe('audio, tracks and media', () => {
  it('audio takes https or relative sources and never autoplays', () => {
    ok('audio', 'src', 'https://cdn.example/a.mp3');
    ok('audio', 'controls', '');
    ok('audio', 'loop', '');
    ok('audio', 'preload', 'none');
    bad('audio', 'src', 'http://cdn.example/a.mp3');
    bad('audio', 'src', 'javascript:alert(1)');
    bad('audio', 'autoplay', '');
    ok('track', 'src', '/captions.vtt');
    ok('track', 'kind', 'captions');
    ok('track', 'srclang', 'ar');
    bad('track', 'kind', 'karaoke');
  });

  it('a source sits in picture, video or audio; a track in video or audio', () => {
    expect(
      messages(
        root(el('audio', { controls: '' }, [el('source', { src: '/a.mp3', type: 'audio/mpeg' })])),
      ),
    ).toEqual([]);
    expect(messages(root(el('div', {}, [el('track', { src: '/c.vtt' })])))).toEqual([
      '<track> belongs inside a <video> or an <audio>',
    ]);
  });
});

describe('the svg text and filter family', () => {
  it('drawn text holds text; other shapes still do not', () => {
    const tree = root(
      el('svg', { viewBox: '0 0 200 40' }, [
        el('defs', {}, [
          el('path', { id: 'curve', d: 'M0 30 Q100 0 200 30' }),
          el('filter', { id: 'grain' }, [
            el('feTurbulence', {
              type: 'fractalNoise',
              baseFrequency: '0.8',
              numOctaves: '2',
              result: 'n',
            }),
            el('feColorMatrix', { type: 'saturate', values: '0', in: 'n' }),
            el('feBlend', { mode: 'multiply', in: 'SourceGraphic', in2: 'n' }),
            el('feGaussianBlur', { stdDeviation: '2 3' }),
          ]),
          el('clipPath', { id: 'clip', clipPathUnits: 'objectBoundingBox' }, [
            el('rect', { width: '1', height: '1' }),
          ]),
        ]),
        el(
          'text',
          { x: '10', y: '30', 'text-anchor': 'start', 'font-size': '18', filter: 'url(#grain)' },
          [el('tspan', { 'font-weight': '700' }, [], { text: 'مرحبا' })],
          { text: 'Hello ' },
        ),
        el('text', {}, [
          el('textPath', { href: '#curve', startOffset: '10%' }, [], { text: 'along a curve' }),
        ]),
        el('rect', { 'clip-path': 'url(#clip)', width: '10', height: '10' }),
      ]),
    );
    expect(messages(tree)).toEqual([]);
    expect(customCodeTreeSchema.safeParse(tree).success).toBe(true);
    expect(messages(root(el('svg', {}, [el('rect', {}, [], { text: 'nope' })])))[0]).toMatch(
      /holds no text/u,
    );
  });

  it('refuses references that leave the drawing', () => {
    bad('textPath', 'href', 'https://evil.example/font.svg#p');
    bad('textPath', 'href', 'javascript:alert(1)');
    bad('rect', 'filter', 'url(https://evil.example/f.svg#x)');
    bad('rect', 'mask', 'url(//evil.example/m)');
    bad('feTurbulence', 'type', 'evil');
    bad('feBlend', 'mode', 'plus-darker');
    bad('feColorMatrix', 'values', 'url(#x)');
    bad('text', 'font-family', 'x" onload="y');
    bad('div', 'filter', 'url(#x)');
  });
});

describe('accessibility and link attributes', () => {
  it('admits the aria additions and tabindex 0 or -1', () => {
    ok('div', 'tabindex', '0');
    ok('div', 'tabindex', '-1');
    bad('div', 'tabindex', '3');
    ok('button', 'aria-expanded', 'true');
    ok('button', 'aria-controls', 'menu-1 menu-2');
    ok('button', 'aria-haspopup', 'dialog');
    ok('button', 'aria-pressed', 'mixed');
    ok('li', 'aria-selected', 'false');
    ok('div', 'aria-live', 'polite');
    ok('dialog', 'aria-modal', 'true');
    ok('dialog', 'open', '');
    bad('div', 'aria-live', 'loud');
  });

  it('rel takes only the closed tokens, on a link', () => {
    ok('a', 'rel', 'nofollow');
    ok('a', 'rel', 'noopener noreferrer sponsored');
    bad('a', 'rel', 'stylesheet');
    bad('a', 'rel', 'nofollow import');
    bad('div', 'rel', 'nofollow');
  });

  it('folds React spellings of the new attributes', () => {
    expect(customCodeAttributeSpelling('htmlFor')).toBe('for');
    expect(customCodeAttributeSpelling('tabIndex')).toBe('tabindex');
    expect(customCodeAttributeSpelling('maxLength')).toBe('maxlength');
    expect(customCodeAttributeSpelling('textAnchor')).toBe('text-anchor');
    expect(customCodeAttributeSpelling('dataCkMotion')).toBe('data-ck-motion');
  });
});

describe('editor metadata', () => {
  it('an element carries a label of at most 60 characters and locked: true only', () => {
    expect(
      customCodeTreeSchema.safeParse(
        root(el('h1', {}, [], { label: 'Hero heading', locked: true })),
      ).success,
    ).toBe(true);
    expect(
      customCodeTreeSchema.safeParse(root(el('h1', {}, [], { label: 'x'.repeat(61) }))).success,
    ).toBe(false);
    expect(customCodeTreeSchema.safeParse(root(el('h1', {}, [], { locked: false }))).success).toBe(
      false,
    );
    expect(
      customCodeTreeSchema.safeParse(
        root({ kind: 'component', component: 'card', label: 'Pricing card', locked: true }),
      ).success,
    ).toBe(true);
    expect(
      customCodeTreeSchema.safeParse(root({ kind: 'icon', name: 'mail', locked: true })).success,
    ).toBe(true);
  });
});

describe('Tabler icon names', () => {
  it('the name shape admits the two Tabler prefixes beside Lucide', () => {
    expect(CUSTOM_CODE_ICON_NAME.test('mail')).toBe(true);
    expect(CUSTOM_CODE_ICON_NAME.test('tabler:brand-whatsapp')).toBe(true);
    expect(CUSTOM_CODE_ICON_NAME.test('tabler-filled:heart')).toBe(true);
    expect(CUSTOM_CODE_ICON_NAME.test('tabler:Brand')).toBe(false);
    expect(CUSTOM_CODE_ICON_NAME.test('phosphor:heart')).toBe(false);
    expect(CUSTOM_CODE_ICON_NAME.test('tabler:')).toBe(false);
  });

  it('parses the set and checks existence against the generated lists', () => {
    expect(parseCustomCodeIconName('tabler-filled:heart')).toEqual({
      set: 'tabler-filled',
      name: 'heart',
    });
    expect(parseCustomCodeIconName('tabler:mail')).toEqual({ set: 'tabler', name: 'mail' });
    expect(parseCustomCodeIconName('mail')).toEqual({ set: 'lucide', name: 'mail' });
    expect(isCustomCodeIconName('mail')).toBe(true);
    expect(isCustomCodeIconName('tabler:brand-whatsapp')).toBe(true);
    expect(isCustomCodeIconName('tabler-filled:heart')).toBe(true);
    expect(isCustomCodeIconName('tabler:not-an-icon-at-all')).toBe(false);
    expect(isCustomCodeIconName('brand-whatsapp')).toBe(false);
    expect(tablerOutlineIconNames().size).toBeGreaterThan(5_000);
    expect(tablerFilledIconNames().size).toBeGreaterThan(1_000);
    expect(isTablerIconName('heart', 'filled')).toBe(true);
    // The generated list is sorted and kebab-case throughout.
    const names = [...tablerOutlineIconNames()];
    expect(names).toEqual([...names].sort());
    expect(names.every((name) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name))).toBe(true);
  });

  it('the tree schema stores a Tabler icon', () => {
    expect(
      customCodeTreeSchema.safeParse(root({ kind: 'icon', name: 'tabler-filled:star' })).success,
    ).toBe(true);
  });
});

describe('component props, validated against the referenced block', () => {
  afterEach(() => {
    setCustomCodeComponentSchemaResolver(undefined);
  });

  const card = root({
    kind: 'component',
    component: 'card',
    props: { title: 42 },
  });

  it('without a resolver, any JSON stands (today’s rule)', () => {
    expect(customCodeTreeSchema.safeParse(card).success).toBe(true);
  });

  it('with a resolver, a bad prop is refused with the block’s own issue text', () => {
    setCustomCodeComponentSchemaResolver((type) =>
      type === 'card' ? z.object({ title: z.string().default('') }) : undefined,
    );
    const result = customCodeTreeSchema.safeParse(card);
    expect(result.success).toBe(false);
    const issue = result.error?.issues[0];
    expect(issue?.path).toEqual(['children', 0, 'props', 'title']);
    expect(issue?.message).toMatch(/^component 'card' prop title: /u);
    expect(
      customCodeTreeSchema.safeParse(
        root({ kind: 'component', component: 'card', props: { title: 'Pro' } }),
      ).success,
    ).toBe(true);
    // An unknown type is not this check's to refuse.
    expect(
      customCodeTreeSchema.safeParse(
        root({ kind: 'component', component: 'nope', props: { x: 1 } }),
      ).success,
    ).toBe(true);
  });
});

describe('the region css cap', () => {
  it('is 24 000 characters for a region stylesheet', () => {
    expect(CUSTOM_CODE_REGION_CSS_MAX).toBe(24_000);
    const css = customCss();
    expect(css.safeParse('a'.repeat(24_000)).success).toBe(true);
    expect(css.safeParse('a'.repeat(24_001)).success).toBe(false);
    // An explicit ceiling (the page root's pageCss) is still honoured.
    expect(customCss(20_000).safeParse('a'.repeat(20_001)).success).toBe(false);
  });
});
