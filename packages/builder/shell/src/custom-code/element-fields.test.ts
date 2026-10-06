import { describe, expect, it } from 'vitest';

import type { CustomCodeNode } from '@craftkit/builder-schema';

import {
  ADVANCED_ATTRIBUTE_FIELDS,
  customCodeElementSections,
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

  it('a video: src, poster, one autoplay toggle, loop, controls, preload', () => {
    expect(keys({ kind: 'element', tag: 'video' })).toEqual(['src', 'poster', 'autoplay', 'loop', 'controls', 'preload']);
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
