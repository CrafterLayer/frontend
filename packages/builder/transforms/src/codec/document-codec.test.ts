import { describe, expect, it } from 'vitest';

import type { BuilderDocument, Node, Patch } from '@craftkit/builder-schema';

import { canonicalJson } from './canonical-json';
import {
  parseDocument,
  parseScope,
  projectDocument,
  projectScope,
  type CodecPorts,
} from './document-codec';
import { scopedProjection } from './scope';

const KNOWN_TYPES = new Set(['page', 'hero', 'section', 'text']);
const ports: CodecPorts = { blockExists: (type) => KNOWN_TYPES.has(type) };

const fixture = (): BuilderDocument => ({
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: {
      id: 'root',
      type: 'page',
      props: { title: 'Landing', locale: 'العربية' },
      slots: { default: ['hero', 'section'] },
    },
    hero: {
      id: 'hero',
      type: 'hero',
      props: { heading: 'Build 😀', weight: Number.MAX_SAFE_INTEGER },
      bindings: { heading: 'content.hero.title' },
      variantOf: 'hero.dark',
      responsive: {
        mobile: { heading: 'Mobile' },
        tablet: { heading: 'Tablet' },
      },
    },
    section: {
      id: 'section',
      type: 'section',
      props: { gap: 1.5 },
      slots: { default: ['first', 'second'] },
    },
    first: { id: 'first', type: 'text', props: { content: 'First' } },
    second: { id: 'second', type: 'text', props: { content: 'Second' } },
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNode = (value: unknown): value is Node =>
  isRecord(value) &&
  typeof value['id'] === 'string' &&
  typeof value['type'] === 'string' &&
  isRecord(value['props']);

const isDocument = (value: unknown): value is BuilderDocument =>
  isRecord(value) &&
  typeof value['schemaVersion'] === 'number' &&
  typeof value['surface'] === 'string' &&
  (value['dir'] === 'ltr' || value['dir'] === 'rtl') &&
  typeof value['rootId'] === 'string' &&
  isRecord(value['nodes']);

const copyNodes = (nodes: Record<string, Node>): Record<string, Node> => {
  const copy: Record<string, Node> = {};
  Object.setPrototypeOf(copy, null);
  for (const key of Object.keys(nodes)) {
    const node = nodes[key];
    if (node !== undefined) {
      Object.defineProperty(copy, key, {
        configurable: true,
        enumerable: true,
        value: node,
        writable: true,
      });
    }
  }
  return copy;
};

function applyCodecPatches(base: BuilderDocument, patches: Patch[]): BuilderDocument {
  let next = base;
  for (const patch of patches) {
    if (patch.path.length === 0 && patch.op === 'replace' && isDocument(patch.value)) {
      next = patch.value;
      continue;
    }
    const [head, id] = patch.path;
    if (
      patch.path.length === 1 &&
      (head === 'schemaVersion' || head === 'surface' || head === 'dir' || head === 'rootId') &&
      patch.op === 'replace'
    ) {
      next = { ...next, [head]: patch.value };
      continue;
    }
    if (head !== 'nodes' || typeof id !== 'string' || patch.path.length !== 2) {
      throw new Error('test helper received an unsupported patch path');
    }
    const nodes =
      patch.op === 'remove'
        ? copyNodes(Object.fromEntries(Object.entries(next.nodes).filter(([key]) => key !== id)))
        : copyNodes(next.nodes);
    if (patch.op === 'remove') {
      next = { ...next, nodes };
      continue;
    } else if (isNode(patch.value)) {
      Object.defineProperty(nodes, id, {
        configurable: true,
        enumerable: true,
        value: patch.value,
        writable: true,
      });
    } else {
      throw new Error('test helper received a node patch without a node value');
    }
    next = { ...next, nodes };
  }
  return next;
}

const lineContaining = (text: string, needle: string): number => {
  const index = text.split('\n').findIndex((line) => line.includes(needle));
  if (index < 0) throw new Error(`fixture line does not contain ${needle}`);
  return index + 1;
};

describe('document projection (US1)', () => {
  it('describes every document field, node, property, optional map, and slot relationship', () => {
    const doc = fixture();
    const before = canonicalJson(doc);
    const projection = projectDocument(doc);

    expect(projection.text).toBe(before);
    expect(projection.text).toContain('"schemaVersion": 1');
    expect(projection.text).toContain('"surface": "site"');
    expect(projection.text).toContain('"dir": "ltr"');
    expect(projection.text).toContain('"bindings"');
    expect(projection.text).toContain('"responsive"');
    expect(projection.text).toContain('"variantOf": "hero.dark"');
    expect(projection.text).toContain('"default": [\n          "first",\n          "second"');
    expect(canonicalJson(doc)).toBe(before);
  });

  it('narrows projection to the selected flat subtree without needing a kernel or dispatch port', () => {
    const doc = fixture();
    const projection = projectScope(doc, 'section');

    expect(projection.text).toContain('"envelope": 1');
    expect(projection.text).toContain('"rootId": "section"');
    expect(projection.text).toContain('"section"');
    expect(projection.text).toContain('"first"');
    expect(projection.text).toContain('"second"');
    expect(projection.text).not.toContain('"hero"');
  });

  it('makes runtime content with no JSON form explicit instead of silently dropping its key', () => {
    const doc = fixture();
    const root = doc.nodes['root'];
    if (root === undefined) throw new Error('fixture root missing');
    Object.defineProperty(root.props, 'broken-runtime-value', {
      enumerable: true,
      value: undefined,
    });

    expect(projectDocument(doc).text).toContain(
      '"broken-runtime-value": "[Unprojectable: undefined]"',
    );
  });
});

describe('parseDocument', () => {
  it('reproduces a projected document exactly against a different base', () => {
    const target = fixture();
    const base: BuilderDocument = { ...target, dir: 'rtl' };
    const result = parseDocument(projectDocument(target).text, base, ports);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patches).not.toHaveLength(0);
    expect(projectDocument(applyCodecPatches(base, result.patches)).text).toBe(
      projectDocument(target).text,
    );
  });

  it('preserves the difference between an absent optional map and a present-empty one', () => {
    const base = fixture();
    const first = base.nodes['first'];
    if (first === undefined) throw new Error('fixture child missing');
    const edited: BuilderDocument = {
      ...base,
      nodes: { ...base.nodes, first: { ...first, bindings: {} } },
    };
    const result = parseDocument(projectDocument(edited).text, base, ports);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const applied = applyCodecPatches(base, result.patches);
    expect(Object.hasOwn(applied.nodes['first'] ?? {}, 'bindings')).toBe(true);
    expect(applied.nodes['first']?.bindings).toEqual({});
  });

  it('returns an empty patch set when canonical text already equals the base', () => {
    const base = fixture();
    const result = parseDocument(projectDocument(base).text, base, ports);

    expect(result).toEqual({ ok: true, patches: [] });
  });

  it('canonicalises textual -0 before it can become a stored document value', () => {
    const base = fixture();
    const text = projectDocument(base).text.replace('"schemaVersion": 1', '"schemaVersion": -0');
    const result = parseDocument(text, base, ports);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const applied = applyCodecPatches(base, result.patches);
    expect(Object.is(applied.schemaVersion, -0)).toBe(false);
    expect(applied.schemaVersion).toBe(0);
  });

  it.each([
    ['bindings entry', { bindings: { content: 42 } }],
    ['responsive entry', { responsive: { mobile: [] } }],
    ['slot entry', { slots: { default: [42] } }],
  ])('rejects an invalid optional %s without constructing a partial node', (_name, mutation) => {
    const base = fixture();
    const first = base.nodes['first'];
    if (first === undefined) throw new Error('fixture child missing');
    const text = canonicalJson({
      ...base,
      nodes: { ...base.nodes, first: { ...first, ...mutation } },
    });
    const result = parseDocument(text, base, ports);

    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('patches');
  });

  it('returns every malformed-input failure as errors and never exposes partial patches', () => {
    for (const text of ['', '{', '{"nodes":', '[]', '{"schemaVersion": 1}']) {
      expect(() => parseDocument(text, fixture(), ports)).not.toThrow();
      const result = parseDocument(text, fixture(), ports);
      expect(result.ok).toBe(false);
      expect(result).not.toHaveProperty('patches');
      if (!result.ok) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.every((error) => error.line >= 1)).toBe(true);
      }
    }
  });

  it.each([
    [
      'a missing id',
      (doc: BuilderDocument) => {
        const node = doc.nodes['first'];
        if (node === undefined) throw new Error('fixture child missing');
        const value = { type: node.type, props: node.props };
        return { ...doc, nodes: { ...doc.nodes, first: value } };
      },
      '"first": {',
    ],
    [
      'an id that disagrees with its node-map key',
      (doc: BuilderDocument) => {
        const node = doc.nodes['first'];
        if (node === undefined) throw new Error('fixture child missing');
        return { ...doc, nodes: { ...doc.nodes, first: { ...node, id: 'invented' } } };
      },
      '"id": "invented"',
    ],
  ])('rejects %s at the offending token instead of inventing identity', (_name, mutate, needle) => {
    const text = canonicalJson(mutate(fixture()));
    const result = parseDocument(text, fixture(), ports);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.line === lineContaining(text, needle))).toBe(true);
      expect(result.errors.some((error) => /id|required/u.test(error.message))).toBe(true);
    }
  });

  it('reports an unregistered block type on the exact line carrying its value', () => {
    const doc = fixture();
    const first = doc.nodes['first'];
    if (first === undefined) throw new Error('fixture child missing');
    doc.nodes['first'] = { ...first, type: 'ghost' };
    const text = canonicalJson(doc);
    const result = parseDocument(text, fixture(), ports);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual({
        line: lineContaining(text, '"type": "ghost"'),
        message: 'Node "first" uses unregistered block type "ghost".',
      });
    }
  });

  it('is total when the registry lookup port itself refuses to answer', () => {
    const failingPorts: CodecPorts = {
      blockExists: () => {
        throw new Error('registry unavailable');
      },
    };
    const result = parseDocument(projectDocument(fixture()).text, fixture(), failingPorts);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.every((error) => error.line >= 1)).toBe(true);
      expect(result.errors[0]?.message).toContain('lookup failed');
    }
  });

  it('refuses unknown document and node fields explicitly rather than discarding them', () => {
    const doc = fixture();
    const value = {
      ...doc,
      futureDocumentField: true,
      nodes: {
        ...doc.nodes,
        first: { ...doc.nodes['first'], futureNodeField: 'not-yet-projectable' },
      },
    };
    const text = canonicalJson(value);
    const result = parseDocument(text, doc, ports);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.filter((error) => error.message.includes('no textual'))).toHaveLength(2);
    }
  });

  it('does not mistake inherited names for nodes when a hostile root id is absent', () => {
    const doc = fixture();
    const text = canonicalJson({ ...doc, rootId: 'toString' });
    const result = parseDocument(text, doc, ports);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.message.includes('does not exist'))).toBe(true);
    }
  });

  it('REFUSES reserved node ids and prop keys per line, without phantom prototype behaviour', () => {
    const nodes: Record<string, Node> = {};
    Object.defineProperty(nodes, '__proto__', {
      enumerable: true,
      value: {
        id: '__proto__',
        type: 'page',
        props: { constructor: 'data' },
        slots: { default: ['constructor'] },
      },
    });
    Object.defineProperty(nodes, 'constructor', {
      enumerable: true,
      value: { id: 'constructor', type: 'text', props: { __proto__: 'data' } },
    });
    const target: BuilderDocument = {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: '__proto__',
      nodes,
    };
    const base: BuilderDocument = { ...target, dir: 'rtl' };
    const text = projectDocument(target).text;
    const result = parseDocument(text, base, ports);

    // These keys were once round-tripped. They no longer may be: the kernel's
    // patch door refuses them as path segments, so a document holding one
    // projects to text whose patches can never be applied — `parse(project(d))`
    // would not reproduce `d`. Law J and the validator now refuse them, so the
    // accepted domain and the applicable domain are the same set again
    // (011 T033 review, second residual).
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    for (const error of result.errors) {
      // Every refusal still names a real line — the parser reports, it never throws.
      expect(error.line).toBeGreaterThanOrEqual(1);
      expect(error.line).toBeLessThanOrEqual(text.split('\n').length);
    }
    // The safety half is unchanged: reading hostile text pollutes nothing.
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('parseScope', () => {
  it('refuses unknown envelope versions with the exact one-based source line', () => {
    const text = '{\n  "envelope": 9,\n  "nodes": {},\n  "rootId": "section"\n}';
    const result = parseScope(text, fixture(), 'section', ports);

    expect(result).toMatchObject({ ok: false, errors: [{ line: 2 }] });
  });

  it('refuses a scope whose envelope root is not the selected node', () => {
    const text = canonicalJson({ ...scopedProjection(fixture(), 'section'), rootId: 'first' });
    const result = parseScope(text, fixture(), 'section', ports);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.message.includes('selected node'))).toBe(true);
    }
  });

  it('emits only subtree node patches and leaves every outside node byte-identical', () => {
    const base = fixture();
    const section = base.nodes['section'];
    const first = base.nodes['first'];
    if (section === undefined || first === undefined) throw new Error('scope fixture missing');
    const edited: BuilderDocument = {
      ...base,
      nodes: {
        ...base.nodes,
        section: { ...section, props: { gap: 2.5 }, slots: { default: ['second', 'first'] } },
        first: { ...first, props: { content: 'Edited' } },
      },
    };
    const result = parseScope(projectScope(edited, 'section').text, base, 'section', ports);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patches.length).toBeGreaterThan(0);
    expect(
      result.patches.every(
        (patch) =>
          patch.path[0] === 'nodes' &&
          (patch.path[1] === 'section' || patch.path[1] === 'first' || patch.path[1] === 'second'),
      ),
    ).toBe(true);
    const applied = applyCodecPatches(base, result.patches);
    expect(projectDocument(applied).text).toBe(projectDocument(edited).text);
    expect(canonicalJson(applied.nodes['root'])).toBe(canonicalJson(base.nodes['root']));
    expect(canonicalJson(applied.nodes['hero'])).toBe(canonicalJson(base.nodes['hero']));
  });

  it('adds and removes descendants while preserving the selected root identity', () => {
    const base = fixture();
    const section = base.nodes['section'];
    if (section === undefined) throw new Error('scope fixture missing');
    const edited: BuilderDocument = {
      ...base,
      nodes: {
        root: base.nodes['root'] ?? section,
        hero: base.nodes['hero'] ?? section,
        section: { ...section, slots: { default: ['first', 'third'] } },
        first: base.nodes['first'] ?? section,
        third: { id: 'third', type: 'text', props: { content: 'New' } },
      },
    };
    const result = parseScope(projectScope(edited, 'section').text, base, 'section', ports);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patches).toContainEqual({
      op: 'add',
      path: ['nodes', 'third'],
      value: edited.nodes['third'],
    });
    expect(result.patches).toContainEqual({ op: 'remove', path: ['nodes', 'second'] });
    expect(projectDocument(applyCodecPatches(base, result.patches)).text).toBe(
      projectDocument(edited).text,
    );
  });

  it('rejects any scoped node id already owned by content outside the subtree', () => {
    const base = fixture();
    const section = base.nodes['section'];
    const hero = base.nodes['hero'];
    if (section === undefined || hero === undefined) throw new Error('scope fixture missing');
    const envelope = {
      envelope: 1,
      rootId: 'section',
      nodes: {
        section: { ...section, slots: { default: ['hero'] } },
        hero,
      },
    };
    const result = parseScope(canonicalJson(envelope), base, 'section', ports);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.message.includes('outside'))).toBe(true);
      expect(result).not.toHaveProperty('patches');
    }
  });
});

describe('patch shape — node granularity (011 §5, found by the browser road)', () => {
  it('a one-property edit patches exactly that node — never the document root', () => {
    // The defect this pins: a root replace patch satisfies the non-vacuous
    // property gate (applying it DOES yield `edited`) while cloning the world
    // into every transaction — and the kernel's applyPatches door refuses
    // empty paths outright. Only a named shape assertion can hold this line.
    const base = fixture();
    const edited = structuredClone(base);
    const node = edited.nodes['first'];
    if (node === undefined) {
      throw new Error('fixture must contain first');
    }
    node.props['content'] = 'changed once';

    const parsed = parseDocument(projectDocument(edited).text, base, ports);
    if (!parsed.ok) {
      throw new Error('the edit must parse');
    }
    expect(parsed.patches).toHaveLength(1);
    expect(parsed.patches[0]?.path).toEqual(['nodes', 'first']);
    expect(parsed.patches.every((patch) => patch.path.length >= 1)).toBe(true);
  });
});
