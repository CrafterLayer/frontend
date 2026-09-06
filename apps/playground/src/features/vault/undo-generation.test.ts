import {
  codeViewExtension,
  createBuilder,
  type BuilderDocument,
  type BuilderKernel,
} from '@craftkit/builder';
import { fixedClock, fixtureBlocks, seededIds } from '@craftkit/builder/testing';
import { describe, expect, it } from 'vitest';

import { undoGeneration, undoSection } from './undo-generation';

/** A page as it stood BEFORE a run: one section the person already had. */
function pageBefore(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['mine'] } },
      mine: { id: 'mine', type: 'text', props: { content: 'What I wrote myself' } },
    },
  } as unknown as BuilderDocument;
}

const kernelWith = (document: BuilderDocument, seed: string): BuilderKernel =>
  createBuilder({
    document,
    extensions: [fixtureBlocks, codeViewExtension],
    ports: { clock: fixedClock(), ids: seededIds(seed) },
  });

/** The run: it rewrote the person's section and added two of its own. */
function afterARun(kernel: BuilderKernel): void {
  kernel.dispatchGroup(
    [
      { command: 'setProp', args: { id: 'mine', key: 'content', value: 'Rewritten by the run' } },
      { command: 'insertNode', args: { type: 'text', parentId: 'root' } },
      { command: 'insertNode', args: { type: 'text', parentId: 'root' } },
    ],
    { author: 'ai', label: 'AI: three sections' },
  );
}

const contentOf = (kernel: BuilderKernel, id: string): unknown =>
  kernel.getDocument().nodes[id]?.props['content'];

const childrenOf = (kernel: BuilderKernel): readonly string[] =>
  kernel.getDocument().nodes['root']?.slots?.['default'] ?? [];

describe('undoGeneration', () => {
  it('restores the state before the run, in ONE transaction', () => {
    const before = pageBefore();
    const kernel = kernelWith(before, 'live');
    afterARun(kernel);
    const transactions = kernel.transactions().length;

    expect(undoGeneration(kernel, before, { label: 'Undo the generation' })).toEqual({
      ok: true,
      changed: true,
    });

    expect(kernel.getDocument()).toEqual(before);
    expect(kernel.transactions()).toHaveLength(transactions + 1);
  });

  it('works even after the person edited the page since', () => {
    const before = pageBefore();
    const kernel = kernelWith(before, 'live');
    afterARun(kernel);
    // A single undo() would take THIS back, not the generation.
    kernel.dispatch('setProp', { id: 'mine', key: 'content', value: 'my later edit' });

    undoGeneration(kernel, before, { label: 'Undo the generation' });
    expect(kernel.getDocument()).toEqual(before);
  });

  it('files the revert under the person, not the agent or the code view', () => {
    const before = pageBefore();
    const kernel = kernelWith(before, 'live');
    afterARun(kernel);
    undoGeneration(kernel, before, { author: 'user', label: 'Undo the generation' });

    const tx = kernel.transactions().at(-1);
    expect(tx?.author).toBe('user');
    expect(tx?.command).toBe('Undo the generation');
  });

  it('is itself one undo away', () => {
    const before = pageBefore();
    const kernel = kernelWith(before, 'live');
    afterARun(kernel);
    const afterRun = structuredClone(kernel.getDocument());

    undoGeneration(kernel, before, { label: 'Undo the generation' });
    expect(kernel.undo()).toBe(true);
    expect(kernel.getDocument()).toEqual(afterRun);
  });

  it('changes nothing when the page is already where it started', () => {
    const before = pageBefore();
    const kernel = kernelWith(before, 'live');
    expect(undoGeneration(kernel, before)).toEqual({ ok: true, changed: false });
    expect(kernel.transactions()).toHaveLength(0);
  });
});

describe('undoSection', () => {
  it('REMOVES a section the run created', () => {
    const before = pageBefore();
    const kernel = kernelWith(before, 'live');
    afterARun(kernel);
    const created = childrenOf(kernel)[1] ?? '';

    expect(undoSection(kernel, before, created, { label: 'Undo Pricing' })).toEqual({
      ok: true,
      action: 'removed',
    });
    expect(kernel.getDocument().nodes[created]).toBeUndefined();
  });

  it('RESTORES a section that existed before and was rewritten', () => {
    const before = pageBefore();
    const kernel = kernelWith(before, 'live');
    afterARun(kernel);

    expect(undoSection(kernel, before, 'mine', { label: 'Undo mine' })).toEqual({
      ok: true,
      action: 'restored',
    });
    expect(contentOf(kernel, 'mine')).toBe('What I wrote myself');
  });

  it('touches NOTHING else — that is the whole point of the task', () => {
    const before = pageBefore();
    const kernel = kernelWith(before, 'live');
    afterARun(kernel);
    const [, first, second] = childrenOf(kernel);
    kernel.dispatch('setProp', { id: second ?? '', key: 'content', value: 'I edited this one' });

    undoSection(kernel, before, first ?? '', { label: 'Undo one' });

    /*
      The old behaviour popped N entries off the history stack, so a person who
      had edited another section since lost that edit too, silently.
    */
    expect(contentOf(kernel, second ?? '')).toBe('I edited this one');
    expect(contentOf(kernel, 'mine')).toBe('Rewritten by the run');
  });

  it('is ONE transaction, and one undo puts the section back', () => {
    const before = pageBefore();
    const kernel = kernelWith(before, 'live');
    afterARun(kernel);
    const created = childrenOf(kernel)[1] ?? '';
    const withSection = structuredClone(kernel.getDocument());
    const transactions = kernel.transactions().length;

    undoSection(kernel, before, created, { label: 'Undo one' });
    expect(kernel.transactions()).toHaveLength(transactions + 1);
    expect(kernel.undo()).toBe(true);
    expect(kernel.getDocument()).toEqual(withSection);
  });

  it('files it under the person by default', () => {
    const before = pageBefore();
    const kernel = kernelWith(before, 'live');
    afterARun(kernel);
    undoSection(kernel, before, 'mine', { label: 'Undo mine' });
    expect(kernel.transactions().at(-1)?.author).toBe('user');
  });

  it('does nothing for a section that is already gone', () => {
    const before = pageBefore();
    const kernel = kernelWith(before, 'live');
    afterARun(kernel);
    const transactions = kernel.transactions().length;

    expect(undoSection(kernel, before, 'never-existed')).toEqual({
      ok: true,
      action: 'unchanged',
    });
    expect(kernel.transactions()).toHaveLength(transactions);
  });

  it('does nothing for a section the run did not change', () => {
    const before = pageBefore();
    const kernel = kernelWith(before, 'live');
    kernel.dispatchGroup([{ command: 'insertNode', args: { type: 'text', parentId: 'root' } }], {
      author: 'ai',
      label: 'AI: one section',
    });
    const transactions = kernel.transactions().length;

    expect(undoSection(kernel, before, 'mine')).toEqual({ ok: true, action: 'unchanged' });
    expect(kernel.transactions()).toHaveLength(transactions);
  });

  it('removes a prop the live node has and the snapshot does not', () => {
    /*
      Not reachable through `setProp` — the door refuses a prop the block does
      not declare. It arises from the other direction: a snapshot taken before a
      schema gained a prop, or a document hand-edited through the code view. The
      branch exists for those, and this is the only honest way to drive it.
    */
    const kernel = kernelWith(pageBefore(), 'live');
    const thinner = pageBefore();
    const withoutContent: BuilderDocument = {
      ...thinner,
      nodes: { ...thinner.nodes, mine: { id: 'mine', type: 'text', props: {} } },
    };

    const outcome = undoSection(kernel, withoutContent, 'mine');

    expect(outcome).toEqual({ ok: true, action: 'restored' });
    expect(kernel.getDocument().nodes['mine']?.props['content']).toBeUndefined();
  });

  it('leaves the document untouched when the revert would be invalid', () => {
    const before = pageBefore();
    const kernel = kernelWith(before, 'live');
    afterARun(kernel);
    const afterRun = structuredClone(kernel.getDocument());

    // The root cannot be removed; the door refuses and nothing lands.
    const outcome = undoSection(kernel, { ...before, nodes: {} }, 'root');
    expect(outcome.ok).toBe(false);
    expect(kernel.getDocument()).toEqual(afterRun);
  });
});
