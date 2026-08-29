import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import type { FieldTypeDef, RegistryRead } from '@craftkit/builder-schema';

import {
  defaultFieldFor,
  enumValuesOf,
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
    expect(defaultFieldFor(z.string())).toEqual({ kind: 'default', control: 'text' });
    expect(defaultFieldFor(z.enum(['a', 'b']))).toEqual({ kind: 'default', control: 'select' });
    expect(defaultFieldFor(z.boolean())).toEqual({ kind: 'default', control: 'switch' });
    expect(defaultFieldFor(z.number())).toEqual({ kind: 'default', control: 'number' });
    expect(defaultFieldFor(z.array(z.string()))).toEqual({
      kind: 'default',
      control: 'repeater',
    });
  });

  it('unwraps optional/default/nullable (nested included) before mapping', () => {
    expect(defaultFieldFor(z.string().optional())).toEqual({ kind: 'default', control: 'text' });
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

  it('falls back to readonly for anything else', () => {
    expect(defaultFieldFor(z.object({ a: z.string() }))).toEqual({ kind: 'readonly' });
    expect(defaultFieldFor(z.record(z.string(), z.string()))).toEqual({ kind: 'readonly' });
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
    expect(resolveField(registryWith(zero, negative), z.string())).toEqual({
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
    expect(resolveField(registryWith(throwing), z.string())).toEqual({
      kind: 'default',
      control: 'text',
    });
  });

  it('resolves readonly when nothing matches an exotic schema', () => {
    expect(resolveField(registryWith(), z.object({ nested: z.string() }))).toEqual({
      kind: 'readonly',
    });
  });
});
