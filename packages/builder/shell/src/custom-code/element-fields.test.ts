import { describe, expect, it } from 'vitest';

import type { CustomCodeNode } from '@craftkit/builder-schema';

import { customCodeElementSections } from './element-fields';

const keys = (node: CustomCodeNode) =>
  customCodeElementSections(node).map((section) => [
    section.name,
    section.fields.map((field) => field.key),
  ]);

const field = (node: CustomCodeNode, key: string) => {
  const found = customCodeElementSections(node)
    .flatMap((section) => section.fields)
    .find((candidate) => candidate.key === key);
  if (found === undefined) throw new Error(`no field ${key}`);
  return found;
};

describe('customCodeElementSections', () => {
  it('an image edits its source and alternative text, its classes, and the advanced attributes', () => {
    expect(keys({ kind: 'element', tag: 'img', attributes: { src: '/a.jpg', alt: 'A' } })).toEqual([
      ['Image', ['src', 'alt']],
      ['Design', ['className']],
      ['Advanced', ['id', 'title', 'role', 'aria-label', 'aria-hidden']],
    ]);
  });

  it('a text-bearing element edits its text first; a void element never offers text', () => {
    expect(keys({ kind: 'element', tag: 'h1', text: 'Hi' })[0]).toEqual(['Content', ['text']]);
    expect(keys({ kind: 'element', tag: 'button', text: 'Go' })[0]).toEqual(['Content', ['text']]);
    expect(keys({ kind: 'element', tag: 'hr' })[0]).toEqual(['Design', ['className']]);
    expect(keys({ kind: 'element', tag: 'br' })[0]).toEqual(['Design', ['className']]);
  });

  it('a link edits its text and destination', () => {
    expect(keys({ kind: 'element', tag: 'a', text: 'Docs' })[0]).toEqual([
      'Content',
      ['text', 'href', 'target'],
    ]);
  });

  it('a time element edits its machine-readable datetime', () => {
    expect(keys({ kind: 'element', tag: 'time', text: '2024' })[0]).toEqual([
      'Content',
      ['text', 'datetime'],
    ]);
  });

  it('an icon edits its glyph, label, size and stroke; a component reference offers nothing yet', () => {
    expect(keys({ kind: 'icon', name: 'mail' })).toEqual([
      ['Icon', ['name', 'label']],
      ['Design', ['size', 'strokeWidth', 'className']],
    ]);
    expect(keys({ kind: 'component', component: 'hero' })).toEqual([]);
  });

  it('reads the current value of each field from the node', () => {
    const img: CustomCodeNode = {
      kind: 'element',
      tag: 'img',
      className: 'rounded',
      attributes: { src: '/a.jpg', alt: 'A' },
    };
    expect(field(img, 'src').read(img)).toBe('/a.jpg');
    expect(field(img, 'alt').read(img)).toBe('A');
    expect(field(img, 'className').read(img)).toBe('rounded');
    expect(field(img, 'title').read(img)).toBeUndefined();
    const icon: CustomCodeNode = { kind: 'icon', name: 'mail', size: 32 };
    expect(field(icon, 'size').read(icon)).toBe(32);
    expect(field(icon, 'strokeWidth').read(icon)).toBeUndefined();
  });

  it('writes return a NEW node and never mutate the input', () => {
    const img: CustomCodeNode = { kind: 'element', tag: 'img', attributes: { src: '/a.jpg' } };
    const next = field(img, 'alt').write(img, 'Portrait');
    expect(next).toEqual({
      kind: 'element',
      tag: 'img',
      attributes: { src: '/a.jpg', alt: 'Portrait' },
    });
    expect(img).toEqual({ kind: 'element', tag: 'img', attributes: { src: '/a.jpg' } });
    expect(next).not.toBe(img);
  });

  it('clearing a value DELETES the key rather than storing an empty string or undefined (Law J)', () => {
    const img: CustomCodeNode = {
      kind: 'element',
      tag: 'img',
      className: 'rounded',
      attributes: { src: '/a.jpg', alt: 'A', title: 'T' },
    };
    const noAlt = field(img, 'alt').write(img, '');
    expect(noAlt).toEqual({
      kind: 'element',
      tag: 'img',
      className: 'rounded',
      attributes: { src: '/a.jpg', title: 'T' },
    });
    expect('alt' in ((noAlt as { attributes?: object }).attributes ?? {})).toBe(false);
    const noClass = field(img, 'className').write(img, '   ');
    expect('className' in noClass).toBe(false);
    // Dropping the last attribute drops the attributes object itself.
    const bare: CustomCodeNode = { kind: 'element', tag: 'img', attributes: { alt: 'A' } };
    expect(field(bare, 'alt').write(bare, '')).toEqual({ kind: 'element', tag: 'img' });
  });

  it('text stays a string even when emptied — an emptied heading is still a heading', () => {
    const h1: CustomCodeNode = { kind: 'element', tag: 'h1', text: 'Hi' };
    expect(field(h1, 'text').write(h1, '')).toEqual({ kind: 'element', tag: 'h1', text: '' });
  });

  it('icon numbers are written as numbers and cleared by deletion', () => {
    const icon: CustomCodeNode = { kind: 'icon', name: 'mail', size: 32, strokeWidth: 1.5 };
    expect(field(icon, 'size').write(icon, 48)).toEqual({ ...icon, size: 48 });
    const cleared = field(icon, 'strokeWidth').write(icon, undefined);
    expect('strokeWidth' in cleared).toBe(false);
    expect(field(icon, 'name').write(icon, 'globe')).toEqual({ ...icon, name: 'globe' });
  });

  it('every field carries a schema the door will agree with', () => {
    const img: CustomCodeNode = { kind: 'element', tag: 'img' };
    expect(field(img, 'src').schema.safeParse('x'.repeat(2_001)).success).toBe(false);
    expect(field(img, 'className').schema.safeParse('x'.repeat(1_001)).success).toBe(false);
    const icon: CustomCodeNode = { kind: 'icon', name: 'mail' };
    expect(field(icon, 'size').schema.safeParse(4).success).toBe(false);
    expect(field(icon, 'size').schema.safeParse(24).success).toBe(true);
    expect(field(icon, 'name').schema.safeParse('Not Kebab').success).toBe(false);
  });
});
