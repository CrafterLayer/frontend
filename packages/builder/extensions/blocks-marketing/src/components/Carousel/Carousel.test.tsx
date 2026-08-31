import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Carousel } from './Carousel';
import { carouselSchema } from './schema';

const node: Node = { id: 'carousel-test', type: 'carousel', props: {} };
const slides = [
  {
    title: 'Plan with evidence',
    body: 'Start with the signal.',
    imageSrc: '/plan.jpg',
    imageAlt: 'Planning board',
    action: { label: 'Open planning', href: '/planning' },
  },
  { title: 'Build with context', body: 'Keep decisions visible.' },
  { title: 'Learn from outcomes', body: 'Close the loop.' },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Carousel', () => {
  it('renders one labelled slide with semantic controls and a live status', () => {
    render(
      <Carousel
        node={node}
        props={carouselSchema.props.parse({ heading: 'Product tour', items: slides })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const region = screen.getByRole('region', { name: 'Product tour' });
    expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    expect(region).toHaveAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight Home End');
    expect(screen.getByRole('group', { name: '1 / 3: Plan with evidence' })).toHaveAttribute(
      'aria-roledescription',
      'slide',
    );
    expect(screen.getByRole('img', { name: 'Planning board' })).toHaveAttribute('loading', 'lazy');
    expect(screen.getByRole('img', { name: 'Planning board' }).closest('figure')).toHaveClass(
      'order-first',
      'aspect-video',
    );
    expect(screen.getByRole('link', { name: 'Open planning' })).toHaveAttribute(
      'href',
      '/planning',
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(
      screen.getByRole('button', { name: 'Go to slide 1: Plan with evidence' }),
    ).toHaveAttribute('aria-current', 'true');
  });

  it('moves through slides with buttons, indicators, and keyboard shortcuts', () => {
    render(
      <Carousel
        node={node}
        props={carouselSchema.props.parse({ heading: 'Navigation proof', items: slides })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Build with context' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Go to slide 3: Learn from outcomes' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Learn from outcomes' })).toBeVisible();

    fireEvent.keyDown(screen.getByRole('region', { name: 'Navigation proof' }), { key: 'Home' });
    expect(screen.getByRole('heading', { level: 3, name: 'Plan with evidence' })).toBeVisible();
  });

  it('keeps autoplay off by default and suppresses opt-in autoplay for reduced motion', () => {
    expect(carouselSchema.props.parse({}).autoplay).toBe(false);
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    );

    render(
      <Carousel
        node={node}
        props={carouselSchema.props.parse({
          autoplay: true,
          showControls: false,
          items: slides,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'Play carousel' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('keeps autoplay paused until both pointer and focus interactions end', () => {
    render(
      <Carousel
        node={node}
        props={carouselSchema.props.parse({ autoplay: true, items: slides })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const region = screen.getByRole('region', { name: 'Featured stories' });
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'off');

    fireEvent.mouseEnter(region);
    fireEvent.focus(region);
    expect(status).toHaveAttribute('aria-live', 'polite');

    fireEvent.mouseLeave(region);
    expect(status).toHaveAttribute('aria-live', 'polite');

    fireEvent.blur(region, { relatedTarget: null });
    expect(status).toHaveAttribute('aria-live', 'off');
  });

  it('renders canvas-only guidance for an empty carousel', () => {
    const props = carouselSchema.props.parse({ heading: 'Empty carousel' });
    const { rerender } = render(
      <Carousel node={node} props={props} slots={{}} data={{}} isCanvas={true} />,
    );
    expect(screen.getByText('Add carousel slides in the inspector.')).toBeVisible();

    rerender(<Carousel node={node} props={props} slots={{}} data={{}} isCanvas={false} />);
    expect(screen.queryByText('Add carousel slides in the inspector.')).not.toBeInTheDocument();
  });

  it('rejects executable and protocol-relative destinations at the schema boundary', () => {
    expect(
      carouselSchema.props.safeParse({
        items: [{ title: 'Unsafe action', action: { label: 'Run', href: 'javascript:alert(1)' } }],
      }).success,
    ).toBe(false);
    expect(
      carouselSchema.props.safeParse({
        items: [{ title: 'Unsafe media', imageSrc: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false);
    expect(
      carouselSchema.props.safeParse({
        items: [{ title: 'Protocol relative', imageSrc: '//example.com/image.jpg' }],
      }).success,
    ).toBe(false);
  });

  it('keeps shared customization controls optional and without defaults', () => {
    const props = carouselSchema.props.parse({});
    for (const sharedProp of [
      'background',
      'textColor',
      'motion',
      'gutter',
      'className',
      'fontFamily',
      'fontSize',
      'paddingBlockStart',
      'marginInlineEnd',
    ] as const) {
      expect(Object.hasOwn(carouselSchema.props.shape, sharedProp), sharedProp).toBe(true);
      expect(Object.hasOwn(props, sharedProp), `${sharedProp} must not be defaulted`).toBe(false);
      expect(carouselSchema.propertyGroups?.[sharedProp]).toBeDefined();
    }
  });
});
