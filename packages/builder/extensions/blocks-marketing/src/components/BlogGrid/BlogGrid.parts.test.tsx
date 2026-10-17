import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { BlogGrid } from './BlogGrid';
import { blogGridSchema, type BlogGridProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction, the article list, each card and
  every line on it are addressable on the canvas, carry nothing extra when
  published, take classes and direction from `partStyles`, and render an
  inline editor swapped in at its bind exactly where the text was.
*/
const node: Node = { id: 'blog-parts', type: 'blogGrid', props: {} };

const FULL = {
  eyebrow: 'Journal',
  heading: 'Latest insights.',
  body: 'Notes from our team.',
  posts: [
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
    },
    {
      title: 'Better decisions',
      excerpt: 'A practical operating model.',
      href: '/insights/decisions',
    },
  ],
};

type Swap = (props: BlogGridProps) => BlogGridProps;

function renderBlog(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = blogGridSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<BlogGrid node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('BlogGrid parts', () => {
  it('stamps each part instance with its index and bind on the canvas', () => {
    const { container } = renderBlog({}, true);
    expect(partsNamed(container, 'heading')[0]).toHaveAttribute('data-ck-bind', 'heading');
    expect(partsNamed(container, 'posts')[0]).toHaveAttribute('data-ck-bind', 'posts');
    const cards = partsNamed(container, 'post');
    expect(cards).toHaveLength(2);
    expect(cards[1]).toHaveAttribute('data-ck-part-index', '1');
    expect(cards[1]).toHaveAttribute('data-ck-bind', 'posts.1');
    expect(partsNamed(container, 'post.title').map((title) => title.dataset['ckBind'])).toEqual([
      'posts.0.title',
      'posts.1.title',
    ]);
    expect(partsNamed(container, 'post.excerpt')[1]).toHaveAttribute(
      'data-ck-bind',
      'posts.1.excerpt',
    );
    expect(partsNamed(container, 'post.image')[0]).toHaveAttribute(
      'data-ck-bind',
      'posts.0.imageSrc',
    );
    for (const name of [
      'post.category',
      'post.author',
      'post.publishedLabel',
      'post.readingTime',
    ]) {
      expect(partsNamed(container, name), name).toHaveLength(1);
    }
    const links = partsNamed(container, 'post.link');
    expect(links).toHaveLength(2);
    expect(links[1]).toHaveAttribute('data-ck-bind', 'posts.1.title');
    /* One shared label, shown on every card. */
    expect(partsNamed(container, 'actionLabel')).toHaveLength(2);
    expect(partsNamed(container, 'actionLabel')[1]).toHaveAttribute('data-ck-bind', 'actionLabel');
  });

  it('publishes no part markers and names each link without copying its text', () => {
    const { container } = renderBlog({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
    expect(container.querySelector('[data-blog-card]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Read article Better decisions' })).toHaveAttribute(
      'href',
      '/insights/decisions',
    );
    expect(container.querySelector('a[aria-label]')).toBeNull();
  });

  it('applies an all-items style to every instance and a this-item style to one, this winning', () => {
    const { container } = renderBlog(
      {
        partStyles: {
          'post.title': { className: 'ps-4' },
          'post.title@1': { className: 'ps-8', dir: 'rtl' },
          heading: { className: 'pe-2', dir: 'ltr' },
        },
      },
      true,
    );
    const titles = partsNamed(container, 'post.title');
    expect(titles[0]).toHaveClass('ps-4', 'font-semibold');
    expect(titles[0]).toHaveAttribute('dir', 'auto');
    expect(titles[1]).toHaveClass('ps-8');
    expect(titles[1]).not.toHaveClass('ps-4');
    expect(titles[1]).toHaveAttribute('dir', 'rtl');
    expect(partsNamed(container, 'heading')[0]).toHaveClass('pe-2');
    expect(partsNamed(container, 'heading')[0]).toHaveAttribute('dir', 'ltr');
    expect(partsNamed(container, 'post.excerpt')[0]).not.toHaveClass('ps-4');
  });

  it('gives text parts their own direction and leaves boxes and images to the page', () => {
    const { container } = renderBlog({}, false);
    expect(container.querySelector('h2')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('h3')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('a')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('[data-blog-card]')).not.toHaveAttribute('dir');
    expect(container.querySelector('[data-blog-grid-list]')).not.toHaveAttribute('dir');
    expect(container.querySelector('img')).not.toHaveAttribute('dir');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderBlog({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      actionLabel: swapped('actionLabel'),
      posts: props.posts.map((post, index) => ({
        ...post,
        title: swapped(`posts.${String(index)}.title`),
        excerpt: swapped(`posts.${String(index)}.excerpt`),
      })),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of [
      'heading',
      'actionLabel',
      'posts.0.title',
      'posts.1.title',
      'posts.1.excerpt',
    ]) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
