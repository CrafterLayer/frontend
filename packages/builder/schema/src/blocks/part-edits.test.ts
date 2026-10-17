import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import type { Node } from '../document/types';
import { richText } from '../rich-text/rich-text';
import { propSchemaAt, type BlockParts } from './block-parts';
import { planPartDir, planPartListOp, planPartStyle, planPartValue, type PartPlan } from './part-edits';
import { partStylesProp } from './part-styles';

const label = (en: string, ar: string) => ({ en, ar });

const itemSchema = z.object({ title: z.string().default('New item'), body: z.string().optional() });
const props = z.object({
  heading: z.string(),
  content: richText().optional(),
  items: z.array(itemSchema).default([]),
  link: z.object({ label: z.string(), href: z.string() }).optional(),
  imageSrc: z.string().optional(),
  partStyles: partStylesProp(),
});

const parts: BlockParts = {
  heading: { kind: 'text', bind: 'heading', label: label('Heading', 'العنوان') },
  content: { kind: 'rich', bind: 'content', label: label('Content', 'المحتوى') },
  items: { kind: 'list', bind: 'items', label: label('Items', 'العناصر') },
  item: { kind: 'item', bind: 'items.*', list: 'items', label: label('Item', 'العنصر') },
  'item.title': { kind: 'text', bind: 'items.*.title', label: label('Item title', 'عنوان العنصر') },
  link: { kind: 'link', bind: { text: 'link.label', href: 'link.href' }, label: label('Link', 'الرابط') },
  image: { kind: 'image', bind: { src: 'imageSrc' }, label: label('Image', 'الصورة') },
  frame: { kind: 'box', label: label('Frame', 'الإطار') },
};

function hero(extra: Record<string, unknown> = {}): Node {
  return {
    id: 'h1',
    type: 'demo',
    props: {
      heading: 'Welcome',
      items: [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }],
      link: { label: 'Read', href: '/docs' },
      ...extra,
    },
  };
}

function ok(plan: PartPlan) {
  if (!plan.ok) throw new Error(`expected a plan, got: ${plan.message}`);
  expect(plan.steps).toHaveLength(1);
  const [step] = plan.steps;
  if (step === undefined) throw new Error('no step');
  expect(step.command).toBe('setProp');
  return { step: step.args, label: plan.label };
}

function refused(plan: PartPlan): string {
  if (plan.ok) throw new Error(`expected a refusal, got: ${plan.label}`);
  expect(plan.message).toContain(' · ');
  return plan.message;
}

describe('planPartValue', () => {
  it('writes a top-level text as one setProp with the history label', () => {
    const { step, label: text } = ok(planPartValue(hero(), parts, { part: 'heading', index: [] }, 'text', 'مرحبا', 'Hero'));
    expect(step).toEqual({ id: 'h1', key: 'heading', value: 'مرحبا' });
    expect(text).toBe('Edit text · Hero heading');
  });

  // ── block-parts (2026-10-06) ──
  it('never repeats the part word the block name already ends with', () => {
    expect(ok(planPartValue(hero(), parts, { part: 'heading', index: [] }, 'text', 'x', 'Big Heading')).label).toBe(
      'Edit text · Big Heading',
    );
  });
  // ── /block-parts ──

  it('writes a nested item value as ONE setProp of the top-level key, sharing the other items', () => {
    const node = hero();
    const { step, label: text } = ok(planPartValue(node, parts, { part: 'item.title', index: [1] }, 'text', 'Deux', 'Features'));
    expect(step.key).toBe('items');
    expect(step.value).toEqual([{ title: 'One' }, { title: 'Deux' }, { title: 'Three' }]);
    const items = node.props['items'] as unknown[];
    expect((step.value as unknown[])[0]).toBe(items[0]);
    expect(text).toBe('Edit text · Features item title 2');
  });

  it('writes link text and href, and image src', () => {
    expect(ok(planPartValue(hero(), parts, { part: 'link', index: [] }, 'href', '/start', 'Hero')).step).toEqual({
      id: 'h1',
      key: 'link',
      value: { label: 'Read', href: '/start' },
    });
    expect(ok(planPartValue(hero(), parts, { part: 'link', index: [] }, 'text', 'Go', 'Hero')).label).toBe(
      'Edit text · Hero link',
    );
    expect(ok(planPartValue(hero(), parts, { part: 'image', index: [] }, 'src', '/a.png', 'Hero')).step).toEqual({
      id: 'h1',
      key: 'imageSrc',
      value: '/a.png',
    });
  });

  it('accepts a rich-text document for a rich part and refuses a string', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }] };
    expect(ok(planPartValue(hero(), parts, { part: 'content', index: [] }, 'text', doc, 'Rich')).step.key).toBe('content');
    expect(refused(planPartValue(hero(), parts, { part: 'content', index: [] }, 'text', 'Hi', 'Rich'))).toContain(
      'rich-text document',
    );
  });

  it('refuses an unknown part, a wrong slot, a missing item, a wrong index and a non-string', () => {
    expect(refused(planPartValue(hero(), parts, { part: 'subtitle', index: [] }, 'text', 'x', 'Hero'))).toContain(
      'send one of: heading',
    );
    expect(refused(planPartValue(hero(), parts, { part: 'heading', index: [] }, 'href', '/x', 'Hero'))).toContain(
      'no href',
    );
    expect(refused(planPartValue(hero(), parts, { part: 'frame', index: [] }, 'text', 'x', 'Hero'))).toContain(
      'holds no value',
    );
    expect(refused(planPartValue(hero(), parts, { part: 'item.title', index: [7] }, 'text', 'x', 'Hero'))).toContain(
      'does not exist',
    );
    expect(refused(planPartValue(hero(), parts, { part: 'item.title', index: [] }, 'text', 'x', 'Hero'))).toContain(
      'index',
    );
    expect(refused(planPartValue(hero(), parts, { part: 'heading', index: [] }, 'text', 4, 'Hero'))).toContain(
      'must be text',
    );
    expect(refused(planPartValue(hero(), parts, { part: 'image', index: [] }, 'alt', 'x', 'Hero'))).toContain(
      'no alt',
    );
  });
});

describe('planPartListOp', () => {
  const items = (plan: PartPlan) => ok(plan).step.value as { title: string }[];
  const item = (index: number) => ({ part: 'item', index: [index] });

  it('adds from the item schema defaults', () => {
    const plan = planPartListOp(hero(), parts, { part: 'items', index: [] }, { kind: 'add', at: 3 }, 'Features', propSchemaAt(props, 'items.*'));
    expect(items(plan).map((entry) => entry.title)).toEqual(['One', 'Two', 'Three', 'New item']);
    expect(ok(plan).label).toBe('Add item · Features');
  });

  it('adds a clone of the neighbour without a schema, and an explicit item when sent', () => {
    expect(items(planPartListOp(hero(), parts, item(0), { kind: 'add', at: 1 }, 'Features')).map((entry) => entry.title)).toEqual(
      ['One', 'One', 'Two', 'Three'],
    );
    expect(
      items(planPartListOp(hero(), parts, item(0), { kind: 'add', at: 0, item: { title: 'Zero' } }, 'Features')).map(
        (entry) => entry.title,
      ),
    ).toEqual(['Zero', 'One', 'Two', 'Three']);
  });

  it('duplicates as a deep copy, removes and moves', () => {
    const node = hero();
    const duplicated = items(planPartListOp(node, parts, item(1), { kind: 'duplicate', at: 1 }, 'Features'));
    expect(duplicated.map((entry) => entry.title)).toEqual(['One', 'Two', 'Two', 'Three']);
    expect(duplicated[2]).not.toBe((node.props['items'] as unknown[])[1]);
    expect(items(planPartListOp(node, parts, item(1), { kind: 'remove', at: 1 }, 'Features')).map((entry) => entry.title)).toEqual(
      ['One', 'Three'],
    );
    const moved = planPartListOp(node, parts, item(0), { kind: 'move', from: 0, to: 2 }, 'Features');
    expect(items(moved).map((entry) => entry.title)).toEqual(['Two', 'Three', 'One']);
    expect(ok(moved).label).toBe('Move item · Features');
    expect(ok(planPartListOp(node, parts, item(1), { kind: 'remove', at: 1 }, 'Features')).label).toBe(
      'Remove item · Features',
    );
  });

  it('refuses out-of-range positions, non-list parts and an empty list with nothing to copy', () => {
    expect(refused(planPartListOp(hero(), parts, item(0), { kind: 'remove', at: 3 }, 'Features'))).toContain('does not exist');
    expect(refused(planPartListOp(hero(), parts, item(0), { kind: 'add', at: 9 }, 'Features'))).toContain('outside the list');
    expect(refused(planPartListOp(hero(), parts, item(0), { kind: 'move', from: 0, to: 3 }, 'Features'))).toContain('inside the list');
    expect(refused(planPartListOp(hero(), parts, { part: 'heading', index: [] }, { kind: 'remove', at: 0 }, 'Features'))).toContain(
      'not a list',
    );
    expect(
      refused(planPartListOp(hero({ items: [] }), parts, { part: 'items', index: [] }, { kind: 'add', at: 0 }, 'Features')),
    ).toContain('send the new item');
  });
});

describe('planPartStyle', () => {
  const padding = {
    property: 'padding',
    value: { kind: 'token', token: '4' },
    bucket: 'base',
    state: 'default',
    side: 'inline-start',
  } as const;

  it('writes the classes into partStyles at the scope key through the tokens engine', () => {
    const all = ok(planPartStyle(hero(), props, { part: 'item.title', index: [1] }, 'all', [padding], 'Features'));
    expect(all.step.key).toBe('partStyles');
    expect(all.step.value).toEqual({ 'item.title': { className: 'ps-4' } });
    expect(all.label).toBe('Padding · Features item title');

    const one = ok(planPartStyle(hero(), props, { part: 'item.title', index: [1] }, 'this', [padding], 'Features'));
    expect(one.step.value).toEqual({ 'item.title@1': { className: 'ps-4' } });
    expect(one.label).toBe('Padding · Features item title 2');
  });

  it('keeps the other entries and a stored direction', () => {
    const node = hero({ partStyles: { heading: { dir: 'ltr' }, body: { className: 'p-2' } } });
    expect(ok(planPartStyle(node, props, { part: 'heading', index: [] }, 'all', [padding], 'Hero')).step.value).toEqual({
      heading: { dir: 'ltr', className: 'ps-4' },
      body: { className: 'p-2' },
    });
  });

  it('refuses palette colours (tokens law), an empty request, and a block without partStyles', () => {
    const palette = {
      property: 'backgroundColor',
      value: { kind: 'raw', css: '#ff0000' },
      bucket: 'base',
      state: 'default',
    } as const;
    refused(planPartStyle(hero(), props, { part: 'heading', index: [] }, 'all', [palette], 'Hero'));
    expect(refused(planPartStyle(hero(), props, { part: 'heading', index: [] }, 'all', [], 'Hero'))).toContain('no style change');
    expect(
      refused(planPartStyle(hero(), z.object({ heading: z.string() }), { part: 'heading', index: [] }, 'all', [padding], 'Hero')),
    ).toContain('partStylesProp()');
  });
});

describe('planPartDir', () => {
  it('sets and clears one instance direction, dropping an emptied entry', () => {
    const set = ok(planPartDir(hero(), props, { part: 'item.title', index: [2] }, 'ltr', 'Features'));
    expect(set.step).toEqual({ id: 'h1', key: 'partStyles', value: { 'item.title@2': { dir: 'ltr' } } });
    expect(set.label).toBe('Direction · Features item title 3');

    const node = hero({ partStyles: { heading: { dir: 'rtl' }, body: { className: 'p-2', dir: 'ltr' } } });
    expect(ok(planPartDir(node, props, { part: 'heading', index: [] }, null, 'Hero')).step.value).toEqual({
      body: { className: 'p-2', dir: 'ltr' },
    });
  });
});
