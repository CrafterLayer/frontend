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
    expect(screen.getByText('01 / 03')).toHaveAttribute('dir', 'ltr');
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

  it('renders the media-overlay composition with its authored hierarchy', () => {
    render(
      <Carousel
        node={node}
        props={carouselSchema.props.parse({
          eyebrow: 'Field notes',
          heading: 'Immersive story',
          body: 'A concise introduction.',
          variant: 'media',
          mediaPosition: 'end',
          items: [
            {
              label: 'Chapter one',
              title: 'A visual opening',
              body: 'Copy remains legible over the image.',
              imageSrc: '/opening.jpg',
              imageAlt: 'Sunlit landscape',
            },
          ],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByText('Field notes')).toBeVisible();
    expect(screen.getByText('A concise introduction.')).toBeVisible();
    expect(screen.getByText('Chapter one')).toBeVisible();
    expect(screen.getByText('Copy remains legible over the image.')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Sunlit landscape' }).closest('figure')).toHaveClass(
      'col-start-1',
      'row-start-1',
      'min-h-96',
    );
    expect(screen.getByText('A visual opening').closest('[data-carousel-copy]')).toHaveClass(
      'col-start-1',
      'justify-self-end',
      'text-text-inverse',
    );
  });

  it('supports play, pause, End, and bounded previous navigation without indicators', () => {
    render(
      <Carousel
        node={node}
        props={carouselSchema.props.parse({
          autoplay: true,
          loop: false,
          showIndicators: false,
          items: slides,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const region = screen.getByRole('region', { name: 'Featured stories' });
    expect(screen.getByRole('button', { name: 'Previous slide' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Go to slide/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pause carousel' }));
    expect(screen.getByRole('button', { name: 'Play carousel' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play carousel' }));
    expect(screen.getByRole('button', { name: 'Pause carousel' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.keyDown(region, { key: 'End' });
    expect(screen.getByRole('heading', { level: 3, name: 'Learn from outcomes' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Build with context' })).toBeVisible();
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

  it('always pauses autoplay for keyboard focus even when pointer pausing is disabled', () => {
    render(
      <Carousel
        node={node}
        props={carouselSchema.props.parse({
          autoplay: true,
          pauseOnInteraction: false,
          items: slides,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const region = screen.getByRole('region', { name: 'Featured stories' });
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'off');

    fireEvent.mouseEnter(region);
    expect(status).toHaveAttribute('aria-live', 'off');

    fireEvent.focus(region);
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('keeps indicator targets at least 24px while preserving a compact visual dot', () => {
    render(
      <Carousel
        node={node}
        props={carouselSchema.props.parse({ items: slides })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const indicator = screen.getByRole('button', {
      name: 'Go to slide 1: Plan with evidence',
    });
    expect(indicator).toHaveClass('size-6');
    expect(indicator.querySelector('[data-carousel-indicator-dot]')).toHaveClass('h-2', 'w-4');
  });

  it('collapses a split slide to one column when it has no media', () => {
    render(
      <Carousel
        node={node}
        props={carouselSchema.props.parse({ items: [slides[1]], variant: 'split' })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('group', { name: '1 / 1: Build with context' })).toHaveClass(
      '@lg:grid-cols-1',
    );
    expect(screen.getByRole('group', { name: '1 / 1: Build with context' })).not.toHaveClass(
      '@lg:grid-cols-2',
    );
  });

  it('preserves the action anchor but prevents navigation on the builder canvas', () => {
    render(
      <Carousel
        node={node}
        props={carouselSchema.props.parse({ items: [slides[0]] })}
        slots={{}}
        data={{}}
        isCanvas={true}
      />,
    );

    const action = screen.getByRole('link', { name: 'Open planning' });
    expect(action).toHaveAttribute('href', '/planning');
    expect(fireEvent.click(action)).toBe(false);
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
    expect(
      carouselSchema.props.safeParse({
        items: [
          {
            title: 'Protocol relative action',
            action: { label: 'Open', href: '//evil.example/path' },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      carouselSchema.props.safeParse({
        items: [{ title: 'Backslash media', imageSrc: '/\\evil.example/image.jpg' }],
      }).success,
    ).toBe(false);
    expect(
      carouselSchema.props.safeParse({
        items: [
          {
            title: 'Backslash action',
            action: { label: 'Open', href: '/\\evil.example/path' },
          },
        ],
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
