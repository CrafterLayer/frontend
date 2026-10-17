import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { StyleValue } from '@craftkit/builder-schema';

import { installBrowserStandIns } from '../../test-support';
import { contrastOf } from './color-math';
import { StyleColorControl, type StyleColorControlProps } from './StyleColorControl';
import { STYLE_COLOR_CONTROL_LABELS_AR } from './StyleColorControl.labels';

beforeAll(installBrowserStandIns);
afterEach(cleanup);

const tokens = [
  { id: 'text', name: 'Text', css: '#111827' },
  { id: 'text-muted', name: 'Muted text', css: '#9ca3af' },
  { id: 'accent', name: 'Accent', css: '#2563eb' },
];
const palette = [{ id: 'brand', name: 'Brand', css: '#0f766e' }];

function setup(value: StyleValue | undefined, overrides: Partial<StyleColorControlProps> = {}) {
  const onCommit = vi.fn();
  render(
    <StyleColorControl
      label="Text colour"
      value={value}
      mode="free"
      tokens={tokens}
      palette={palette}
      onCommit={onCommit}
      {...overrides}
    />,
  );
  return onCommit;
}

describe('StyleColorControl', () => {
  it('offers theme tokens then the site palette, checking the current one', () => {
    setup({ kind: 'token', token: 'accent' });
    expect(screen.getByRole('radiogroup', { name: 'Text colour' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Accent' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Brand' })).toBeInTheDocument();
  });

  it('writes a token, or a palette colour, in one click', async () => {
    const user = userEvent.setup();
    const onCommit = setup(undefined);
    await user.click(screen.getByRole('radio', { name: 'Text' }));
    expect(onCommit).toHaveBeenLastCalledWith({ kind: 'token', token: 'text' });
    await user.click(screen.getByRole('radio', { name: 'Brand' }));
    expect(onCommit).toHaveBeenLastCalledWith({ kind: 'palette', id: 'brand' });
  });

  it('keeps a token opacity when switching tokens and edits it once on Enter', async () => {
    const user = userEvent.setup();
    const onCommit = setup({ kind: 'token', token: 'accent/80' });
    await user.click(screen.getByRole('radio', { name: 'Text' }));
    expect(onCommit).toHaveBeenLastCalledWith({ kind: 'token', token: 'text/80' });
    const opacity = screen.getByRole('spinbutton', { name: 'Opacity: Text colour' });
    await user.clear(opacity);
    await user.type(opacity, '50');
    expect(onCommit).toHaveBeenCalledTimes(1);
    await user.keyboard('{Enter}');
    expect(onCommit).toHaveBeenLastCalledWith({ kind: 'token', token: 'accent/50' });
  });

  it('tokens mode hides the palette and the free picker', () => {
    setup({ kind: 'token', token: 'text' }, { mode: 'tokens' });
    expect(screen.queryByRole('radio', { name: 'Brand' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Custom colour/ })).not.toBeInTheDocument();
  });

  it('warns below 4.5:1 and fixes it with the nearest accessible colour', async () => {
    const user = userEvent.setup();
    const onCommit = setup({ kind: 'token', token: 'text-muted' }, { contrastWith: '#ffffff' });
    expect(screen.getByRole('status')).toHaveTextContent(/below 4.5:1/u);
    await user.click(screen.getByRole('button', { name: 'Use accessible colour' }));
    const written = onCommit.mock.lastCall?.[0] as StyleValue;
    expect(written.kind).toBe('raw');
    expect(contrastOf(written.kind === 'raw' ? written.css : undefined, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('in tokens mode the fix picks the most legible token', async () => {
    const user = userEvent.setup();
    const onCommit = setup(
      { kind: 'token', token: 'text-muted' },
      { contrastWith: '#ffffff', mode: 'tokens' },
    );
    await user.click(screen.getByRole('button', { name: 'Use accessible colour' }));
    expect(onCommit).toHaveBeenCalledWith({ kind: 'token', token: 'text' });
  });

  it('commits a typed hex once, on Enter', async () => {
    const user = userEvent.setup();
    const onCommit = setup({ kind: 'raw', css: '#000000' });
    await user.click(screen.getByRole('button', { name: 'Custom colour: Text colour' }));
    const hex = await screen.findByRole('textbox', { name: 'Hex colour' });
    await user.clear(hex);
    await user.type(hex, '0f766e');
    await user.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ kind: 'raw', css: '#0f766e' });
  });

  it('keeps a typed short prefix as typed until Enter, left to right in the Arabic editor', async () => {
    const user = userEvent.setup({ delay: null });
    const onCommit = setup({ kind: 'raw', css: '#000000' }, { dir: 'rtl' });
    await user.click(screen.getByRole('button', { name: 'Custom colour: Text colour' }));
    const hex = await screen.findByRole('textbox', { name: 'Hex colour' });
    expect(hex).toHaveAttribute('dir', 'ltr');
    await user.clear(hex);
    // "#e11" is already a colour; it must not come back expanded mid-typing.
    await user.type(hex, '#e11');
    expect(hex).toHaveValue('#e11');
    expect(onCommit).not.toHaveBeenCalled();
    await user.type(hex, 'd48');
    expect(hex).toHaveValue('#e11d48');
    await user.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ kind: 'raw', css: '#e11d48' });
  });

  it('shows Mixed and labels in Arabic', () => {
    setup(undefined, { mixed: true, labels: STYLE_COLOR_CONTROL_LABELS_AR, label: 'لون النص' });
    expect(screen.getByRole('radiogroup', { name: 'لون النص (مختلطة)' })).toBeInTheDocument();
  });
});
