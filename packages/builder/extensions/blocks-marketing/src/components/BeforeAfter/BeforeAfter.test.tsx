import { fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { BeforeAfter } from './BeforeAfter';
import { beforeAfterExamples } from './examples';
import { beforeAfterSchema, type BeforeAfterProps } from './schema';

const node: Node = { id: 'compare', type: 'beforeAfter', props: {} };
const PHOTOS = {
  beforeSrc: '/assets/room-before.jpg',
  beforeAlt: 'The room before',
  afterSrc: '/assets/room-after.jpg',
  afterAlt: 'The room after',
};

function props(overrides: Record<string, unknown> = {}): BeforeAfterProps {
  return beforeAfterSchema.props.parse({ ...PHOTOS, ...overrides });
}

function renderLive(overrides: Record<string, unknown> = {}, isCanvas = false) {
  return render(
    <BeforeAfter node={node} props={props(overrides)} slots={{}} data={{}} isCanvas={isCanvas} />,
  );
}

function staticMarkup(value: BeforeAfterProps): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(
    <BeforeAfter node={node} props={value} slots={{}} data={{}} isCanvas={false} />,
  );
  return host;
}

const frameOf = (root: ParentNode) => root.querySelector<HTMLElement>('[data-before-after-frame]');

describe('BeforeAfter', () => {
  it('is a section named by its heading, with both photos and their corner labels', () => {
    renderLive({ caption: 'Staged in March.' });
    expect(screen.getByRole('region', { name: 'See the difference' })).toHaveClass('@container');
    expect(screen.getByRole('img', { name: 'The room before' })).toHaveAttribute(
      'src',
      '/assets/room-before.jpg',
    );
    expect(screen.getByRole('img', { name: 'The room after' })).toHaveAttribute('loading', 'lazy');
    expect(screen.getByText('Before')).toHaveClass('start-3');
    expect(screen.getByText('After')).toHaveClass('end-3');
    expect(screen.getByText('Staged in March.').tagName).toBe('FIGCAPTION');
  });

  it('moves the divider with a native, named range and reads the position as a percentage', () => {
    const { container } = renderLive({ start: 40 });
    const slider = screen.getByRole('slider', { name: 'Drag to compare before and after' });
    expect(slider).toHaveValue('40');
    expect(slider).toHaveAttribute('aria-valuetext', '40%');
    expect(frameOf(container)?.style.getPropertyValue('--ck-compare')).toBe('40%');
    fireEvent.change(slider, { target: { value: '72' } });
    expect(frameOf(container)?.style.getPropertyValue('--ck-compare')).toBe('72%');
    expect(slider).toHaveAttribute('aria-valuetext', '72%');
    /* The handle is decoration; the range is the control. */
    expect(container.querySelector('[data-before-after-handle]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('clips the after photo from the inline start in either direction', () => {
    renderLive();
    expect(screen.getByRole('img', { name: 'The room after' })).toHaveClass(
      '[clip-path:inset(0_0_0_var(--ck-compare))]',
      'rtl:[clip-path:inset(0_var(--ck-compare)_0_0)]',
    );
    expect(screen.getByRole('img', { name: 'The room before' }).className).not.toContain(
      'clip-path',
    );
  });

  it('keeps the slider inert on the editing canvas, so a click selects', () => {
    renderLive({}, true);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('tabindex', '-1');
    expect(slider).toHaveClass('pointer-events-none');
  });

  it('publishes for the compare pack: two images, its name and start, and no React control', () => {
    const host = staticMarkup(props({ start: 35, sliderLabel: 'Compare' }));
    const frame = frameOf(host);
    expect(frame).toHaveAttribute('data-ck-behavior', 'compare');
    expect(frame).toHaveAttribute('data-ck-compare-label', 'Compare');
    expect(frame).toHaveAttribute('data-ck-compare-start', '35');
    expect([...(frame?.children ?? [])].filter((child) => child.tagName === 'IMG')).toHaveLength(2);
    expect(host.querySelector('input')).toBeNull();
    expect(host.querySelector('[data-before-after-handle]')).toBeNull();
    /* The pack draws the line; the block adds none of its own. */
    expect(host.querySelector('[data-before-after-divider]')).toBeNull();
  });

  it('draws two placeholders, and no behaviour, until both photos are chosen', () => {
    const host = staticMarkup(beforeAfterSchema.props.parse({}));
    expect(host.querySelectorAll('[data-before-after-placeholder]')).toHaveLength(2);
    expect(frameOf(host)).not.toHaveAttribute('data-ck-behavior');
    expect(host.querySelector('[data-before-after-divider]')).not.toBeNull();
  });

  it('names a photo by its corner label when its alt text is empty', () => {
    renderLive({ beforeAlt: '', afterAlt: '' });
    expect(screen.getByRole('img', { name: 'Before' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'After' })).toBeInTheDocument();
  });

  it('hides the labels when asked and sizes the frame by aspect', () => {
    const { container } = renderLive({ showLabels: false, aspect: 'portrait' });
    expect(screen.queryByText('Before')).toBeNull();
    expect(frameOf(container)).toHaveClass('aspect-3/4', 'max-w-xl');
  });

  it('combines token-based colour, typography, and logical spacing controls', () => {
    renderLive({ background: 'accent', fontFamily: 'serif', marginInlineEnd: 4, tone: 'dark' });
    const section = screen.getByRole('region', { name: 'See the difference' });
    expect(section).toHaveClass('mkt-type--family-serif', 'mkt-slab');
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });
});

describe('BeforeAfter schema', () => {
  it('defaults to a centred, labelled comparison and maps every inspector prop', () => {
    const defaults = beforeAfterSchema.props.parse({});
    expect(defaults).toMatchObject({
      heading: 'See the difference',
      start: 50,
      aspect: 'landscape',
      showLabels: true,
      width: 'wide',
    });
    expect(Object.keys(beforeAfterSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(beforeAfterSchema.props.shape).sort(),
    );
  });

  it('refuses unsafe image sources and a start outside 0–100', () => {
    const parse = (value: unknown) => beforeAfterSchema.props.safeParse(value).success;
    expect(parse({ beforeSrc: 'javascript:alert(1)' })).toBe(false);
    expect(parse({ afterSrc: '//evil.example/x.jpg' })).toBe(false);
    expect(parse({ start: 101 })).toBe(false);
    expect(parse({ start: 12.5 })).toBe(false);
    expect(parse({ beforeSrc: 'data:image/png;base64,iVBORw0KGgo=' })).toBe(true);
  });

  it('ships model-facing examples that parse, one of them in Arabic', () => {
    for (const example of beforeAfterExamples) {
      const exampleNode = example.node as { type: string; props: unknown };
      expect(exampleNode.type).toBe('beforeAfter');
      expect(beforeAfterSchema.props.safeParse(exampleNode.props).success, example.prompt).toBe(
        true,
      );
    }
    expect(beforeAfterExamples.some((example) => /[؀-ۿ]/u.test(example.prompt))).toBe(true);
  });
});
