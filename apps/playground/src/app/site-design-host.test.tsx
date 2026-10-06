import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useContext } from 'react';
import {
  CustomCodeClassTransformContext,
  SiteDesignContext,
  type BuilderSite,
  type BuilderSiteKernel,
} from '@craftkit/builder';

import { SiteDesignHost } from './site-design-host';

/** The two reads the host makes of a site kernel, with a switchable library. */
function fakeSiteKernel(library: BuilderSite['library']) {
  let site = { library } as BuilderSite;
  const listeners = new Set<() => void>();
  const kernel = {
    getSite: () => site,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as unknown as BuilderSiteKernel;
  const setLibrary = (next: BuilderSite['library']) => {
    site = { library: next } as BuilderSite;
    for (const listener of listeners) listener();
  };
  return { kernel, setLibrary };
}

function Probe() {
  const transform = useContext(CustomCodeClassTransformContext);
  const design = useContext(SiteDesignContext);
  return (
    <output aria-label="expanded" data-has-library={String(design.library !== undefined)}>
      {transform('ck-s-card text-start')}
    </output>
  );
}

describe('SiteDesignHost', () => {
  it('expands named-style markers for the canvas and follows a style edit', () => {
    const { kernel, setLibrary } = fakeSiteKernel({
      styles: { card: { id: 'card', name: 'Card', className: 'p-6 rounded-xl' } },
    });
    render(
      <SiteDesignHost siteKernel={kernel}>
        <Probe />
      </SiteDesignHost>,
    );
    const out = screen.getByRole('status', { name: 'expanded' });
    expect(out.textContent).toContain('p-6');
    expect(out.textContent).toContain('rounded-xl');
    expect(out.textContent).toContain('text-start');
    expect(out.dataset['hasLibrary']).toBe('true');
    act(() => {
      setLibrary({ styles: { card: { id: 'card', name: 'Card', className: 'p-10' } } });
    });
    expect(out.textContent).toContain('p-10');
    expect(out.textContent).not.toContain('rounded-xl');
  });

  it('puts the palette into the host head and swaps the element when a colour changes', () => {
    const { kernel, setLibrary } = fakeSiteKernel({
      palette: [{ id: 'brand', name: 'Brand', value: '#0f766e' }],
    });
    const { unmount } = render(
      <SiteDesignHost siteKernel={kernel}>
        <span />
      </SiteDesignHost>,
    );
    const first = document.head.querySelector('style[data-ck-library]');
    expect(first?.textContent).toContain('--ck-c-brand');
    act(() => {
      setLibrary({ palette: [{ id: 'brand', name: 'Brand', value: '#b91c1c' }] });
    });
    const second = document.head.querySelector('style[data-ck-library]');
    // A new element, not new text: the canvas frame mirrors added style nodes only.
    expect(second).not.toBe(first);
    expect(second?.textContent).toContain('#b91c1c');
    unmount();
    expect(document.head.querySelector('style[data-ck-library]')).toBeNull();
  });

  it('renders children untouched without a site kernel', () => {
    render(
      <SiteDesignHost siteKernel={undefined}>
        <Probe />
      </SiteDesignHost>,
    );
    const out = screen.getByRole('status', { name: 'expanded' });
    expect(out.textContent).toContain('text-start');
    expect(out.dataset['hasLibrary']).toBe('false');
  });
});
