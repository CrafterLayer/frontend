import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SiteDesignContext, useSiteDesign, type SiteDesign } from './site-design-context';

function Probe({ onRead }: { onRead: (design: SiteDesign) => void }) {
  onRead(useSiteDesign());
  return null;
}

describe('SiteDesignContext', () => {
  it('defaults to an empty design: no library and no class transform', () => {
    let read: SiteDesign | undefined;
    render(<Probe onRead={(design) => (read = design)} />);
    expect(read).toEqual({});
    expect(read?.library).toBeUndefined();
    expect(read?.classTransform).toBeUndefined();
  });

  it('hands the provided library and class transform to a reader', () => {
    const classTransform = (className: string) => `${className} expanded`;
    const library = { palette: [{ id: 'brand', name: 'Brand', value: '#0f766e' }] };
    let read: SiteDesign | undefined;
    render(
      <SiteDesignContext.Provider value={{ library, classTransform }}>
        <Probe onRead={(design) => (read = design)} />
      </SiteDesignContext.Provider>,
    );
    expect(read?.library).toBe(library);
    expect(read?.classTransform?.('ck-s-card')).toBe('ck-s-card expanded');
  });
});
