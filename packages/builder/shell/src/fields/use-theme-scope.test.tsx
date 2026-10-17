import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useThemeScope } from './use-theme-scope';

/**
 * The regression these pin: a Radix popover portalled to `document.body` lands
 * outside the element carrying `data-bldr-theme`, so every `--bldr-*` token
 * resolves to the light palette. Measured in a real browser — with the editor
 * stamped dark, the popover still painted white.
 */
function Probe() {
  const { attach, scope } = useThemeScope();
  return (
    <div ref={attach}>
      <span data-testid="found">{scope?.dataset['testid'] ?? 'none'}</span>
    </div>
  );
}

describe('useThemeScope', () => {
  it('finds the nearest themed ancestor', () => {
    render(
      <div data-bldr-theme="dark" data-testid="outer">
        <div data-testid="middle">
          <Probe />
        </div>
      </div>,
    );

    expect(screen.getByTestId('found')).toHaveTextContent('outer');
  });

  it('prefers the NEAREST themed ancestor when themes nest', () => {
    // A host may theme a region inside an already-themed editor. Taking the
    // outermost would paint the popover with the wrong one of the two.
    render(
      <div data-bldr-theme="dark" data-testid="outer">
        <div data-bldr-theme="light" data-testid="inner">
          <Probe />
        </div>
      </div>,
    );

    expect(screen.getByTestId('found')).toHaveTextContent('inner');
  });

  it('reports nothing when no ancestor is themed, so a portal keeps its default', () => {
    render(
      <div data-testid="plain">
        <Probe />
      </div>,
    );

    expect(screen.getByTestId('found')).toHaveTextContent('none');
  });
});
