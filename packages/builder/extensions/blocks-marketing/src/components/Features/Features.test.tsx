import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Features } from './Features';
import { featuresSchema } from './schema';

const node: Node = { id: 'f', type: 'features', props: {} };

describe('Features', () => {
  it('renders a labelled section with a list item per feature', () => {
    render(
      <Features
        node={node}
        props={featuresSchema.props.parse({
          heading: 'Why us',
          columns: '2',
          items: [
            { title: 'Fast', body: 'Very fast.' },
            { title: 'Safe', body: 'Very safe.' },
          ],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(screen.getByRole('region', { name: 'Why us' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 3, name: 'Fast' })).toBeInTheDocument();
  });

  it('renders no list items for the empty default', () => {
    render(
      <Features
        node={node}
        props={featuresSchema.props.parse({})}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('schema rejects malformed items', () => {
    expect(featuresSchema.props.safeParse({ items: [{ title: '', body: 'x' }] }).success).toBe(
      false,
    );
  });

  it('schema: enforces the complete Features builder-control contract', () => {
    const props = featuresSchema.props.parse({});
    expect(props).toMatchObject({
      align: 'start',
      columns: '3',
      spacing: 'md',
      tone: 'transparent',
      width: 'full',
    });
    expect(props.body).toBeUndefined();

    const accepted = [
      ...['start', 'center', 'end'].map((align) => ({ align })),
      ...['transparent', 'light', 'dark'].map((tone) => ({ tone })),
      ...['none', 'sm', 'md', 'lg'].map((spacing) => ({ spacing })),
      ...['narrow', 'standard', 'wide', 'full'].map((width) => ({ width })),
      ...['1', '2', '3', '4'].map((columns) => ({ columns })),
      { body: 'Everything your team needs.' },
    ];
    for (const candidate of accepted) {
      expect(featuresSchema.props.safeParse(candidate).success, JSON.stringify(candidate)).toBe(
        true,
      );
    }

    const rejected = [
      { body: '' },
      { body: 'x'.repeat(201) },
      { body: 42 },
      { align: 'justify' },
      { tone: 'muted' },
      { spacing: 'xl' },
      { width: 'auto' },
      { columns: '5' },
    ];
    for (const candidate of rejected) {
      expect(featuresSchema.props.safeParse(candidate).success, JSON.stringify(candidate)).toBe(
        false,
      );
    }
  });
});
