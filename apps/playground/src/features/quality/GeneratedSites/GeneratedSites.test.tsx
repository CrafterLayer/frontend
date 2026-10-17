import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createPlaygroundKernel } from '../../preview/create-playground-kernel';
import { GeneratedSites } from './GeneratedSites';

const kernel = createPlaygroundKernel({ fixture: 'landing' });

function renderPage(width = 1024) {
  return render(
    <GeneratedSites
      document={kernel.getDocument()}
      blocks={kernel.context.registry.block}
      width={width}
    />,
  );
}

describe('GeneratedSites', () => {
  it('renders the page through the STATIC renderer, with no editor chrome', () => {
    const { container } = renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    /*
      Measuring the real canvas would measure the editor's own furniture along
      with the page, and every overlap between a toolbar and a heading would be
      reported as a page defect.
    */
    expect(container.querySelector('[data-bldr-selected]')).toBeNull();
    expect(container.querySelector('[contenteditable]')).toBeNull();
  });

  it('applies the width as a REAL width, not a scaled preview', () => {
    const { container } = renderPage(360);
    const host = container.querySelector<HTMLElement>('[data-generated-site]');
    expect(host?.style.inlineSize).toBe('360px');
    expect(host?.style.maxInlineSize).toBe('360px');
    // A transform would report the scaled numbers, which are not the ones a
    // person's browser produces.
    expect(host?.style.transform).toBe('');
  });

  it('says which width it is, so a failure can name it', () => {
    const { container } = renderPage(768);
    expect(container.querySelector('[data-generated-site]')?.getAttribute('data-width')).toBe(
      '768',
    );
  });
});
