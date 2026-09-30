import { isValidElement, type ReactNode } from 'react';

import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';
import type {
  BlockRenderComponent,
  BlockRenderProps,
  BuilderDocument,
  NodeId,
  TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { NodeView, type InlineEditSeam, type InlineEditTarget } from './NodeView';

function visibleValue(value: unknown): ReactNode {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return isValidElement(value) ? value : null;
}

const ObservableFixtureBlock = (({
  node,
  props,
  slots,
}: BlockRenderProps<Record<string, unknown>>) => (
  <div data-testid={`node-${node.id}`}>
    {Object.entries(props).map(([key, value]) => (
      <span key={key} data-testid={`prop-${node.id}-${key}`}>
        {visibleValue(value)}
      </span>
    ))}
    {Object.entries(slots).map(([slotName, children]) => (
      <div key={slotName} data-testid={`slot-${node.id}-${slotName}`}>
        {children}
      </div>
    ))}
  </div>
)) as BlockRenderComponent;

const observableFixtureBlocks: TrustedExtensionManifest = {
  ...fixtureBlocks,
  name: 'node-view-observable-fixtures',
  contributes: {
    ...fixtureBlocks.contributes,
    blocks: (fixtureBlocks.contributes?.blocks ?? []).map((contribution) => ({
      schema: contribution.schema,
      render: ObservableFixtureBlock,
    })),
  },
};

interface SeamBinding {
  nodeId: NodeId;
  target: InlineEditTarget;
}

interface TestInlineEditSeam extends InlineEditSeam {
  set: (binding: SeamBinding | null) => void;
  subscriberCount: (nodeId: NodeId) => number;
  notificationCount: () => number;
}

function createTestInlineEditSeam(initial: SeamBinding | null = null): TestInlineEditSeam {
  let current = initial;
  let notifications = 0;
  const listeners = new Map<NodeId, Set<() => void>>();

  const notify = (nodeId: NodeId) => {
    for (const listener of [...(listeners.get(nodeId) ?? [])]) {
      notifications += 1;
      listener();
    }
  };

  return {
    subscribe: (nodeId, listener) => {
      const own = listeners.get(nodeId) ?? new Set<() => void>();
      own.add(listener);
      listeners.set(nodeId, own);
      return () => {
        own.delete(listener);
        if (own.size === 0) {
          listeners.delete(nodeId);
        }
      };
    },
    getSnapshot: (nodeId) => (current?.nodeId === nodeId ? current.target : null),
    set: (binding) => {
      if (Object.is(current, binding)) {
        return;
      }
      const previousId = current?.nodeId;
      current = binding;
      const nextId = binding?.nodeId;
      if (previousId !== undefined) {
        notify(previousId);
      }
      if (nextId !== undefined && nextId !== previousId) {
        notify(nextId);
      }
    },
    subscriberCount: (nodeId) => listeners.get(nodeId)?.size ?? 0,
    notificationCount: () => notifications,
  };
}

function makeKernel(document = landingFixture()) {
  return createBuilder({
    document,
    extensions: [observableFixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('nv') },
  });
}

function directSlotChildIds(wrapper: HTMLElement): string[] {
  return [...wrapper.children].map((child) => {
    const canvasId = child.getAttribute('data-bldr-node');
    if (canvasId !== null) {
      return canvasId;
    }
    return (child.getAttribute('data-testid') ?? '').replace(/^node-/, '');
  });
}

function firstTextNode(element: HTMLElement): Text {
  const node = element.firstChild;
  if (node?.nodeType !== Node.TEXT_NODE) {
    throw new Error('expected the inline control to own a text node');
  }
  return node as Text;
}

function currentSelection(): Selection {
  const selection = document.getSelection();
  if (selection === null) {
    throw new Error('jsdom must expose a Selection for this test');
  }
  return selection;
}

function renderHero(target: InlineEditTarget) {
  const kernel = makeKernel();
  const seam = createTestInlineEditSeam({ nodeId: 'hero1', target });
  const view = render(
    <NodeView
      kernel={kernel}
      id="hero1"
      breakpoint="desktop"
      attachNodeElement={() => undefined}
      inlineEdit={seam}
    />,
  );
  return { kernel, seam, view };
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, 'caretPositionFromPoint');
  Reflect.deleteProperty(document, 'caretRangeFromPoint');
  document.getSelection()?.removeAllRanges();
  document.querySelector('[data-node-view-outside]')?.remove();
});

describe('NodeView', () => {
  it('renders an unknown type as the explicit fallback', () => {
    const kernel = createBuilder(); // no extensions: 'page' is unregistered
    render(<NodeView kernel={kernel} id="root" breakpoint="desktop" />);
    expect(screen.getByRole('note')).toHaveTextContent('page');
  });

  it('renders nothing for a missing node id', () => {
    const kernel = makeKernel();
    const { container } = render(<NodeView kernel={kernel} id="ghost" breakpoint="desktop" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('wraps a populated slot as display contents on canvas, and not at all in preview', () => {
    /*
      The wrapper is CANVAS scaffolding: it exists so the drop resolver can
      measure a slot. `display: contents` is what makes it free — the box does
      not participate in layout, so Stack's row of flex items stays a row.

      Preview gets the children bare. A `data-bldr-*` attribute in published
      HTML is the same mistake as an editing hint reaching a published page, and
      StaticDocument emits no wrapper — the two published shapes must match,
      which is what SC-003b pins.
    */
    const canvas = render(
      <NodeView
        kernel={makeKernel()}
        id="root"
        breakpoint="desktop"
        attachNodeElement={() => undefined}
        isCanvas
      />,
    );
    const canvasHost = screen.getByTestId('slot-root-default');
    const wrapper = canvasHost.firstElementChild;
    if (!(wrapper instanceof HTMLElement)) {
      throw new Error('expected the block slot host to contain the renderer slot wrapper');
    }

    expect(canvasHost.children).toHaveLength(1);
    expect(wrapper).toHaveAttribute('data-bldr-slot', 'default');
    expect(wrapper).toHaveAttribute('data-bldr-slot-of', 'root');
    expect(wrapper).not.toHaveClass('bldr-slot-empty');
    expect(wrapper.style.display).toBe('contents');
    expect(directSlotChildIds(wrapper)).toEqual(['hero1', 'sec1']);
    canvas.unmount();

    render(<NodeView kernel={makeKernel()} id="root" breakpoint="desktop" isCanvas={false} />);
    const previewHost = screen.getByTestId('slot-root-default');

    // The children sit directly in the block's own slot host — no wrapper.
    expect(previewHost.querySelector('[data-bldr-slot]')).toBeNull();
    expect(directSlotChildIds(previewHost)).toEqual(['hero1', 'sec1']);
  });

  it('renders a schema-declared empty slot as a real measurable box on canvas only', () => {
    const emptyDocument: BuilderDocument = {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: { root: { id: 'root', type: 'page', props: { title: 'Empty' } } },
    };

    /*
      An empty slot is the one that MUST be droppable — it is where the first
      block in a region goes — and a `display: contents` box cannot be measured,
      so this one is real. In preview an empty slot is simply nothing.
    */
    const canvas = render(
      <NodeView
        kernel={makeKernel(emptyDocument)}
        id="root"
        breakpoint="desktop"
        attachNodeElement={() => undefined}
        isCanvas
      />,
    );
    const wrapper = screen.getByTestId('slot-root-default').firstElementChild;
    if (!(wrapper instanceof HTMLElement)) {
      throw new Error('expected an empty renderer slot wrapper');
    }

    expect(wrapper).toHaveAttribute('data-bldr-slot', 'default');
    expect(wrapper).toHaveAttribute('data-bldr-slot-of', 'root');
    expect(wrapper).toHaveClass('bldr-slot-empty');
    expect(wrapper).not.toHaveAttribute('style');
    /*
      `default` is the block's unnamed region, and its name is an identifier,
      not words: on an empty page it sat alone in the middle of the canvas as
      stray debug text. So the unnamed region carries no label; a NAMED region
      does (next test). The geometry that makes the box hittable at all is a
      browser question, pinned in the Chromium story rather than here, because
      jsdom computes no layout.
    */
    expect(wrapper.textContent).toBe('');
    canvas.unmount();

    render(
      <NodeView
        kernel={makeKernel(emptyDocument)}
        id="root"
        breakpoint="desktop"
        isCanvas={false}
      />,
    );
    expect(screen.getByTestId('slot-root-default').querySelector('[data-bldr-slot]')).toBeNull();
  });

  it('labels an empty NAMED slot with its name, so named regions are not identical boxes', () => {
    const heroWithoutActions: BuilderDocument = {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: {
        root: { id: 'root', type: 'page', props: { title: 'Hero' }, slots: { default: ['hero1'] } },
        hero1: { id: 'hero1', type: 'hero', props: { tone: 'dark', heading: 'Build faster' } },
      },
    };

    render(
      <NodeView
        kernel={makeKernel(heroWithoutActions)}
        id="root"
        breakpoint="desktop"
        attachNodeElement={() => undefined}
        isCanvas
      />,
    );
    const wrapper = screen.getByTestId('slot-hero1-actions').firstElementChild;
    if (!(wrapper instanceof HTMLElement)) {
      throw new Error('expected an empty renderer slot wrapper');
    }

    expect(wrapper).toHaveClass('bldr-slot-empty');
    expect(wrapper.textContent).toBe('actions');
  });

  it('swaps only the matching node property and keeps stored output for other or pending nodes', () => {
    const kernel = makeKernel();
    const seam = createTestInlineEditSeam();
    const renderInline = vi.fn(
      ({ nodeId, propKey, value }: Parameters<NonNullable<InlineEditTarget['render']>>[0]) => (
        <strong data-testid={`editor-${nodeId}`}>
          {propKey}:{typeof value === 'string' ? value : 'unsupported'}
        </strong>
      ),
    );
    render(<NodeView kernel={kernel} id="root" breakpoint="desktop" inlineEdit={seam} />);

    act(() => {
      seam.set({ nodeId: 'p1', target: { propKey: 'content', render: renderInline } });
    });
    expect(screen.getByTestId('editor-p1')).toHaveTextContent('content:Welcome aboard.');
    expect(screen.getByTestId('prop-hero1-heading')).toHaveTextContent('Build faster');

    act(() => {
      seam.set({ nodeId: 'hero1', target: { propKey: 'heading', render: null } });
    });
    expect(screen.queryByTestId('editor-p1')).not.toBeInTheDocument();
    expect(screen.getByTestId('prop-p1-content')).toHaveTextContent('Welcome aboard.');
    expect(screen.getByTestId('prop-hero1-heading')).toHaveTextContent('Build faster');

    act(() => {
      seam.set({ nodeId: 'hero1', target: { propKey: 'heading', render: renderInline } });
    });
    expect(screen.getByTestId('editor-hero1')).toHaveTextContent('heading:Build faster');
    expect(screen.getByTestId('prop-p1-content')).toHaveTextContent('Welcome aboard.');
  });

  it('re-renders only the node left and the node entered when the seam moves', () => {
    const kernel = makeKernel();
    const seam = createTestInlineEditSeam();
    const counts = new Map<NodeId, number>();
    const renderInline = ({
      nodeId,
      value,
    }: Parameters<NonNullable<InlineEditTarget['render']>>[0]) => (
      <em data-testid={`scoped-editor-${nodeId}`}>
        {typeof value === 'string' ? value : 'unsupported'}
      </em>
    );
    render(
      <NodeView
        kernel={kernel}
        id="root"
        breakpoint="desktop"
        onBlockRender={(nodeId) => counts.set(nodeId, (counts.get(nodeId) ?? 0) + 1)}
        inlineEdit={seam}
      />,
    );
    counts.clear();

    act(() => {
      seam.set({ nodeId: 'hero1', target: { propKey: 'heading', render: renderInline } });
    });
    expect([...counts.entries()]).toEqual([['hero1', 1]]);
    expect(screen.getByTestId('scoped-editor-hero1')).toHaveTextContent('Build faster');
    counts.clear();

    act(() => {
      seam.set({ nodeId: 'p1', target: { propKey: 'content', render: renderInline } });
    });
    expect(Object.fromEntries(counts)).toEqual({ hero1: 1, p1: 1 });
    expect(screen.getByTestId('prop-hero1-heading')).toHaveTextContent('Build faster');
    expect(screen.getByTestId('scoped-editor-p1')).toHaveTextContent('Welcome aboard.');
    counts.clear();

    act(() => {
      seam.set(null);
    });
    expect([...counts.entries()]).toEqual([['p1', 1]]);
    expect(screen.getByTestId('prop-p1-content')).toHaveTextContent('Welcome aboard.');
  });

  it('places pointer entry at the clicked caret position through both browser APIs', () => {
    const caretPositionFromPoint = vi.fn(() => {
      const control = screen.getByRole('textbox');
      return { offsetNode: firstTextNode(control), offset: 5 };
    });
    Object.defineProperty(document, 'caretPositionFromPoint', {
      configurable: true,
      value: caretPositionFromPoint,
    });
    const primary = renderHero({
      propKey: 'heading',
      entryPoint: { key: 1, kind: 'pointer', clientX: 41, clientY: 17 },
      render: ({ value }) => (
        <span role="textbox" contentEditable suppressContentEditableWarning>
          {typeof value === 'string' ? value : 'unsupported'}
        </span>
      ),
    });
    const primaryControl = screen.getByRole('textbox');
    expect(caretPositionFromPoint).toHaveBeenCalledWith(41, 17);
    expect(currentSelection().anchorNode).toBe(firstTextNode(primaryControl));
    expect(currentSelection().anchorOffset).toBe(5);
    primary.view.unmount();
    currentSelection().removeAllRanges();
    Reflect.deleteProperty(document, 'caretPositionFromPoint');

    const legacyPosition = vi.fn(() => null);
    const caretRangeFromPoint = vi.fn(() => {
      const control = screen.getByRole('textbox');
      const range = document.createRange();
      range.setStart(control, 1);
      range.collapse(true);
      return range;
    });
    Object.defineProperty(document, 'caretPositionFromPoint', {
      configurable: true,
      value: legacyPosition,
    });
    Object.defineProperty(document, 'caretRangeFromPoint', {
      configurable: true,
      value: caretRangeFromPoint,
    });
    const legacy = renderHero({
      propKey: 'heading',
      entryPoint: { key: 2, kind: 'pointer', clientX: 9, clientY: 23 },
      render: ({ value }) => (
        <span role="textbox" contentEditable suppressContentEditableWarning>
          {typeof value === 'string' ? value : 'unsupported'}
        </span>
      ),
    });
    const legacyControl = screen.getByRole('textbox');
    expect(legacyPosition).toHaveBeenCalledWith(9, 23);
    expect(caretRangeFromPoint).toHaveBeenCalledWith(9, 23);
    expect(currentSelection().anchorNode).toBe(legacyControl);
    expect(currentSelection().anchorOffset).toBe(1);
    legacy.view.unmount();
  });

  it('places keyboard entry at the logical end, including when the control mounts late', async () => {
    const immediate = renderHero({
      propKey: 'heading',
      entryPoint: { key: 1, kind: 'keyboard' },
      render: () => (
        <span role="textbox" contentEditable suppressContentEditableWarning>
          <strong>Build</strong>
          <span> faster</span>
        </span>
      ),
    });
    const immediateControl = screen.getByRole('textbox');
    const immediateRange = currentSelection().getRangeAt(0);
    expect(immediateRange.collapsed).toBe(true);
    expect(immediateRange.endContainer).toBe(immediateControl);
    expect(immediateRange.endOffset).toBe(immediateControl.childNodes.length);
    immediate.view.unmount();
    currentSelection().removeAllRanges();

    const late = renderHero({
      propKey: 'heading',
      entryPoint: { key: 2, kind: 'keyboard' },
      render: () => <span data-testid="late-editor-host" />,
    });
    const lateControl = document.createElement('span');
    lateControl.setAttribute('role', 'textbox');
    lateControl.setAttribute('contenteditable', 'true');
    lateControl.textContent = 'Mounted later';
    act(() => {
      screen.getByTestId('late-editor-host').append(lateControl);
    });
    await waitFor(() => {
      const range = currentSelection().getRangeAt(0);
      expect(lateControl).toHaveFocus();
      expect(range.endContainer).toBe(lateControl);
      expect(range.endOffset).toBe(lateControl.childNodes.length);
    });
    late.view.unmount();
  });

  it('wires a live rejection description and removes it on clear, late mount, and unmount', async () => {
    const withExistingDescription = () => (
      <>
        <span id="existing-help">Existing help</span>
        <span
          role="textbox"
          contentEditable
          suppressContentEditableWarning
          aria-describedby="existing-help"
        >
          Draft
        </span>
      </>
    );
    const immediate = renderHero({
      propKey: 'heading',
      render: withExistingDescription,
      rejection: { id: 'reject-one', message: 'Heading cannot be empty' },
    });
    const describedControl = screen.getByRole('textbox');
    expect(screen.getByText('Heading cannot be empty')).toHaveAttribute('id', 'reject-one');
    expect(describedControl.getAttribute('aria-describedby')?.split(/\s+/)).toEqual([
      'existing-help',
      'reject-one',
    ]);

    act(() => {
      immediate.seam.set({
        nodeId: 'hero1',
        target: { propKey: 'heading', render: withExistingDescription },
      });
    });
    expect(screen.queryByText('Heading cannot be empty')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'existing-help');

    act(() => {
      immediate.seam.set({
        nodeId: 'hero1',
        target: {
          propKey: 'heading',
          render: () => (
            <span role="textbox" contentEditable suppressContentEditableWarning>
              Draft
            </span>
          ),
          rejection: { id: 'reject-two', message: 'Still rejected' },
        },
      });
    });
    const unmountedControl = screen.getByRole('textbox');
    expect(unmountedControl).toHaveAttribute('aria-describedby', 'reject-two');
    immediate.view.unmount();
    expect(document.getElementById('reject-two')).toBeNull();
    expect(unmountedControl).not.toHaveAttribute('aria-describedby');

    const late = renderHero({
      propKey: 'heading',
      render: () => <span data-testid="late-rejection-host" />,
      rejection: { id: 'reject-late', message: 'Late control rejected' },
    });
    const lateControl = document.createElement('span');
    lateControl.setAttribute('role', 'textbox');
    act(() => {
      screen.getByTestId('late-rejection-host').append(lateControl);
    });
    await waitFor(() => {
      expect(lateControl).toHaveAttribute('aria-describedby', 'reject-late');
    });
    late.view.unmount();
    expect(lateControl).not.toHaveAttribute('aria-describedby');
    expect(document.getElementById('reject-late')).toBeNull();
  });

  it('unsubscribes its node-keyed seam listener before an update after unmount', () => {
    const kernel = makeKernel();
    const seam = createTestInlineEditSeam();
    const view = render(
      <NodeView kernel={kernel} id="hero1" breakpoint="desktop" inlineEdit={seam} />,
    );
    expect(seam.subscriberCount('hero1')).toBe(1);
    const notificationsBeforeUnmount = seam.notificationCount();

    view.unmount();
    expect(seam.subscriberCount('hero1')).toBe(0);
    expect(() => {
      seam.set({
        nodeId: 'hero1',
        target: { propKey: 'heading', render: () => <span>Unused editor</span> },
      });
    }).not.toThrow();
    expect(seam.notificationCount()).toBe(notificationsBeforeUnmount);
  });

  it('degrades quietly for a missing entry, missing control, unavailable selection, or foreign node', () => {
    const unusedCaretLookup = vi.fn(() => null);
    Object.defineProperty(document, 'caretPositionFromPoint', {
      configurable: true,
      value: unusedCaretLookup,
    });
    let receivedEntryPoint = false;
    const renderWithoutEntry = vi.fn(
      (context: Parameters<NonNullable<InlineEditTarget['render']>>[0]) => {
        receivedEntryPoint = Object.hasOwn(context, 'entryPoint');
        return (
          <span role="textbox" contentEditable suppressContentEditableWarning>
            {typeof context.value === 'string' ? context.value : 'unsupported'}
          </span>
        );
      },
    );
    const missingEntry = renderHero({ propKey: 'heading', render: renderWithoutEntry });
    expect(renderWithoutEntry).toHaveBeenCalledWith({
      nodeId: 'hero1',
      propKey: 'heading',
      value: 'Build faster',
    });
    expect(receivedEntryPoint).toBe(false);
    expect(unusedCaretLookup).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).not.toHaveFocus();
    missingEntry.view.unmount();

    const missingControl = renderHero({
      propKey: 'heading',
      entryPoint: { key: 1, kind: 'keyboard' },
      render: () => <span data-testid="no-inline-control">Loading editor</span>,
    });
    expect(screen.getByTestId('no-inline-control')).toHaveTextContent('Loading editor');
    expect(missingControl.view.unmount).not.toThrow();

    const outside = document.createElement('div');
    outside.dataset['nodeViewOutside'] = 'true';
    outside.textContent = 'Outside node';
    document.body.append(outside);
    const outsideText = firstTextNode(outside);
    const foreignRange = document.createRange();
    foreignRange.setStart(outsideText, 3);
    foreignRange.collapse(true);
    const foreignPosition = vi.fn(() => ({ offsetNode: outsideText, offset: 3 }));
    const foreignLegacyRange = vi.fn(() => foreignRange);
    Object.defineProperty(document, 'caretPositionFromPoint', {
      configurable: true,
      value: foreignPosition,
    });
    Object.defineProperty(document, 'caretRangeFromPoint', {
      configurable: true,
      value: foreignLegacyRange,
    });
    const selection = currentSelection();
    const removeAllRanges = vi.spyOn(selection, 'removeAllRanges');
    const addRange = vi.spyOn(selection, 'addRange');
    const foreignNode = renderHero({
      propKey: 'heading',
      entryPoint: { key: 2, kind: 'pointer', clientX: 2, clientY: 4 },
      render: ({ value }) => (
        <span role="textbox" contentEditable suppressContentEditableWarning>
          {typeof value === 'string' ? value : 'unsupported'}
        </span>
      ),
    });
    expect(foreignPosition).toHaveBeenCalledWith(2, 4);
    expect(foreignLegacyRange).toHaveBeenCalledWith(2, 4);
    expect(removeAllRanges).not.toHaveBeenCalled();
    expect(addRange).not.toHaveBeenCalled();
    foreignNode.view.unmount();

    vi.restoreAllMocks();
    vi.spyOn(document, 'getSelection').mockReturnValue(null);
    const unavailableSelection = renderHero({
      propKey: 'heading',
      entryPoint: { key: 3, kind: 'keyboard' },
      render: ({ value }) => (
        <span role="textbox" contentEditable suppressContentEditableWarning>
          {typeof value === 'string' ? value : 'unsupported'}
        </span>
      ),
    });
    expect(screen.getByRole('textbox')).not.toHaveFocus();
    expect(unavailableSelection.view.unmount).not.toThrow();
  });
});
