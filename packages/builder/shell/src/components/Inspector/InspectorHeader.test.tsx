import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InspectorHeader } from './InspectorHeader';

describe('InspectorHeader', () => {
  it('shows the eyebrow, the selected block name and the tab slot', () => {
    render(
      <InspectorHeader blockName="Card" selected bucket="base" onClearSelection={vi.fn()}>
        <div data-testid="tabs" />
      </InspectorHeader>,
    );
    expect(screen.getByRole('heading', { name: 'Inspector' }).tagName).toBe('H2');
    const name = screen.getByRole('paragraph', { name: 'Selected block' });
    expect(name).toHaveTextContent('Card');
    expect(name).not.toHaveAttribute('data-empty');
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.queryByText('base')).not.toBeInTheDocument();
  });

  it('offers Clear selection only while something is selected, as quiet small chrome in the title row', async () => {
    const onClearSelection = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <InspectorHeader
        blockName="Card"
        selected
        bucket="base"
        onClearSelection={onClearSelection}
      />,
    );
    const clear = screen.getByRole('button', { name: 'Clear selection' });
    expect(clear.closest('.bldr-inspector__title-row')).not.toBeNull();
    expect(clear).toHaveClass('bldr-inspector__clear-selection');
    expect(clear).toHaveAttribute('data-bldr-chrome-button', '');
    expect(clear).toHaveAttribute('data-size', 'sm');
    expect(clear).toHaveAttribute('data-variant', 'quiet');
    expect(clear.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    await user.click(clear);
    expect(onClearSelection).toHaveBeenCalledTimes(1);

    view.rerender(
      <InspectorHeader
        blockName="No block selected"
        selected={false}
        bucket="base"
        onClearSelection={onClearSelection}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
    expect(screen.getByRole('paragraph', { name: 'Selected block' })).toHaveAttribute(
      'data-empty',
      'true',
    );
  });

  it('badges the bucket and notes the override mode only off-base and only with a selection', () => {
    const view = render(
      <InspectorHeader blockName="Card" selected bucket="tablet" onClearSelection={vi.fn()} />,
    );
    const identity = document.querySelector('.bldr-inspector__identity');
    expect(identity).not.toBeNull();
    expect(within(identity as HTMLElement).getByText('tablet')).toHaveClass(
      'bldr-inspector__bucket',
    );
    expect(screen.getByText('Editing tablet overrides')).toBeInTheDocument();

    view.rerender(
      <InspectorHeader
        blockName="No block selected"
        selected={false}
        bucket="tablet"
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getByText('tablet')).toBeInTheDocument();
    expect(screen.queryByText('Editing tablet overrides')).not.toBeInTheDocument();
  });
});
