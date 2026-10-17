import { act, renderHook } from '@testing-library/react';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { EditingBucket } from '../../devices/buckets';
import type { FieldCommit } from '../../fields/field-commit';
import { useRowCommit } from './use-row-commit';

const NullRender: BlockRenderComponent = () => null;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'row-commit-vocab',
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
          description: 'Card',
          props: z.object({ title: z.string().max(10).default('Hi') }),
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
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['c1'] } },
    c1: { id: 'c1', type: 'card', props: { title: 'Hello' } },
  },
};

const makeKernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('rc') },
  });

function mount(
  kernel: ReturnType<typeof makeKernel>,
  bucket: EditingBucket,
  options: { nested?: boolean; commitValue?: FieldCommit } = {},
) {
  const announce = vi.fn();
  const view = renderHook(() =>
    useRowCommit({
      kernel,
      nodeId: 'c1',
      propKey: 'title',
      bucket,
      nested: options.nested ?? false,
      commitValue: options.commitValue,
      announce,
    }),
  );
  return { view, announce };
}

describe('useRowCommit', () => {
  it('base bucket → one setProp, announced as updated', () => {
    const kernel = makeKernel();
    const { view, announce } = mount(kernel, 'base');
    let result;
    act(() => {
      result = view.result.current.commit('Bye');
    });
    expect(result).toEqual({ ok: true });
    expect(kernel.transactions().map((tx) => tx.command)).toEqual(['setProp']);
    expect(kernel.getDocument().nodes['c1']?.props['title']).toBe('Bye');
    expect(announce).toHaveBeenCalledWith('title updated');
    expect(view.result.current.rejection).toBeNull();
  });

  it('override bucket → one setResponsive; clear → value null, announced as cleared', () => {
    const kernel = makeKernel();
    const { view, announce } = mount(kernel, 'tablet');
    act(() => {
      view.result.current.commit('Tab');
    });
    expect(kernel.transactions().map((tx) => tx.command)).toEqual(['setResponsive']);
    expect(kernel.getDocument().nodes['c1']?.responsive?.tablet?.['title']).toBe('Tab');

    act(() => {
      view.result.current.clearOverride();
    });
    expect(kernel.transactions()).toHaveLength(2);
    expect(kernel.getDocument().nodes['c1']?.responsive?.tablet?.['title']).toBeUndefined();
    expect(announce).toHaveBeenLastCalledWith('title override cleared');
  });

  it('clearOverride is a no-op in the base bucket and on nested rows', () => {
    const kernel = makeKernel();
    const base = mount(kernel, 'base');
    act(() => {
      base.view.result.current.clearOverride();
    });
    const nested = mount(kernel, 'tablet', { nested: true });
    act(() => {
      nested.view.result.current.clearOverride();
    });
    expect(kernel.transactions()).toHaveLength(0);
    expect(base.announce).not.toHaveBeenCalled();
    expect(nested.announce).not.toHaveBeenCalled();
  });

  it('a rejection records no transaction, leaves the document reference-identical and says so', () => {
    const kernel = makeKernel();
    const before = kernel.getDocument();
    const { view, announce } = mount(kernel, 'base');
    let result;
    act(() => {
      result = view.result.current.commit('far too long a title');
    });
    expect(result).toMatchObject({ ok: false });
    expect(kernel.transactions()).toHaveLength(0);
    expect(kernel.getDocument()).toBe(before);
    expect(announce).toHaveBeenCalledWith('title rejected');
    expect(view.result.current.rejection).not.toBeNull();

    act(() => {
      view.result.current.commit('Fine');
    });
    expect(view.result.current.rejection).toBeNull();
  });

  it('a nested row writes through the supplied door and still reports through its own row', () => {
    const kernel = makeKernel();
    const commitValue = vi.fn<FieldCommit>(() => ({ ok: false, message: 'nested no' }));
    const { view, announce } = mount(kernel, 'base', { nested: true, commitValue });
    expect(view.result.current.writeValue).toBe(commitValue);
    act(() => {
      view.result.current.commit('x');
    });
    expect(commitValue).toHaveBeenCalledWith('x');
    expect(kernel.transactions()).toHaveLength(0);
    expect(view.result.current.rejection).toBe('nested no');
    expect(announce).toHaveBeenCalledWith('title rejected');
  });
});
