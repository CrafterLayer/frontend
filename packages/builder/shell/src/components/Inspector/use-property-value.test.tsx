import { act, renderHook } from '@testing-library/react';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { EditingBucket } from '../../devices/buckets';
import { usePropertyValue } from './use-property-value';

const NullRender: BlockRenderComponent = () => null;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'property-value-vocab',
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
          props: z.object({
            title: z.string().default('Hi'),
            tone: z.enum(['light', 'dark']).default('light'),
          }),
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
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['c1', 'c2'] } },
    c1: { id: 'c1', type: 'card', props: { title: 'Hello', tone: 'light' } },
    c2: { id: 'c2', type: 'card', props: { title: 'Other', tone: 'dark' } },
  },
};

const makeKernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('pv') },
  });

function mountCounter(kernel: ReturnType<typeof makeKernel>, bucket: EditingBucket) {
  const counter = { renders: 0 };
  const view = renderHook(() => {
    counter.renders += 1;
    return usePropertyValue(kernel, 'c1', 'title', bucket);
  });
  return { view, counter };
}

describe('usePropertyValue', () => {
  it('re-renders for its own key only: unrelated node 0, other key 0, own key 1', () => {
    const kernel = makeKernel();
    const { view, counter } = mountCounter(kernel, 'base');
    expect(view.result.current).toEqual({
      stored: 'Hello',
      override: undefined,
      hasOverride: false,
    });

    counter.renders = 0;
    act(() => {
      kernel.dispatch('setProp', { id: 'c2', key: 'title', value: 'Moved' }, 'user');
    });
    expect(counter.renders).toBe(0);

    act(() => {
      kernel.dispatch('setProp', { id: 'c1', key: 'tone', value: 'dark' }, 'user');
    });
    expect(counter.renders).toBe(0);

    act(() => {
      kernel.dispatch('setProp', { id: 'c1', key: 'title', value: 'Changed' }, 'user');
    });
    expect(counter.renders).toBe(1);
    expect(view.result.current.stored).toBe('Changed');
  });

  it('follows undo with exactly one render', () => {
    const kernel = makeKernel();
    const { view, counter } = mountCounter(kernel, 'base');
    act(() => {
      kernel.dispatch('setProp', { id: 'c1', key: 'title', value: 'Changed' }, 'user');
    });
    counter.renders = 0;
    act(() => {
      kernel.undo();
    });
    expect(counter.renders).toBe(1);
    expect(view.result.current.stored).toBe('Hello');
  });

  it('reads the override bucket: setResponsive 1, clear 1, equal-to-base is still an override', () => {
    const kernel = makeKernel();
    const { view, counter } = mountCounter(kernel, 'tablet');
    expect(view.result.current).toEqual({
      stored: 'Hello',
      override: undefined,
      hasOverride: false,
    });

    counter.renders = 0;
    act(() => {
      kernel.dispatch(
        'setResponsive',
        { id: 'c1', breakpoint: 'tablet', key: 'title', value: 'Hello' },
        'user',
      );
    });
    expect(counter.renders).toBe(1);
    expect(view.result.current).toEqual({ stored: 'Hello', override: 'Hello', hasOverride: true });

    counter.renders = 0;
    act(() => {
      kernel.dispatch(
        'setResponsive',
        { id: 'c1', breakpoint: 'tablet', key: 'title', value: null },
        'user',
      );
    });
    expect(counter.renders).toBe(1);
    expect(view.result.current).toEqual({
      stored: 'Hello',
      override: undefined,
      hasOverride: false,
    });
  });

  it('never reports an override in the base bucket', () => {
    const kernel = makeKernel();
    kernel.dispatch(
      'setResponsive',
      { id: 'c1', breakpoint: 'tablet', key: 'title', value: 'Tab' },
      'user',
    );
    const { view } = mountCounter(kernel, 'base');
    expect(view.result.current).toEqual({
      stored: 'Hello',
      override: undefined,
      hasOverride: false,
    });
  });

  it('survives the removal of the node it subscribes to', () => {
    const kernel = makeKernel();
    const { view } = mountCounter(kernel, 'tablet');
    expect(() => {
      act(() => {
        kernel.dispatch('removeNode', { id: 'c1' }, 'user');
      });
    }).not.toThrow();
    expect(view.result.current).toEqual({
      stored: undefined,
      override: undefined,
      hasOverride: false,
    });
  });
});
