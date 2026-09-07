import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { defaultDesignSystem, type TokenName } from '@craftkit/builder-schema';

import { TokenSwatchGrid } from './TokenSwatchGrid';

afterEach(cleanup);

const COLOURS: readonly TokenName[] = [
  'surface',
  'surfaceInverse',
  'text',
  'textInverse',
  'textMuted',
  'accent',
];

const tokens = defaultDesignSystem().tokens;

const renderGrid = (props: Partial<Parameters<typeof TokenSwatchGrid>[0]> = {}) =>
  render(<TokenSwatchGrid tokens={tokens} names={COLOURS} label="Colour" columns={3} {...props} />);

describe('TokenSwatchGrid', () => {
  it('is a named grid whose cells are all reachable', () => {
    renderGrid();
    const grid = screen.getByRole('grid', { name: 'Colour' });
    expect(grid).toHaveAttribute('aria-colcount', '3');
    expect(screen.getAllByRole('gridcell')).toHaveLength(COLOURS.length);
  });

  it('names every token in TEXT and shows its value, never colour alone', () => {
    renderGrid();
    /*
      A grid of coloured squares is unusable to anyone who cannot tell them
      apart — one man in twelve, every screen reader, and anybody on a bad
      monitor. The name and the value are what make a cell legible.
    */
    expect(screen.getByText('surface inverse')).toBeVisible();
    expect(screen.getByRole('button', { name: /accent/u })).toHaveTextContent(tokens.accent);
  });

  it('reports the token a person chose, once', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn<(token: TokenName) => void>();
    renderGrid({ onSelect });

    await user.click(screen.getByRole('button', { name: /^accent/u }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('accent');
  });

  it('marks the selected token as pressed rather than only colouring it', () => {
    renderGrid({ selected: 'text' });
    const pressed = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true');
    /* Exactly one, and it is the one named — not merely "some cell is pressed". */
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent('text');
  });

  it('walks the grid with arrow keys, by row and by column', async () => {
    const user = userEvent.setup();
    renderGrid();
    const buttons = screen.getAllByRole('button');

    await user.tab();
    expect(buttons[0]).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(buttons[1]).toHaveFocus();

    /* Down is a whole row, not one cell — three columns, so index 1 → 4. */
    await user.keyboard('{ArrowDown}');
    expect(buttons[4]).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(buttons[1]).toHaveFocus();
  });

  it('goes to the ends of the ROW with Home and End, not the ends of the grid', async () => {
    const user = userEvent.setup();
    renderGrid();
    const buttons = screen.getAllByRole('button');

    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(buttons[3]).toHaveFocus();

    await user.keyboard('{End}');
    expect(buttons[5]).toHaveFocus();

    await user.keyboard('{Home}');
    expect(buttons[3]).toHaveFocus();
  });

  it('stops at the edges instead of wrapping into another row', async () => {
    const user = userEvent.setup();
    renderGrid();
    const buttons = screen.getAllByRole('button');

    await user.tab();
    await user.keyboard('{ArrowLeft}');
    /*
      Wrapping would move a person from the start of one row to the end of the
      row above, which reads as the grid jumping. Clamping is the quieter lie
      to tell: nothing moved.
    */
    expect(buttons[0]).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(buttons[0]).toHaveFocus();
  });

  it('costs ONE tab to get past, however many tokens it holds', async () => {
    const user = userEvent.setup();
    render(
      <>
        <TokenSwatchGrid tokens={tokens} names={COLOURS} label="Colour" columns={3} />
        <button type="button">after</button>
      </>,
    );

    await user.tab();
    expect(screen.getAllByRole('button')[0]).toHaveFocus();
    await user.tab();
    /* A roving tabindex: sixty tokens must not cost sixty presses. */
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
  });

  it('shows a measurement token with no colour chip, in the same grid', () => {
    render(
      <TokenSwatchGrid tokens={tokens} names={['gap', 'radius']} label="Measurement" columns={2} />,
    );
    const gap = screen.getByRole('button', { name: /^gap/u });
    expect(gap).toHaveTextContent(tokens.gap);
    expect(gap.querySelector('.bldr-swatches__chip')).toBeNull();
  });
});
