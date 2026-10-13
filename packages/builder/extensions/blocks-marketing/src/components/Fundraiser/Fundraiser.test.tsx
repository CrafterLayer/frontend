import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Fundraiser } from './Fundraiser';
import { fundraiserExamples } from './examples';
import { fundraiserSchema } from './schema';

const node: Node = { id: 'appeal', type: 'fundraiser', props: {} };

function renderAppeal(overrides: Record<string, unknown> = {}) {
  return render(
    <Fundraiser
      node={node}
      props={fundraiserSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('Fundraiser', () => {
  it('states the amount raised against the goal and draws a named progress bar', () => {
    const { container } = renderAppeal();
    expect(screen.getByRole('region', { name: 'Help us reach our goal' })).toHaveClass(
      '@container',
    );
    const card = container.querySelector('[data-fundraiser-card]')!;
    expect(card).toHaveTextContent('$68,250raised of$100,000goal');
    const bar = screen.getByRole('progressbar', { name: 'Funding progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '68');
    expect(bar).toHaveAttribute('aria-valuetext', '68%');
    expect(container.querySelector<HTMLElement>('[data-fundraiser-bar]')?.style.inlineSize).toBe(
      '68.3%',
    );
  });

  it('keeps each amount one isolated unit, the currency after the digits when asked', () => {
    const { container } = renderAppeal({ currency: 'SAR', currencyPosition: 'after' });
    const amounts = container.querySelectorAll('bdi');
    expect(amounts).toHaveLength(2);
    expect(amounts[0]?.textContent).toBe('68,250\u00a0SAR');
    expect(amounts[0]).toHaveClass('whitespace-nowrap');
  });

  it('spaces a lettered currency before the number and keeps a symbol tight', () => {
    const { container, unmount } = renderAppeal({ currency: 'SAR' });
    expect(container.querySelector('bdi')?.textContent).toBe('SAR\u00a068,250');
    unmount();
    expect(renderAppeal().container.querySelector('bdi')?.textContent).toBe('$68,250');
  });

  it('prints Arabic-Indic digits and caps the bar past the goal', () => {
    const { container } = renderAppeal({ raised: 1200, goal: 1000, numberLanguage: 'ar' });
    expect(container.querySelector('bdi')).toHaveTextContent('١٬٢٠٠');
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar.getAttribute('aria-valuetext')).toMatch(/^١٢٠/u);
    expect(container.querySelector<HTMLElement>('[data-fundraiser-bar]')?.style.inlineSize).toBe(
      '100%',
    );
  });

  it('lists supporter stats as terms, preset amounts as links, and the donate button', () => {
    const { container } = renderAppeal({
      amounts: [
        { label: '$25', href: '/donate?amount=25' },
        { label: '$50', href: '/donate?amount=50' },
      ],
      note: 'Tax-deductible.',
    });
    const stats = container.querySelector('dl') as HTMLElement;
    expect(
      within(stats)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['donors', 'days left']);
    expect(screen.getByRole('link', { name: '$50' })).toHaveAttribute('href', '/donate?amount=50');
    expect(screen.getByRole('link', { name: 'Donate now' })).toHaveClass('bg-accent', 'w-full');
    expect(screen.getByText('Tax-deductible.')).toBeInTheDocument();
  });

  it('sets the card beside a photo in the split layout, and alone without one', () => {
    const { container, unmount } = renderAppeal({
      layout: 'split',
      imageSrc: '/assets/library.jpg',
      imageAlt: 'The library',
    });
    expect(container.querySelector('[data-fundraiser-layout="split"]')).toHaveClass(
      '@3xl:grid-cols-2',
    );
    expect(screen.getByRole('img', { name: 'The library' })).toBeInTheDocument();
    unmount();
    const alone = renderAppeal({ layout: 'split' }).container;
    expect(alone.querySelector('[data-fundraiser-layout="card"]')).toHaveClass('max-w-xl');
  });

  it('keeps the card light with its own ink on a dark section', () => {
    const { container } = renderAppeal({ tone: 'dark' });
    expect(container.querySelector('[data-fundraiser-card]')).toHaveClass(
      'bg-surface',
      'text-text',
    );
  });

  it('combines token-based colour, typography, and logical spacing controls', () => {
    renderAppeal({ background: 'accent', fontFamily: 'serif', marginInlineEnd: 4 });
    const section = screen.getByRole('region', { name: 'Help us reach our goal' });
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });
});

describe('Fundraiser schema', () => {
  it('defaults to a centred appeal with a donate button and maps every inspector prop', () => {
    expect(fundraiserSchema.props.parse({})).toMatchObject({
      raised: 68250,
      goal: 100000,
      currency: '$',
      actionLabel: 'Donate now',
      layout: 'card',
      align: 'center',
      width: 'wide',
    });
    expect(Object.keys(fundraiserSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(fundraiserSchema.props.shape).sort(),
    );
  });

  it('refuses a zero goal, negative amounts and unsafe links', () => {
    const parse = (value: unknown) => fundraiserSchema.props.safeParse(value).success;
    expect(parse({ goal: 0 })).toBe(false);
    expect(parse({ raised: -5 })).toBe(false);
    expect(parse({ actionHref: 'javascript:alert(1)' })).toBe(false);
    expect(parse({ amounts: [{ label: '$5', href: 'javascript:void(0)' }] })).toBe(false);
    expect(parse({ stats: Array.from({ length: 4 }, () => ({ value: '1', label: 'x' })) })).toBe(
      false,
    );
  });

  it('ships model-facing examples that parse, one of them in Arabic', () => {
    for (const example of fundraiserExamples) {
      const exampleNode = example.node as { type: string; props: unknown };
      expect(exampleNode.type).toBe('fundraiser');
      expect(fundraiserSchema.props.safeParse(exampleNode.props).success, example.prompt).toBe(
        true,
      );
    }
    expect(fundraiserExamples.some((example) => /[؀-ۿ]/u.test(example.prompt))).toBe(true);
  });
});
