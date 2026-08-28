import { describe, expect, it } from 'vitest';

import type { BuilderDocument, Node } from '@craftkit/builder-schema';

import { scopedProjection } from './scope';

const fixture = (): BuilderDocument => ({
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: {
      id: 'root',
      type: 'page',
      props: { title: 'Landing' },
      slots: { default: ['hero', 'section'] },
    },
    hero: { id: 'hero', type: 'hero', props: { heading: 'Hello' } },
    section: {
      id: 'section',
      type: 'section',
      props: {},
      slots: { default: ['paragraph'] },
    },
    paragraph: { id: 'paragraph', type: 'text', props: { content: 'Welcome' } },
  },
});

describe('scopedProjection', () => {
  it('returns the selected node and descendants as a flat versioned envelope', () => {
    const scope = scopedProjection(fixture(), 'section');

    expect(scope.envelope).toBe(1);
    expect(scope.rootId).toBe('section');
    expect(Object.keys(scope.nodes).sort()).toEqual(['paragraph', 'section']);
    expect(scope.nodes['section']?.slots?.['default']).toEqual(['paragraph']);
    expect(Object.getPrototypeOf(scope.nodes)).toBeNull();
  });

  it('narrows a leaf to exactly one node and a document root to the full map', () => {
    expect(Object.keys(scopedProjection(fixture(), 'paragraph').nodes)).toEqual(['paragraph']);
    expect(Object.keys(scopedProjection(fixture(), 'root').nodes).sort()).toEqual([
      'hero',
      'paragraph',
      'root',
      'section',
    ]);
  });

  it('retains dangling ids in their slot array instead of silently dropping the content', () => {
    const doc = fixture();
    doc.nodes['section'] = {
      ...doc.nodes['section'],
      slots: { default: ['missing-child'] },
    } as Node;

    const scope = scopedProjection(doc, 'section');
    expect(scope.nodes['section']?.slots?.['default']).toEqual(['missing-child']);
    expect(Object.keys(scope.nodes)).toEqual(['section']);
  });

  it('makes an unknown selected id explicit as the envelope root with an empty map', () => {
    expect(scopedProjection(fixture(), 'missing')).toEqual({
      envelope: 1,
      rootId: 'missing',
      nodes: {},
    });
  });

  it('terminates on a corrupt cycle and safely retains reserved-looking ids', () => {
    const nodes: Record<string, Node> = {};
    Object.defineProperty(nodes, '__proto__', {
      enumerable: true,
      value: {
        id: '__proto__',
        type: 'page',
        props: {},
        slots: { default: ['constructor'] },
      },
    });
    Object.defineProperty(nodes, 'constructor', {
      enumerable: true,
      value: {
        id: 'constructor',
        type: 'page',
        props: {},
        slots: { default: ['__proto__'] },
      },
    });
    const doc: BuilderDocument = {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: '__proto__',
      nodes,
    };

    expect(Object.keys(scopedProjection(doc, '__proto__').nodes).sort()).toEqual([
      '__proto__',
      'constructor',
    ]);
  });
});
