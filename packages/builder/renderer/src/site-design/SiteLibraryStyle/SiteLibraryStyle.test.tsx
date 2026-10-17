import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SiteLibrary } from '@craftkit/builder-schema';

import { SiteDesignContext } from '../site-design-context';
import { SiteLibraryStyle } from './SiteLibraryStyle';

const library: SiteLibrary = {
  palette: [{ id: 'brand', name: 'Brand', value: '#0f766e' }],
};

function libraryStyle(container: HTMLElement): HTMLStyleElement | null {
  return container.querySelector('style[data-ck-library]');
}

describe('SiteLibraryStyle', () => {
  it('publishes the palette passed as a prop', () => {
    const { container } = render(<SiteLibraryStyle library={library} />);
    expect(libraryStyle(container)?.textContent).toContain('--ck-c-brand: #0f766e;');
  });

  it('falls back to the library the context provides', () => {
    const { container } = render(
      <SiteDesignContext.Provider value={{ library }}>
        <SiteLibraryStyle />
      </SiteDesignContext.Provider>,
    );
    expect(libraryStyle(container)?.textContent).toContain('--ck-c-brand');
  });

  it('prefers the prop over the context', () => {
    const other: SiteLibrary = { palette: [{ id: 'ink', name: 'Ink', value: '#111827' }] };
    const { container } = render(
      <SiteDesignContext.Provider value={{ library }}>
        <SiteLibraryStyle library={other} />
      </SiteDesignContext.Provider>,
    );
    const css = libraryStyle(container)?.textContent ?? '';
    expect(css).toContain('--ck-c-ink');
    expect(css).not.toContain('--ck-c-brand');
  });

  it('renders nothing for a library with no CSS, or none at all', () => {
    expect(libraryStyle(render(<SiteLibraryStyle library={{}} />).container)).toBeNull();
    expect(libraryStyle(render(<SiteLibraryStyle />).container)).toBeNull();
  });
});
