import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { useBuilder } from '../../hooks/use-builder';
import { BuilderProvider } from './BuilderProvider';

function SurfaceProbe() {
  const kernel = useBuilder();
  return <output>{kernel.context.surface}</output>;
}

function makeKernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('t') },
  });
}

describe('BuilderProvider', () => {
  it('exposes the kernel to hooks beneath it', () => {
    render(
      <BuilderProvider kernel={makeKernel()}>
        <SurfaceProbe />
      </BuilderProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('site');
  });

  it('hooks outside the provider throw a wiring error', () => {
    expect(() => render(<SurfaceProbe />)).toThrow(/inside <BuilderProvider>/);
  });
});
