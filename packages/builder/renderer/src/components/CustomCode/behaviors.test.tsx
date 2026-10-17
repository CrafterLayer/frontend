import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CustomCodeNode } from '@craftkit/builder-schema';

import { CustomCode } from './CustomCode';

function tree(children: CustomCodeNode[]) {
  return { kind: 'root' as const, children };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
});

describe('CustomCode site behaviours', () => {
  it('renders data-ck-behavior and its params, and mounts the runtime on the region', () => {
    const { container } = render(
      <CustomCode
        hostId="host1"
        tree={tree([
          {
            kind: 'element',
            tag: 'p',
            attributes: { lang: 'ar' },
            children: [
              {
                kind: 'element',
                tag: 'span',
                text: '0',
                attributes: { 'data-ck-behavior': 'count-up', 'data-ck-to': '40' },
              },
            ],
          },
          {
            kind: 'element',
            tag: 'img',
            attributes: { src: '/hero.webp', alt: '', fetchpriority: 'high' },
          },
        ])}
      />,
    );
    const counter = container.querySelector('span');
    expect(counter?.getAttribute('data-ck-behavior')).toBe('count-up');
    expect(counter?.getAttribute('data-ck-to')).toBe('40');
    expect(counter?.hasAttribute('data-ck-mounted')).toBe(true);
    expect(container.querySelector('img')?.getAttribute('fetchpriority')).toBe('high');
    expect(document.head.querySelectorAll('style[data-ck-behavior-css]')).toHaveLength(1);
  });

  it('keeps the click-driven behaviours inert on the canvas and disposes on unmount', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const nodes: CustomCodeNode[] = [
      {
        kind: 'element',
        tag: 'button',
        text: 'واتساب',
        attributes: { 'data-ck-behavior': 'whatsapp-form', 'data-ck-phone': '962790000000' },
      },
    ];
    const canvas = render(<CustomCode hostId="c" isCanvas tree={tree(nodes)} />);
    canvas.container.querySelector('button')?.click();
    expect(open).not.toHaveBeenCalled();
    canvas.unmount();

    const live = render(<CustomCode hostId="l" tree={tree(nodes)} />);
    const button = live.container.querySelector('button');
    button?.click();
    expect(open).toHaveBeenCalledWith('https://wa.me/962790000000', '_blank', 'noopener,noreferrer');
    live.unmount();
    button?.click();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('gives a motion-only region its presets, the runtime and data-ck-still on the canvas', () => {
    const { container } = render(
      <CustomCode
        hostId="m"
        isCanvas
        tree={tree([
          { kind: 'element', tag: 'h2', text: 'Hi', attributes: { 'data-ck-motion': 'fade-up' } },
        ])}
      />,
    );
    expect(document.head.querySelectorAll('style[data-ck-motion-css]')).toHaveLength(1);
    expect(container.querySelector('[data-ck-custom-code]')?.hasAttribute('data-ck-still')).toBe(true);
  });

  it('gives an effects-only region the effects stylesheet without mounting the runtime', () => {
    const { container } = render(
      <CustomCode
        hostId="fx"
        isCanvas
        tree={tree([{ kind: 'element', tag: 'div', className: 'ck-fx-glass p-4', text: 'x' }])}
      />,
    );
    expect(document.head.querySelectorAll('style[data-ck-effects-css]')).toHaveLength(1);
    expect(container.querySelector('[data-ck-still]')).toBeNull();
  });

  it('mounts nothing and injects no styles for a tree without behaviours', () => {
    const { container } = render(
      <CustomCode hostId="h" tree={tree([{ kind: 'element', tag: 'p', text: 'hi' }])} />,
    );
    expect(container.querySelector('[data-ck-mounted]')).toBeNull();
    expect(document.head.querySelector('style[data-ck-behavior-css]')).toBeNull();
  });
});
