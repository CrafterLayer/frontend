import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BuilderShell } from './BuilderShell';

afterEach(cleanup);

const regions = {
  rail: <nav aria-label="Sections">rail</nav>,
  panel: <div data-testid="panel">panel</div>,
  canvas: <div data-testid="canvas">canvas</div>,
  dock: <div data-testid="dock">dock</div>,
  aside: <div data-testid="aside">aside</div>,
  top: <div data-testid="top">top</div>,
  status: <div data-testid="status">status</div>,
};

function shell(): HTMLElement {
  return screen.getByRole('application', { name: 'Builder' });
}

describe('BuilderShell — the layout, and nothing else', () => {
  it('places every region it is given', () => {
    render(<BuilderShell {...regions} />);
    for (const id of ['top', 'panel', 'canvas', 'dock', 'aside', 'status']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
  });

  it('renders NO element for an absent region, so it can reserve no space', () => {
    // The point is not that the region is hidden — it is that there is nothing
    // there at all, which is what lets the CSS collapse its track to zero.
    const { container } = render(<BuilderShell canvas={regions.canvas} />);
    expect(container.querySelector('.bldr-shell__panel')).toBeNull();
    expect(container.querySelector('.bldr-shell__aside')).toBeNull();
    expect(container.querySelector('.bldr-shell__dock')).toBeNull();
    expect(container.querySelector('.bldr-shell__top')).toBeNull();
    expect(container.querySelector('.bldr-shell__status')).toBeNull();
    // The canvas is the one region that is never optional.
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
  });

  it('keeps the dock inside the canvas column, not beside it', () => {
    // If the dock were a sibling of the canvas in the OUTER grid, opening it
    // would shrink the panel and the inspector too. It belongs to the canvas.
    const { container } = render(<BuilderShell {...regions} />);
    const main = container.querySelector('.bldr-shell__main');
    if (main === null) {
      throw new Error('the shell must render a canvas column');
    }
    expect(within(main as HTMLElement).getByTestId('canvas')).toBeInTheDocument();
    expect(within(main as HTMLElement).getByTestId('dock')).toBeInTheDocument();
    expect(within(main as HTMLElement).queryByTestId('aside')).toBeNull();
  });

  it('orders the regions so the tab sequence follows the visual one', () => {
    // Grid areas let CSS place a region anywhere, which makes it easy to ship a
    // tab order that jumps around the screen. The DOM order is the contract.
    const { container } = render(<BuilderShell {...regions} />);
    const classes = [...container.querySelectorAll('.bldr-shell > *')].map(
      (element) => element.className,
    );
    expect(classes).toEqual([
      'bldr-shell__top',
      'bldr-shell__rail',
      'bldr-shell__panel',
      'bldr-shell__main',
      'bldr-shell__aside',
      'bldr-shell__status',
    ]);
  });

  it('names the editor for assistive technology, and lets a host rename it', () => {
    render(<BuilderShell canvas={regions.canvas} />);
    expect(shell()).toBeInTheDocument();
    cleanup();
    render(<BuilderShell canvas={regions.canvas} label="Landing page editor" />);
    expect(screen.getByRole('application', { name: 'Landing page editor' })).toBeInTheDocument();
  });

  it('keeps a host class alongside its own rather than replacing it', () => {
    const { container } = render(
      <BuilderShell canvas={regions.canvas} className="playground-shell" />,
    );
    const root = container.firstElementChild;
    expect(root).toHaveClass('bldr-shell');
    expect(root).toHaveClass('playground-shell');
  });

  it('sets no colour, size or direction of its own', () => {
    // Everything visual comes from tokens in the stylesheet. An inline style
    // here would be a value no theme could reach.
    const { container } = render(<BuilderShell {...regions} />);
    for (const element of container.querySelectorAll('.bldr-shell, .bldr-shell > *')) {
      expect(element.getAttribute('style')).toBeNull();
      expect(element.getAttribute('dir')).toBeNull();
    }
  });
});
