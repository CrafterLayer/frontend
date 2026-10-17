import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Carousel } from './Carousel';
import { carouselSchema, type CarouselProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction, every slide, its image, label,
  title, text and button, and the visible play/pause labels are addressable on
  the canvas, carry nothing extra when published, take classes and direction
  from `partStyles`, and render an inline editor swapped in at its bind
  exactly once — slide and indicator names read the title, never copy it.
*/
const node: Node = { id: 'carousel-parts', type: 'carousel', props: {} };

const FULL = {
  eyebrow: 'Inside the platform',
  heading: 'Product tour.',
  body: 'Three practical workflows.',
  autoplay: true,
  items: [
    {
      label: '01 · Plan',
      title: 'Plan with evidence',
      body: 'Start with the signal.',
      imageSrc: '/plan.jpg',
      imageAlt: 'Planning board',
      action: { label: 'Open planning', href: '/planning' },
    },
    { title: 'Build with context', body: 'Keep decisions visible.' },
  ],
};

type Swap = (props: CarouselProps) => CarouselProps;

function renderCarousel(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = carouselSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<Carousel node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('Carousel parts', () => {
  it('stamps every slide and its lines on the canvas, hidden slides included', () => {
    const { container } = renderCarousel({}, true);
    expect(partsNamed(container, 'items')[0]).toHaveAttribute('data-ck-bind', 'items');
    expect(partsNamed(container, 'item')).toHaveLength(2);
    expect(partsNamed(container, 'item')[1]).toHaveAttribute('data-ck-bind', 'items.1');
    expect(partsNamed(container, 'item.title').map((title) => title.dataset['ckBind'])).toEqual([
      'items.0.title',
      'items.1.title',
    ]);
    expect(partsNamed(container, 'item.label')[0]).toHaveAttribute('data-ck-bind', 'items.0.label');
    expect(partsNamed(container, 'item.image')[0]).toHaveAttribute(
      'data-ck-bind',
      'items.0.imageSrc',
    );
    expect(partsNamed(container, 'item.action')[0]).toHaveAttribute(
      'data-ck-bind',
      'items.0.action.label',
    );
    /* Both autoplay labels are parts; the inactive one is hidden. */
    expect(partsNamed(container, 'pauseLabel')[0]).not.toHaveAttribute('hidden');
    expect(partsNamed(container, 'playLabel')[0]).toHaveAttribute('hidden');
  });

  it('publishes no part markers and keeps slide and indicator names', () => {
    const { container } = renderCarousel({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
    expect(screen.getByRole('group', { name: '1 / 2: Plan with evidence' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Go to slide 2: Build with context' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause carousel' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Plan with evidence');
  });

  it('applies an all-items style to every title and a this-item style to one, this winning', () => {
    const { container } = renderCarousel(
      {
        partStyles: {
          'item.title': { className: 'ps-4' },
          'item.title@1': { className: 'ps-8', dir: 'rtl' },
          'item.action': { className: 'pe-2', dir: 'ltr' },
        },
      },
      true,
    );
    const titles = partsNamed(container, 'item.title');
    expect(titles[0]).toHaveClass('ps-4', 'font-bold');
    expect(titles[0]).toHaveAttribute('dir', 'auto');
    expect(titles[1]).toHaveClass('ps-8');
    expect(titles[1]).not.toHaveClass('ps-4');
    expect(titles[1]).toHaveAttribute('dir', 'rtl');
    expect(partsNamed(container, 'item.action')[0]).toHaveClass('pe-2', 'bg-accent');
    expect(partsNamed(container, 'item.action')[0]).toHaveAttribute('dir', 'ltr');
  });

  it('gives text parts their own direction and leaves slides to the page', () => {
    const { container } = renderCarousel({}, false);
    expect(container.querySelector('h3')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('[data-carousel-slide]')).not.toHaveAttribute('dir');
    expect(container.querySelector('[data-carousel-track]')).not.toHaveAttribute('dir');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderCarousel({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      pauseLabel: swapped('pauseLabel'),
      playLabel: swapped('playLabel'),
      items: props.items.map((item, index) => ({
        ...item,
        title: swapped(`items.${String(index)}.title`),
        ...(item.action === undefined
          ? {}
          : { action: { ...item.action, label: swapped(`items.${String(index)}.action.label`) } }),
      })),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of [
      'heading',
      'pauseLabel',
      'playLabel',
      'items.0.title',
      'items.1.title',
      'items.0.action.label',
    ]) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
