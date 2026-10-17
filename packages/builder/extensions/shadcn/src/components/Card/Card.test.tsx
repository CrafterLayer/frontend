import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Card } from './Card';
import { cardSchema } from './schema';

afterEach(cleanup);

const node = { id: 'card-1', type: 'card', props: {} };

const renderCard = (overrides: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) =>
  render(
    <Card
      node={node}
      props={cardSchema.props.parse(overrides)}
      slots={{ default: <p>Body</p>, ...slots } as never}
      data={{}}
      isCanvas={false}
    />,
  );

describe('Card', () => {
  it('renders header, body and footer as separate regions', () => {
    renderCard({}, { header: <h3>Title</h3>, footer: <button type="button">Act</button> });

    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Act' })).toBeInTheDocument();
  });

  it('omits the header and footer wrappers when those slots are empty', () => {
    const { container } = renderCard();

    /* Root + body only — an empty region is still a gap in a flex column. */
    expect(container.firstElementChild?.children).toHaveLength(1);
  });

  /*
    Ground and ink as a PAIR. A card that set its background and inherited its
    text is how a dark card ends up with dark text — the one combination that
    is invisible and the one nobody checks.
  */
  it('pairs every tone with the ink that reads on it', () => {
    const { container } = renderCard({ tone: 'inverse' });

    expect(container.firstElementChild).toHaveClass('bg-surface-inverse');
    expect(container.firstElementChild).toHaveClass('text-text-inverse');
  });

  it('lets the body grow, so a row of cards lines its footers up', () => {
    const { container } = renderCard();
    const body = container.firstElementChild?.firstElementChild;

    expect(body).toHaveClass('flex-1');
  });

  it('resolves elevation to a shadow TOKEN, never a raw shadow', () => {
    const { container } = renderCard({ elevation: 'soft' });

    /* `shadow-soft` compiles to `var(--t-shadow-soft)` through the bridge. */
    expect(container.firstElementChild).toHaveClass('shadow-soft');
    expect(renderCard({ elevation: 'none' }).container.querySelector('[class*="shadow-"]')).toBe(
      null,
    );
  });

  it('puts the caller className last, so it wins a conflict', () => {
    const { container } = renderCard({ className: 'rounded-none' });

    expect(container.firstElementChild).toHaveClass('rounded-none');
  });

  /*
    The defect this block exists to avoid. The old Pricing section carried its
    cards as an array of strings, so a button inside one was impossible to
    author — a template wearing a builder block's clothes.
  */
  it('schema: takes BLOCKS in every region, not strings', () => {
    expect(cardSchema.slots?.['default']?.allow).toContain('cta');
    expect(cardSchema.slots?.['header']?.allow).toContain('richText');
    expect(cardSchema.slots?.['footer']?.allow).toContain('cta');
  });

  it('schema: refuses a class the design system cannot reach', () => {
    expect(cardSchema.props.safeParse({ className: 'bg-blue-500' }).success).toBe(false);
    expect(cardSchema.props.safeParse({ className: 'lg:p-8 hover:bg-accent' }).success).toBe(true);
  });
});
