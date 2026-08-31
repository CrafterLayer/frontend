import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Breadcrumbs } from './Breadcrumbs';
import { breadcrumbsSchema } from './schema';

afterEach(cleanup);

const node: Node = { id: 'breadcrumbs', type: 'breadcrumbs', props: {} };

function renderBreadcrumbs(overrides: Record<string, unknown> = {}, isCanvas = false) {
  return render(
    <Breadcrumbs
      node={node}
      props={breadcrumbsSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={isCanvas}
    />,
  );
}

describe('Breadcrumbs', () => {
  it('renders a named nav, ordered list, safe links, and one current page', () => {
    renderBreadcrumbs({
      label: 'Product breadcrumb',
      items: [{ label: 'Home', href: '/' }, { label: 'Shop', href: '/shop' }, { label: 'Lamp' }],
    });

    expect(screen.getByRole('navigation', { name: 'Product breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toHaveClass('@container');
    expect(screen.getByRole('list').tagName).toBe('OL');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/shop');
    expect(screen.getByText('Lamp')).toHaveAttribute('aria-current', 'page');
  });

  it('uses decorative RTL-aware separators that never pollute the accessible name', () => {
    const { container } = renderBreadcrumbs({ separator: 'chevron' });
    const separators = container.querySelectorAll('[aria-hidden="true"]');

    expect(separators).toHaveLength(2);
    expect(separators[0]).toHaveTextContent('›');
    expect(separators[0]).toHaveClass('rtl:rotate-180');
  });

  it('collapses only middle items below the container breakpoint', () => {
    const { container } = renderBreadcrumbs({
      items: [
        { label: 'Home', href: '/' },
        { label: 'Department', href: '/department' },
        { label: 'Category', href: '/department/category' },
        { label: 'Collection', href: '/department/category/collection' },
        { label: 'Product', current: true },
      ],
      collapse: 'responsive',
    });

    expect(screen.getByText('Department').closest('li')).toHaveClass('hidden', '@md:flex');
    expect(screen.getByText('Category').closest('li')).toHaveClass('hidden', '@md:flex');
    expect(screen.getByText('Collection').closest('li')).toHaveClass('flex');
    expect(screen.getByText('Product')).toHaveAttribute('aria-current', 'page');
    expect(container.querySelector('[data-breadcrumb-ellipsis="true"]')).toHaveClass('@md:hidden');
  });

  it('prevents link navigation on the canvas but preserves authored destinations', () => {
    renderBreadcrumbs({}, true);
    const link = screen.getByRole('link', { name: 'Home' });

    expect(fireEvent.click(link)).toBe(false);
    expect(link).toHaveAttribute('href', '/');
  });

  it('pairs inverse ground and ink and applies size, alignment, and custom controls', () => {
    renderBreadcrumbs({
      tone: 'inverse',
      size: 'large',
      align: 'center',
      className: 'max-w-content-wide',
    });

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass(
      'bg-surface-inverse',
      'text-text-inverse',
      'rounded-xl',
      'shadow-soft',
      'max-w-content-wide',
    );
    expect(screen.getByRole('list')).toHaveClass('text-base', 'justify-center');
  });

  it('renders an authoring hint only on canvas when the trail is empty', () => {
    expect(renderBreadcrumbs({ items: [] }).container).toBeEmptyDOMElement();
    renderBreadcrumbs({ items: [] }, true);
    expect(screen.getByText('Add breadcrumb items.')).toBeInTheDocument();
  });

  it('exposes every prop and rejects unsafe links, invalid current pages, and raw utilities', () => {
    expect(Object.keys(breadcrumbsSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(breadcrumbsSchema.props.shape).sort(),
    );
    expect(
      breadcrumbsSchema.props.safeParse({
        items: [
          { label: 'Unsafe', href: 'javascript:alert(1)' },
          { label: 'Current', current: true },
        ],
      }).success,
    ).toBe(false);
    expect(
      breadcrumbsSchema.props.safeParse({
        items: [
          { label: 'Unsafe', href: '//evil.example/path' },
          { label: 'Current', current: true },
        ],
      }).success,
    ).toBe(false);
    expect(
      breadcrumbsSchema.props.safeParse({
        items: [
          { label: 'Current', current: true },
          { label: 'Later', href: '/later' },
        ],
      }).success,
    ).toBe(false);
    expect(breadcrumbsSchema.props.safeParse({ className: 'text-blue-600' }).success).toBe(false);
    expect(breadcrumbsSchema.props.safeParse({ className: '@md:px-6' }).success).toBe(true);
  });
});
