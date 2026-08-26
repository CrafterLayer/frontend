import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { BuilderError } from '../errors';
import { blockPropsJsonSchema } from '../json-schema';
import { defineBlockSchema } from './define-block-schema';

describe('defineBlockSchema', () => {
  it('accepts a JSON-representable schema and freezes it', () => {
    const block = defineBlockSchema({
      type: 'hero',
      description: 'Opening section.',
      props: z.object({ tone: z.enum(['light', 'dark']).default('light') }),
      slots: { actions: { allow: ['button'], max: 2 } },
      examples: [{ prompt: 'hero', node: { type: 'hero', props: {} } }],
    });
    expect(Object.isFrozen(block)).toBe(true);
    expect(block.type).toBe('hero');
  });

  it.each([
    ['a date prop', z.object({ when: z.date() })],
    ['a bigint prop', z.object({ big: z.bigint() })],
    ['a map prop', z.object({ lookup: z.map(z.string(), z.string()) })],
    ['a transform pipeline', z.object({ v: z.string().transform((s) => s.length) })],
  ])('rejects %s as non-JSON-representable', (_label, props) => {
    expect(() => defineBlockSchema({ type: 'bad', description: 'x', props, examples: [] })).toThrow(
      BuilderError,
    );
    try {
      defineBlockSchema({ type: 'bad', description: 'x', props, examples: [] });
    } catch (error) {
      expect((error as BuilderError).code).toBe('block/non-json-props');
      expect((error as BuilderError).path).toEqual(['props']);
    }
  });

  it('rejects empty type, empty description, bad slot declarations, and non-JSON examples', () => {
    const props = z.object({});
    expect(() => defineBlockSchema({ type: ' ', description: 'x', props, examples: [] })).toThrow(
      /non-empty/,
    );
    expect(() => defineBlockSchema({ type: 'x', description: ' ', props, examples: [] })).toThrow(
      /description/,
    );
    expect(() =>
      defineBlockSchema({
        type: 'x',
        description: 'x',
        props,
        slots: { main: { allow: [] } },
        examples: [],
      }),
    ).toThrow(/at least one/);
    expect(() =>
      defineBlockSchema({
        type: 'x',
        description: 'x',
        props,
        slots: { main: { allow: ['y'], max: 0 } },
        examples: [],
      }),
    ).toThrow(/positive integer/);
    expect(() =>
      defineBlockSchema({
        type: 'x',
        description: 'x',
        props,
        examples: [{ prompt: 'p', node: { bad: (() => null) as never } }],
      }),
    ).toThrow(/non-JSON/);
  });
});

describe('blockPropsJsonSchema', () => {
  it('derives a JSON Schema object for AI context', () => {
    const block = defineBlockSchema({
      type: 'hero',
      description: 'Opening section.',
      props: z.object({ heading: z.string().max(80) }),
      examples: [],
    });
    const jsonSchema = blockPropsJsonSchema(block) as { type: string; properties: object };
    expect(jsonSchema.type).toBe('object');
    expect(Object.keys(jsonSchema.properties)).toEqual(['heading']);
  });
});
