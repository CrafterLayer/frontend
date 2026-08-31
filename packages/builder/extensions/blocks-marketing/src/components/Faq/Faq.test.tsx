import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Faq } from './Faq';
import { faqSchema } from './schema';

const node: Node = { id: 'faq', type: 'faq', props: {} };

describe('Faq', () => {
  it('renders keyboard-native disclosures under a labelled section', () => {
    render(
      <Faq
        node={node}
        props={faqSchema.props.parse({
          heading: 'Questions',
          openFirst: true,
          items: [
            { question: 'How fast?', answer: 'Usually one day.' },
            { question: 'Is it secure?', answer: 'Controls are built in.' },
          ],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('region', { name: 'Questions' })).toHaveClass('@container');
    expect(screen.getAllByRole('group')).toHaveLength(2);
    expect(screen.getByText('How fast?').closest('details')).toHaveAttribute('open');
    expect(screen.getByText('Is it secure?').closest('details')).not.toHaveAttribute('open');
  });

  it('renders card and column design choices as real layout classes', () => {
    render(
      <Faq
        node={node}
        props={faqSchema.props.parse({
          heading: 'Card questions',
          layout: 'columns',
          variant: 'cards',
          showNumbers: true,
          items: [{ question: 'What is included?', answer: 'Everything listed.' }],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByText('What is included?').closest('details')).toHaveClass(
      'rounded-xl',
      'bg-surface',
      'open:shadow-elevated',
    );
    expect(screen.getByText('What is included?').closest('[data-faq-list]')).toHaveClass(
      '@lg:grid-cols-2',
    );
    expect(screen.getByText('01')).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies shared typography and logical spacing controls', () => {
    render(
      <Faq
        node={node}
        props={faqSchema.props.parse({
          heading: 'Styled FAQ',
          fontFamily: 'serif',
          marginInlineEnd: 2,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Styled FAQ' });
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 2)');
  });

  it('rejects empty questions and excessive collections', () => {
    expect(faqSchema.props.safeParse({ items: [{ question: '', answer: 'Answer' }] }).success).toBe(
      false,
    );
    expect(
      faqSchema.props.safeParse({
        items: Array.from({ length: 17 }, (_, index) => ({
          question: `Question ${String(index)}`,
          answer: 'Answer',
        })),
      }).success,
    ).toBe(false);
  });
});
