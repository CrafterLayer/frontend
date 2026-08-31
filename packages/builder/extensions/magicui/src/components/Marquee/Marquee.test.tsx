import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Marquee } from './Marquee';
import { marqueeSchema } from './schema';

const node: Node = { id: 'marquee', type: 'marquee', props: {} };

function renderMarquee(overrides: Record<string, unknown> = {}) {
  return render(
    <Marquee
      node={node}
      props={marqueeSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('Marquee', () => {
  it('exposes one semantic list while hiding the seamless duplicate', () => {
    renderMarquee();
    const region = screen.getByRole('region', { name: 'Highlights' });
    const primary = region.querySelector('[data-marquee-copy="primary"]');
    const duplicate = region.querySelector('[data-marquee-copy="duplicate"]');
    expect(primary).not.toBeNull();
    expect(within(primary as HTMLElement).getAllByRole('listitem')).toHaveLength(5);
    expect(duplicate).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders safe links and descriptive images', () => {
    renderMarquee({
      items: [
        {
          title: 'Northstar',
          imageUrl: '/logos/northstar.svg',
          imageAlt: 'Northstar mark',
          href: '/partners/northstar',
        },
        { title: 'Monument', href: 'https://example.com/monument' },
      ],
    });
    const primary = document.querySelector<HTMLElement>('[data-marquee-copy="primary"]')!;
    expect(within(primary).getByRole('img', { name: 'Northstar mark' })).toHaveAttribute(
      'src',
      '/logos/northstar.svg',
    );
    expect(within(primary).getByRole('link', { name: /Northstar/ })).toHaveAttribute(
      'href',
      '/partners/northstar',
    );
  });

  it('applies motion, presentation, tone, and row controls', () => {
    renderMarquee({
      direction: 'reverse',
      edgeFade: false,
      pauseOnHover: false,
      presentation: 'cards',
      rows: 'two',
      speed: 'fast',
      tone: 'inverse',
    });
    const region = screen.getByRole('region', { name: 'Highlights' });
    expect(region).toHaveAttribute('data-marquee-presentation', 'cards');
    expect(region).toHaveClass('bg-surface-inverse');
    expect(region).not.toHaveClass('mgc-marquee--fade', 'mgc-marquee--pause');
    expect(region.style.getPropertyValue('--mgc-marquee-duration')).toBe('16s');
    expect(region.querySelectorAll('.mgc-marquee__viewport')).toHaveLength(2);
    expect(region.querySelector('.mgc-marquee__viewport')).toHaveAttribute(
      'data-marquee-direction',
      'reverse',
    );
  });

  it('exposes every prop and rejects unsafe URLs and utilities', () => {
    expect(Object.keys(marqueeSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(marqueeSchema.props.shape).sort(),
    );
    expect(
      marqueeSchema.props.safeParse({
        items: [{ title: 'Unsafe', href: 'javascript:alert(1)' }, { title: 'Safe' }],
      }).success,
    ).toBe(false);
    expect(
      marqueeSchema.props.safeParse({
        items: [{ title: 'Unsafe', href: '//evil.example/card' }, { title: 'Safe' }],
      }).success,
    ).toBe(false);
    expect(marqueeSchema.props.safeParse({ className: 'bg-red-500' }).success).toBe(false);
  });
});
