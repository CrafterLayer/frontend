import { describe, expect, it } from 'vitest';

import type { CustomCodeNode } from '@craftkit/builder-schema';

import {
  elementPayload,
  elementPayloadFromValue,
  parseElementPayload,
  serializeElementPayload,
} from './element-drag-payload';

const node: CustomCodeNode = {
  kind: 'element',
  tag: 'section',
  className: 'p-4 ck-card',
  children: [{ kind: 'element', tag: 'h2', text: 'Our story' }],
};

describe('element payload codec', () => {
  it('round-trips a node and its css through wire text', () => {
    const payload = elementPayload(node, '.ck-card{border-radius:12px}');
    const text = serializeElementPayload(payload);
    expect(JSON.parse(text)).toEqual({ craftkit: 'tree-node', v: 1, node, css: '.ck-card{border-radius:12px}' });
    expect(parseElementPayload(text)).toEqual(payload);
  });

  it('deep-copies the node and drops empty css', () => {
    const payload = elementPayload(node, '  ');
    expect(payload.node).toEqual(node);
    expect(payload.node).not.toBe(node);
    expect('css' in payload).toBe(false);
  });

  it('refuses anything that is not a valid v1 tree-node payload', () => {
    expect(parseElementPayload('hello')).toBeUndefined();
    expect(parseElementPayload('{not json')).toBeUndefined();
    expect(parseElementPayload(JSON.stringify({ craftkit: 'tree-node', v: 2, node }))).toBeUndefined();
    expect(parseElementPayload(JSON.stringify({ craftkit: 'other', v: 1, node }))).toBeUndefined();
    expect(parseElementPayload(JSON.stringify({ craftkit: 'tree-node', v: 1, node, extra: true }))).toBeUndefined();
    expect(parseElementPayload(JSON.stringify({ craftkit: 'tree-node', v: 1, node, css: 3 }))).toBeUndefined();
    // The tree door: a script tag and a handler attribute never travel.
    expect(
      parseElementPayload(JSON.stringify({ craftkit: 'tree-node', v: 1, node: { kind: 'element', tag: 'script' } })),
    ).toBeUndefined();
    expect(
      elementPayloadFromValue({
        craftkit: 'tree-node',
        v: 1,
        node: { kind: 'element', tag: 'button', attributes: { onclick: 'x()' } },
      }),
    ).toBeUndefined();
    expect(elementPayloadFromValue(null)).toBeUndefined();
    expect(elementPayloadFromValue([node])).toBeUndefined();
  });
});
