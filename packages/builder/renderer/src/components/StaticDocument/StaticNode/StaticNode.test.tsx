import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { landingFixture } from '@craftkit/builder-core/testing';

import { StaticNode } from './StaticNode';

describe('StaticNode', () => {
  it('falls back to UnknownBlock when no renderer is registered', () => {
    render(
      <StaticNode
        document={landingFixture()}
        id="hero1"
        blocks={() => undefined}
        breakpoint="desktop"
      />,
    );
    expect(screen.getByRole('note')).toHaveTextContent('hero');
  });

  it('renders nothing for a missing id', () => {
    const { container } = render(
      <StaticNode
        document={landingFixture()}
        id="ghost"
        blocks={() => undefined}
        breakpoint="desktop"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
