import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPlaygroundKernel } from '../features/preview/create-playground-kernel';
import { useRevealInspector, type RevealInspectorPanes } from './use-reveal-inspector';

function panesWith(overrides: Partial<RevealInspectorPanes> = {}): RevealInspectorPanes {
  return {
    visiblePanes: { panel: true, aside: false, overlay: false },
    asideOpen: true,
    railSection: 'blocks',
    setActiveSide: vi.fn(),
    ...overrides,
  };
}

function firstBlockId(kernel: ReturnType<typeof createPlaygroundKernel>): string {
  const document = kernel.getDocument();
  const root = document.nodes[document.rootId];
  const id = Object.values(root?.slots ?? {}).flat()[0];
  if (id === undefined) throw new Error('The landing fixture has no blocks');
  return id;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('useRevealInspector', () => {
  it('brings a hidden Inspector forward when a block is selected on the canvas', () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    const panes = panesWith();
    renderHook(() => {
      useRevealInspector(kernel, panes);
    });

    act(() => {
      kernel.setSelection([firstBlockId(kernel)]);
    });
    expect(panes.setActiveSide).toHaveBeenCalledWith('aside');
  });

  it('leaves the panel alone when the selection came from inside it (Layers)', () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    const panes = panesWith();
    const panel = document.createElement('div');
    panel.className = 'bldr-shell__panel';
    const row = document.createElement('button');
    panel.append(row);
    document.body.append(panel);
    row.focus();
    renderHook(() => {
      useRevealInspector(kernel, panes);
    });

    act(() => {
      kernel.setSelection([firstBlockId(kernel)]);
    });
    expect(panes.setActiveSide).not.toHaveBeenCalled();
  });

  it('never reopens a closed Inspector, never pushes the Assistant aside, ignores a clear', () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    const closed = panesWith({ asideOpen: false });
    const assistant = panesWith({ railSection: 'assistant' });
    renderHook(() => {
      useRevealInspector(kernel, closed);
      useRevealInspector(kernel, assistant);
    });

    act(() => {
      kernel.setSelection([firstBlockId(kernel)]);
      kernel.clearSelection();
    });
    expect(closed.setActiveSide).not.toHaveBeenCalled();
    expect(assistant.setActiveSide).not.toHaveBeenCalled();
  });

  it('does nothing while the Inspector is already showing', () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    const panes = panesWith({ visiblePanes: { panel: true, aside: true, overlay: false } });
    renderHook(() => {
      useRevealInspector(kernel, panes);
    });

    act(() => {
      kernel.setSelection([firstBlockId(kernel)]);
    });
    expect(panes.setActiveSide).not.toHaveBeenCalled();
  });
});
