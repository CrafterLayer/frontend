import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import {
  imagePropSchema,
  partStylesProp,
  type BlockParts,
  type FieldTypeDef,
  type RegistryRead,
} from '@craftkit/builder-schema';

import {
  defaultFieldFor,
  enumValuesOf,
  isImagePropSchema,
  partBindingFor,
  propsShapeOf,
  resolveField,
  unwrapSchema,
} from './resolve-field';
import { initialValueForSchema, repeaterSchemaInfo } from './repeater-schema';

const registryWith = (...defs: FieldTypeDef[]): RegistryRead =>
  ({ fieldTypes: () => defs }) as unknown as RegistryRead;

const field = (id: string, match: (schema: z.ZodType) => number): FieldTypeDef => ({
  id,
  match,
  load: () => Promise.resolve({ default: () => null }),
});

describe('defaultFieldFor (f2)', () => {
  it('maps scalar and array kinds to their default controls', () => {
    // Mutation: returning readonly for arrays makes this named gate fail.
    expect(defaultFieldFor(z.string().max(80))).toEqual({ kind: 'default', control: 'text' });
    expect(defaultFieldFor(z.enum(['a', 'b']))).toEqual({ kind: 'default', control: 'select' });
    expect(defaultFieldFor(z.boolean())).toEqual({ kind: 'default', control: 'switch' });
    expect(defaultFieldFor(z.number())).toEqual({ kind: 'default', control: 'number' });
    expect(defaultFieldFor(z.array(z.string()))).toEqual({
      kind: 'default',
      control: 'repeater',
    });
  });

  it('unwraps optional/default/nullable (nested included) before mapping', () => {
    expect(defaultFieldFor(z.string().max(60).optional())).toEqual({
      kind: 'default',
      control: 'text',
    });
    expect(defaultFieldFor(z.number().default(3))).toEqual({ kind: 'default', control: 'number' });
    expect(defaultFieldFor(z.boolean().nullable())).toEqual({ kind: 'default', control: 'switch' });
    expect(defaultFieldFor(z.enum(['x', 'y']).default('x').optional())).toEqual({
      kind: 'default',
      control: 'select',
    });
    expect(defaultFieldFor(z.array(z.string()).default([]).optional())).toEqual({
      kind: 'default',
      control: 'repeater',
    });
  });

  it('long or unbounded strings get the paragraph editor; formatted strings stay one line', () => {
    // Mutation: dropping the bound check sends every body to a one-line input.
    expect(defaultFieldFor(z.string())).toEqual({ kind: 'default', control: 'textarea' });
    expect(defaultFieldFor(z.string().max(200))).toEqual({ kind: 'default', control: 'textarea' });
    expect(defaultFieldFor(z.string().max(120))).toEqual({ kind: 'default', control: 'text' });
    expect(defaultFieldFor(z.email())).toEqual({ kind: 'default', control: 'text' });
    expect(defaultFieldFor(z.string().regex(/^[a-z]+$/u))).toEqual({
      kind: 'default',
      control: 'text',
    });
  });

  it('a union of strings and string literals is text (blankOr), never JSON', () => {
    const blankOr = z
      .union([
        z.literal(''),
        z
          .string()
          .max(400)
          .regex(/\.vtt$/u),
      ])
      .optional();
    expect(defaultFieldFor(blankOr)).toEqual({ kind: 'default', control: 'text' });
    expect(defaultFieldFor(z.union([z.string(), z.number()]))).toEqual({ kind: 'readonly' });
  });

  it('objects get grouped rows, string records name/value rows', () => {
    expect(defaultFieldFor(z.object({ a: z.string() }))).toEqual({
      kind: 'default',
      control: 'object',
    });
    expect(defaultFieldFor(z.object({ a: z.string() }).optional())).toEqual({
      kind: 'default',
      control: 'object',
    });
    expect(defaultFieldFor(z.record(z.string(), z.string().nullable()))).toEqual({
      kind: 'default',
      control: 'key-value',
    });
    expect(defaultFieldFor(z.record(z.string(), z.number()))).toEqual({ kind: 'readonly' });
  });

  it('the image asset prop gets the asset picker; partStyles gets its own field (markers)', () => {
    expect(defaultFieldFor(imagePropSchema.optional())).toEqual({
      kind: 'default',
      control: 'asset',
    });
    expect(isImagePropSchema(imagePropSchema)).toBe(true);
    expect(defaultFieldFor(partStylesProp())).toEqual({ kind: 'default', control: 'part-styles' });
  });

  it('falls back to a readonly summary only for what no editor fits', () => {
    expect(defaultFieldFor(z.date())).toEqual({ kind: 'readonly' });
    expect(defaultFieldFor(z.literal('fixed'))).toEqual({ kind: 'readonly' });
  });
});

describe('part-declared bindings (block-parts DESIGN §2.10 step 2)', () => {
  const PARTS: BlockParts = {
    link: {
      kind: 'link',
      bind: { text: 'link.label', href: 'link.href' },
      label: { en: 'Link', ar: 'الرابط' },
    },
    'item.action': {
      kind: 'link',
      bind: { text: 'items.*.action.label', href: 'items.*.action.href' },
      label: { en: 'Item action', ar: 'إجراء العنصر' },
    },
    cta: {
      kind: 'link',
      bind: { text: 'linkLabel', href: 'href' },
      label: { en: 'Link', ar: 'الرابط' },
    },
    'post.image': {
      kind: 'image',
      bind: { src: 'posts.*.imageSrc', alt: 'posts.*.imageAlt' },
      label: { en: 'Post image', ar: 'صورة المقال' },
    },
  };
  const linkSchema = z.object({ label: z.string(), href: z.string() });

  it('finds link objects, href strings and image sources by declaration, nested too', () => {
    expect(partBindingFor(PARTS, ['link'])).toEqual({
      kind: 'link',
      textKey: 'label',
      hrefKey: 'href',
    });
    expect(partBindingFor(PARTS, ['items', 3, 'action'])).toMatchObject({ textKey: 'label' });
    expect(partBindingFor(PARTS, ['href'])).toEqual({ kind: 'link' });
    expect(partBindingFor(PARTS, ['posts', 0, 'imageSrc'])).toEqual({ kind: 'image' });
    // Not by name: an undeclared `imageSrc` is just a string.
    expect(partBindingFor(PARTS, ['imageSrc'])).toBeUndefined();
    expect(partBindingFor(PARTS, ['items', 'x', 'action'])).toBeUndefined();
  });

  it('resolves the bound rows to LinkField and ImageUrlField before contributions', () => {
    const greedy = field('greedy', () => 100);
    const registry = registryWith(greedy);
    expect(
      resolveField(registry, linkSchema, undefined, { parts: PARTS, propPath: ['link'] }),
    ).toEqual({ kind: 'default', control: 'link' });
    expect(
      resolveField(registry, z.string(), undefined, {
        parts: PARTS,
        propPath: ['posts', 1, 'imageSrc'],
      }),
    ).toEqual({ kind: 'default', control: 'image-url' });
    // A binding that does not fit the schema's shape is ignored.
    expect(
      resolveField(registryWith(), z.number(), undefined, { parts: PARTS, propPath: ['href'] }),
    ).toEqual({ kind: 'default', control: 'number' });
  });
});

describe('introspection helpers', () => {
  it('unwrapSchema peels wrappers to the core schema', () => {
    const core = z.enum(['a', 'b']);
    expect(unwrapSchema(core.default('a').optional())).toBe(core);
    expect(unwrapSchema(z.string())._zod.def.type).toBe('string');
  });

  it('propsShapeOf enumerates object properties in declaration order, empty otherwise', () => {
    const shape = propsShapeOf(z.object({ title: z.string(), tone: z.enum(['a', 'b']) }));
    expect(Object.keys(shape)).toEqual(['title', 'tone']);
    expect(shape['title']?._zod.def.type).toBe('string');
    expect(propsShapeOf(z.string())).toEqual({});
  });

  it('enumValuesOf lists members through wrappers, empty otherwise', () => {
    expect(enumValuesOf(z.enum(['left', 'right']))).toEqual(['left', 'right']);
    expect(enumValuesOf(z.enum(['left', 'right']).optional())).toEqual(['left', 'right']);
    expect(enumValuesOf(z.string())).toEqual([]);
  });
});

describe('repeater schema helpers', () => {
  it('reads inclusive array bounds and seeds a value inside exclusive numeric bounds', () => {
    // Mutation: trying only zero or the exclusive endpoints makes this named gate fail.
    const array = z.array(z.number().gt(0).lt(1)).min(1).max(3);
    expect(repeaterSchemaInfo(array)).toMatchObject({ min: 1, max: 3 });

    const seed = initialValueForSchema(array.element);
    expect(seed.ok).toBe(true);
    if (!seed.ok) {
      throw new Error(seed.reason);
    }
    expect(seed.value).toBeGreaterThan(0);
    expect(seed.value).toBeLessThan(1);
    expect(array.element.safeParse(seed.value).success).toBe(true);
  });
});

describe('resolveField (declared kinds, then f1 contributions)', () => {
  it('resolves a declared color role before even a high-scoring contribution', () => {
    // Mutation: removing the declared-kind branch returns this contribution and fails this gate.
    const alwaysWins = field('always-wins', () => 100);
    expect(resolveField(registryWith(alwaysWins), z.string(), 'color-role')).toEqual({
      kind: 'default',
      control: 'color-role',
    });
  });

  it('maps the block-parts declared kinds to their editors', () => {
    const alwaysWins = field('always-wins', () => 100);
    const registry = registryWith(alwaysWins);
    expect(resolveField(registry, z.string().max(20), 'multiline')).toEqual({
      kind: 'default',
      control: 'textarea',
    });
    expect(resolveField(registry, z.string(), 'image')).toEqual({
      kind: 'default',
      control: 'image-url',
    });
    expect(resolveField(registry, imagePropSchema, 'image')).toEqual({
      kind: 'default',
      control: 'asset',
    });
    expect(resolveField(registry, z.string(), 'link')).toEqual({
      kind: 'default',
      control: 'link',
    });
    expect(resolveField(registry, partStylesProp(), 'part-styles')).toEqual({
      kind: 'default',
      control: 'part-styles',
    });
  });

  it('picks the highest positive match score over the defaults', () => {
    const low = field('low', () => 1);
    const high = field('high', () => 5);
    expect(resolveField(registryWith(low, high), z.string())).toEqual({
      kind: 'contributed',
      def: high,
    });
  });

  it('breaks ties by registration order (first registered wins)', () => {
    const first = field('first', () => 5);
    const second = field('second', () => 5);
    expect(resolveField(registryWith(first, second), z.string())).toEqual({
      kind: 'contributed',
      def: first,
    });
  });

  it('skips scores ≤ 0 and falls through to the default mapping', () => {
    const zero = field('zero', () => 0);
    const negative = field('negative', () => -3);
    expect(resolveField(registryWith(zero, negative), z.string().max(40))).toEqual({
      kind: 'default',
      control: 'text',
    });
  });

  it('contains a throwing match() to a no-match (broken contribution ≠ broken panel)', () => {
    const throwing = field('throwing', () => {
      throw new Error('bad matcher');
    });
    const sane = field('sane', () => 2);
    expect(resolveField(registryWith(throwing, sane), z.string())).toEqual({
      kind: 'contributed',
      def: sane,
    });
    expect(resolveField(registryWith(throwing), z.string().max(40))).toEqual({
      kind: 'default',
      control: 'text',
    });
  });

  it('resolves readonly when nothing matches an exotic schema', () => {
    expect(resolveField(registryWith(), z.date())).toEqual({ kind: 'readonly' });
  });
});
