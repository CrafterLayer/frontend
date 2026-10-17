import { act, renderHook } from '@testing-library/react';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder, emptyDocument } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import type { FieldProps, FieldTypeDef } from '@craftkit/builder-schema';

import { fieldModuleCache, fieldModuleFailures } from './field-module-cache';
import { useFieldRendering } from './use-field-rendering';

const Custom = (props: FieldProps) => <span>{String(props.value)}</span>;
const Better = (props: FieldProps) => <b>{String(props.value)}</b>;

const makeKernel = () =>
  createBuilder({
    document: emptyDocument(),
    ports: { clock: fixedClock(), ids: seededIds('fr') },
  });

const contribute = (
  kernel: ReturnType<typeof makeKernel>,
  name: string,
  def: FieldTypeDef,
): void => {
  kernel.extensions.register({
    tier: 1,
    name,
    version: '1.0.0',
    contributes: { fieldTypes: [def] },
  });
};

const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('useFieldRendering', () => {
  it('resolves the default control for a plain schema and read-only for an exotic one', () => {
    const kernel = makeKernel();
    const text = renderHook(() => useFieldRendering(kernel, z.string().max(40), undefined, 0));
    expect(text.result.current.rendering).toEqual({
      kind: 'default',
      control: 'text',
      loading: false,
    });
    expect(text.result.current.loading).toBe(false);

    const exotic = renderHook(() => useFieldRendering(kernel, z.date(), undefined, 0));
    expect(exotic.result.current.rendering).toEqual({ kind: 'readonly', loading: false });
  });

  it('shows a loading default until the contribution lands in the shared cache', async () => {
    const kernel = makeKernel();
    const target = z.string().max(40);
    const def: FieldTypeDef = {
      id: 'custom-string',
      match: (schema) => (schema === target ? 10 : 0),
      load: () => Promise.resolve({ default: Custom }),
    };
    contribute(kernel, 'custom', def);
    const view = renderHook(() =>
      useFieldRendering(kernel, target, undefined, kernel.extensions.version()),
    );
    expect(view.result.current.rendering).toEqual({
      kind: 'default',
      control: 'text',
      loading: true,
    });
    expect(view.result.current.loading).toBe(true);

    await settle();
    expect(view.result.current.rendering).toEqual({ kind: 'contributed', def, component: Custom });
    expect(view.result.current.loading).toBe(false);
    expect(fieldModuleCache.get(def)).toBe(Custom);
  });

  it('contains a rejected loader as the live default', async () => {
    const kernel = makeKernel();
    const target = z.string().max(40);
    const def: FieldTypeDef = {
      id: 'broken-string',
      match: (schema) => (schema === target ? 10 : 0),
      load: () => Promise.reject(new Error('nope')),
    };
    contribute(kernel, 'broken', def);
    const view = renderHook(() =>
      useFieldRendering(kernel, target, undefined, kernel.extensions.version()),
    );
    await settle();
    expect(fieldModuleCache.has(def)).toBe(false);
    expect(fieldModuleFailures.get(def)?.message).toBe('nope');
    expect(view.result.current.failure?.message).toBe('nope');
    expect(view.result.current.rendering).toEqual({
      kind: 'default',
      control: 'text',
      loading: false,
    });
  });

  it('a failed load is NOT cached forever: retry() loads again and mounts the field', async () => {
    const kernel = makeKernel();
    const target = z.string().max(40);
    let attempts = 0;
    const def: FieldTypeDef = {
      id: 'flaky-string',
      match: (schema) => (schema === target ? 10 : 0),
      load: () => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error('chunk 504'))
          : Promise.resolve({ default: Custom });
      },
    };
    contribute(kernel, 'flaky', def);
    const view = renderHook(() =>
      useFieldRendering(kernel, target, undefined, kernel.extensions.version()),
    );
    await settle();
    expect(view.result.current.failure?.message).toBe('chunk 504');

    act(() => {
      view.result.current.retry();
    });
    await settle();
    expect(attempts).toBe(2);
    expect(view.result.current.failure).toBeUndefined();
    expect(view.result.current.rendering).toEqual({ kind: 'contributed', def, component: Custom });
  });

  it('a row mounting after a failure tries again on its own', async () => {
    const kernel = makeKernel();
    const target = z.string().max(40);
    let attempts = 0;
    const def: FieldTypeDef = {
      id: 'second-chance',
      match: (schema) => (schema === target ? 10 : 0),
      load: () => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error('offline'))
          : Promise.resolve({ default: Custom });
      },
    };
    contribute(kernel, 'second-chance', def);
    const first = renderHook(() =>
      useFieldRendering(kernel, target, undefined, kernel.extensions.version()),
    );
    await settle();
    expect(first.result.current.failure).toBeDefined();
    first.unmount();

    const second = renderHook(() =>
      useFieldRendering(kernel, target, undefined, kernel.extensions.version()),
    );
    await settle();
    expect(attempts).toBe(2);
    expect(second.result.current.rendering.kind).toBe('contributed');
  });

  it('resolves a part-declared binding from the row’s place', () => {
    const kernel = makeKernel();
    const view = renderHook(() =>
      useFieldRendering(kernel, z.string(), undefined, 0, {
        parts: {
          image: {
            kind: 'image',
            bind: { src: 'imageSrc' },
            label: { en: 'Image', ar: 'الصورة' },
          },
        },
        propPath: ['imageSrc'],
      }),
    );
    expect(view.result.current.rendering).toEqual({
      kind: 'default',
      control: 'image-url',
      loading: false,
    });
  });

  it('R8: lock freezes the mounted renderer while the live one moves; unlock releases it', async () => {
    const kernel = makeKernel();
    const target = z.string().max(40);
    const view = renderHook(
      ({ version }: { version: number }) => useFieldRendering(kernel, target, undefined, version),
      { initialProps: { version: kernel.extensions.version() } },
    );
    act(() => {
      view.result.current.lock();
    });
    const def: FieldTypeDef = {
      id: 'better-string',
      match: (schema) => (schema === target ? 10 : 0),
      load: () => Promise.resolve({ default: Better }),
    };
    contribute(kernel, 'better', def);
    view.rerender({ version: kernel.extensions.version() });
    await settle();
    expect(view.result.current.rendering).toEqual({
      kind: 'default',
      control: 'text',
      loading: false,
    });
    expect(view.result.current.liveRendering).toEqual({
      kind: 'contributed',
      def,
      component: Better,
    });

    act(() => {
      view.result.current.unlock();
    });
    expect(view.result.current.rendering).toEqual({ kind: 'contributed', def, component: Better });
  });

  it('markFailed records a throwing contribution and falls back live', async () => {
    const kernel = makeKernel();
    const target = z.string().max(40);
    const def: FieldTypeDef = {
      id: 'throwing-string',
      match: (schema) => (schema === target ? 10 : 0),
      load: () => Promise.resolve({ default: Custom }),
    };
    contribute(kernel, 'throwing', def);
    const view = renderHook(() =>
      useFieldRendering(kernel, target, undefined, kernel.extensions.version()),
    );
    await settle();
    expect(view.result.current.rendering.kind).toBe('contributed');
    act(() => {
      view.result.current.markFailed(new Error('render threw'));
    });
    expect(fieldModuleCache.has(def)).toBe(false);
    expect(view.result.current.failure?.message).toBe('render threw');
    expect(view.result.current.rendering).toEqual({
      kind: 'default',
      control: 'text',
      loading: false,
    });
  });
});
