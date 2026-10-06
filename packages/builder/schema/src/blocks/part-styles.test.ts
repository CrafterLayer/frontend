import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { defineBlockSchema } from './define-block-schema';
import {
  isPartStylesSchema,
  partStylesKeyOf,
  partStylesProp,
  readPartStyles,
} from './part-styles';

describe('partStylesProp', () => {
  it('accepts token classes and a direction per part key, including instance keys', () => {
    const schema = partStylesProp();
    expect(
      schema.safeParse({
        heading: { className: 'ps-4 text-accent hover:bg-surface', dir: 'ltr' },
        'item.title@2': { dir: 'rtl' },
        'item.tag@1.0': { className: 'max-md:p-2' },
      }).success,
    ).toBe(true);
    expect(schema.safeParse(undefined).success).toBe(true);
  });

  it('refuses the default palette, arbitrary values, overlong lists, bad keys and bad directions', () => {
    const schema = partStylesProp();
    const palette = schema.safeParse({ heading: { className: 'bg-blue-500' } });
    expect(palette.success).toBe(false);
    expect(JSON.stringify(palette.error?.issues)).toContain('Tailwind');
    expect(schema.safeParse({ heading: { className: 'p-[17px]' } }).success).toBe(false);
    expect(schema.safeParse({ heading: { className: 'p-4 '.repeat(101) } }).success).toBe(false);
    expect(schema.safeParse({ 'Heading!': { className: 'p-4' } }).success).toBe(false);
    expect(schema.safeParse({ heading: { dir: 'up' } }).success).toBe(false);
  });

  it('is JSON-representable, so a block declaring it registers', () => {
    expect(() =>
      defineBlockSchema({
        type: 'styled',
        description: 'A block with part styles.',
        props: z.object({ heading: z.string(), partStyles: partStylesProp() }),
        examples: [],
      }),
    ).not.toThrow();
  });
});

describe('isPartStylesSchema / partStylesKeyOf', () => {
  it('finds the marker through wrappers, never by the prop name', () => {
    expect(isPartStylesSchema(partStylesProp())).toBe(true);
    expect(isPartStylesSchema(z.record(z.string(), z.object({})).optional())).toBe(false);
    expect(isPartStylesSchema('partStyles')).toBe(false);
    expect(isPartStylesSchema(undefined)).toBe(false);

    expect(partStylesKeyOf(z.object({ heading: z.string(), looks: partStylesProp() }))).toBe('looks');
    expect(partStylesKeyOf(z.object({ partStyles: z.record(z.string(), z.string()) }))).toBeUndefined();
    expect(partStylesKeyOf(z.string())).toBeUndefined();
  });
});

describe('readPartStyles', () => {
  it('reads valid entries and skips junk without throwing', () => {
    expect(
      readPartStyles({
        partStyles: {
          heading: { className: 'ps-4', dir: 'ltr' },
          body: { className: 7, dir: 'sideways' },
          bad: 'p-4',
        },
      }),
    ).toEqual({ heading: { className: 'ps-4', dir: 'ltr' }, body: {} });
    expect(readPartStyles({ partStyles: [] })).toEqual({});
    expect(readPartStyles(null)).toEqual({});
    expect(readPartStyles({})).toEqual({});
  });
});
