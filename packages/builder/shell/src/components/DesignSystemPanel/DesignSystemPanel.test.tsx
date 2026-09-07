import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { defaultDesignSystem, type DesignSystem, type TokenName } from '@craftkit/builder-schema';

import { DesignSystemPanel } from './DesignSystemPanel';

afterEach(cleanup);

const withAccent = (accent: string): DesignSystem => {
  const base = defaultDesignSystem();
  return { ...base, tokens: { ...base.tokens, accent } };
};

describe('DesignSystemPanel', () => {
  it('names the system and groups the tokens a person can walk', () => {
    render(<DesignSystemPanel system={defaultDesignSystem()} onChangeToken={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Design system' })).toBeVisible();
    expect(screen.getByRole('grid', { name: 'Colour tokens' })).toBeVisible();
    expect(screen.getByRole('grid', { name: 'Measurement tokens' })).toBeVisible();
  });

  it('commits ONE dispatch per edit, not one per keystroke', async () => {
    const user = userEvent.setup();
    const onChangeToken = vi.fn<(token: TokenName, value: string) => void>();
    render(<DesignSystemPanel system={defaultDesignSystem()} onChangeToken={onChangeToken} />);

    const field = screen.getByLabelText('accent');
    await user.clear(field);
    await user.type(field, '#0b5cff');

    /*
      Seven characters, zero dispatches so far. A controlled field that
      dispatched per keystroke would put seven entries in history and make
      "undo the colour" seven presses.
    */
    expect(onChangeToken).not.toHaveBeenCalled();

    await user.tab();
    expect(onChangeToken).toHaveBeenCalledTimes(1);
    expect(onChangeToken).toHaveBeenCalledWith('accent', '#0b5cff');
  });

  it('commits on Enter as well, without submitting anything', async () => {
    const user = userEvent.setup();
    const onChangeToken = vi.fn<(token: TokenName, value: string) => void>();
    render(<DesignSystemPanel system={defaultDesignSystem()} onChangeToken={onChangeToken} />);

    const field = screen.getByLabelText('accent');
    await user.clear(field);
    await user.type(field, '#0b5cff{Enter}');

    expect(onChangeToken).toHaveBeenCalledExactlyOnceWith('accent', '#0b5cff');
  });

  it('says nothing when the value did not change', async () => {
    const user = userEvent.setup();
    const onChangeToken = vi.fn<(token: TokenName, value: string) => void>();
    const system = defaultDesignSystem();
    render(<DesignSystemPanel system={system} onChangeToken={onChangeToken} />);

    await user.click(screen.getByLabelText('accent'));
    await user.tab();

    /* "It did nothing" and "it did nothing but I recorded it" differ. */
    expect(onChangeToken).not.toHaveBeenCalled();
  });

  it('lets an EXTERNAL write beat an open draft', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DesignSystemPanel system={withAccent('#111111')} onChangeToken={vi.fn()} />,
    );

    const field = screen.getByLabelText('accent');
    await user.clear(field);
    await user.type(field, '#abcabc');
    expect(field).toHaveValue('#abcabc');

    /* A generation lands, or another tab commits, or an undo runs. */
    rerender(<DesignSystemPanel system={withAccent('#222222')} onChangeToken={vi.fn()} />);

    /*
      The draft is DISCARDED. Keeping it would let a half-typed colour outrank a
      value the kernel has already committed, and the next commit would
      overwrite a change the person never saw. Losing three keystrokes is the
      smaller harm than showing a site a colour it does not have.
    */
    expect(screen.getByLabelText('accent')).toHaveValue('#222222');
  });

  it('shows the token a person picked from the grid, with its committed value', async () => {
    const user = userEvent.setup();
    render(<DesignSystemPanel system={defaultDesignSystem()} onChangeToken={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /^text muted/u }));

    expect(screen.getByLabelText('textMuted')).toHaveValue(defaultDesignSystem().tokens.textMuted);
  });

  it('ANNOUNCES what the door refused, and ties it to the field', () => {
    render(
      <DesignSystemPanel
        system={defaultDesignSystem()}
        onChangeToken={vi.fn()}
        issues={['"accent" on "surface" measures 1.2:1, below the 4.5:1 this text size needs.']}
      />,
    );

    /*
      A person who has just typed a colour is looking at the field, not at a
      banner — so the refusal goes into a live region as well as beside it.
    */
    expect(screen.getByRole('status')).toHaveTextContent('below the 4.5:1');
    const field = screen.getByLabelText('accent');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field.getAttribute('aria-describedby') ?? '').not.toBe('');
  });

  it('withdraws Regenerate rather than disabling an action nobody wired', () => {
    const { rerender } = render(
      <DesignSystemPanel system={defaultDesignSystem()} onChangeToken={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Regenerate' })).toBeNull();

    rerender(
      <DesignSystemPanel
        system={defaultDesignSystem()}
        onChangeToken={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeEnabled();
  });

  it('closes the field while a run owns the panel', () => {
    render(
      <DesignSystemPanel
        system={defaultDesignSystem()}
        onChangeToken={vi.fn()}
        onRegenerate={vi.fn()}
        busy
      />,
    );
    expect(screen.getByLabelText('accent')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeDisabled();
  });
});
