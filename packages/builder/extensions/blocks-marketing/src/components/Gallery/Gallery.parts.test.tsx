import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Gallery } from './Gallery';
import { gallerySchema, type GalleryProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction, each figure, its image and its
  caption are addressable on the canvas, carry nothing extra when published,
  take classes and direction from `partStyles`, and render an inline editor
  swapped in at its bind exactly where the text was. The section heading is
  read by the image links through aria-labelledby, never copied.
*/
const node: Node = { id: 'gallery-parts', type: 'gallery', props: {} };

const FULL = {
  eyebrow: 'Portfolio',
  heading: 'Selected spaces.',
  body: 'Houses and studios from the last five years.',
  linkImages: true,
  items: [
    { src: '/courtyard.jpg', alt: 'Sunlit courtyard', caption: 'Courtyard House' },
    { src: '/studio.jpg', alt: '', decorative: true, caption: 'Studio' },
    { src: '/stair.jpg', alt: '', decorative: true },
  ],
};

type Swap = (props: GalleryProps) => GalleryProps;

function renderGallery(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = gallerySchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<Gallery node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('Gallery parts', () => {
  it('stamps each figure, image and caption on the canvas', () => {
    const { container } = renderGallery({}, true);
    expect(partsNamed(container, 'heading')[0]).toHaveAttribute('data-ck-bind', 'heading');
    expect(partsNamed(container, 'items')[0]).toHaveAttribute('data-ck-bind', 'items');
    expect(partsNamed(container, 'item')).toHaveLength(3);
    expect(partsNamed(container, 'item')[2]).toHaveAttribute('data-ck-part-index', '2');
    expect(partsNamed(container, 'item.image').map((image) => image.dataset['ckBind'])).toEqual([
      'items.0.src',
      'items.1.src',
      'items.2.src',
    ]);
    expect(
      partsNamed(container, 'item.caption').map((caption) => caption.dataset['ckBind']),
    ).toEqual(['items.0.caption', 'items.1.caption']);
  });

  it('publishes no part markers and names image links from the caption or heading', () => {
    const { container } = renderGallery({ linkLabel: 'Open image' }, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Open image: Sunlit courtyard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open image: Studio' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open image: Selected spaces.' })).toBeInTheDocument();
  });

  it('applies an all-items style to every caption and a this-item style to one, this winning', () => {
    const { container } = renderGallery(
      {
        partStyles: {
          'item.caption': { className: 'ps-4' },
          'item.caption@1': { className: 'ps-8', dir: 'rtl' },
          'item.image@0': { className: 'opacity-90' },
        },
      },
      true,
    );
    const captions = partsNamed(container, 'item.caption');
    expect(captions[0]).toHaveClass('ps-4', 'text-sm');
    expect(captions[0]).toHaveAttribute('dir', 'auto');
    expect(captions[1]).toHaveClass('ps-8');
    expect(captions[1]).not.toHaveClass('ps-4');
    expect(captions[1]).toHaveAttribute('dir', 'rtl');
    expect(partsNamed(container, 'item.image')[0]).toHaveClass('opacity-90', 'object-cover');
    expect(partsNamed(container, 'item.image')[1]).not.toHaveClass('opacity-90');
  });

  it('gives text parts their own direction and leaves figures and images to the page', () => {
    const { container } = renderGallery({}, false);
    expect(container.querySelector('h2')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('figcaption')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('[data-gallery-item]')).not.toHaveAttribute('dir');
    expect(container.querySelector('img')).not.toHaveAttribute('dir');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderGallery({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      body: swapped('body'),
      items: props.items.map((item, index) =>
        item.caption === undefined
          ? item
          : { ...item, caption: swapped(`items.${String(index)}.caption`) },
      ),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of ['heading', 'body', 'items.0.caption', 'items.1.caption']) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
