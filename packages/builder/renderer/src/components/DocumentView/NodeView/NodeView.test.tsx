import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { NodeView } from './NodeView';

function makeKernel(document = landingFixture()) {
  return createBuilder({
    document,
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('nv') },
  });
}

describe('NodeView', () => {
  it('renders an unknown type as the explicit fallback', () => {
    const kernel = createBuilder(); // no extensions: 'page' is unregistered
    render(<NodeView kernel={kernel} id="root" breakpoint="desktop" />);
    expect(screen.getByRole('note')).toHaveTextContent('page');
  });

  it('renders nothing for a missing node id', () => {
    const kernel = makeKernel();
    const { container } = render(<NodeView kernel={kernel} id="ghost" breakpoint="desktop" />);
    expect(container).toBeEmptyDOMElement();
  });
});
