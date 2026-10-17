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
  type PartRef,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { createInlineSession, type InlineSession } from './inline-session';
import { partInlineCommit } from './part-inline';

const NullRender: BlockRenderComponent = () => null;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'part-inline-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['card'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'card',
          description: 'Card with parts',
          props: z.object({
            heading: z.string().min(1).max(40).default('Card'),
            content: richText().default(emptyRichText() as never),
            link: z
              .object({ label: z.string(), href: z.string() })
              .default({ label: 'Go', href: '#' }),
            items: z.array(z.object({ title: z.string(), body: z.string() })).default([]),
          }),
          parts: {
            heading: { kind: 'text', bind: 'heading', label: { en: 'Heading', ar: 'العنوان' } },
            content: { kind: 'rich', bind: 'content', label: { en: 'Content', ar: 'المحتوى' } },
            cta: {
              kind: 'link',
              bind: { text: 'link.label', href: 'link.href' },
              label: { en: 'Link', ar: 'الرابط' },
            },
            items: { kind: 'list', bind: 'items', label: { en: 'Items', ar: 'العناصر' } },
            'item.title': {
              kind: 'text',
              bind: 'items.*.title',
              label: { en: 'Item title', ar: 'عنوان العنصر' },
            },
          },
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

const ITEMS = [
  { title: 'One', body: 'First' },
  { title: 'اثنان', body: 'Second' },
  { title: 'Three', body: 'Third' },
];

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'rtl',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['c1'] } },
    c1: {
      id: 'c1',
      type: 'card',
      props: {
        heading: 'Card title',
        content: emptyRichText() as never,
        link: { label: 'Read more', href: '/docs' },
        items: ITEMS,
      },
    },
  },
};

const makeKernel = (): BuilderKernel =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('pin') },
  });

/** Open a real part session the way the canvas does: focus the part, then begin. */
function open(kernel: BuilderKernel, ref: PartRef): InlineSession {
  kernel.focusPart('c1', ref);
  const handle = createInlineSession(kernel);
  if (!handle.begin('c1', ref)) {
    throw new Error(`the part "${ref.part}" must open an inline session`);
  }
  const session = handle.current();
  handle.dispose();
  if (session === null) {
    throw new Error('the session must be open');
  }
  return session;
}

const props = (kernel: BuilderKernel) => kernel.getDocument().nodes['c1']?.props ?? {};

describe('partInlineCommit (block-parts DESIGN §2.8)', () => {
  it('writes EXACTLY one labelled transaction, and one Undo restores the value', () => {
    const kernel = makeKernel();
    const session = open(kernel, { part: 'heading', index: [] });

    expect(partInlineCommit(kernel, session, 'Welcome')).toEqual({ ok: true, changed: true });
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('Edit text · Card heading');
    expect(props(kernel)['heading']).toBe('Welcome');

    expect(kernel.undo()).toBe(true);
    expect(props(kernel)['heading']).toBe('Card title');
  });

  it('a nested item title replaces ONE top-level setProp; siblings keep their values', () => {
    const kernel = makeKernel();
    const session = open(kernel, { part: 'item.title', index: [1] });
    expect(session.bind).toBe('items.1.title');

    expect(partInlineCommit(kernel, session, 'اثنان معدّل').ok).toBe(true);
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('Edit text · Card item title 2');
    expect(props(kernel)['items']).toEqual([
      { title: 'One', body: 'First' },
      { title: 'اثنان معدّل', body: 'Second' },
      { title: 'Three', body: 'Third' },
    ]);

    kernel.undo();
    expect(props(kernel)['items']).toEqual(ITEMS);
  });

  it('Arabic and English values both commit as typed', () => {
    const kernel = makeKernel();
    const session = open(kernel, { part: 'heading', index: [] });
    partInlineCommit(kernel, session, 'مرحبا بالعالم');
    expect(props(kernel)['heading']).toBe('مرحبا بالعالم');
    partInlineCommit(kernel, session, 'Your site grows.');
    expect(props(kernel)['heading']).toBe('Your site grows.');
    expect(kernel.transactions()).toHaveLength(2);
  });

  it('a link part edits its visible label, never its href', () => {
    const kernel = makeKernel();
    const session = open(kernel, { part: 'cta', index: [] });
    expect(partInlineCommit(kernel, session, 'اقرأ التوثيق').ok).toBe(true);
    expect(props(kernel)['link']).toEqual({ label: 'اقرأ التوثيق', href: '/docs' });
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('a rich part commits a rich-text document as one transaction', () => {
    const kernel = makeKernel();
    const session = open(kernel, { part: 'content', index: [] });
    expect(session.kind).toBe('rich');
    const next = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Every edit becomes one Undo.' }] }],
    };
    expect(partInlineCommit(kernel, session, next)).toEqual({ ok: true, changed: true });
    expect(props(kernel)['content']).toEqual(next);
    expect(kernel.transactions()).toHaveLength(1);
  });

  // ── block-parts (2026-10-06) ──
  it('SKIPS a rich commit that only differs by key order or the editor\'s dir:auto stamps', () => {
    const kernel = makeKernel();
    const session = open(kernel, { part: 'content', index: [] });
    const stored = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Why it holds' }] }],
    };
    expect(partInlineCommit(kernel, session, stored)).toEqual({ ok: true, changed: true });
    const echoed = {
      content: [{ attrs: { dir: 'auto' }, content: [{ text: 'Why it holds', type: 'text' }], type: 'paragraph' }],
      type: 'doc',
    };
    expect(partInlineCommit(kernel, session, echoed)).toEqual({ ok: true, changed: false });
    expect(kernel.transactions()).toHaveLength(1);
    // An explicit direction is a real change.
    const ltr = { ...echoed, content: [{ ...echoed.content[0], attrs: { dir: 'ltr' } }] };
    expect(partInlineCommit(kernel, session, ltr)).not.toEqual({ ok: true, changed: false });
  });
  // ── /block-parts ──

  it('SKIPS the commit when the value is unchanged — no empty Undo', () => {
    const kernel = makeKernel();
    const session = open(kernel, { part: 'item.title', index: [0] });
    expect(partInlineCommit(kernel, session, 'One')).toEqual({ ok: true, changed: false });
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('returns the door refusal as a message and leaves the document untouched', () => {
    const kernel = makeKernel();
    const session = open(kernel, { part: 'heading', index: [] });

    const empty = partInlineCommit(kernel, session, ''); // heading is .min(1)
    expect(empty.ok).toBe(false);
    expect(empty.ok ? '' : empty.message).not.toBe('');

    const notText = partInlineCommit(kernel, session, 42);
    expect(notText.ok).toBe(false);

    expect(kernel.transactions()).toHaveLength(0);
    expect(props(kernel)['heading']).toBe('Card title');
  });

  it('refuses a session that is not a part, and a block that is gone', () => {
    const kernel = makeKernel();
    expect(
      partInlineCommit(kernel, { nodeId: 'c1', propKey: 'heading', kind: 'text' }, 'x').ok,
    ).toBe(false);

    const session = open(kernel, { part: 'heading', index: [] });
    kernel.dispatch('removeNode', { id: 'c1' }, 'user');
    expect(partInlineCommit(kernel, session, 'x').ok).toBe(false);
    expect(kernel.transactions()).toHaveLength(1); // only the removal
  });
});
