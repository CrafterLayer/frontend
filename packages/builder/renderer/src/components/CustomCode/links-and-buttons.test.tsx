import { fireEvent, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CustomCode } from './CustomCode';

function tree(children: unknown[]) {
  return { kind: 'root', children };
}

/**
 * Links and buttons: the two tags a page cannot do without, admitted with a
 * policy each rather than a hope.
 */
describe('links', () => {
  it('renders an https link with rel="noopener noreferrer"', () => {
    const { container } = render(
      <CustomCode
        tree={tree([
          {
            kind: 'element',
            tag: 'a',
            text: 'LinkedIn',
            attributes: { href: 'https://www.linkedin.com/in/reem', target: '_blank' },
          },
        ])}
        hostId="h"
      />,
    );

    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://www.linkedin.com/in/reem');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.textContent).toBe('LinkedIn');
  });

  it('keeps mailto, tel, and relative destinations', () => {
    const { container } = render(
      <CustomCode
        tree={tree([
          { kind: 'element', tag: 'a', text: 'a', attributes: { href: 'mailto:reem@example.com' } },
          { kind: 'element', tag: 'a', text: 'b', attributes: { href: 'tel:+97012345678' } },
          { kind: 'element', tag: 'a', text: 'c', attributes: { href: '/portfolio' } },
        ])}
        hostId="h"
      />,
    );

    expect([...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      'mailto:reem@example.com',
      'tel:+97012345678',
      '/portfolio',
    ]);
  });

  it('drops a javascript: destination — the text survives, nothing is navigable', () => {
    const { container } = render(
      <CustomCode
        tree={tree([
          { kind: 'element', tag: 'a', text: 'x', attributes: { href: 'javascript:alert(1)' } },
        ])}
        hostId="h"
      />,
    );

    const link = container.querySelector('a');
    expect(link?.textContent).toBe('x');
    expect(link?.getAttribute('href')).toBeNull();
  });

  it('ignores a named target and never emits one', () => {
    const { container } = render(
      <CustomCode
        tree={tree([
          { kind: 'element', tag: 'a', text: 'x', attributes: { href: '/a', target: 'evilframe' } },
        ])}
        hostId="h"
      />,
    );

    expect(container.querySelector('a')?.getAttribute('target')).toBeNull();
  });

  it('swallows a click on the editing canvas so the editor is not navigated away', () => {
    const { container } = render(
      <CustomCode
        tree={tree([{ kind: 'element', tag: 'a', text: 'x', attributes: { href: '/away' } }])}
        hostId="h"
        isCanvas
      />,
    );

    const link = container.querySelector('a');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('lets the click through when published', () => {
    const { container } = render(
      <CustomCode
        tree={tree([{ kind: 'element', tag: 'a', text: 'x', attributes: { href: '/away' } }])}
        hostId="h"
      />,
    );

    const link = container.querySelector('a');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(
      renderToStaticMarkup(
        <CustomCode
          tree={tree([{ kind: 'element', tag: 'a', text: 'x', attributes: { href: '/away' } }])}
          hostId="h"
        />,
      ),
    ).not.toContain('onClick');
  });

  it('does not honour href on any other tag', () => {
    const { container } = render(
      <CustomCode
        tree={tree([{ kind: 'element', tag: 'div', text: 'x', attributes: { href: '/away' } }])}
        hostId="h"
      />,
    );

    expect(container.querySelector('div[href]')).toBeNull();
  });
});

describe('buttons', () => {
  it('is always type="button" — never a submit, never a handler', () => {
    const { container } = render(
      <CustomCode
        tree={tree([
          {
            kind: 'element',
            tag: 'button',
            className: 'rounded-full bg-accent px-6 py-3 text-accent-text',
            text: 'تواصل معي',
          },
        ])}
        hostId="h"
      />,
    );

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.textContent).toBe('تواصل معي');
    expect(button?.className).toContain('bg-accent');
    if (button !== null) fireEvent.click(button); // no handler: nothing to throw, nothing to submit
  });

  it('can hold an icon beside its text', () => {
    const { container } = render(
      <CustomCode
        tree={tree([
          {
            kind: 'element',
            tag: 'button',
            text: 'Download CV',
            children: [{ kind: 'icon', name: 'download', className: 'h-6 w-6' }],
          },
        ])}
        hostId="h"
      />,
    );

    expect(container.querySelector('button svg[data-icon="download"]')).not.toBeNull();
  });
});
