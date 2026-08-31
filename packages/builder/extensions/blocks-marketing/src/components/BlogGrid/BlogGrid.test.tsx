import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { BlogGrid } from './BlogGrid';
import { blogGridSchema } from './schema';

const node: Node = { id: 'blog', type: 'blogGrid', props: {} };

const posts = [
  {
    title: 'Designing for trust',
    excerpt: 'The signals that make a product feel dependable.',
    href: '/insights/trust',
    category: 'Design',
    author: 'Maya Chen',
    publishedLabel: 'August 24, 2026',
    dateTime: '2026-08-24',
    readingTime: '7 min read',
    imageSrc: '/trust.jpg',
    imageAlt: 'A product team reviewing a prototype',
    featured: true,
  },
  {
    title: 'Better decisions',
    excerpt: 'A practical operating model.',
    href: '/insights/decisions',
  },
];

function renderBlog(overrides: Record<string, unknown> = {}) {
  return render(
    <BlogGrid
      node={node}
      props={blogGridSchema.props.parse({ heading: 'Insights', posts, ...overrides })}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('BlogGrid', () => {
  it('renders semantic articles, publication data, lazy media, and labelled actions', () => {
    renderBlog({ eyebrow: 'Journal', body: 'Notes from our team.' });

    expect(screen.getByRole('region', { name: 'Insights' })).toHaveClass('@container');
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getAllByRole('article')[0]).toHaveClass(
      'rounded-xl',
      'shadow-soft',
      'hover:shadow-elevated',
    );
    expect(screen.getByText('Journal')).toBeInTheDocument();
    expect(screen.getByText('Notes from our team.')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'A product team reviewing a prototype' }),
    ).toHaveAttribute('loading', 'lazy');
    expect(screen.getByText('August 24, 2026')).toHaveAttribute('datetime', '2026-08-24');
    expect(screen.getByRole('link', { name: 'Read article: Designing for trust' })).toHaveAttribute(
      'href',
      '/insights/trust',
    );
  });

  it('promotes the lead story and can remove visual media without losing content', () => {
    renderBlog({ variant: 'featured', columns: '2', showImages: false });
    expect(screen.getAllByRole('article')[0]).toHaveAttribute('data-blog-card', 'featured');
    expect(screen.getByRole('list').firstElementChild).toHaveClass('@lg:col-span-2');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Designing for trust')).toBeInTheDocument();
  });

  it('renders editorial cards and combines shared token controls on the root', () => {
    renderBlog({
      variant: 'editorial',
      background: 'surfaceInverse',
      fontWeight: 'medium',
      marginBlockStart: 2,
    });
    const section = screen.getByRole('region', { name: 'Insights' });
    expect(section).toHaveClass('mkt-type--weight-medium');
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.marginBlockStart).toBe('calc(var(--t-space-unit, 4px) * 2)');
    expect(screen.getAllByRole('article')[0]).toHaveClass('grid');
  });

  it('enforces bounded post data and maps every prop to the inspector', () => {
    const defaults = blogGridSchema.props.parse({});
    expect(defaults).toMatchObject({
      actionLabel: 'Read article',
      columns: '3',
      heading: 'Latest insights',
      posts: [],
      showImages: true,
      spacing: 'lg',
      variant: 'cards',
      width: 'wide',
    });
    expect(Object.keys(blogGridSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(blogGridSchema.props.shape).sort(),
    );
    expect(
      blogGridSchema.props.safeParse({ posts: [{ title: '', excerpt: 'x', href: '/' }] }).success,
    ).toBe(false);
    expect(
      blogGridSchema.props.safeParse({
        posts: [{ title: 'Unsafe', excerpt: 'Unsafe link.', href: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false);
    expect(
      blogGridSchema.props.safeParse({
        posts: Array.from({ length: 13 }, (_, index) => ({
          title: `Post ${String(index)}`,
          excerpt: 'Useful article.',
          href: `/post/${String(index)}`,
        })),
      }).success,
    ).toBe(false);
  });
});
