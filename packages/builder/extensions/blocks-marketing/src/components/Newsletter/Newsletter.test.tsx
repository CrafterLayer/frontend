import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Newsletter } from './Newsletter';
import { newsletterSchema } from './schema';

const node: Node = { id: 'newsletter', type: 'newsletter', props: {} };

describe('Newsletter', () => {
  it('renders a labelled native email form with consent context', () => {
    render(
      <Newsletter
        node={node}
        props={newsletterSchema.props.parse({
          heading: 'Weekly signal',
          emailLabel: 'Work email',
          buttonLabel: 'Join',
          privacy: 'Unsubscribe whenever you like.',
          action: '/join',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('region', { name: 'Weekly signal' })).toHaveClass('@container');
    const email = screen.getByRole('textbox', { name: 'Work email' });
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toBeRequired();
    expect(email).toHaveAttribute('aria-describedby', 'newsletter-privacy');
    expect(screen.getByRole('button', { name: 'Join' })).toHaveAttribute('type', 'submit');
    expect(email.closest('form')).toHaveAttribute('action', '/join');
    expect(email.closest('form')).toHaveAttribute('method', 'post');
  });

  it('renders split and stacked controls as distinct layout classes', () => {
    render(
      <Newsletter
        node={node}
        props={newsletterSchema.props.parse({
          heading: 'Product notes',
          variant: 'split',
          formLayout: 'stacked',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByText('Product notes').closest('[data-newsletter-panel]')).toHaveClass(
      'grid',
      '@lg:grid-cols-2',
      'rounded-xl',
      'shadow-elevated',
    );
    expect(screen.getByText('Product notes').closest('[data-newsletter-copy]')).toHaveClass(
      'bg-surface-inverse',
    );
    expect(screen.getByRole('textbox').parentElement).not.toHaveClass('@sm:flex-row');
  });

  it('applies shared color, typography, and logical spacing controls', () => {
    render(
      <Newsletter
        node={node}
        props={newsletterSchema.props.parse({
          heading: 'Styled newsletter',
          background: 'surfaceInverse',
          textColor: 'textInverse',
          fontSize: 'lg',
          paddingInlineStart: 6,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Styled newsletter' });
    expect(section).toHaveClass('mkt-type--size-lg');
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.color).toBe('var(--t-text-inverse)');
    expect(section.style.paddingInlineStart).toBe('calc(var(--t-space-unit, 4px) * 6)');
  });

  it('rejects invalid form and text values', () => {
    expect(newsletterSchema.props.safeParse({ action: '' }).success).toBe(false);
    expect(newsletterSchema.props.safeParse({ buttonLabel: '' }).success).toBe(false);
    expect(newsletterSchema.props.safeParse({ privacy: '' }).success).toBe(false);
  });

  it('rejects executable script form actions at the schema boundary', () => {
    expect(newsletterSchema.props.safeParse({ action: 'javascript:alert(1)' }).success).toBe(false);
  });
});
