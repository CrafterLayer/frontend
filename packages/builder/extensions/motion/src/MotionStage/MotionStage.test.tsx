import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { MotionStage } from './MotionStage';

/*
  `useReducedMotion` reads a media query, and jsdom ships no matchMedia. The
  stub defaults to "no preference" so the default path is what the tests below
  exercise unless one of them says otherwise.
*/
const reducedMotion = false;

/** jsdom's stub needs listener methods to exist; nothing here has to happen. */
function noop(): void {
  return undefined;
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
      media: query,
      onchange: null,
      addEventListener: noop,
      removeEventListener: noop,
      addListener: noop,
      removeListener: noop,
      dispatchEvent: () => false,
    }),
  });
});

describe('MotionStage', () => {
  it('renders its children when no motion is asked for', () => {
    render(
      <MotionStage>
        <p>Visible either way</p>
      </MotionStage>,
    );

    expect(screen.getByText('Visible either way')).toBeInTheDocument();
  });

  /*
    The point of the CSS baseline. A stage that is not pinning must leave no
    engine-driven wrapper behind — the attributes are all the stylesheet needs.
  */
  it('carries the motion intent as data attributes rather than inline timings', () => {
    const { container } = render(
      <MotionStage spec={{ reveal: 'fade-up', duration: 'slow' }}>
        <p>Content</p>
      </MotionStage>,
    );
    const stage = container.firstElementChild;

    expect(stage?.getAttribute('data-reveal')).toBe('fade-up');
    expect(stage?.getAttribute('data-duration')).toBe('slow');
    expect(stage?.getAttribute('style') ?? '').not.toMatch(/\d+ms/);
  });

  it('adds no attributes at all when motion is switched off', () => {
    const { container } = render(
      <MotionStage spec={{ reveal: 'none' }}>
        <p>Still</p>
      </MotionStage>,
    );
    const stage = container.firstElementChild;

    expect(stage?.getAttribute('data-reveal')).toBeNull();
    expect(stage?.className).toBe('');
  });

  /*
    The one thing CSS cannot portably do: tell a child its own position. The
    stylesheet's `calc(step * var(--stagger-index))` is inert without it.
  */
  it('gives each child its position so a cascade can be computed', () => {
    const { container } = render(
      <MotionStage spec={{ reveal: 'fade', stagger: 'normal' }}>
        <p>One</p>
        <p>Two</p>
        <p>Three</p>
      </MotionStage>,
    );
    const children = Array.from(container.firstElementChild?.children ?? []);

    expect(children).toHaveLength(3);
    children.forEach((child, index) => {
      expect(child.getAttribute('style')).toContain(`--stagger-index: ${String(index)}`);
    });
  });

  it('leaves children untouched when no stagger is asked for', () => {
    const { container } = render(
      <MotionStage spec={{ reveal: 'fade' }}>
        <p>One</p>
      </MotionStage>,
    );

    expect(container.firstElementChild?.firstElementChild?.getAttribute('style')).toBeNull();
  });

  it('preserves a class the block supplied alongside the motion class', () => {
    const { container } = render(
      <MotionStage spec={{ reveal: 'fade' }} className="mkt-section">
        <p>Content</p>
      </MotionStage>,
    );

    expect(container.firstElementChild?.className).toContain('mkt-section');
    expect(container.firstElementChild?.className).toContain('bldr-motion');
  });

  it('renders content that is not a valid element without complaint', () => {
    render(<MotionStage spec={{ stagger: 'tight' }}>plain text</MotionStage>);

    expect(screen.getByText('plain text')).toBeInTheDocument();
  });
});
