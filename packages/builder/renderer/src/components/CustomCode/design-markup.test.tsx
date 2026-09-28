import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CustomCode } from './CustomCode';

const SVG_NS = 'http://www.w3.org/2000/svg';

function tree(children: unknown[]) {
  return { kind: 'root', children };
}

function el(
  tag: string,
  extra: { attributes?: Record<string, string>; children?: unknown[]; text?: string } = {},
) {
  return { kind: 'element', tag, ...extra };
}

function renderRegion(children: unknown[], isCanvas = false) {
  return render(<CustomCode tree={tree(children)} hostId="h" isCanvas={isCanvas} />);
}

/*
  Design code (2026-09-28): the markup the door admits for professional
  sections — a FAQ that opens, a price table, an svg divider, a muted video
  hero, a menu a phone opens — rendered as the browser needs it, and still
  nothing authored that runs.
*/
describe('CustomCode — design markup', () => {
  it('renders a FAQ as details and summary, open and grouped by name', () => {
    const { container } = renderRegion([
      el('details', {
        attributes: { name: 'faq', open: '' },
        children: [el('summary', { text: 'Do you deliver?' }), el('p', { text: 'Daily, 8–11.' })],
      }),
      el('details', { attributes: { name: 'faq' }, children: [el('summary', { text: 'Parking?' })] }),
    ]);

    const [first, second] = [...container.querySelectorAll('details')];
    expect(first?.open).toBe(true);
    expect(first?.getAttribute('name')).toBe('faq');
    expect(second?.open).toBe(false);
    expect(first?.querySelector('summary')?.textContent).toBe('Do you deliver?');
  });

  it('renders a table with its spans and header scopes as HTML attributes', () => {
    const { container } = renderRegion([
      el('table', {
        children: [
          el('tbody', {
            children: [
              el('tr', {
                children: [
                  el('th', { attributes: { scope: 'row' }, text: 'Seats' }),
                  el('td', { attributes: { colspan: '2', rowspan: '1' }, text: '5' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ]);

    expect(container.querySelector('th')?.getAttribute('scope')).toBe('row');
    expect(container.querySelector('td')?.getAttribute('colspan')).toBe('2');
    expect(container.querySelector('td')?.getAttribute('rowspan')).toBe('1');
  });

  it('draws an svg in the SVG namespace with its case-sensitive and kebab attributes', () => {
    const { container } = renderRegion([
      el('svg', {
        attributes: { viewBox: '0 0 100 10', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
        children: [
          el('defs', {
            children: [
              el('linearGradient', {
                attributes: { id: 'ck-fade', gradientUnits: 'objectBoundingBox' },
                children: [el('stop', { attributes: { offset: '0', 'stop-color': 'currentColor', 'stop-opacity': '0.5' } })],
              }),
            ],
          }),
          el('path', {
            attributes: {
              d: 'M0 5C25 10 75 0 100 5V10H0Z',
              fill: 'url(#ck-fade)',
              stroke: 'currentColor',
              'stroke-width': '1.5',
              'stroke-linecap': 'round',
              'fill-rule': 'evenodd',
            },
          }),
        ],
      }),
    ]);

    const svg = container.querySelector('svg');
    expect(svg?.namespaceURI).toBe(SVG_NS);
    expect(svg?.getAttribute('viewBox')).toBe('0 0 100 10');
    expect(svg?.getAttribute('preserveAspectRatio')).toBe('none');
    const gradient = svg?.getElementsByTagName('linearGradient')[0];
    expect(gradient?.namespaceURI).toBe(SVG_NS);
    expect(gradient?.getAttribute('gradientUnits')).toBe('objectBoundingBox');
    expect(svg?.querySelector('stop')?.getAttribute('stop-color')).toBe('currentColor');
    expect(svg?.querySelector('stop')?.getAttribute('stop-opacity')).toBe('0.5');
    const path = svg?.querySelector('path');
    expect(path?.namespaceURI).toBe(SVG_NS);
    expect(path?.getAttribute('stroke-width')).toBe('1.5');
    expect(path?.getAttribute('stroke-linecap')).toBe('round');
    expect(path?.getAttribute('fill-rule')).toBe('evenodd');
    expect(path?.getAttribute('fill')).toBe('url(#ck-fade)');
  });

  it('keeps an svg a closed drawing on read: no text, no html inside, no remote paint, no href', () => {
    const { container } = renderRegion([
      el('svg', {
        text: 'stray words',
        children: [
          el('div', { text: 'an html box in an svg' }),
          { kind: 'icon', name: 'mail' },
          el('path', { attributes: { d: 'M0 0', fill: 'url(https://evil.test/p.svg#a)', href: '#x' } }),
        ],
      }),
    ]);

    const svg = container.querySelector('svg');
    expect(svg?.textContent).toBe('');
    expect(svg?.children).toHaveLength(1);
    expect(svg?.querySelector('path')?.getAttribute('fill')).toBeNull();
    expect(svg?.querySelector('path')?.getAttribute('href')).toBeNull();
  });

  it('mutes a video that plays by itself and keeps it inline, whatever the tree says', () => {
    const { container } = renderRegion([
      el('video', {
        attributes: { autoplay: '', loop: '', poster: 'https://img.test/poster.jpg', preload: 'metadata' },
        children: [el('source', { attributes: { src: 'https://cdn.test/hero.mp4', type: 'video/mp4' } })],
      }),
    ]);

    const video = container.querySelector('video');
    expect(video?.autoplay).toBe(true);
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.hasAttribute('playsinline')).toBe(true);
    expect(video?.getAttribute('poster')).toBe('https://img.test/poster.jpg');
    expect(video?.getAttribute('preload')).toBe('metadata');
    expect(video?.querySelector('source')?.getAttribute('src')).toBe('https://cdn.test/hero.mp4');
    expect(video?.querySelector('source')?.getAttribute('type')).toBe('video/mp4');
  });

  it('publishes the muted attribute itself, so a page with no script still autoplays', () => {
    const html = renderToStaticMarkup(
      <CustomCode
        tree={tree([el('video', { attributes: { autoplay: '', muted: '', loop: '', playsinline: '' } })])}
        hostId="h"
      />,
    );

    expect(html).toMatch(/<video[^>]*\bmuted=""/u);
    expect(html.toLowerCase()).toMatch(/<video[^>]*\bautoplay=""/u);
    expect(html.toLowerCase()).toMatch(/<video[^>]*\bplaysinline=""/u);
  });

  it('drops every media address outside the policy: poster, source src and srcset candidates', () => {
    const { container } = renderRegion([
      el('video', {
        attributes: { poster: 'http://img.test/p.jpg' },
        children: [el('source', { attributes: { src: 'javascript:alert(1)' } })],
      }),
      el('img', { attributes: { src: '/a.jpg', srcset: 'http://img.test/a.jpg 2x', alt: 'a' } }),
    ]);

    expect(container.querySelector('video')?.getAttribute('poster')).toBeNull();
    expect(container.querySelector('source')?.getAttribute('src')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('srcset')).toBeNull();
  });

  it('renders responsive images with their size, loading and decoding hints', () => {
    const { container } = renderRegion([
      el('picture', {
        children: [
          el('source', { attributes: { media: '(min-width:768px)', srcset: 'https://img.test/wide.jpg 1600w' } }),
          el('img', {
            attributes: {
              src: 'https://img.test/a.jpg',
              srcset: 'https://img.test/a.jpg 800w, /a-1600.jpg 1600w',
              sizes: '(min-width:768px) 50vw, 100vw',
              loading: 'lazy',
              decoding: 'async',
              width: '800',
              height: '600',
              alt: 'A cup',
            },
          }),
        ],
      }),
    ]);

    const source = container.querySelector('picture > source');
    expect(source?.getAttribute('media')).toBe('(min-width:768px)');
    expect(source?.getAttribute('srcset')).toBe('https://img.test/wide.jpg 1600w');
    const image = container.querySelector('picture > img');
    expect(image?.getAttribute('srcset')).toBe('https://img.test/a.jpg 800w, /a-1600.jpg 1600w');
    expect(image?.getAttribute('sizes')).toBe('(min-width:768px) 50vw, 100vw');
    expect(image?.getAttribute('loading')).toBe('lazy');
    expect(image?.getAttribute('decoding')).toBe('async');
    expect(image?.getAttribute('width')).toBe('800');
    expect(image?.getAttribute('height')).toBe('600');
  });

  it('opens a popover from a button, and never from a link', () => {
    const { container } = renderRegion([
      el('button', { attributes: { popovertarget: 'ck-menu', 'aria-label': 'Menu' } }),
      el('nav', {
        attributes: { id: 'ck-menu', popover: '' },
        children: [el('a', { attributes: { href: '#menu', popovertarget: 'ck-menu' }, text: 'Menu' })],
      }),
      el('button', { attributes: { popovertarget: 'ck-menu', popovertargetaction: 'hide' } }),
    ]);

    const [open, close] = [...container.querySelectorAll('button')];
    expect(open?.getAttribute('popovertarget')).toBe('ck-menu');
    expect(open?.getAttribute('type')).toBe('button');
    expect(close?.getAttribute('popovertargetaction')).toBe('hide');
    expect(container.querySelector('nav')?.getAttribute('popover')).toBe('');
    expect(container.querySelector('a')?.hasAttribute('popovertarget')).toBe(false);
  });

  it('closes the open menu when one of its in-page links is followed, but not on the canvas', () => {
    const menu = [
      el('nav', {
        attributes: { id: 'ck-menu', popover: '' },
        children: [el('a', { attributes: { href: '#menu' }, text: 'Menu' })],
      }),
    ];

    const published = renderRegion(menu);
    const nav = published.container.querySelector('nav') as HTMLElement & { hidePopover?: () => void };
    const hidePopover = vi.fn();
    nav.hidePopover = hidePopover;
    const follow = new MouseEvent('click', { bubbles: true, cancelable: true });
    published.container.querySelector('a')?.dispatchEvent(follow);
    expect(hidePopover).toHaveBeenCalledTimes(1);
    expect(follow.defaultPrevented).toBe(false);
    published.unmount();

    const canvas = renderRegion(menu, true);
    const canvasNav = canvas.container.querySelector('nav') as HTMLElement & { hidePopover?: () => void };
    const canvasHide = vi.fn();
    canvasNav.hidePopover = canvasHide;
    const select = new MouseEvent('click', { bubbles: true, cancelable: true });
    canvas.container.querySelector('a')?.dispatchEvent(select);
    expect(canvasHide).not.toHaveBeenCalled();
    expect(select.defaultPrevented).toBe(true);
  });

  it('marks mixed-language text with lang and dir', () => {
    const { container } = renderRegion([
      el('p', {
        attributes: { lang: 'ar', dir: 'rtl' },
        children: [el('span', { attributes: { lang: 'en', dir: 'ltr' }, text: 'Hail Roastery' })],
      }),
      el('span', { attributes: { dir: 'sideways' }, text: 'x' }),
    ]);

    expect(container.querySelector('p')?.getAttribute('dir')).toBe('rtl');
    expect(container.querySelector('p > span')?.getAttribute('lang')).toBe('en');
    expect(container.querySelector('[data-ck] > span')?.hasAttribute('dir')).toBe(false);
  });

  it('renders the phrasing and definition tags the recipes name', () => {
    const { container } = renderRegion([
      el('dl', { children: [el('dt', { text: 'Roast' }), el('dd', { text: 'Medium' })] }),
      el('p', {
        children: ['b', 'i', 's', 'mark', 'cite', 'q', 'abbr'].map((tag) => el(tag, { text: tag })),
      }),
      el('address', { text: 'Rainbow St' }),
    ]);

    for (const tag of ['dl', 'dt', 'dd', 'b', 'i', 's', 'mark', 'cite', 'q', 'abbr', 'address']) {
      expect(container.querySelector(tag), tag).not.toBeNull();
    }
  });

  it('stamps an svg shape with its editing path on the canvas like any element', () => {
    const { container } = renderRegion(
      [el('svg', { attributes: { viewBox: '0 0 1 1' }, children: [el('path', { attributes: { d: 'M0 0' } })] })],
      true,
    );

    expect(container.querySelector('svg')?.getAttribute('data-ck-path')).toBe('0');
    expect(container.querySelector('path')?.getAttribute('data-ck-path')).toBe('0.0');
  });
});
