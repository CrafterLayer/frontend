import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { type BlockSchema, defineBlockSchema } from '../blocks/define-block-schema';
import { BuilderError } from '../errors';
import { MAX_JSON_DEPTH, type JsonValue } from '../json/json-value';
import type { BuilderDocument, Node } from './types';
import { type BlockSchemaLookup, validateDocument } from './validate';

type NodeSeed = { id: string; type: string } & Partial<Node>;

function doc(nodeSeeds: NodeSeed[], rootId = 'root'): BuilderDocument {
  const nodes: Record<string, Node> = {};
  for (const seed of nodeSeeds) {
    nodes[seed.id] = { props: {}, ...seed };
  }
  return { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId, nodes };
}

function nestedArrays(depth: number): JsonValue {
  let value: JsonValue = null;
  for (let level = 0; level < depth; level += 1) {
    value = [value];
  }
  return value;
}

function codes(document: BuilderDocument, lookup?: BlockSchemaLookup): string[] {
  return validateDocument(document, lookup)
    .map((error) => error.code)
    .sort();
}

const page = defineBlockSchema({
  type: 'page',
  description: 'Page root.',
  props: z.object({ title: z.string().default('') }),
  slots: { default: { allow: ['hero', 'button'] } },
  examples: [],
});
const hero = defineBlockSchema({
  type: 'hero',
  description: 'Opening section.',
  props: z.object({
    tone: z.enum(['light', 'dark']).default('light'),
    heading: z.string().min(1).max(80),
  }),
  slots: { actions: { allow: ['button'], max: 2 } },
  examples: [],
});
const button = defineBlockSchema({
  type: 'button',
  description: 'Action button.',
  props: z.object({ label: z.string().min(1) }),
  examples: [],
});

const registry = new Map<string, BlockSchema>([
  ['page', page],
  ['hero', hero],
  ['button', button],
]);
const lookup: BlockSchemaLookup = (type) => registry.get(type);

describe('validateDocument — structural pass', () => {
  it('accepts a well-formed document', () => {
    const document = doc([
      { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: ['h1'] } },
      {
        id: 'h1',
        type: 'hero',
        props: { tone: 'dark', heading: 'Hi' },
        slots: { actions: ['b1'] },
      },
      { id: 'b1', type: 'button', props: { label: 'Go' } },
    ]);
    expect(validateDocument(document)).toEqual([]);
  });

  it('refuses a RESERVED node id — the patch door cannot address one (011 T033)', () => {
    // Domain alignment, the same discipline as MAX_JSON_DEPTH: the kernel's
    // patch door rejects these as path segments, so a document holding one
    // would project to text whose patches can never be applied — the round-trip
    // law would be false for it. Accepted and applicable must stay one set.
    for (const reserved of ['__proto__', 'constructor', 'prototype']) {
      const nodes: Record<string, unknown> = {};
      Object.defineProperty(nodes, reserved, {
        configurable: true,
        enumerable: true,
        value: { id: reserved, type: 'page', props: {} },
        writable: true,
      });
      const document = {
        schemaVersion: 1,
        surface: 'site',
        dir: 'ltr',
        rootId: reserved,
        nodes,
      } as unknown as Parameters<typeof validateDocument>[0];
      expect(validateDocument(document).map((error) => error.code)).toContain(
        'doc/reserved-node-id',
      );
    }
  });

  it('refuses a RESERVED prop key through the Law J walk (011 T033)', () => {
    const document = doc([
      {
        id: 'root',
        type: 'page',
        // JSON.parse is the only way to get an OWN `__proto__` key: an object
        // literal would set the prototype instead of defining a property.
        props: JSON.parse('{"title": "Home", "__proto__": 1}') as Record<string, JsonValue>,
      },
    ]);
    const errors = validateDocument(document);
    expect(errors.map((error) => error.code)).toContain('doc/non-json-value');
    expect(errors.some((error) => error.message.includes('reserved object key'))).toBe(true);
  });

  it('reports a missing root', () => {
    const document = doc([{ id: 'a', type: 'button' }], 'nope');
    expect(codes(document)).toContain('doc/root-missing');
  });

  it('reports a parented root', () => {
    const document = doc([
      { id: 'root', type: 'page', slots: { default: ['a'] } },
      { id: 'a', type: 'hero', slots: { actions: ['root'] } },
    ]);
    expect(codes(document)).toContain('doc/root-parented');
  });

  it('reports duplicate membership across two parents', () => {
    const document = doc([
      { id: 'root', type: 'page', slots: { default: ['a', 'b'] } },
      { id: 'a', type: 'hero', slots: { actions: ['c'] } },
      { id: 'b', type: 'hero', slots: { actions: ['c'] } },
      { id: 'c', type: 'button' },
    ]);
    expect(codes(document)).toContain('doc/duplicate-membership');
  });

  it('reports a duplicate inside one slot exactly once', () => {
    const document = doc([
      { id: 'root', type: 'page', slots: { default: ['a', 'a'] } },
      { id: 'a', type: 'button' },
    ]);
    const errors = validateDocument(document);
    expect(errors.map((error) => error.code)).toEqual(['doc/duplicate-in-slot']);
  });

  it('reports dangling slot references', () => {
    const document = doc([{ id: 'root', type: 'page', slots: { default: ['ghost'] } }]);
    expect(codes(document)).toContain('doc/dangling-child');
  });

  it('reports orphans', () => {
    const document = doc([
      { id: 'root', type: 'page' },
      { id: 'floating', type: 'button' },
    ]);
    expect(codes(document)).toContain('doc/orphan');
  });

  it('reports a detached cycle once with its members', () => {
    const document = doc([
      { id: 'root', type: 'page' },
      { id: 'x', type: 'hero', slots: { actions: ['y'] } },
      { id: 'y', type: 'hero', slots: { actions: ['x'] } },
    ]);
    const errors = validateDocument(document);
    const cycleErrors = errors.filter((error) => error.code === 'doc/cycle');
    expect(cycleErrors).toHaveLength(1);
    expect(cycleErrors[0]?.meta?.['members']).toEqual(['x', 'y']);
  });

  it('reports stored empty slot arrays', () => {
    const document = doc([{ id: 'root', type: 'page', slots: { default: [] } }]);
    expect(codes(document)).toContain('doc/empty-slot-array');
  });

  it('reports empty slot names', () => {
    const document = doc([
      { id: 'root', type: 'page', slots: { '': ['a'] } },
      { id: 'a', type: 'button' },
    ]);
    expect(codes(document)).toContain('doc/invalid-slot-name');
  });

  it('reports id/key mismatches', () => {
    const document = doc([{ id: 'root', type: 'page' }]);
    const mismatched = { ...document.nodes['root'], id: 'other' } as Node;
    document.nodes['root'] = mismatched;
    expect(codes(document)).toContain('doc/id-mismatch');
  });

  it('reports non-JSON prop values with their path', () => {
    const document = doc([{ id: 'root', type: 'page' }]);
    document.nodes['root'] = {
      ...document.nodes['root'],
      props: { handler: (() => null) as unknown as string },
    } as Node;
    const errors = validateDocument(document);
    expect(errors[0]?.code).toBe('doc/non-json-value');
    expect(errors[0]?.path).toEqual(['nodes', 'root', 'props', 'handler']);
  });

  it('refuses MAX_JSON_DEPTH + 1 at the Law J document door with a typed error', () => {
    const document = doc([
      {
        id: 'root',
        type: 'page',
        props: { deep: nestedArrays(MAX_JSON_DEPTH + 1) },
      },
    ]);

    const errors = validateDocument(document);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(BuilderError);
    expect(errors[0]).toMatchObject({
      name: 'BuilderError',
      code: 'doc/non-json-value',
      message: 'Documents hold plain data only; found max-depth value.',
    });
    expect(errors[0]?.path).toEqual([
      'nodes',
      'root',
      'props',
      'deep',
      ...Array.from({ length: MAX_JSON_DEPTH + 1 }, () => 0),
    ]);
  });

  it('reports non-finite numbers distinctly', () => {
    const document = doc([{ id: 'root', type: 'page', props: { ratio: Number.NaN } }]);
    expect(codes(document)).toContain('doc/non-finite-number');
  });

  it('reports unknown breakpoints and invalid binding paths', () => {
    const document = doc([
      {
        id: 'root',
        type: 'page',
        responsive: { desktop: { title: 'x' } } as unknown as NonNullable<Node['responsive']>,
        bindings: { items: '' },
      },
    ]);
    const found = codes(document);
    expect(found).toContain('doc/invalid-props');
    expect(found).toContain('doc/non-json-value');
  });
});

describe('validateDocument — registry-aware pass', () => {
  it('accepts a schema-conformant document', () => {
    const document = doc([
      { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: ['h1'] } },
      {
        id: 'h1',
        type: 'hero',
        props: { tone: 'light', heading: 'Hello' },
        responsive: { mobile: { tone: 'dark' } },
        slots: { actions: ['b1', 'b2'] },
      },
      { id: 'b1', type: 'button', props: { label: 'One' } },
      { id: 'b2', type: 'button', props: { label: 'Two' } },
    ]);
    expect(validateDocument(document, lookup)).toEqual([]);
  });

  it('reports unknown node types', () => {
    const document = doc([{ id: 'root', type: 'mystery' }]);
    expect(codes(document, lookup)).toContain('doc/unknown-type');
  });

  it('reports undeclared slots', () => {
    const document = doc([
      { id: 'root', type: 'page', slots: { sidebar: ['b1'] } },
      { id: 'b1', type: 'button', props: { label: 'x' } },
    ]);
    expect(codes(document, lookup)).toContain('doc/unknown-slot');
  });

  it('reports disallowed child types', () => {
    const document = doc([
      { id: 'root', type: 'page', slots: { default: ['h1'] } },
      {
        id: 'h1',
        type: 'hero',
        props: { tone: 'light', heading: 'x' },
        slots: { actions: ['h2'] },
      },
      { id: 'h2', type: 'hero', props: { tone: 'light', heading: 'y' } },
    ]);
    expect(codes(document, lookup)).toContain('doc/slot-not-allowed');
  });

  it('reports slot capacity overflow', () => {
    const document = doc([
      { id: 'root', type: 'page', slots: { default: ['h1'] } },
      {
        id: 'h1',
        type: 'hero',
        props: { tone: 'light', heading: 'x' },
        slots: { actions: ['b1', 'b2', 'b3'] },
      },
      { id: 'b1', type: 'button', props: { label: '1' } },
      { id: 'b2', type: 'button', props: { label: '2' } },
      { id: 'b3', type: 'button', props: { label: '3' } },
    ]);
    expect(codes(document, lookup)).toContain('doc/slot-capacity');
  });

  it('reports props failing the block schema, with zod paths', () => {
    const document = doc([
      { id: 'root', type: 'page', slots: { default: ['h1'] } },
      { id: 'h1', type: 'hero', props: { tone: 'neon', heading: '' } },
    ]);
    const errors = validateDocument(document, lookup).filter(
      (error) => error.code === 'doc/invalid-props',
    );
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors[0]?.path?.slice(0, 3)).toEqual(['nodes', 'h1', 'props']);
  });

  it('validates responsive overrides against the partial props schema (Law R stays value-only)', () => {
    const document = doc([
      { id: 'root', type: 'page', slots: { default: ['h1'] } },
      {
        id: 'h1',
        type: 'hero',
        props: { tone: 'light', heading: 'ok' },
        responsive: { mobile: { tone: 'ultraviolet' } },
      },
    ]);
    expect(codes(document, lookup)).toContain('doc/invalid-props');
  });

  it('rejects raw style literals through the registry-aware pass', () => {
    const document = doc([
      { id: 'root', type: 'page', slots: { default: ['h1'] } },
      { id: 'h1', type: 'hero', props: { tone: 'light', heading: 'use #ff0000 here' } },
    ]);
    expect(codes(document, lookup)).toContain('doc/raw-style-literal');
  });
});
