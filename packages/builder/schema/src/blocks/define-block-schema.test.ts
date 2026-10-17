import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { BuilderError } from '../errors';
import { blockPropsJsonSchema } from '../json-schema';
import {
  type BlockPropertyGroup,
  type BlockSchema,
  defineBlockSchema,
} from './define-block-schema';

function propertyGroupTypeAssertions(): void {
  const props = z.object({ heading: z.string(), alignment: z.string() });

  defineBlockSchema({
    type: 'type-check',
    description: 'Compile-time property-group checks.',
    props,
    propertyGroups: {
      // @ts-expect-error -- misspelled property keys must fail at compile time.
      hedaing: { tab: 'content' },
    },
    examples: [],
  });

  defineBlockSchema({
    type: 'type-check-tab',
    description: 'Compile-time property-tab checks.',
    props,
    propertyGroups: {
      heading: {
        // @ts-expect-error -- tabs are a closed union.
        tab: 'style',
      },
    },
    examples: [],
  });

  defineBlockSchema({
    type: 'type-check-kind',
    description: 'Compile-time property-kind checks.',
    props,
    propertyGroups: {
      heading: {
        tab: 'design',
        // Mutation gate: widening BlockPropertyKind to string makes typecheck report TS2578 here.
        // @ts-expect-error -- property kinds are a closed union.
        kind: 'color',
      },
    },
    examples: [],
  });
}

void propertyGroupTypeAssertions;

describe('defineBlockSchema', () => {
  it('accepts a JSON-representable schema and freezes it', () => {
    const block = defineBlockSchema({
      type: 'hero',
      description: 'Opening section.',
      props: z.object({ tone: z.enum(['light', 'dark']).default('light') }),
      slots: { actions: { allow: ['button'], max: 2, exposeChildMetadata: true } },
      examples: [{ prompt: 'hero', node: { type: 'hero', props: {} } }],
    });
    expect(Object.isFrozen(block)).toBe(true);
    expect(block.type).toBe('hero');
    expect(block.slots?.['actions']?.exposeChildMetadata).toBe(true);
  });

  it('preserves optional typed property groups while ungrouped properties remain valid', () => {
    const props = z.object({ heading: z.string(), alignment: z.string(), eyebrow: z.string() });
    const block = defineBlockSchema({
      type: 'grouped-hero',
      description: 'Opening section with declared Inspector placement.',
      props,
      propertyGroups: {
        heading: { tab: 'content', section: 'Copy' },
        alignment: { tab: 'design', section: 'Alignment' },
      },
      examples: [],
    });

    expect(block.propertyGroups).toEqual({
      heading: { tab: 'content', section: 'Copy' },
      alignment: { tab: 'design', section: 'Alignment' },
    });
    expect(block.propertyGroups?.eyebrow).toBeUndefined();

    const erased: BlockSchema = block;
    const erasedGroup: BlockPropertyGroup | undefined = erased.propertyGroups?.['heading'];
    expect(erasedGroup?.tab).toBe('content');
  });

  it('preserves an explicit color-role kind through typed and erased BlockSchema views', () => {
    const block = defineBlockSchema({
      type: 'color-role-card',
      description: 'Card with an explicitly declared page color role.',
      props: z.object({ background: z.string() }),
      propertyGroups: {
        background: { tab: 'design', section: 'Color', kind: 'color-role' },
      },
      examples: [],
    });

    // Mutation gate: clone propertyGroups while omitting `kind` before returning the block; this
    // named test fails with expected "color-role", received undefined.
    expect(block.propertyGroups?.background?.kind).toBe('color-role');

    const erased: BlockSchema = block;
    const erasedGroup: BlockPropertyGroup | undefined = erased.propertyGroups?.['background'];
    expect(erasedGroup?.kind).toBe('color-role');
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

// ── block-parts (2026-10-06) ──
describe('defineBlockSchema — parts', () => {
  const props = z.object({
    heading: z.string(),
    body: z.string().optional(),
    items: z.array(z.object({ title: z.string() })).default([]),
  });

  it('keeps a valid parts declaration and the new declared kinds', () => {
    const block = defineBlockSchema({
      type: 'parts-ok',
      description: 'A block with parts.',
      props,
      propertyGroups: {
        body: { tab: 'content', kind: 'multiline' },
        heading: { tab: 'content', kind: 'link' },
        items: { tab: 'content', kind: 'image' },
      },
      parts: {
        heading: { kind: 'text', bind: 'heading', label: { en: 'Heading', ar: 'العنوان' } },
        'item.title': { kind: 'text', bind: 'items.*.title', label: { en: 'Title', ar: 'العنوان' } },
      },
      inlineEditable: 'heading',
      examples: [],
    });
    expect(Object.keys(block.parts ?? {})).toEqual(['heading', 'item.title']);
    const kind: BlockPropertyGroup['kind'] = 'part-styles';
    expect(kind).toBe('part-styles');
  });

  it('runs the parts gate at registration', () => {
    expect(() =>
      defineBlockSchema({
        type: 'parts-bad',
        description: 'A block with a broken part.',
        props,
        parts: { body: { kind: 'text', bind: 'items.*', label: { en: 'Body', ar: 'النص' } } },
        examples: [],
      }),
    ).toThrow(BuilderError);
  });

  it('leaves blocks without parts exactly as before (inlineEditable alone is enough)', () => {
    expect(() =>
      defineBlockSchema({
        type: 'no-parts',
        description: 'A block without parts.',
        props,
        inlineEditable: 'body',
        examples: [],
      }),
    ).not.toThrow();
  });
});
// ── /block-parts ──
