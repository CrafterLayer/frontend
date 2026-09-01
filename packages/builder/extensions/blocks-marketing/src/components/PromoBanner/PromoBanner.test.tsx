import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { PromoBanner } from './PromoBanner';
import { promoBannerSchema } from './schema';

const node: Node = { id: 'promo-test', type: 'promoBanner', props: {} };

describe('PromoBanner', () => {
  it('renders a labelled complementary banner with responsive media and safe actions', () => {
    render(
      <PromoBanner
        node={node}
        props={promoBannerSchema.props.parse({
          label: 'New',
          headline: 'Launch with confidence',
          body: 'Everything the team needs in one place.',
          variant: 'split',
          imageSrc: '/launch.jpg',
          imageAlt: 'Team preparing a launch',
          actions: [
            { label: 'Start now', href: '/start', emphasis: 'primary' },
            { label: 'Read more', href: '#details', emphasis: 'secondary' },
          ],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('complementary', { name: 'Launch with confidence' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Team preparing a launch' })).toHaveAttribute(
      'loading',
      'lazy',
    );
    expect(screen.getByRole('link', { name: 'Start now' })).toHaveAttribute('href', '/start');
    expect(screen.getByRole('link', { name: 'Read more' })).toHaveAttribute('href', '#details');
    expect(
      screen.getByRole('img', { name: 'Team preparing a launch' }).closest('[data-promo-panel]'),
    ).toHaveAttribute('data-promo-variant', 'split');
  });

  it('renders media overlay, panel intent, radius, and padding as real classes', () => {
    render(
      <PromoBanner
        node={node}
        props={promoBannerSchema.props.parse({
          headline: 'Immersive offer',
          variant: 'media',
          panelStyle: 'accent',
          padding: 'comfortable',
          radius: 'xl',
          imageSrc: '/offer.jpg',
          imageAlt: 'Mountain retreat',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByText('Immersive offer').closest('[data-promo-copy]')).toHaveClass(
      'col-start-1',
      'bg-accent',
      'rounded-xl',
      'p-6',
      'justify-self-end',
    );
    expect(screen.getByRole('img')).toHaveClass('min-h-96');
    expect(screen.getByRole('img').closest('figure')).toHaveClass('aspect-video');
  });

  it('can hide configured media without leaving an empty media shell', () => {
    render(
      <PromoBanner
        node={node}
        props={promoBannerSchema.props.parse({
          headline: 'Copy only',
          imageSrc: '/hidden.jpg',
          showMedia: false,
          variant: 'split',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Copy only')).toBeVisible();
    expect(screen.getByText('Copy only').closest('[data-promo-panel]')).toHaveClass(
      '@lg:grid-cols-1',
    );
    expect(screen.getByText('Copy only').closest('[data-promo-panel]')).not.toHaveClass(
      '@lg:grid-cols-2',
    );
  });

  it('preserves action anchors but prevents navigation on the builder canvas', () => {
    render(
      <PromoBanner
        node={node}
        props={promoBannerSchema.props.parse({
          headline: 'Canvas promotion',
          actions: [{ label: 'Start now', href: '/start' }],
        })}
        slots={{}}
        data={{}}
        isCanvas={true}
      />,
    );

    const action = screen.getByRole('link', { name: 'Start now' });
    expect(action).toHaveAttribute('href', '/start');
    expect(fireEvent.click(action)).toBe(false);
  });

  it('rejects executable and protocol-relative URLs at the schema boundary', () => {
    expect(
      promoBannerSchema.props.safeParse({
        actions: [{ label: 'Unsafe', href: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false);
    expect(promoBannerSchema.props.safeParse({ imageSrc: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(promoBannerSchema.props.safeParse({ imageSrc: '//example.com/image.jpg' }).success).toBe(
      false,
    );
    expect(
      promoBannerSchema.props.safeParse({
        actions: [{ label: 'Unsafe', href: '//evil.example/path' }],
      }).success,
    ).toBe(false);
    expect(
      promoBannerSchema.props.safeParse({ imageSrc: '/\\evil.example/image.jpg' }).success,
    ).toBe(false);
    expect(
      promoBannerSchema.props.safeParse({
        actions: [{ label: 'Unsafe', href: '/\\evil.example/path' }],
      }).success,
    ).toBe(false);
  });

  it('applies shared colour, typography, and logical spacing controls', () => {
    render(
      <PromoBanner
        node={node}
        props={promoBannerSchema.props.parse({
          headline: 'Styled promotion',
          background: 'surfaceInverse',
          textColor: 'textInverse',
          fontFamily: 'serif',
          marginInlineStart: 3,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const banner = screen.getByRole('complementary', { name: 'Styled promotion' });
    expect(banner).toHaveClass('mkt-type--family-serif');
    expect(banner.style.background).toBe('var(--t-surface-inverse)');
    expect(banner.style.color).toBe('var(--t-text-inverse)');
    expect(banner.style.marginInlineStart).toBe('calc(var(--t-space-unit, 4px) * 3)');
  });

  it('keeps shared customization controls optional and without defaults', () => {
    const props = promoBannerSchema.props.parse({});
    for (const sharedProp of [
      'background',
      'textColor',
      'motion',
      'gutter',
      'className',
      'fontFamily',
      'fontSize',
      'paddingBlockEnd',
      'marginInlineEnd',
    ] as const) {
      expect(Object.hasOwn(promoBannerSchema.props.shape, sharedProp), sharedProp).toBe(true);
      expect(Object.hasOwn(props, sharedProp), `${sharedProp} must not be defaulted`).toBe(false);
      expect(promoBannerSchema.propertyGroups?.[sharedProp]).toBeDefined();
    }
  });
});
