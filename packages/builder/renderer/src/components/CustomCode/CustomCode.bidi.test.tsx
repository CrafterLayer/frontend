import { renderToStaticMarkup } from 'react-dom/server';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CustomCodeNode } from '@craftkit/builder-schema';

import { CustomCode } from './CustomCode';

/** block-parts DESIGN §2.11: customCode text elements take their own base direction. */
const tree = (children: CustomCodeNode[]) => ({ kind: 'root' as const, children });

function renderInRtl(children: CustomCodeNode[], isCanvas = false) {
  return render(
    <div dir="rtl">
      <CustomCode tree={tree(children)} hostId="host1" isCanvas={isCanvas} />
    </div>,
  );
}

describe('CustomCode text direction', () => {
  it('gives an English text element dir="auto" inside an RTL page, on the canvas and off it', () => {
    for (const isCanvas of [false, true]) {
      const { unmount } = renderInRtl(
        [
          { kind: 'element', tag: 'p', text: 'The site grows.' },
          { kind: 'element', tag: 'h2', text: 'Responsive spacing' },
          { kind: 'element', tag: 'a', text: 'Read the docs', attributes: { href: '/docs' } },
        ],
        isCanvas,
      );
      expect(screen.getByText('The site grows.')).toHaveAttribute('dir', 'auto');
      expect(screen.getByText('Responsive spacing')).toHaveAttribute('dir', 'auto');
      expect(screen.getByText('Read the docs')).toHaveAttribute('dir', 'auto');
      unmount();
    }
  });

  it("never overrides an author's dir", () => {
    renderInRtl([
      { kind: 'element', tag: 'p', text: 'Left to right, on purpose.', attributes: { dir: 'ltr' } },
      { kind: 'element', tag: 'p', text: 'نص عربي', attributes: { dir: 'rtl' } },
    ]);
    expect(screen.getByText('Left to right, on purpose.')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('نص عربي')).toHaveAttribute('dir', 'rtl');
  });

  it('leaves elements without their own text, and svg shapes, exactly as they were', () => {
    const { container } = renderInRtl([
      {
        kind: 'element',
        tag: 'section',
        className: 'p-4',
        children: [
          {
            kind: 'element',
            tag: 'div',
            children: [{ kind: 'element', tag: 'span', text: 'Inner' }],
          },
          { kind: 'element', tag: 'p', text: '   ' },
          { kind: 'element', tag: 'img', attributes: { src: '/a.jpg', alt: 'A' } },
          {
            kind: 'element',
            tag: 'svg',
            attributes: { viewBox: '0 0 10 10' },
            children: [{ kind: 'element', tag: 'text', text: 'Label' }],
          },
        ],
      },
    ]);
    expect(container.querySelector('section')).not.toHaveAttribute('dir');
    expect(container.querySelector('section > div')).not.toHaveAttribute('dir');
    expect(screen.getByText('Inner')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('section > p')).not.toHaveAttribute('dir');
    expect(container.querySelector('img')).not.toHaveAttribute('dir');
    expect(container.querySelector('svg text')).not.toHaveAttribute('dir');
  });

  it('adds only the direction: the static markup is otherwise identical', () => {
    const html = renderToStaticMarkup(
      <CustomCode
        tree={tree([{ kind: 'element', tag: 'p', className: 'text-lg', text: 'The site grows.' }])}
        hostId="host1"
      />,
    );
    const probe = document.createElement('div');
    probe.innerHTML = html;
    const paragraph = probe.querySelector('p');
    expect(paragraph).not.toBeNull();
    expect(paragraph?.getAttribute('dir')).toBe('auto');
    expect(paragraph?.getAttribute('class')).toBe('text-lg');
    expect(paragraph?.textContent).toBe('The site grows.');
    paragraph?.removeAttribute('dir');
    expect(paragraph?.outerHTML).toBe('<p class="text-lg">The site grows.</p>');
  });
});
