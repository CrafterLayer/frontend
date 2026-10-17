import { describe, expect, it, vi } from 'vitest';

import type { Editor } from '@tiptap/core';

import { subscribeBubbleReports } from './bubble-reporting';

describe('subscribeBubbleReports', () => {
  it('defers a transaction whose appended transaction carries blur metadata', async () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const off = vi.fn((event: string) => {
      listeners.delete(event);
    });
    const editor = {
      off,
      on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        listeners.set(event, listener);
      }),
    } as unknown as Editor;
    const report = vi.fn();
    const menu = document.createElement('div');
    const dispose = subscribeBubbleReports({
      editor,
      formattingMenuElement: menu,
      report,
    });

    const onTransaction = listeners.get('transaction');
    if (onTransaction === undefined) {
      throw new Error('The editor transaction listener must be registered');
    }
    onTransaction({
      appendedTransactions: [
        { getMeta: () => undefined },
        { getMeta: (key: string) => (key === 'blur' ? true : undefined) },
      ],
      transaction: { getMeta: () => undefined },
    });

    expect(report).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(report).toHaveBeenCalledTimes(2);

    dispose();
    expect(off).toHaveBeenCalledWith('transaction', expect.any(Function));
  });
});
