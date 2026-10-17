import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fakeExtension, fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { CanvasFrame } from './components/CanvasFrame';
import { lightTheme } from './themes';
import { useRegistryEpoch } from './subscribe';

describe('renderer branch coverage', () => {
  it('un-mirrors host styles that are REMOVED after mount', async () => {
    const transient = document.createElement('style');
    transient.textContent = '.transient { color: teal; }';
    document.head.appendChild(transient);

    render(
      <CanvasFrame theme={lightTheme} dir="ltr">
        <p>content</p>
      </CanvasFrame>,
    );
    const frame = screen.getByTitle<HTMLIFrameElement>('Preview');
    const frameDocument = () => {
      const doc = frame.contentDocument;
      if (doc === null) throw new Error('no contentDocument');
      return doc;
    };
    await waitFor(() => {
      expect(
        [...frameDocument().head.querySelectorAll('style')].some(
          (styleNode) => styleNode.textContent === '.transient { color: teal; }',
        ),
      ).toBe(true);
    });

    act(() => {
      transient.remove();
    });
    await waitFor(() => {
      expect(
        [...frameDocument().head.querySelectorAll('style')].some(
          (styleNode) => styleNode.textContent === '.transient { color: teal; }',
        ),
      ).toBe(false);
    });
  });

  it('mirrors LINK stylesheet elements too, not just STYLE', async () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'data:text/css,.linked%7Bcolor:purple%7D';
    document.head.appendChild(link);

    render(
      <CanvasFrame theme={lightTheme} dir="ltr">
        <p>content</p>
      </CanvasFrame>,
    );
    const frame = screen.getByTitle<HTMLIFrameElement>('Preview');
    await waitFor(() => {
      const doc = frame.contentDocument;
      if (doc === null) throw new Error('no contentDocument');
      expect(
        [...doc.head.querySelectorAll('link')].some(
          (node) => node.rel === 'stylesheet' && node.href.startsWith('data:text/css'),
        ),
      ).toBe(true);
    });
    link.remove();
  });

  it('withPassThroughRenderers tolerates manifests without block contributions', async () => {
    const { withPassThroughRenderers } = await import('./test-utils');
    const wrapped = withPassThroughRenderers({ tier: 1, name: 'bare', version: '1' });
    expect(wrapped.contributes?.blocks).toEqual([]);
  });

  it('useRegistryEpoch observes a registration fired before its subscription attaches', () => {
    // Tree-order-earlier sibling registers in its mount effect; the epoch is
    // kernel-intrinsic, so the post-subscribe snapshot re-check catches it.
    const kernel = createBuilder({ ports: { clock: fixedClock(), ids: seededIds('race') } });
    const before = kernel.extensions.version();
    function EarlyRegistrar() {
      useEffect(() => {
        kernel.extensions.register(fakeExtension);
        return () => {
          kernel.extensions.dispose('fake');
        };
      }, []);
      return null;
    }
    function EpochProbe() {
      const epoch = useRegistryEpoch(kernel);
      return <output>{epoch}</output>;
    }
    render(
      <>
        <EarlyRegistrar />
        <EpochProbe />
      </>,
    );
    expect(Number(screen.getByRole('status').textContent)).toBe(before + 1);
  });

  it('useRegistryEpoch increments per kernel on registration and disposal', () => {
    const kernel = createBuilder({ ports: { clock: fixedClock(), ids: seededIds('ep') } });
    function EpochProbe() {
      const epoch = useRegistryEpoch(kernel);
      return <output>{epoch}</output>;
    }
    render(<EpochProbe />);
    const initial = Number(screen.getByRole('status').textContent);

    act(() => {
      kernel.extensions.register(fakeExtension);
    });
    expect(Number(screen.getByRole('status').textContent)).toBe(initial + 1);

    act(() => {
      kernel.extensions.dispose('fake');
    });
    expect(Number(screen.getByRole('status').textContent)).toBe(initial + 2);
  });
});
