import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BuilderKernel } from '@craftkit/builder';

import { createPlaygroundKernel } from '../../create-playground-kernel';
import { demoExtension } from '../../demo-extension';
import {
  createCodeViewKernelAdapter,
  type CodeViewKernelAdapterHandle,
} from './create-code-view-kernel-adapter';

const handles: CodeViewKernelAdapterHandle[] = [];

function createAdapter(kernel: BuilderKernel): CodeViewKernelAdapterHandle {
  const handle = createCodeViewKernelAdapter(kernel);
  handles.push(handle);
  return handle;
}

afterEach(() => {
  for (const handle of handles.splice(0)) {
    handle.dispose();
  }
});

describe('createCodeViewKernelAdapter', () => {
  it('fires for a selection-only notification without advancing the revision', () => {
    const kernel = createPlaygroundKernel({ fixture: 'code-view' });
    const { adapter } = createAdapter(kernel);
    const listener = vi.fn();
    adapter.subscribe(listener);
    const before = adapter.getSnapshot();

    kernel.setSelection(['hero']);

    const after = adapter.getSnapshot();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(after.selection).toEqual(['hero']);
    expect(after.revision).toBe(before.revision);
    expect(after.document).toBe(before.document);
  });

  it('advances the revision when undo replaces the document identity', () => {
    const kernel = createPlaygroundKernel({ fixture: 'code-view' });
    const { adapter } = createAdapter(kernel);
    const original = adapter.getSnapshot();

    adapter.dispatch([
      {
        op: 'replace',
        path: ['nodes', 'hero', 'props', 'heading'],
        value: 'Changed before undo',
      },
    ]);
    const edited = adapter.getSnapshot();

    expect(edited.revision).toBe(original.revision + 1);
    expect(kernel.undo()).toBe(true);

    const undone = adapter.getSnapshot();
    expect(undone.revision).toBe(edited.revision + 1);
    expect(undone.document).not.toBe(edited.document);
    expect(undone.document).toEqual(original.document);
  });

  it('advances the revision and refreshes block types when an extension is registered after creation', () => {
    const kernel = createPlaygroundKernel({ fixture: 'code-view' });
    const { adapter } = createAdapter(kernel);
    const listener = vi.fn();
    adapter.subscribe(listener);
    const before = adapter.getSnapshot();

    expect(before.blockTypes).not.toContain('announcement');
    expect(before.blockTypes).not.toContain('story');

    kernel.registerExtension(demoExtension);

    const registered = adapter.getSnapshot();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(registered.revision).toBe(before.revision + 1);
    expect(registered.document).toBe(before.document);
    expect(registered.blockTypes).toEqual(expect.arrayContaining(['announcement', 'story']));

    expect(kernel.extensions.dispose(demoExtension.name)).toBe(true);

    const disposed = adapter.getSnapshot();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(disposed.revision).toBe(registered.revision + 1);
    expect(disposed.blockTypes).not.toContain('announcement');
    expect(disposed.blockTypes).not.toContain('story');
  });
});
