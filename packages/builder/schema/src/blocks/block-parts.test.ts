import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { BuilderError } from '../errors';
import { richText } from '../rich-text/rich-text';
import {
  bindPathOf,
  blockPartsOf,
  formatPropPath,
  hasPartInstance,
  PART_NAME_PATTERN,
  parsePropPath,
  partInstances,
  partStyleKey,
  propSchemaAt,
  validateBlockParts,
  type BlockParts,
} from './block-parts';
import { defineBlockSchema } from './define-block-schema';

const label = (en: string, ar: string) => ({ en, ar });

const props = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().default('Title'),
  content: richText().optional(),
  tone: z.enum(['light', 'dark']).default('light'),
  count: z.number().optional(),
  items: z
    .array(z.object({ title: z.string(), body: z.string().optional(), tags: z.array(z.string()) }))
    .default([]),
  link: z.object({ label: z.string(), href: z.string() }).optional(),
  imageSrc: z.string().optional(),
  imageAlt: z.string().optional(),
});

const parts: BlockParts = {
  eyebrow: { kind: 'text', bind: 'eyebrow', label: label('Eyebrow', 'العنوان الصغير') },
  heading: { kind: 'text', bind: 'heading', label: label('Heading', 'العنوان'), aliases: ['title'] },
  content: { kind: 'rich', bind: 'content', label: label('Content', 'المحتوى') },
  items: { kind: 'list', bind: 'items', label: label('Items', 'العناصر') },
  item: { kind: 'item', bind: 'items.*', list: 'items', label: label('Item', 'العنصر') },
  'item.title': { kind: 'text', bind: 'items.*.title', label: label('Item title', 'عنوان العنصر') },
  'item.tag': { kind: 'text', bind: 'items.*.tags.*', label: label('Tag', 'وسم') },
  link: {
    kind: 'link',
    bind: { text: 'link.label', href: 'link.href' },
    label: label('Link', 'الرابط'),
  },
  image: { kind: 'image', bind: { src: 'imageSrc', alt: 'imageAlt' }, label: label('Image', 'الصورة') },
  frame: { kind: 'box', label: label('Frame', 'الإطار') },
};

function refusal(run: () => void): BuilderError {
  try {
    run();
  } catch (error) {
    if (error instanceof BuilderError) return error;
    throw error;
  }
  throw new Error('expected a refusal');
}

describe('paths', () => {
  it('formats and parses prop paths, numeric segments becoming indices', () => {
    expect(formatPropPath(['items', 2, 'title'])).toBe('items.2.title');
    expect(parsePropPath('items.2.title')).toEqual(['items', 2, 'title']);
    expect(parsePropPath('heading')).toEqual(['heading']);
    expect(parsePropPath('')).toEqual([]);
  });

  it('bindPathOf fills each * from the index and refuses a wrong index length', () => {
    expect(bindPathOf(parts['item.title']!, [2])).toEqual(['items', 2, 'title']);
    expect(bindPathOf(parts['item.tag']!, [1, 0])).toEqual(['items', 1, 'tags', 0]);
    expect(bindPathOf(parts['heading']!, [])).toEqual(['heading']);
    expect(bindPathOf(parts['item.title']!, [])).toBeUndefined();
    expect(bindPathOf(parts['heading']!, [0])).toBeUndefined();
  });

  it('bindPathOf reads the link and image slots', () => {
    expect(bindPathOf(parts['link']!, [])).toEqual(['link', 'label']);
    expect(bindPathOf(parts['link']!, [], 'href')).toEqual(['link', 'href']);
    expect(bindPathOf(parts['image']!, [])).toEqual(['imageSrc']);
    expect(bindPathOf(parts['image']!, [], 'alt')).toEqual(['imageAlt']);
    expect(bindPathOf(parts['image']!, [], 'href')).toBeUndefined();
    expect(bindPathOf(parts['heading']!, [], 'href')).toBeUndefined();
    expect(bindPathOf(parts['frame']!, [])).toBeUndefined();
  });

  it('partStyleKey: the name for all, name@index for this', () => {
    expect(partStyleKey({ part: 'item.title', index: [2] }, 'all')).toBe('item.title');
    expect(partStyleKey({ part: 'item.title', index: [2] }, 'this')).toBe('item.title@2');
    expect(partStyleKey({ part: 'item.tag', index: [1, 0] }, 'this')).toBe('item.tag@1.0');
    expect(partStyleKey({ part: 'heading', index: [] }, 'this')).toBe('heading');
  });

  it('PART_NAME_PATTERN accepts camelCase dotted names only', () => {
    expect(PART_NAME_PATTERN.test('item.title')).toBe(true);
    expect(PART_NAME_PATTERN.test('trustLine')).toBe(true);
    expect(PART_NAME_PATTERN.test('Item')).toBe(false);
    expect(PART_NAME_PATTERN.test('item-title')).toBe(false);
    expect(PART_NAME_PATTERN.test('item.')).toBe(false);
  });
});

describe('partInstances', () => {
  it('lists present instances in declaration then array order; absent optional values drop out', () => {
    const instances = partInstances(parts, {
      heading: 'Hi',
      items: [
        { title: 'A', tags: ['x', 'y'] },
        { title: 'B', tags: [] },
      ],
    });
    expect(instances.map((instance) => `${instance.part}@${instance.index.join('.')}`)).toEqual([
      'heading@',
      'items@',
      'item@0',
      'item@1',
      'item.title@0',
      'item.title@1',
      'item.tag@0.0',
      'item.tag@0.1',
      'frame@',
    ]);
    const title = instances.find((instance) => instance.part === 'item.title' && instance.index[0] === 1);
    expect(title?.bind).toBe('items.1.title');
    expect(instances.find((instance) => instance.part === 'frame')?.bind).toBeUndefined();
  });

  it('hasPartInstance follows the props', () => {
    const live = { items: [{ title: 'A', tags: [] }] };
    expect(hasPartInstance(parts, live, { part: 'item.title', index: [0] })).toBe(true);
    expect(hasPartInstance(parts, live, { part: 'item.title', index: [1] })).toBe(false);
    expect(hasPartInstance(parts, live, { part: 'eyebrow', index: [] })).toBe(false);
    expect(hasPartInstance(parts, { ...live, eyebrow: 'New' }, { part: 'eyebrow', index: [] })).toBe(true);
    expect(hasPartInstance(parts, live, { part: 'nope', index: [] })).toBe(false);
  });

  it('blockPartsOf returns {} for a block without parts', () => {
    expect(blockPartsOf(undefined)).toEqual({});
    const schema = defineBlockSchema({ type: 'plain', description: 'Plain.', props, examples: [] });
    expect(blockPartsOf(schema)).toEqual({});
  });

  it('propSchemaAt finds an item schema', () => {
    const item = propSchemaAt(props, 'items.*');
    expect(item?.safeParse({ title: 'x', tags: [] }).success).toBe(true);
    expect(propSchemaAt(props, 'items.*.missing')).toBeUndefined();
  });
});

describe('validateBlockParts (registration gate)', () => {
  it('accepts every kind declared correctly, through defineBlockSchema', () => {
    expect(() =>
      defineBlockSchema({
        type: 'good',
        description: 'Good parts.',
        props,
        parts,
        inlineEditable: 'heading',
        examples: [],
      }),
    ).not.toThrow();
  });

  it('refuses a bind that does not resolve, at ["parts", name]', () => {
    const error = refusal(() =>
      { validateBlockParts('bad', props, {
        heading: { kind: 'text', bind: 'headline', label: label('Heading', 'العنوان') },
      }); },
    );
    expect(error.code).toBe('block/non-json-props');
    expect(error.path).toEqual(['parts', 'heading']);
    expect(error.message).toContain('no prop "headline"');
  });

  it('refuses * on a non-array', () => {
    const error = refusal(() =>
      { validateBlockParts('bad', props, {
        'link.text': { kind: 'text', bind: 'link.*', label: label('Link', 'الرابط') },
      }); },
    );
    expect(error.message).toContain('"*" must sit on an array');
  });

  it('refuses a kind mismatch on the leaf', () => {
    expect(
      refusal(() =>
        { validateBlockParts('bad', props, {
          tone: { kind: 'text', bind: 'tone', label: label('Tone', 'النبرة') },
        }); },
      ).message,
    ).toContain('not a string');
    expect(
      refusal(() =>
        { validateBlockParts('bad', props, {
          heading: { kind: 'rich', bind: 'heading', label: label('Heading', 'العنوان') },
        }); },
      ).message,
    ).toContain('not rich text');
    expect(
      refusal(() =>
        { validateBlockParts('bad', props, {
          items: { kind: 'list', bind: 'heading', label: label('Items', 'العناصر') },
        }); },
      ).message,
    ).toContain('not a array');
    expect(
      refusal(() =>
        { validateBlockParts('bad', props, {
          image: { kind: 'image', bind: { src: 'count' }, label: label('Image', 'الصورة') },
        }); },
      ).message,
    ).toContain('ends on number');
  });

  it('refuses a wrong bind shape for the kind', () => {
    expect(() =>
      { validateBlockParts('bad', props, {
        link: { kind: 'link', bind: 'link.label', label: label('Link', 'الرابط') },
      }); },
    ).toThrow(/binds \{ text, href \}/);
    expect(() =>
      { validateBlockParts('bad', props, {
        item: { kind: 'item', bind: 'items', label: label('Item', 'العنصر') },
      }); },
    ).toThrow(/"<array>\.\*"/);
    expect(() =>
      { validateBlockParts('bad', props, {
        frame: { kind: 'box', bind: 'heading', label: label('Frame', 'الإطار') },
      }); },
    ).toThrow(/takes no bind/);
    expect(() =>
      { validateBlockParts('bad', props, {
        heading: { kind: 'text', label: label('Heading', 'العنوان') },
      }); },
    ).toThrow(/binds one dotted prop path/);
  });

  it('refuses an item whose list is not a list part of the same array', () => {
    expect(() =>
      { validateBlockParts('bad', props, {
        item: { kind: 'item', bind: 'items.*', list: 'heading', label: label('Item', 'العنصر') },
        heading: parts['heading']!,
      }); },
    ).toThrow(/is not a list part/);
  });

  it('refuses a bad name, a one-locale label and an empty alias', () => {
    expect(() =>
      { validateBlockParts('bad', props, {
        Heading: { kind: 'text', bind: 'heading', label: label('Heading', 'العنوان') },
      }); },
    ).toThrow(/camelCase/);
    expect(() =>
      { validateBlockParts('bad', props, {
        heading: { kind: 'text', bind: 'heading', label: label('Heading', '') },
      }); },
    ).toThrow(/English and an Arabic/);
    expect(() =>
      { validateBlockParts('bad', props, {
        heading: { kind: 'text', bind: 'heading', label: label('Heading', 'العنوان'), aliases: [' '] },
      }); },
    ).toThrow(/alias is empty/);
  });

  it('refuses an inlineEditable prop no text or rich part binds', () => {
    const error = refusal(() =>
      defineBlockSchema({
        type: 'unbound',
        description: 'Unbound inline edit.',
        props,
        parts: { eyebrow: parts['eyebrow']! },
        inlineEditable: 'heading',
        examples: [],
      }),
    );
    expect(error.code).toBe('block/non-json-props');
    expect(error.path).toEqual(['parts', 'heading']);
    expect(error.message).toContain('no text or rich part binds it');
  });
});
