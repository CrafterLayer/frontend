import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Hero } from './Hero';
import { heroSchema } from './schema';

/*
  Block parts (DESIGN §4.3): every inner element of the hero is addressable on
  the canvas, carries nothing extra when published, takes its own classes and
  direction from `partStyles`, and renders an inline editor swapped in at its
  bind exactly where the text was.
*/
const node: Node = { id: 'hero-parts', type: 'hero', props: {}, slots: { media: ['m'] } };

const FULL = {
  eyebrow: 'New release',
  heading: 'Build faster.',
  body: 'Premium blocks, edited in place.',
  trustLine: 'Trusted by 2,000 teams.',
  variant: 'split',
};

function renderHero(overrides: Record<string, unknown>, isCanvas: boolean, swap = {}) {
  const props = { ...heroSchema.props.parse({ ...FULL, ...overrides }), ...swap };
  return render(
    <Hero
      node={node}
      props={props}
      slots={{ media: <span>media child</span> }}
      data={{}}
      isCanvas={isCanvas}
    />,
  );
}

function partOf(container: HTMLElement, name: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[data-ck-part="${name}"]`);
  if (found === null) throw new Error(`no part "${name}"`);
  return found;
}

describe('Hero parts', () => {
  it('stamps every declared part with its bind on the canvas', () => {
    const { container } = renderHero({}, true);
    for (const name of Object.keys(heroSchema.parts ?? {})) {
      expect(container.querySelector(`[data-ck-part="${name}"]`), name).not.toBeNull();
    }
    expect(partOf(container, 'heading')).toHaveAttribute('data-ck-bind', 'heading');
    expect(partOf(container, 'heading').tagName).toBe('H1');
    expect(partOf(container, 'body')).toHaveTextContent('Premium blocks, edited in place.');
    expect(partOf(container, 'trustLine')).toHaveAttribute('data-ck-bind', 'trustLine');
    expect(partOf(container, 'copy')).not.toHaveAttribute('data-ck-bind');
  });

  it('publishes no part markers and keeps the structural hooks', () => {
    const { container } = renderHero({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
    expect(container.querySelector('[data-mkt-part="trust-line"]')).not.toBeNull();
    expect(container.querySelector('[data-mkt-part="copy"]')).not.toBeNull();
  });

  it('lands a part style and direction override on that part only', () => {
    const { container } = renderHero(
      { partStyles: { heading: { className: 'ps-4', dir: 'ltr' } } },
      true,
    );
    const heading = partOf(container, 'heading');
    expect(heading).toHaveClass('ps-4', 'font-bold');
    expect(heading).toHaveAttribute('dir', 'ltr');
    expect(partOf(container, 'body')).not.toHaveClass('ps-4');
  });

  it('gives English text its own direction so the full stop stays at the end', () => {
    const { container } = renderHero({}, false);
    expect(container.querySelector('h1')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('[data-mkt-part="eyebrow"]')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('[data-mkt-part="copy"]')).not.toHaveAttribute('dir');
  });

  it('renders an element swapped in at each text bind in place', () => {
    const swap = Object.fromEntries(
      ['eyebrow', 'heading', 'body', 'trustLine'].map((key) => [key, <span data-swap={key} />]),
    );
    const { container } = renderHero({}, true, swap);
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of Object.keys(swap)) {
      const swapped = container.querySelectorAll(`[data-swap="${key}"]`);
      expect(swapped, key).toHaveLength(1);
      expect(swapped[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
