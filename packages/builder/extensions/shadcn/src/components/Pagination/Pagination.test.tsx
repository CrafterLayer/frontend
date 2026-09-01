import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Pagination } from './Pagination';
import { paginationSchema } from './schema';

const node: Node = { id: 'pagination-test', type: 'pagination', props: {} };

describe('Pagination', () => {
  it('renders a generated sibling range with a semantic current page', () => {
    render(
      <Pagination
        node={node}
        props={paginationSchema.props.parse({
          navigationLabel: 'Archive pages',
          currentPage: 5,
          pageCount: 10,
          siblingCount: 1,
          pageHrefTemplate: '/archive?page={page}',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Archive pages' })).toBeVisible();
    expect(screen.getByLabelText('Page 5')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Page 4' })).toHaveAttribute('href', '/archive?page=4');
    expect(screen.getByRole('link', { name: 'Page 10' })).toBeVisible();
    expect(screen.getAllByText('More pages')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('rel', 'prev');
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('rel', 'next');
  });

  it('renders compact status, boundary state, sizing, alignment, and logical arrows', () => {
    render(
      <div dir="rtl">
        <Pagination
          node={node}
          props={paginationSchema.props.parse({
            navigationLabel: 'نتائج',
            previousLabel: 'السابق',
            nextLabel: 'التالي',
            pageLabel: 'صفحة',
            currentPage: 1,
            pageCount: 8,
            variant: 'compact',
            size: 'lg',
            align: 'end',
          })}
          slots={{}}
          data={{}}
          isCanvas={false}
        />
      </div>,
    );

    expect(screen.getByText('صفحة 1 / 8')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('السابق').closest('[aria-disabled]')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('link', { name: 'التالي' })).toHaveClass('min-h-12');
    expect(screen.getByRole('navigation').querySelector('ul')).toHaveClass('justify-end');
    for (const arrow of screen.getAllByText(/←|→/)) expect(arrow).toHaveClass('rtl:rotate-180');
  });

  it('renders explicit destinations and their declared current item', () => {
    render(
      <Pagination
        node={node}
        props={paginationSchema.props.parse({
          mode: 'explicit',
          previousHref: '/new',
          nextHref: '/archive',
          items: [
            { label: 'New', href: '/new' },
            { label: 'Popular', current: true },
            { label: 'Archive', href: '/archive' },
          ],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByLabelText('Popular')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'New' })).toHaveAttribute('href', '/new');
    expect(screen.getByRole('link', { name: 'Archive' })).toHaveAttribute('href', '/archive');
  });

  it('prevents navigation only on the builder canvas', () => {
    render(
      <Pagination
        node={node}
        props={paginationSchema.props.parse({ pageCount: 3 })}
        slots={{}}
        data={{}}
        isCanvas={true}
      />,
    );

    const link = screen.getByRole('link', { name: 'Page 2' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('rejects unsafe destinations and malformed templates', () => {
    expect(paginationSchema.props.safeParse({ nextHref: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(paginationSchema.props.safeParse({ nextHref: '//evil.example/page' }).success).toBe(
      false,
    );
    expect(
      paginationSchema.props.safeParse({
        items: [{ label: 'Unsafe', href: '//example.com', current: true }],
      }).success,
    ).toBe(false);
    expect(paginationSchema.props.safeParse({ pageHrefTemplate: '/page' }).success).toBe(false);
    expect(
      paginationSchema.props.safeParse({ pageHrefTemplate: 'javascript:{page}' }).success,
    ).toBe(false);
  });

  it('keeps the outer props object inspectable and accepts legacy empty or no-current items', () => {
    expect(paginationSchema.props.shape.items).toBeDefined();
    expect(paginationSchema.props.parse({}).items).toEqual([]);
    expect(paginationSchema.props.safeParse({ items: [] }).success).toBe(true);
    expect(
      paginationSchema.props.safeParse({ items: [{ label: 'One' }, { label: 'Two' }] }).success,
    ).toBe(true);
    expect(
      paginationSchema.props.safeParse({
        items: [
          { label: 'One', current: true },
          { label: 'Two', current: true },
        ],
      }).success,
    ).toBe(false);
    expect(
      paginationSchema.props.safeParse({ items: [{ label: 'One', current: true, disabled: true }] })
        .success,
    ).toBe(false);
    expect(
      paginationSchema.props.safeParse({
        items: [{ label: 'One', current: true }, { label: 'Two' }],
      }).success,
    ).toBe(true);
  });

  it('renders the first enabled legacy item as current without requiring persisted current state', () => {
    render(
      <Pagination
        node={node}
        props={paginationSchema.props.parse({
          mode: 'explicit',
          items: [
            { label: 'Unavailable', disabled: true },
            { label: 'First enabled', href: '/first' },
            { label: 'Later', href: '/later' },
          ],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByText('First enabled')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'First enabled' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Later' })).toHaveAttribute('href', '/later');
  });

  it('derives compact explicit status from the effective item and explicit item count', () => {
    render(
      <Pagination
        node={node}
        props={paginationSchema.props.parse({
          mode: 'explicit',
          variant: 'compact',
          currentPage: 99,
          pageCount: 100,
          items: [
            { label: 'Unavailable', disabled: true },
            { label: 'First enabled', href: '/first' },
            { label: 'Later', href: '/later' },
          ],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByText('Page 2 / 3')).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByText('Page 99 / 100')).not.toBeInTheDocument();
  });

  it('keeps motion and utility classes optional and validated', () => {
    const props = paginationSchema.props.parse({});
    expect(props.motion).toBeUndefined();
    expect(props.className).toBeUndefined();
    expect(paginationSchema.propertyGroups?.motion).toMatchObject({ kind: 'motion' });
    expect(paginationSchema.propertyGroups?.className).toMatchObject({
      kind: 'utility-classes',
    });
    expect(paginationSchema.props.safeParse({ className: 'text-blue-500' }).success).toBe(false);
    expect(paginationSchema.props.safeParse({ className: 'w-[41px]' }).success).toBe(false);
    expect(paginationSchema.props.safeParse({ className: 'flex gap-2' }).success).toBe(true);
  });
});
