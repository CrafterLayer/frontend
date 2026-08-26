import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { BuilderError } from '../errors';
import { emptyRichText, richText } from '../rich-text/rich-text';
import { defineBlockSchema } from './define-block-schema';

const block = (inlineEditable: string | undefined, props: z.ZodType) =>
  defineBlockSchema({
    type: 'sample',
    description: 'Sample block.',
    props,
    ...(inlineEditable === undefined ? {} : { inlineEditable }),
    examples: [],
  });

describe('inlineEditable declaration (009 contract §1)', () => {
  it('d1: accepts a plain string property', () => {
    const schema = block('heading', z.object({ heading: z.string(), tone: z.enum(['a', 'b']) }));
    expect(schema.inlineEditable).toBe('heading');
  });

  it('d1: accepts a string through optional/default/nullable wrappers', () => {
    expect(block('a', z.object({ a: z.string().optional() })).inlineEditable).toBe('a');
    expect(block('a', z.object({ a: z.string().default('x') })).inlineEditable).toBe('a');
    expect(block('a', z.object({ a: z.string().nullable().optional() })).inlineEditable).toBe('a');
  });

  it('d1: accepts a rich-text property — recognised by MARKER, not by import', () => {
    const schema = block('body', z.object({ body: richText().default(emptyRichText() as never) }));
    expect(schema.inlineEditable).toBe('body');
  });

  it('d1: REJECTS a key that is not a prop', () => {
    expect(() => block('missing', z.object({ heading: z.string() }))).toThrow(BuilderError);
    try {
      block('missing', z.object({ heading: z.string() }));
    } catch (error) {
      expect((error as BuilderError).message).toContain('not one of its props');
      expect((error as BuilderError).path).toEqual(['inlineEditable']);
    }
  });

  it.each([
    ['a number', z.object({ a: z.number() })],
    ['a boolean', z.object({ a: z.boolean() })],
    ['an enum', z.object({ a: z.enum(['x', 'y']) })],
    ['an array', z.object({ a: z.array(z.string()) })],
    ['an object', z.object({ a: z.object({ nested: z.string() }) })],
  ])('d1: REJECTS %s — only text edits in place', (_label, props) => {
    expect(() => block('a', props)).toThrow(BuilderError);
  });

  it('d2: a block without the declaration is simply not inline-editable', () => {
    expect(block(undefined, z.object({ heading: z.string() })).inlineEditable).toBeUndefined();
  });
});
