import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Hero } from './Hero';
import { heroSchema } from './schema';

const node: Node = { id: 'h', type: 'hero', props: {} };

describe('Hero', () => {
  it('renders a labelled section with heading, body, and actions', () => {
    render(
      <Hero
        node={node}
        props={{ tone: 'dark', align: 'start', heading: 'Build faster', body: 'Now.' }}
        slots={{ actions: <button type="button">Go</button> }}
        data={{}}
        isCanvas={false}
      />,
    );
    const section = screen.getByRole('region', { name: 'Build faster' });
    expect(section).toContainElement(screen.getByRole('heading', { level: 1 }));
    expect(section).toHaveTextContent('Now.');
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('omits body and actions when absent (defaults still render)', () => {
    const props = heroSchema.props.parse({});
    render(<Hero node={node} props={props} slots={{}} data={{}} isCanvas={false} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your headline');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('schema: enforces the heading length and the actions slot vocabulary', () => {
    expect(heroSchema.props.safeParse({ heading: '' }).success).toBe(false);
    expect(heroSchema.slots?.['actions']).toEqual({ allow: ['cta'], max: 2 });
  });
});
