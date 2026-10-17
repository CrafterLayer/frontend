import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { lightTheme, type CanvasDragHandle } from '@craftkit/builder';

import { createPlaygroundKernel } from '../features/preview/create-playground-kernel';
import { playgroundTemplatesState } from '../features/preview/playground-templates';
import type { ReadySession } from './app-helpers';
import { editorLabels } from './editor-labels';
import { RailSectionPanel, type RailSectionPanelProps } from './rail-section-panel';
import type { EditorChrome } from './use-editor-chrome';

/*
  The page templates load on demand (2026-10-13). The panel queues their fetch
  for an idle moment once the canvas is live (it hands out its drag handle)
  instead of evaluating them in the entry. "Start from a template" (the empty
  page) opens the Library on its Templates tab: there they are wanted at once,
  so the panel fetches them, says they are loading meanwhile, and lists their
  cards — inserting as before — when they land. The two tests share the
  module's one load, in this order.
*/

afterEach(cleanup);

function libraryProps(kernel: ReturnType<typeof createPlaygroundKernel>): RailSectionPanelProps {
  return {
    railSection: 'blocks',
    session: { kernel } as unknown as ReadySession,
    labels: editorLabels('en'),
    editorLocale: 'en',
    chrome: { removeTemplate: () => undefined } as unknown as EditorChrome,
    styleBucket: 'base',
    harness: null,
    host: {} as RailSectionPanelProps['host'],
    theme: lightTheme,
    docDir: 'ltr',
    announce: () => undefined,
    dragHandle: undefined,
    templates: undefined,
    libraryKitSections: [],
    libraryPreviewCss: '',
    liveUtilities: undefined,
    libraryRequest: { tab: 'templates', nonce: 1 },
    openPalette: () => undefined,
  };
}

describe('RailSectionPanel — the page templates, loaded on demand', () => {
  it('queues the fetch for an idle moment once the canvas is live, and not before', () => {
    const idle: (() => void)[] = [];
    Object.assign(window, { requestIdleCallback: (callback: () => void) => idle.push(callback) });
    try {
      const kernel = createPlaygroundKernel({ fixture: 'empty' });
      const props = { ...libraryProps(kernel), libraryRequest: undefined };
      const view = render(<RailSectionPanel {...props} />);
      expect(idle).toHaveLength(0);
      view.rerender(<RailSectionPanel {...props} dragHandle={{} as CanvasDragHandle} />);
      expect(idle).toHaveLength(1);
      expect(playgroundTemplatesState().status).toBe('pending'); // Queued, not yet fetched.
    } finally {
      Reflect.deleteProperty(window, 'requestIdleCallback');
    }
  });

  it('fetches the templates, says they are loading, then lists cards that insert', async () => {
    expect(playgroundTemplatesState().status).toBe('pending');
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    render(<RailSectionPanel {...libraryProps(kernel)} />);

    expect(screen.getByText('Loading page templates…')).toHaveAttribute('role', 'status');

    const cards = await screen.findAllByRole('button', { name: /^Insert template / });
    expect(cards.length).toBe(kernel.context.registry.compositions('site').length);
    expect(screen.queryByText('Loading page templates…')).toBeNull();

    const before = Object.keys(kernel.getDocument().nodes).length;
    const first = cards[0];
    if (first === undefined) throw new Error('No template card.');
    await userEvent.click(first);
    expect(Object.keys(kernel.getDocument().nodes).length).toBeGreaterThan(before);
    expect(kernel.validate()).toEqual([]);
  });
});
