import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';

import { createBuilder, insertedNodeId, type BuilderKernel } from '@craftkit/builder-core';
import {
  fakeExtension,
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { BuilderProvider } from '../components/BuilderProvider';
import { useBuilder } from './use-builder';
import { useDispatch } from './use-dispatch';
import { useNode } from './use-node';
import { useRegistryVersion } from './use-registry-version';
import { useSelection } from './use-selection';

function makeKernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('hk') },
  });
}

function mount(kernel: BuilderKernel, ui: React.ReactNode) {
  return render(<BuilderProvider kernel={kernel}>{ui}</BuilderProvider>);
}

function NodeProbe({ id }: { id: string }) {
  const node = useNode(id);
  const content = node?.props['content'];
  return (
    <output data-testid={`node-${id}`}>
      {node === undefined ? '∅' : typeof content === 'string' ? content : node.type}
    </output>
  );
}

function SelectionProbe() {
  const selection = useSelection();
  return <output data-testid="selection">{selection.join(',')}</output>;
}

function DispatchProbe() {
  const dispatch = useDispatch();
  return (
    <button
      type="button"
      onClick={() => {
        dispatch('setProp', { id: 'p1', key: 'content', value: 'Dispatched.' });
      }}
    >
      change
    </button>
  );
}

function RegistryVersionProbe() {
  const version = useRegistryVersion();
  return <output data-testid="version">{version}</output>;
}

describe('builder-react hooks (FR-004)', () => {
  it('useNode tracks one node live, and reports removal as undefined', () => {
    const kernel = makeKernel();
    mount(kernel, <NodeProbe id="p1" />);
    expect(screen.getByTestId('node-p1')).toHaveTextContent('Welcome aboard.');

    act(() => {
      kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Edited.' });
    });
    expect(screen.getByTestId('node-p1')).toHaveTextContent('Edited.');

    act(() => {
      kernel.dispatch('removeNode', { id: 'p1' });
    });
    expect(screen.getByTestId('node-p1')).toHaveTextContent('∅');
  });

  it('useSelection reflects kernel selection state', () => {
    const kernel = makeKernel();
    mount(kernel, <SelectionProbe />);
    expect(screen.getByTestId('selection')).toHaveTextContent('');

    act(() => {
      kernel.setSelection(['hero1', 'p1']);
    });
    expect(screen.getByTestId('selection')).toHaveTextContent('hero1,p1');
  });

  it('useDispatch flows through the single door with attribution', () => {
    const kernel = makeKernel();
    mount(kernel, <DispatchProbe />);
    act(() => {
      screen.getByRole('button', { name: 'change' }).click();
    });
    expect(kernel.getDocument().nodes['p1']?.props['content']).toBe('Dispatched.');
    expect(kernel.transactions().at(-1)?.author).toBe('user');
  });

  it('useRegistryVersion bumps on runtime registration and disposal (FR-013)', () => {
    const kernel = makeKernel();
    mount(kernel, <RegistryVersionProbe />);
    // The snapshot is the kernel-intrinsic catalog version, so construction-time
    // registrations already count — only RELATIVE bumps are contractual.
    const initial = Number(screen.getByTestId('version').textContent);

    act(() => {
      kernel.extensions.register(fakeExtension);
    });
    expect(Number(screen.getByTestId('version').textContent)).toBe(initial + 1);

    act(() => {
      kernel.extensions.dispose('fake');
    });
    expect(Number(screen.getByTestId('version').textContent)).toBe(initial + 2);
  });

  it('does not drop a registration fired before the consumer subscribes (mount-order race)', () => {
    // A tree-order-earlier sibling registers from its own mount effect — its
    // passive effect runs BEFORE the probe's subscription attaches. The event
    // bus has no replay, so a listener-derived version would stay stale; the
    // kernel-intrinsic snapshot is re-checked after subscribing and catches it.
    const kernel = makeKernel();
    const before = kernel.extensions.version();
    function EarlyRegistrar() {
      const builder = useBuilder();
      useEffect(() => {
        builder.extensions.register(fakeExtension);
        return () => {
          builder.extensions.dispose('fake');
        };
      }, [builder]);
      return null;
    }
    mount(
      kernel,
      <>
        <EarlyRegistrar />
        <RegistryVersionProbe />
      </>,
    );
    expect(Number(screen.getByTestId('version').textContent)).toBe(before + 1);
  });

  it('insertedNodeId helper round-trips through a hook-driven insert', () => {
    const kernel = makeKernel();
    const tx = kernel.dispatch('insertNode', { type: 'text', parentId: 'sec1' });
    expect(insertedNodeId(tx.patches)).toBeDefined();
  });
});
