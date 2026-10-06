import { fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
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
    /*
      `w-full` and a narrow minimum height: the overlay figure used to carry
      `min-h-96` alone, and CSS resolved its aspect ratio the wrong way round —
      384px of minimum height became 683px of width, overflowing a 360px phone
      by 348px. Measured by the Chromium responsive gate.
    */
    expect(screen.getByRole('img', { name: 'Sunlit landscape' }).closest('figure')).toHaveClass(
      'col-start-1',
      'row-start-1',
      'w-full',
      'min-h-64',
      '@md:min-h-96',
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

// media-motion (2026-10-06): the published page never hydrates, so the static
// render must carry every slide as the `carousel` behaviour pack's markup.
describe('Carousel — static export markup', () => {
  function staticMarkup(overrides: Record<string, unknown> = {}): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
      <Carousel
        node={node}
        props={carouselSchema.props.parse({ heading: 'Product tour', items: slides, ...overrides })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    return host;
  }

  it('renders every slide inside one scroll-snap track under data-ck-behavior=carousel', () => {
    const host = staticMarkup();
    const carousel = host.querySelector('[data-ck-behavior="carousel"]');
    expect(carousel).not.toBeNull();
    expect(carousel?.getAttribute('data-ck-indicator')).toBe('dots');
    expect(carousel?.hasAttribute('data-ck-autoplay')).toBe(false);
    const track = carousel?.firstElementChild;
    expect(track?.hasAttribute('data-carousel-track')).toBe(true);
    expect(track?.className).toContain('snap-x');
    const articles = [...(track?.querySelectorAll('article[data-carousel-slide]') ?? [])];
    expect(articles.map((article) => article.querySelector('h3')?.textContent)).toEqual(
      slides.map((slide) => slide.title),
    );
    expect(articles.map((article) => article.getAttribute('aria-label'))).toEqual([
      '1 / 3: Plan with evidence',
      '2 / 3: Build with context',
      '3 / 3: Learn from outcomes',
    ]);
    for (const article of articles) {
      expect(article.hasAttribute('hidden')).toBe(false);
      expect(article.getAttribute('style')).toBeNull();
    }
  });

  it('places exactly the prev/next buttons outside the track, so the pack derives them', () => {
    const host = staticMarkup();
    const carousel = host.querySelector('[data-ck-behavior="carousel"]')!;
    const track = carousel.firstElementChild!;
    const outside = [...carousel.querySelectorAll('button')].filter((button) => !track.contains(button));
    expect(outside.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Previous slide',
      'Next slide',
    ]);
    // React-only controls (dots, play, the counter, the live status) stay out of the static page.
    expect(host.querySelector('[aria-label^="Go to slide"]')).toBeNull();
    expect(host.querySelector('[data-carousel-controls]')).toBeNull();
    expect(host.querySelector('[role="status"]')).toBeNull();
    expect(host.querySelector('section')?.hasAttribute('tabindex')).toBe(false);
  });

  it('maps autoplay, its interval and the indicator switch onto the closed params', () => {
    const host = staticMarkup({ autoplay: true, autoplayInterval: 'slow', showIndicators: false });
    const carousel = host.querySelector('[data-ck-behavior="carousel"]');
    expect(carousel?.getAttribute('data-ck-autoplay')).toBe('true');
    expect(carousel?.getAttribute('data-ck-speed')).toBe('slow');
    expect(carousel?.getAttribute('data-ck-indicator')).toBe('none');
  });

  it('omits the buttons when controls are off, and keeps one slide static', () => {
    expect(staticMarkup({ showControls: false }).querySelectorAll('button')).toHaveLength(0);
    const single = staticMarkup({ items: [slides[0]] });
    expect(single.querySelectorAll('article')).toHaveLength(1);
    expect(single.querySelectorAll('button')).toHaveLength(0);
  });

  it('keeps every slide in the DOM in a live render, showing only the active one', () => {
    const { container } = render(
      <Carousel
        node={node}
        props={carouselSchema.props.parse({ items: slides })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    const articles = [...container.querySelectorAll('article[data-carousel-slide]')];
    expect(articles).toHaveLength(3);
    expect(articles.map((article) => article.hasAttribute('hidden'))).toEqual([false, true, true]);
    expect(container.querySelector('[data-ck-behavior]')).toBeNull();
  });
});
