import { describe, expect, it } from 'vitest';

import { customCodeTreeProblems, type CustomCodeNode } from '@craftkit/builder-schema';

import {
  ADVANCED_ATTRIBUTE_FIELDS,
  customCodeElementSections,
  customCodeMediaParamFields,
  joinIconName,
  splitIconName,
} from './element-fields';

const keys = (node: CustomCodeNode) =>
  customCodeElementSections(node).flatMap((section) => section.fields.map((field) => field.key));

const field = (node: CustomCodeNode, key: string) => {
  const found = customCodeElementSections(node)
    .flatMap((section) => section.fields)
    .find((candidate) => candidate.key === key);
  if (found === undefined) throw new Error(`no field ${key}`);
  return found;
};

describe('customCodeElementSections — Content traits per tag (DESIGN §A.4)', () => {
  it('text tags edit their text; a void element never offers text', () => {
    expect(keys({ kind: 'element', tag: 'h1', text: 'Hi' })).toEqual(['text']);
    expect(keys({ kind: 'element', tag: 'p', text: 'Hi' })).toEqual(['text']);
    expect(keys({ kind: 'element', tag: 'hr' })).toEqual([]);
    expect(customCodeElementSections({ kind: 'element', tag: 'hr' })).toEqual([]);
  });

  it('a link: text, href, target, rel', () => {
    expect(keys({ kind: 'element', tag: 'a', text: 'Docs' })).toEqual(['text', 'href', 'target', 'rel']);
  });

  it('an image: src, alt, loading, decoding, width/height, srcset/sizes, fetchpriority', () => {
    expect(keys({ kind: 'element', tag: 'img' })).toEqual([
      'src', 'alt', 'loading', 'decoding', 'width', 'height', 'srcset', 'sizes', 'fetchpriority',
    ]);
  });

  it('a video: src, poster, one autoplay toggle, loop, controls, preload, then its captions', () => {
    expect(keys({ kind: 'element', tag: 'video' })).toEqual([
      'src', 'poster', 'autoplay', 'loop', 'controls', 'preload', 'captions', 'captionsLang',
    ]);
  });

  it('an iframe, a button, details, table cells, time and label', () => {
    expect(keys({ kind: 'element', tag: 'iframe' })).toEqual(['src', 'title']);
    expect(keys({ kind: 'element', tag: 'button', text: 'Go' })).toEqual([
      'text', 'popovertarget', 'popovertargetaction', 'aria-label', 'type',
    ]);
    expect(keys({ kind: 'element', tag: 'details' })).toEqual(['open', 'name']);
    expect(keys({ kind: 'element', tag: 'td', text: '1' })).toEqual(['text', 'scope', 'colspan', 'rowspan']);
    expect(keys({ kind: 'element', tag: 'time', text: '2024' })).toEqual(['text', 'datetime']);
    expect(keys({ kind: 'element', tag: 'label', text: 'Name' })).toEqual(['text', 'for']);
  });

  it('form controls: name, placeholder, required, autocomplete, inputmode, min/max/step, rows', () => {
    expect(keys({ kind: 'element', tag: 'input' })).toEqual([
      'name', 'placeholder', 'required', 'autocomplete', 'inputmode', 'min', 'max', 'step',
    ]);
    expect(keys({ kind: 'element', tag: 'textarea' })).toContain('rows');
  });

  it('an icon: set, name, size, stroke, label; a component gets its block rows elsewhere', () => {
    expect(keys({ kind: 'icon', name: 'mail' })).toEqual(['iconSet', 'name', 'size', 'strokeWidth', 'label']);
    expect(keys({ kind: 'component', component: 'hero' })).toEqual([]);
  });

  it('every field has a label in English and Arabic', () => {
    for (const node of [
      { kind: 'element', tag: 'img' },
      { kind: 'element', tag: 'video' },
      { kind: 'icon', name: 'mail' },
    ] as CustomCodeNode[]) {
      for (const section of customCodeElementSections(node)) {
        for (const entry of section.fields) {
          expect(entry.label.en).not.toBe('');
          expect(entry.label.ar).not.toBe('');
        }
      }
    }
  });
});

describe('trait writes', () => {
  it('reads current values and patches attributes; clearing removes the attribute (null)', () => {
    const img: CustomCodeNode = { kind: 'element', tag: 'img', attributes: { src: '/a.jpg', alt: 'A' } };
    expect(field(img, 'src').read(img)).toBe('/a.jpg');
    expect(field(img, 'alt').patch?.('Portrait')).toEqual({ attributes: { alt: 'Portrait' } });
    expect(field(img, 'alt').patch?.('  ')).toEqual({ attributes: { alt: null } });
  });

  it('text stays a string when emptied', () => {
    const h1: CustomCodeNode = { kind: 'element', tag: 'h1', text: 'Hi' };
    expect(field(h1, 'text').patch?.('')).toEqual({ set: { text: '' } });
  });

  it('flags are written bare and removed when off; the video autoplay toggle carries muted + playsinline', () => {
    const video: CustomCodeNode = { kind: 'element', tag: 'video', attributes: { loop: '' } };
    expect(field(video, 'loop').read(video)).toBe(true);
    expect(field(video, 'loop').patch?.(false)).toEqual({ attributes: { loop: null } });
    expect(field(video, 'autoplay').patch?.(true)).toEqual({
      attributes: { autoplay: '', muted: '', playsinline: '' },
    });
  });

  it('numeric attributes read and write as numbers stored as strings', () => {
    const td: CustomCodeNode = { kind: 'element', tag: 'td', attributes: { colspan: '2' } };
    expect(field(td, 'colspan').read(td)).toBe(2);
    expect(field(td, 'colspan').patch?.(3)).toEqual({ attributes: { colspan: '3' } });
  });

  it('icon traits write a whole new node; the set keeps the glyph', () => {
    const icon: CustomCodeNode = { kind: 'icon', name: 'heart', size: 32 };
    expect(field(icon, 'iconSet').read(icon)).toBe('lucide');
    expect(field(icon, 'iconSet').write?.(icon, 'tabler-filled')).toEqual({ ...icon, name: 'tabler-filled:heart' });
    expect(field(icon, 'size').write?.(icon, 48)).toEqual({ ...icon, size: 48 });
    expect('strokeWidth' in (field(icon, 'strokeWidth').write?.(icon, undefined) ?? {})).toBe(false);
    expect(splitIconName('tabler:brand-whatsapp')).toEqual({ set: 'tabler', glyph: 'brand-whatsapp' });
    expect(joinIconName('lucide', 'mail')).toBe('mail');
  });

  it('schemas agree with the door', () => {
    const img: CustomCodeNode = { kind: 'element', tag: 'img' };
    expect(field(img, 'src').schema.safeParse('x'.repeat(2_001)).success).toBe(false);
    const icon: CustomCodeNode = { kind: 'icon', name: 'mail' };
    expect(field(icon, 'size').schema.safeParse(4).success).toBe(false);
    expect(field(icon, 'name').schema.safeParse('Not Kebab').success).toBe(false);
  });

  it('the Advanced group edits id, role, aria, lang and tabindex', () => {
    expect(ADVANCED_ATTRIBUTE_FIELDS.map((entry) => entry.key)).toEqual([
      'id', 'role', 'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden', 'aria-live', 'lang', 'tabindex', 'title',
    ]);
  });
});

// media-motion (2026-10-06) additions: captions, a Lottie file, typed behaviour params.
describe('media rows (media-motion DESIGN §A.1, §B.3, §E)', () => {
  const door = (node: CustomCodeNode) => customCodeTreeProblems({ kind: 'root', children: [node] });
  const paramKeys = (node: CustomCodeNode) => customCodeMediaParamFields(node).map((entry) => entry.key);
  const param = (node: CustomCodeNode, key: string) => {
    const found = customCodeMediaParamFields(node).find((entry) => entry.key === key);
    if (found === undefined) throw new Error(`no param ${key}`);
    return found;
  };

  it('a captions file adds ONE track after the sources; its language joins it; clearing removes the track', () => {
    const video: CustomCodeNode = {
      kind: 'element',
      tag: 'video',
      attributes: { controls: '' },
      children: [{ kind: 'element', tag: 'source', attributes: { src: 'https://cdn.example.com/a.mp4', type: 'video/mp4' } }],
    };
    const captions = field(video, 'captions');
    expect(captions.read(video)).toBeUndefined();
    const withTrack = captions.write?.(video, ' https://cdn.example.com/ar.vtt ');
    if (withTrack?.kind !== 'element') throw new Error('no write');
    expect(withTrack.children?.[1]).toEqual({
      kind: 'element',
      tag: 'track',
      attributes: { kind: 'captions', src: 'https://cdn.example.com/ar.vtt' },
    });
    expect(captions.read(withTrack)).toBe('https://cdn.example.com/ar.vtt');
    const lang = field(withTrack, 'captionsLang');
    const withLang = lang.write?.(withTrack, 'ar');
    if (withLang === undefined) throw new Error('no write');
    expect(lang.read(withLang)).toBe('ar');
    expect(door(withLang)).toEqual([]);
    // Replacing the file keeps the language; clearing removes the whole track.
    const replaced = captions.write?.(withLang, 'https://cdn.example.com/ar-2.vtt');
    if (replaced?.kind !== 'element') throw new Error('no write');
    expect(replaced.children).toHaveLength(2);
    expect(lang.read(replaced)).toBe('ar');
    const cleared = captions.write?.(replaced, '');
    if (cleared?.kind !== 'element') throw new Error('no write');
    expect(cleared.children).toHaveLength(1);
    // A language with no file waits for the file.
    expect(lang.write?.(video, 'en')).toEqual(video);
  });

  it('the captions schemas take only an https or uploaded .vtt and a language tag', () => {
    const video: CustomCodeNode = { kind: 'element', tag: 'video' };
    expect(field(video, 'captions').schema.safeParse('https://cdn.example.com/a.vtt').success).toBe(true);
    expect(field(video, 'captions').schema.safeParse('/uploads/a.vtt').success).toBe(true);
    expect(field(video, 'captions').schema.safeParse('http://cdn.example.com/a.vtt').success).toBe(false);
    expect(field(video, 'captions').schema.safeParse('https://cdn.example.com/a.srt').success).toBe(false);
    expect(field(video, 'captionsLang').schema.safeParse('ar-EG').success).toBe(true);
    expect(field(video, 'captionsLang').schema.safeParse('عربي').success).toBe(false);
  });

  it('a Lottie layer edits its animation file in Content', () => {
    const lottie: CustomCodeNode = {
      kind: 'element',
      tag: 'div',
      attributes: { 'data-ck-lottie': '', 'data-ck-src': 'https://assets.example.com/a.json' },
    };
    expect(keys(lottie)).toContain('data-ck-src');
    const src = field(lottie, 'data-ck-src');
    expect(src.read(lottie)).toBe('https://assets.example.com/a.json');
    expect(src.patch?.('https://assets.example.com/b.json')).toEqual({
      attributes: { 'data-ck-src': 'https://assets.example.com/b.json' },
    });
    expect(src.schema.safeParse('https://assets.example.com/b.gif').success).toBe(false);
  });

  it('a carousel types its indicator, autoplay and speed; a mailto form its address; an option its side', () => {
    const carousel: CustomCodeNode = { kind: 'element', tag: 'div', attributes: { 'data-ck-behavior': 'carousel' } };
    expect(paramKeys(carousel)).toEqual(['data-ck-indicator', 'data-ck-autoplay', 'data-ck-speed']);
    expect(param(carousel, 'data-ck-indicator').choices).toEqual(['dots', 'counter', 'none']);
    expect(param(carousel, 'data-ck-autoplay').choices).toEqual(['true', 'false']);
    expect(param(carousel, 'data-ck-indicator').patch?.('dots')).toEqual({ attributes: { 'data-ck-indicator': 'dots' } });
    expect(param(carousel, 'data-ck-indicator').patch?.(undefined)).toEqual({ attributes: { 'data-ck-indicator': null } });
    expect(param(carousel, 'data-ck-indicator').schema.safeParse('stars').success).toBe(false);

    const form: CustomCodeNode = {
      kind: 'element',
      tag: 'form',
      attributes: { 'data-ck-behavior': 'mailto-form', 'data-ck-email': 'hello@example.com' },
    };
    expect(paramKeys(form)).toEqual(['data-ck-email']);
    expect(param(form, 'data-ck-email').input).toBe('email');
    expect(param(form, 'data-ck-email').read(form)).toBe('hello@example.com');
    expect(param(form, 'data-ck-email').schema.safeParse('not an email').success).toBe(false);

    const option: CustomCodeNode = { kind: 'element', tag: 'span', text: '$9', attributes: { 'data-ck-option': 'a' } };
    expect(paramKeys(option)).toEqual(['data-ck-option']);
    // Side b starts hidden without script, so the side and `hidden` move together.
    expect(param(option, 'data-ck-option').patch?.('b')).toEqual({ attributes: { 'data-ck-option': 'b', hidden: '' } });
    expect(param(option, 'data-ck-option').patch?.('a')).toEqual({ attributes: { 'data-ck-option': 'a', hidden: null } });
  });

  it('galleries, compares and toggle-group containers carry no params; plain elements none either', () => {
    for (const behavior of ['gallery', 'compare', 'toggle-group']) {
      expect(paramKeys({ kind: 'element', tag: 'div', attributes: { 'data-ck-behavior': behavior } })).toEqual([]);
    }
    expect(paramKeys({ kind: 'element', tag: 'p', text: 'Hi' })).toEqual([]);
    expect(paramKeys({ kind: 'icon', name: 'mail' })).toEqual([]);
  });

  it('every media row is labelled in English and Arabic', () => {
    const nodes: CustomCodeNode[] = [
      { kind: 'element', tag: 'div', attributes: { 'data-ck-behavior': 'carousel', 'data-ck-option': 'a' } },
      { kind: 'element', tag: 'form', attributes: { 'data-ck-behavior': 'mailto-form' } },
    ];
    for (const node of nodes) {
      for (const entry of customCodeMediaParamFields(node)) {
        expect(entry.label.en).not.toBe('');
        expect(entry.label.ar).toMatch(/[؀-ۿ]/u);
      }
    }
  });
});
