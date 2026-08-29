import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
  stressDocument,
} from '@craftkit/builder-core/testing';

import { withPassThroughRenderers } from '../../test-utils';
import { DocumentView, type InlineEditSeam } from './DocumentView';

function makeKernel(document = landingFixture()) {
  return createBuilder({
    document,
    // Pass-through renderers actually mount slot children, so walks/counts see
    // the whole tree (the kernel's own fixtures render null by design).
    extensions: [withPassThroughRenderers(fixtureBlocks)],
    ports: { clock: fixedClock(), ids: seededIds('dv') },
  });
}

describe('DocumentView (US1)', () => {
  it('renders every node of the landing fixture in document order', () => {
    const kernel = makeKernel();
    // Fixture blocks render nothing visually (NullRender); the probe observes the
    // tree walk itself — which IS the document order contract.
    const seen: string[] = [];
    render(<DocumentView kernel={kernel} onBlockRender={(id) => seen.push(id)} />);
    expect(seen).toEqual(['root', 'hero1', 'cta1', 'cta2', 'sec1', 'p1']);
  });

  it('SC-002: one setProp re-renders exactly ONE block view on the 1,000-node stress doc; selection re-renders none', () => {
    const kernel = makeKernel(stressDocument(1000));
    const counts = new Map<string, number>();
    render(
      <DocumentView
        kernel={kernel}
        onBlockRender={(id) => counts.set(id, (counts.get(id) ?? 0) + 1)}
      />,
    );
    expect(counts.size).toBe(1000); // initial mount touches every node once
    counts.clear();

    act(() => {
      kernel.dispatch('setProp', { id: 'txt-3-7', key: 'content', value: 'hot' });
    });
    expect([...counts.entries()]).toEqual([['txt-3-7', 1]]);

    counts.clear();
    act(() => {
      kernel.setSelection(['txt-1-1']);
    });
    expect(counts.size).toBe(0);
  });

  it('SC-002: OPENING an inline edit reaches only its named node on the 1,000-node stress doc', () => {
    const kernel = makeKernel(stressDocument(1000));
    const counts = new Map<string, number>();
    const onBlockRender = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
    type Target = NonNullable<ReturnType<InlineEditSeam['getSnapshot']>>;
    const listeners = new Map<string, Set<() => void>>();
    let open: { nodeId: string; target: Target } | null = null;
    const seam: InlineEditSeam = {
      subscribe: (nodeId, listener) => {
        const own = listeners.get(nodeId) ?? new Set<() => void>();
        own.add(listener);
        listeners.set(nodeId, own);
        return () => {
          own.delete(listener);
        };
      },
      getSnapshot: (nodeId) => (open?.nodeId === nodeId ? open.target : null),
    };
    render(<DocumentView kernel={kernel} onBlockRender={onBlockRender} inlineEdit={seam} />);
    counts.clear();

    act(() => {
      open = {
        nodeId: 'txt-3-7',
        target: {
          propKey: 'content',
          render: ({ value }) => (typeof value === 'string' ? value : null),
        },
      };
      for (const listener of listeners.get('txt-3-7') ?? []) {
        listener();
      }
    });

    expect([...counts.entries()]).toEqual([['txt-3-7', 1]]);
  });

  it('Law-S audit holds with a mounted view: every observable change pairs 1:1 with a transaction (FR-017)', () => {
    // The core suite proves this headless; re-run it while DocumentView's node
    // subscribers are attached and rendering, so view wiring demonstrably adds
    // zero unaccounted state changes (T037 / convergence).
    const kernel = makeKernel();
    const rendered = new Map<string, number>();
    render(
      <DocumentView
        kernel={kernel}
        onBlockRender={(id) => rendered.set(id, (rendered.get(id) ?? 0) + 1)}
      />,
    );
    rendered.clear();

    let stateChanges = 0;
    let txApplied = 0;
    let historyEvents = 0;
    kernel.context.store.subscribe(() => {
      stateChanges += 1;
    });
    kernel.context.events.on('tx.applied', () => {
      txApplied += 1;
    });
    kernel.context.events.on('history.undone', () => {
      historyEvents += 1;
    });
    kernel.context.events.on('history.redone', () => {
      historyEvents += 1;
    });

    act(() => {
      kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'One' });
    });
    act(() => {
      kernel.dispatch('insertNode', { type: 'text', parentId: 'sec1' });
    });
    act(() => {
      expect(() => kernel.dispatch('insertNode', { type: 'text', parentId: 'ghost' })).toThrow(); // rejected — must not surface as a state change
    });
    act(() => {
      kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'One' }); // no-effect
    });
    act(() => {
      kernel.undo();
    });
    act(() => {
      kernel.redo();
    });
    act(() => {
      kernel.setSelection(['p1']); // kernel state, not a document change
    });

    // Identical invariants to the headless core audit — mounting changed nothing:
    expect(txApplied).toBe(2);
    expect(historyEvents).toBe(2);
    expect(stateChanges).toBe(5);
    // And the mounted view stayed scoped: only touched nodes re-rendered
    // (p1 once per applied change affecting it; parents for the insert path).
    expect(rendered.has('p1')).toBe(true);
    expect(rendered.has('hero1')).toBe(false);
  });

  it('undo through the kernel updates the same scoped view (FR-017 via the door)', () => {
    const kernel = makeKernel(stressDocument(50));
    const counts = new Map<string, number>();
    render(
      <DocumentView
        kernel={kernel}
        onBlockRender={(id) => counts.set(id, (counts.get(id) ?? 0) + 1)}
      />,
    );
    act(() => {
      kernel.dispatch('setProp', { id: 'txt-1-1', key: 'content', value: 'edited' });
    });
    counts.clear();
    act(() => {
      kernel.undo();
    });
    expect([...counts.keys()]).toEqual(['txt-1-1']);
  });

  it('attachNodeElement reports every node with its wrapper, and null on removal (005 §2)', () => {
    const kernel = makeKernel();
    const attached = new Map<string, HTMLElement | null>();
    render(
      <DocumentView
        kernel={kernel}
        attachNodeElement={(id, element) => attached.set(id, element)}
      />,
    );
    expect([...attached.keys()].sort()).toEqual(['cta1', 'cta2', 'hero1', 'p1', 'root', 'sec1']);
    for (const [id, element] of attached) {
      expect(element?.getAttribute('data-bldr-node')).toBe(id);
      expect(element?.getAttribute('data-bldr-type')).toBeTruthy();
    }

    act(() => {
      kernel.dispatch('removeNode', { id: 'p1' });
    });
    expect(attached.get('p1')).toBeNull();
  });

  it('without attachNodeElement the live output carries no editing markers (publish-safe default)', () => {
    const kernel = makeKernel();
    const { container } = render(<DocumentView kernel={kernel} />);
    expect(container.querySelector('[data-bldr-node]')).toBeNull();
  });

  it('runtime registration upgrades fallbacks without reload; disposal downgrades them (SC-005)', () => {
    const kernel = createBuilder({
      document: {
        schemaVersion: 1,
        surface: 'site',
        dir: 'ltr',
        rootId: 'root',
        nodes: { root: { id: 'root', type: 'page', props: {} } },
      },
      ports: { clock: fixedClock(), ids: seededIds('rt') },
    });
    render(<DocumentView kernel={kernel} />);
    expect(screen.getByRole('note')).toHaveTextContent('page');

    act(() => {
      kernel.extensions.register(withPassThroughRenderers(fixtureBlocks));
    });
    expect(screen.queryByRole('note')).not.toBeInTheDocument();

    act(() => {
      kernel.extensions.dispose('fixture-blocks-passthrough');
    });
    expect(screen.getByRole('note')).toHaveTextContent('page');
  });
});

describe('isCanvas is a fact, not a literal', () => {
  /*
    The regression this pins: NodeView rendered `isCanvas` as the bare literal
    `true`, and preview renders through this same view. Any block that showed
    editing-only scaffolding behind the flag — an empty-state hint, a drop
    affordance — therefore showed it to the reader of the finished page too.
  */
  function recordingKernel(seen: boolean[], seed: string) {
    function Recorder({ node, slots, isCanvas }: BlockRenderProps) {
      seen.push(isCanvas);
      return <div data-node-id={node.id}>{Object.values(slots)}</div>;
    }

    const base = withPassThroughRenderers(fixtureBlocks);
    return createBuilder({
      document: landingFixture(),
      extensions: [
        {
          ...base,
          contributes: {
            ...base.contributes,
            blocks: (base.contributes?.blocks ?? []).map((contribution) => ({
              schema: contribution.schema,
              render: Recorder,
            })),
          },
        },
      ],
      ports: { clock: fixedClock(), ids: seededIds(seed) },
    });
  }

  it('defaults to true, because every ordinary caller is the canvas', () => {
    const seen: boolean[] = [];
    render(<DocumentView kernel={recordingKernel(seen, 'dv-canvas')} />);

    expect(seen.length).toBeGreaterThan(1);
    // A set, not `.every`: a failure then names what was actually recorded.
    expect([...new Set(seen)]).toEqual([true]);
  });

  it('is false for every node when the host says it is not the canvas', () => {
    const seen: boolean[] = [];
    render(<DocumentView kernel={recordingKernel(seen, 'dv-preview')} isCanvas={false} />);

    // Every node, not just the root: the flag has to survive the recursion, and
    // a literal `true` deeper in the tree is exactly the bug being pinned.
    expect(seen.length).toBeGreaterThan(1);
    expect([...new Set(seen)]).toEqual([false]);
  });
});
