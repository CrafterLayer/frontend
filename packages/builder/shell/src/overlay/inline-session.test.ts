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
          slots: { default: { allow: ['heading', 'article', 'plain', 'card'] } },
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
      // ── block-parts (2026-10-06) ──
      {
        schema: defineBlockSchema({
          type: 'card',
          description: 'Card with parts',
          props: z.object({
            heading: z.string().default('Card'),
            body: z.string().default(''),
            content: richText().default(emptyRichText() as never),
            link: z.object({ label: z.string(), href: z.string() }).default({ label: 'Go', href: '#' }),
            imageSrc: z.string().default(''),
            items: z.array(z.object({ title: z.string() })).default([]),
            note: z.string().optional(),
          }),
          inlineEditable: 'heading',
          parts: {
            heading: { kind: 'text', bind: 'heading', label: { en: 'Heading', ar: 'العنوان' } },
            body: { kind: 'text', bind: 'body', multiline: true, label: { en: 'Body', ar: 'النص' } },
            content: { kind: 'rich', bind: 'content', label: { en: 'Content', ar: 'المحتوى' } },
            cta: {
              kind: 'link',
              bind: { text: 'link.label', href: 'link.href' },
              label: { en: 'Link', ar: 'الرابط' },
            },
            image: { kind: 'image', bind: { src: 'imageSrc' }, label: { en: 'Image', ar: 'الصورة' } },
            items: { kind: 'list', bind: 'items', label: { en: 'Items', ar: 'العناصر' } },
            item: { kind: 'item', bind: 'items.*', list: 'items', label: { en: 'Item', ar: 'العنصر' } },
            'item.title': {
              kind: 'text',
              bind: 'items.*.title',
              label: { en: 'Item title', ar: 'عنوان العنصر' },
            },
            note: { kind: 'text', bind: 'note', label: { en: 'Note', ar: 'ملاحظة' } },
            frame: { kind: 'box', label: { en: 'Frame', ar: 'الإطار' } },
          },
          examples: [],
        }),
        render: NullRender,
      },
      // ── /block-parts ──
    ],
  },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['h1', 'a1', 'p1', 'c1'] } },
    h1: { id: 'h1', type: 'heading', props: { text: 'Title', tone: 'a' } },
    a1: { id: 'a1', type: 'article', props: { body: emptyRichText() as never } },
    p1: { id: 'p1', type: 'plain', props: { label: 'no inline' } },
    c1: {
      id: 'c1',
      type: 'card',
      props: {
        heading: 'Card title',
        body: 'Line one',
        content: emptyRichText() as never,
        link: { label: 'Read more', href: '/docs' },
        imageSrc: '/a.png',
        items: [{ title: 'One' }, { title: 'اثنان' }, { title: 'Three' }],
      },
    },
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

  it('consumes exactly one popup, text edit, parent and clear layer per Escape', () => {
    const kernel = makeKernel();
    kernel.setSelection(['h1']);
    const session = createInlineSession(kernel);
    expect(session.begin('h1')).toBe(true);
    let popupOpen = true;
    let hasParent = true;
    let selected = true;
    const layers = {
      closePopup: () => {
        if (!popupOpen) return false;
        popupOpen = false;
        return true;
      },
      selectParent: () => {
        if (!hasParent) return false;
        hasParent = false;
        return true;
      },
      clearSelection: () => {
        if (!selected) return false;
        selected = false;
        return true;
      },
    };

    expect(session.escape(layers)).toBe('popup');
    expect(session.current()).not.toBeNull();
    expect(session.escape(layers)).toBe('text-edit');
    expect(session.escape(layers)).toBe('parent');
    expect(session.escape(layers)).toBe('clear');
    expect(session.escape(layers)).toBe('none');
    session.dispose();
  });
});

// ── block-parts (2026-10-06) ──
describe('createInlineSession with a block part (block-parts DESIGN §2.8)', () => {
  const part = (name: string, ...index: number[]) => ({ part: name, index });

  it('resolves kind, top-level key, bind and singleLine from the part declaration', () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const session = createInlineSession(kernel);
    const before = kernel.transactions().length;

    expect(session.begin('c1', part('heading'))).toBe(true);
    expect(session.current()).toEqual({
      nodeId: 'c1',
      propKey: 'heading',
      bind: 'heading',
      kind: 'text',
      part: part('heading'),
      singleLine: true,
    });

    expect(session.begin('c1', part('item.title', 1))).toBe(true);
    expect(session.current()).toEqual({
      nodeId: 'c1',
      propKey: 'items',
      bind: 'items.1.title',
      kind: 'text',
      part: part('item.title', 1),
      singleLine: true,
    });

    // multiline text → Shift+Enter inserts a line feed
    expect(session.begin('c1', part('body'))).toBe(true);
    expect(session.current()?.singleLine).toBe(false);

    // rich → the rich surface
    expect(session.begin('c1', part('content'))).toBe(true);
    expect(session.current()).toMatchObject({ kind: 'rich', propKey: 'content', bind: 'content' });

    // a link edits its visible LABEL as plain text
    expect(session.begin('c1', part('cta'))).toBe(true);
    expect(session.current()).toMatchObject({ kind: 'text', propKey: 'link', bind: 'link.label' });

    // opening sessions is view state: nothing was dispatched
    expect(kernel.transactions().length).toBe(before);
    session.dispose();
  });

  it('is inert for image, list, item, box, undeclared and absent parts', () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const session = createInlineSession(kernel);
    for (const ref of [
      part('image'),
      part('items'),
      part('item', 0),
      part('frame'),
      part('nope'),
      part('note'), // optional and unset: no instance to edit
      part('item.title', 9), // out of range
      part('item.title'), // missing index
    ]) {
      expect(session.begin('c1', ref)).toBe(false);
    }
    expect(session.current()).toBeNull();
    expect(session.begin('ghost', part('heading'))).toBe(false);
    expect(session.begin('h1', part('heading'))).toBe(false); // the heading block declares no parts
    session.dispose();
  });

  it('the same ref is idempotent; a different ref REPLACES the session', () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const session = createInlineSession(kernel);
    const seen: (string | undefined)[] = [];
    session.subscribe((next) => seen.push(next?.bind));

    session.begin('c1', part('item.title', 0));
    session.begin('c1', part('item.title', 0));
    expect(seen).toEqual(['items.0.title']);

    session.begin('c1', part('item.title', 2));
    expect(seen).toEqual(['items.0.title', 'items.2.title']);
    session.dispose();
  });

  it('without a ref, falls back to inlineEditable exactly as before', () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const session = createInlineSession(kernel);
    expect(session.begin('c1')).toBe(true);
    expect(session.current()).toEqual({ nodeId: 'c1', propKey: 'heading', kind: 'text' });
    expect(inlineTargetOf(kernel, 'c1')).toEqual({ propKey: 'heading', kind: 'text' });
    session.dispose();
  });

  it('ends when part focus moves to ANOTHER part of the same node, not on the same one', () => {
    const kernel = makeKernel();
    kernel.focusPart('c1', part('item.title', 1));
    const session = createInlineSession(kernel);
    session.begin('c1', part('item.title', 1));

    kernel.focusPart('c1', part('item.title', 1)); // same part again
    expect(session.current()?.bind).toBe('items.1.title');

    kernel.clearPartFocus(); // no part focused is not a move
    expect(session.current()?.bind).toBe('items.1.title');

    kernel.focusPart('c1', part('item.title', 2));
    expect(session.current()).toBeNull();
    session.dispose();
  });

  it('ends when the edited item VANISHES (an undo or a removal) and commits nothing', () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const session = createInlineSession(kernel);
    session.begin('c1', part('item.title', 2));

    kernel.dispatch('setProp', { id: 'c1', key: 'items', value: [{ title: 'One' }] }, 'user');
    expect(session.current()).toBeNull();
    expect(kernel.transactions()).toHaveLength(1);
    session.dispose();
  });

  it('survives an edit to a sibling item', () => {
    const kernel = makeKernel();
    kernel.setSelection(['c1']);
    const session = createInlineSession(kernel);
    session.begin('c1', part('item.title', 0));
    kernel.dispatch(
      'setProp',
      { id: 'c1', key: 'items', value: [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }] },
      'user',
    );
    expect(session.current()?.bind).toBe('items.0.title');
    session.dispose();
  });
});
// ── /block-parts ──
