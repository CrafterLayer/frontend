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
        props={{
          heading: 'Why us',
          columns: '2',
          items: [
            { title: 'Fast', body: 'Very fast.' },
            { title: 'Safe', body: 'Very safe.' },
          ],
        }}
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
});
