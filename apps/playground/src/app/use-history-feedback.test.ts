import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createPlaygroundKernel } from '../features/preview/create-playground-kernel';
import { editorLabels } from './editor-labels';
import { historyStepName, useHistoryFeedback } from './use-history-feedback';

const info = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { info } }));

const words = editorLabels('en').historyList;

interface ToastOptions {
  readonly id: string;
  readonly action: { readonly onClick: () => void };
}

function lastToast(): { readonly message: string; readonly options: ToastOptions } {
  const call = info.mock.calls.at(-1) as [string, ToastOptions] | undefined;
  if (call === undefined) throw new Error('No toast was shown');
  return { message: call[0], options: call[1] };
}

beforeEach(() => {
  info.mockReset();
});

describe('useHistoryFeedback', () => {
  it('says an undo and a redo once each, with the way back', () => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    renderHook(() => {
      useHistoryFeedback(kernel, 'en', words);
    });
    act(() => {
      kernel.dispatch('setDocMeta', { dir: 'rtl' });
    });
    expect(info).not.toHaveBeenCalled(); // a new change is not a history step

    act(() => {
      kernel.undo();
    });
    const step = historyStepName('setDocMeta', words);
    expect(lastToast().message).toBe(`Undone · ${step}`);
    expect(lastToast().options.id).toBe('pg-history-step');

    // The toast's action takes the step back the other way.
    act(() => {
      lastToast().options.action.onClick();
    });
    expect(kernel.getDocument().dir).toBe('rtl');
    expect(lastToast().message).toBe(`Redone · ${step}`);
    expect(info).toHaveBeenCalledTimes(2);
  });

  it('speaks the editor language', () => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    const arabic = editorLabels('ar').historyList;
    renderHook(() => {
      useHistoryFeedback(kernel, 'ar', arabic);
    });
    act(() => {
      kernel.dispatch('setDocMeta', { dir: 'rtl' });
      kernel.undo();
    });
    expect(lastToast().message).toBe(`تم التراجع · ${historyStepName('setDocMeta', arabic)}`);
  });

  it('names a step the way the History list does', () => {
    expect(historyStepName('setFooBar', words)).toBe('Set foo bar');
  });
});
