import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { PullQuote } from './PullQuote';
import { pullQuoteExamples } from './examples';
import { pullQuoteSchema } from './schema';

const node: Node = { id: 'quote', type: 'pullQuote', props: {} };

function renderQuote(overrides: Record<string, unknown> = {}) {
  return render(
    <PullQuote
      node={node}
      props={pullQuoteSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('PullQuote', () => {
  it('is a figure holding a blockquote and an attributed caption', () => {
    const { container } = renderQuote({
      quote: 'Ship the answer within a week.',
      author: 'Lina Haddad',
      role: 'Founder',
      imageSrc: '/assets/lina.jpg',
      imageAlt: 'Lina Haddad',
    });
    const figure = container.querySelector('figure');
    expect(figure?.querySelector('blockquote')).toHaveTextContent('Ship the answer within a week.');
    const caption = figure?.querySelector('figcaption');
    expect(caption).toHaveTextContent('Lina Haddad');
    expect(caption).toHaveTextContent('Founder');
    expect(screen.getByRole('img', { name: 'Lina Haddad' })).toHaveClass('rounded-full');
  });

  it('cites a linked source on the blockquote and as a link', () => {
    const { container } = renderQuote({
      author: 'Sara',
      source: 'The Daily',
      sourceHref: 'https://example.com/a',
    });
    expect(container.querySelector('blockquote')).toHaveAttribute('cite', 'https://example.com/a');
    expect(screen.getByRole('link', { name: 'The Daily' }).closest('cite')).not.toBeNull();
  });

  it('prints an unlinked source as plain cited text', () => {
    renderQuote({ source: 'Annual report' });
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Annual report').closest('cite')).not.toBeNull();
  });

  it('draws a decorative mark that mirrors in RTL, and leaves it out when asked', () => {
    const { container, unmount } = renderQuote();
    const mark = container.querySelector('[data-pull-quote-mark]');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark).toHaveClass('rtl:-scale-x-100', 'text-accent');
    unmount();
    expect(
      renderQuote({ showMark: false }).container.querySelector('[data-pull-quote-mark]'),
    ).toBeNull();
  });

  it('frames the quote by variant: a bar at the inline start, or a light card', () => {
    const rule = renderQuote({ variant: 'rule' }).container.querySelector('figure');
    expect(rule).toHaveClass('border-s-4', 'border-accent', 'ps-6');
    const card = renderQuote({ variant: 'card', tone: 'dark', role: 'CTO' }).container;
    expect(card.querySelectorAll('figure')[0]).toHaveClass('bg-surface', 'text-text');
    expect(screen.getByText('CTO').parentElement).toHaveClass('text-text-muted');
  });

  it('sizes the quote and renders no caption without attribution', () => {
    const { container } = renderQuote({ size: 'xl' });
    expect(container.querySelector('blockquote p')).toHaveClass('text-3xl', '@md:text-5xl');
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('combines token-based colour, typography, and logical spacing controls', () => {
    const { container } = renderQuote({
      background: 'accent',
      fontFamily: 'serif',
      marginInlineEnd: 4,
    });
    const section = container.querySelector('section')!;
    expect(section).toHaveClass('mkt-type--family-serif', '@container');
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });
});

describe('PullQuote schema', () => {
  it('defaults to a centred plain quote and maps every inspector prop', () => {
    expect(pullQuoteSchema.props.parse({})).toMatchObject({
      variant: 'plain',
      size: 'lg',
      align: 'center',
      width: 'wide',
      showMark: true,
    });
    expect(Object.keys(pullQuoteSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(pullQuoteSchema.props.shape).sort(),
    );
    expect(pullQuoteSchema.inlineEditable).toBe('quote');
  });

  it('bounds the quote and refuses unsafe links', () => {
    const parse = (value: unknown) => pullQuoteSchema.props.safeParse(value).success;
    expect(parse({ quote: '' })).toBe(false);
    expect(parse({ quote: 'x'.repeat(321) })).toBe(false);
    expect(parse({ sourceHref: 'javascript:alert(1)' })).toBe(false);
    expect(parse({ imageSrc: 'data:text/html,hi' })).toBe(false);
  });

  it('ships model-facing examples that parse, one of them in Arabic', () => {
    for (const example of pullQuoteExamples) {
      const exampleNode = example.node as { type: string; props: unknown };
      expect(exampleNode.type).toBe('pullQuote');
      expect(pullQuoteSchema.props.safeParse(exampleNode.props).success, example.prompt).toBe(true);
    }
    expect(pullQuoteExamples.some((example) => /[؀-ۿ]/u.test(example.prompt))).toBe(true);
  });
});
