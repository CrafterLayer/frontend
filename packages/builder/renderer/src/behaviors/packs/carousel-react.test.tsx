import { render, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CustomCode } from '../../components/CustomCode';
import { CAROUSEL_SOURCE } from '../../engines/carousel-source';

vi.mock('../../engines/inject', () => ({ ensureCanvasEngines: () => () => undefined }));

class Observer {
  observe() {
    /* No layout in jsdom. */
  }
  disconnect() {
    /* No retained observer. */
  }
  unobserve() {
    /* No layout in jsdom. */
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'ckCarouselFactory');
});

it('real generated Embla never reparents a React-owned preview track during update/removal', () => {
  vi.stubGlobal('ResizeObserver', Observer);
  vi.stubGlobal('IntersectionObserver', Observer);
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- execute the actual standalone trusted engine asset
  new Function('window', CAROUSEL_SOURCE)(window);
  const slides = {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        attributes: { 'data-ck-behavior': 'carousel' },
        children: [
          {
            kind: 'element',
            tag: 'ul',
            children: [
              { kind: 'element', tag: 'li', text: 'One' },
              { kind: 'element', tag: 'li', text: 'Two' },
            ],
          },
        ],
      },
    ],
  };
  const view = render(<CustomCode hostId="qa" tree={slides} isCanvas={false} />);
  const section = view.container.querySelector('section');
  const track = view.container.querySelector('ul');
  expect(section).toHaveAttribute('data-ck-carousel-engine', 'embla');
  expect(track?.parentElement).toBe(section);
  const replaced = {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        children: [{ kind: 'element', tag: 'p', text: 'Replacement' }],
      },
    ],
  };
  expect(() => {
    view.rerender(<CustomCode hostId="qa" tree={replaced} isCanvas={false} />);
  }).not.toThrow();
  expect(view.container.querySelector('p')).toHaveTextContent('Replacement');
  expect(section).not.toHaveAttribute('data-ck-embla-viewport');
  expect(section?.style.overflowX).toBe('');
  expect(track?.style.transform).toBe('');
  expect(() => {
    view.unmount();
  }).not.toThrow();
});
