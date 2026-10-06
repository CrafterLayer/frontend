import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MediaParamFields, type MediaParamRow } from './MediaParamFields';
import { MEDIA_PARAM_FIELDS_LABELS_AR } from './MediaParamFields.labels';

afterEach(cleanup);

const CAROUSEL: readonly MediaParamRow[] = [
  { key: 'data-ck-indicator', label: 'Position indicator', value: 'dots', choices: ['dots', 'counter', 'none'] },
  { key: 'data-ck-autoplay', label: 'Autoplay', value: undefined, choices: ['true', 'false'] },
];

describe('MediaParamFields', () => {
  it('renders nothing without rows', () => {
    const { container } = render(<MediaParamFields rows={[]} onCommit={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('a closed choice is a radio group; Default removes the param; one commit per change', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<MediaParamFields rows={CAROUSEL} onCommit={onCommit} />);
    const indicator = screen.getByRole('radiogroup', { name: 'Position indicator' });
    expect(screen.getByRole('radio', { name: 'Dots' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'Counter' }));
    expect(onCommit).toHaveBeenLastCalledWith('data-ck-indicator', 'counter');
    expect(indicator).toBeInTheDocument();
    // Autoplay is unset, so Default is checked.
    const autoplay = screen.getByRole('radiogroup', { name: 'Autoplay' });
    expect(autoplay.querySelector('[aria-checked="true"]')).toHaveTextContent('Default');
    await user.click(within(indicator).getByRole('radio', { name: 'Default' }));
    expect(onCommit).toHaveBeenLastCalledWith('data-ck-indicator', undefined);
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('arrow keys move the choice with visible focus, mirrored in RTL', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<MediaParamFields rows={CAROUSEL} onCommit={onCommit} dir="rtl" labels={MEDIA_PARAM_FIELDS_LABELS_AR} />);
    const dots = screen.getByRole('radio', { name: 'نقاط' });
    dots.focus();
    // In RTL, ArrowLeft moves FORWARD (dots → counter).
    await user.keyboard('{ArrowLeft}');
    expect(onCommit).toHaveBeenLastCalledWith('data-ck-indicator', 'counter');
    expect(screen.getByRole('radio', { name: 'عدّاد' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(onCommit).toHaveBeenLastCalledWith('data-ck-indicator', 'none');
    expect(screen.getByRole('radio', { name: 'بدون' })).toHaveFocus();
    expect(screen.getByRole('group', { name: 'إعدادات الوسائط' })).toHaveAttribute('dir', 'rtl');
  });

  it('a text row commits on Enter or blur, trims, and clears to undefined; Escape restores', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <MediaParamFields
        rows={[{ key: 'data-ck-email', label: 'Send to (email)', value: 'hello@example.com', input: 'email' }]}
        onCommit={onCommit}
      />,
    );
    const email = screen.getByRole('textbox', { name: 'Send to (email)' });
    expect(email).toHaveAttribute('type', 'email');
    await user.clear(email);
    await user.type(email, ' team@example.com {Enter}');
    expect(onCommit).toHaveBeenLastCalledWith('data-ck-email', 'team@example.com');
    await user.clear(email);
    await user.type(email, 'x{Escape}');
    expect(email).toHaveValue('hello@example.com');
    await user.clear(email);
    await user.tab();
    expect(onCommit).toHaveBeenLastCalledWith('data-ck-email', undefined);
    expect(onCommit).toHaveBeenCalledTimes(2);
  });
});
