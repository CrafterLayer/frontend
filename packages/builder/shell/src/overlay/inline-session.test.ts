import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  emptyRichText,
  richText,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { createInlineSession, inlineTargetOf } from './inline-session';

const NullRender: BlockRenderComponent = () => null;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'inline-session-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['heading', 'article', 'plain'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'heading',
          description: 'Heading',
          props: z.object({ text: z.string().default(''), tone: z.enum(['a', 'b']).default('a') }),
          inlineEditable: 'text',
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'article',
          description: 'Article',
          props: z.object({ body: richText().default(emptyRichText() as never) }),
          inlineEditable: 'body',
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'plain',
          description: 'Plain',
          props: z.object({ label: z.string().default('') }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['h1', 'a1', 'p1'] } },
    h1: { id: 'h1', type: 'heading', props: { text: 'Title', tone: 'a' } },
    a1: { id: 'a1', type: 'article', props: { body: emptyRichText() as never } },
    p1: { id: 'p1', type: 'plain', props: { label: 'no inline' } },
  },
};

const makeKernel = (): BuilderKernel =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('inl') },
  });

describe('inlineTargetOf', () => {
  it('resolves the declared property and its kind', () => {
    const kernel = makeKernel();
    expect(inlineTargetOf(kernel, 'h1')).toEqual({ propKey: 'text', kind: 'text' });
    expect(inlineTargetOf(kernel, 'a1')).toEqual({ propKey: 'body', kind: 'rich' });
  });

  it('is null for an undeclared block, an unknown type, and a missing node', () => {
    const kernel = makeKernel();
    expect(inlineTargetOf(kernel, 'p1')).toBeNull();
    expect(inlineTargetOf(kernel, 'root')).toBeNull();
    expect(inlineTargetOf(kernel, 'ghost')).toBeNull();
  });
});

describe('createInlineSession (009 contract §3)', () => {
  it('s1: entering dispatches NOTHING and reports the target', () => {
    const kernel = makeKernel();
    kernel.setSelection(['h1']);
    const session = createInlineSession(kernel);
    const before = kernel.transactions().length;

    expect(session.begin('h1')).toBe(true);
    expect(session.current()).toEqual({ nodeId: 'h1', propKey: 'text', kind: 'text' });
    expect(kernel.transactions().length).toBe(before);
    session.dispose();
  });

  it('s1: a block with no declaration is INERT — no session, no error', () => {
    const kernel = makeKernel();
    kernel.setSelection(['p1']);
    const session = createInlineSession(kernel);
    expect(session.begin('p1')).toBe(false);
    expect(session.current()).toBeNull();
    session.dispose();
  });

  it('s1: a repeated begin on the same node is idempotent (one session)', () => {
    const kernel = makeKernel();
    kernel.setSelection(['h1']);
    const session = createInlineSession(kernel);
    const seen: unknown[] = [];
    session.subscribe((next) => seen.push(next));

    session.begin('h1');
    session.begin('h1');
    expect(seen).toHaveLength(1); // the second gesture changed nothing
    session.dispose();
  });

  it('s2: ends on demand, idempotently, without dispatching', () => {
    const kernel = makeKernel();
    kernel.setSelection(['h1']);
    const session = createInlineSession(kernel);
    session.begin('h1');
    const before = kernel.transactions().length;

    session.end();
    session.end();
    expect(session.current()).toBeNull();
    expect(kernel.transactions().length).toBe(before);
    session.dispose();
  });

  it('s2: ends when the selection moves to ANOTHER node', () => {
    const kernel = makeKernel();
    kernel.setSelection(['h1']);
    const session = createInlineSession(kernel);
    session.begin('h1');

    kernel.setSelection(['a1']);
    expect(session.current()).toBeNull();
    session.dispose();
  });

  it('s2: ends when the edited node VANISHES beneath the caret', () => {
    const kernel = makeKernel();
    kernel.setSelection(['h1']);
    const session = createInlineSession(kernel);
    session.begin('h1');

    kernel.dispatch('removeNode', { id: 'h1' }, 'user');
    expect(session.current()).toBeNull();
    // …and the removal is the ONLY transaction: no trailing commit on the way out.
    expect(kernel.transactions()).toHaveLength(1);
    session.dispose();
  });

  it('s2: survives an unrelated document change', () => {
    const kernel = makeKernel();
    kernel.setSelection(['h1']);
    const session = createInlineSession(kernel);
    session.begin('h1');

    kernel.dispatch('setProp', { id: 'p1', key: 'label', value: 'other' }, 'user');
    expect(session.current()).toEqual({ nodeId: 'h1', propKey: 'text', kind: 'text' });
    session.dispose();
  });

  it('s3: subscribers see every transition, and dispose detaches everything', () => {
    const kernel = makeKernel();
    kernel.setSelection(['h1']);
    const session = createInlineSession(kernel);
    const seen: (string | null)[] = [];
    const off = session.subscribe((next) => seen.push(next?.nodeId ?? null));

    session.begin('h1');
    session.end();
    expect(seen).toEqual(['h1', null]);

    off();
    session.begin('h1');
    expect(seen).toEqual(['h1', null]); // unsubscribed

    session.dispose();
    kernel.setSelection(['a1']); // the store listener is gone — no throw, no work
    expect(session.current()).toBeNull();
  });
});
