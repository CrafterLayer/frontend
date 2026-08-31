import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { ContentSection } from './ContentSection';
import { contentSectionSchema } from './schema';

const node: Node = { id: 'content', type: 'content-section', props: {} };

describe('ContentSection', () => {
  it('renders narrative copy, highlights, media, and a real link', () => {
    render(
      <ContentSection
        node={node}
        props={contentSectionSchema.props.parse({
          heading: 'Our approach',
          body: 'Work with clarity.',
          imageSrc: '/studio.jpg',
          imageAlt: 'A team reviewing plans',
          caption: 'Working session',
          highlights: [{ title: 'Evidence', body: 'Start with what is true.' }],
          link: { label: 'Read the method', href: '/method' },
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('region', { name: 'Our approach' })).toHaveClass('@container');
    expect(screen.getByRole('img', { name: 'A team reviewing plans' })).toHaveAttribute(
      'loading',
      'lazy',
    );
    expect(screen.getByText('Working session').tagName).toBe('FIGCAPTION');
    expect(screen.getByRole('link', { name: 'Read the method' })).toHaveAttribute(
      'href',
      '/method',
    );
    expect(screen.getByRole('list')).toHaveAttribute('data-content-highlights');
    expect(screen.getByRole('figure')).toHaveClass('rounded-xl', 'shadow-elevated');
  });

  it('does not render an empty media shell', () => {
    render(
      <ContentSection
        node={node}
        props={contentSectionSchema.props.parse({ heading: 'Text only', body: 'Still complete.' })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
    expect(screen.getByText('Still complete.')).toBeVisible();
  });

  it('uses logical styling for the editorial variant and media order', () => {
    render(
      <ContentSection
        node={node}
        props={contentSectionSchema.props.parse({
          heading: 'Editorial',
          body: 'A composed story.',
          layout: 'editorial',
          imageSrc: '/story.jpg',
          mediaPosition: 'start',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(
      screen.getByText('A composed story.').closest('[data-content-section-copy]'),
    ).toHaveClass('border-s-4', 'ps-gap-lg');
    expect(screen.getByRole('figure')).toHaveClass('order-first');
  });

  it('applies shared colour and spacing controls', () => {
    render(
      <ContentSection
        node={node}
        props={contentSectionSchema.props.parse({
          heading: 'Styled content',
          body: 'Body',
          background: 'accent',
          textColor: 'accentText',
          paddingBlockStart: 8,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Styled content' });
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.color).toBe('var(--t-accent-text)');
    expect(section.style.paddingBlockStart).toBe('calc(var(--t-space-unit, 4px) * 8)');
  });

  it('rejects invalid content and oversized collections', () => {
    expect(contentSectionSchema.props.safeParse({ body: '' }).success).toBe(false);
    expect(
      contentSectionSchema.props.safeParse({
        highlights: Array.from({ length: 7 }, (_, index) => ({
          title: `Point ${String(index)}`,
          body: 'Body',
        })),
      }).success,
    ).toBe(false);
  });

  it('rejects executable script links at the schema boundary', () => {
    expect(
      contentSectionSchema.props.safeParse({
        link: { label: 'Unsafe', href: 'javascript:alert(1)' },
      }).success,
    ).toBe(false);
  });
});
