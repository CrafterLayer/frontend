import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { StyleValue } from '@craftkit/builder-schema';

import { installBrowserStandIns } from '../../test-support';
import { ColorField, type ColorFieldProps } from './ColorField';
import { COLOR_FIELD_LABELS_AR } from './ColorField.labels';

beforeAll(installBrowserStandIns);
afterEach(cleanup);

const tokens = [
  { id: 'surface', name: 'Surface', css: '#ffffff' },
  { id: 'accent', name: 'Accent', css: '#2563eb' },
  { id: 'text-muted', name: 'Muted text', css: '#d1d5db' },
];

function setup(value: StyleValue | undefined, overrides: Partial<ColorFieldProps> = {}) {
  const onCommit = vi.fn();
  render(
    <ColorField
      label="Background colour"
      value={value}
      mode="free"
      tokens={tokens}
      palette={[{ id: 'brand', name: 'Brand', css: '#0f766e' }]}
      onCommit={onCommit}
      {...overrides}
    />,
  );
  return onCommit;
}

describe('ColorField', () => {
  it('names the value on the closed field: token with opacity, palette, hex, none', () => {
    setup({ kind: 'token', token: 'accent/80' });
    expect(screen.getByRole('button', { name: 'Background colour: Accent · 80%' })).toBeInTheDocument();
    cleanup();
    setup({ kind: 'palette', id: 'brand' });
    expect(screen.getByRole('button', { name: 'Background colour: Brand' })).toBeInTheDocument();
    cleanup();
    setup({ kind: 'raw', css: '#ff0000' });
    expect(screen.getByRole('button', { name: 'Background colour: #ff0000' })).toBeInTheDocument();
    cleanup();
    setup(undefined);
    expect(screen.getByRole('button', { name: 'Background colour: None' })).toHaveAttribute('data-unset');
  });

  it('opens token chips, the palette and the inline picker; a chip writes once', async () => {
    const user = userEvent.setup();
    const onCommit = setup({ kind: 'token', token: 'surface' });
    await user.click(screen.getByRole('button', { name: /^Background colour:/u }));
    const group = screen.getByRole('radiogroup', { name: 'Background colour' });
    expect(within(group).getByRole('radio', { name: 'Surface' })).toHaveAttribute('aria-checked', 'true');
    expect(within(group).getByRole('radio', { name: 'Brand' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Hex colour' })).toBeInTheDocument();
    await user.click(within(group).getByRole('radio', { name: 'Accent' }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ kind: 'token', token: 'accent' });
  });

  it('a typed hex commits once, on Enter', async () => {
    const user = userEvent.setup();
    const onCommit = setup(undefined);
    await user.click(screen.getByRole('button', { name: /^Background colour:/u }));
    const hex = screen.getByRole('textbox', { name: 'Hex colour' });
    await user.type(hex, '#123456');
    fireEvent.keyDown(hex, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ kind: 'raw', css: '#123456' });
  });

  it('a typed hex is kept when Escape closes the popover, as a click outside keeps it', async () => {
    const user = userEvent.setup();
    const onCommit = setup(undefined);
    await user.click(screen.getByRole('button', { name: /^Background colour:/u }));
    await user.type(screen.getByRole('textbox', { name: 'Hex colour' }), '#123456');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: 'Hex colour' })).not.toBeInTheDocument();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ kind: 'raw', css: '#123456' });
  });

  it('shows a typed colour left to right inside an Arabic panel', () => {
    setup({ kind: 'raw', css: '#ffffff' }, { labels: COLOR_FIELD_LABELS_AR, dir: 'rtl' });
    const text = document.querySelector('.bldr-color-field__text');
    expect(text).toHaveTextContent('#ffffff');
    expect(text).toHaveAttribute('dir', 'ltr');
  });

  it('tokens mode offers theme tokens only: no palette, no free picker', async () => {
    const user = userEvent.setup();
    setup({ kind: 'token', token: 'accent' }, { mode: 'tokens' });
    await user.click(screen.getByRole('button', { name: /^Background colour:/u }));
    expect(screen.queryByRole('radio', { name: 'Brand' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Hex colour' })).not.toBeInTheDocument();
  });

  it('marks low contrast on the closed field, in Arabic too', () => {
    setup({ kind: 'token', token: 'text-muted' }, { contrastWith: '#ffffff', labels: COLOR_FIELD_LABELS_AR });
    expect(screen.getByRole('button', { name: 'Background colour: Muted text, تباين منخفض' })).toBeInTheDocument();
  });

  it('says Mixed when the targets disagree', () => {
    setup({ kind: 'token', token: 'accent' }, { mixed: true });
    expect(screen.getByRole('button', { name: 'Background colour: Mixed' })).toHaveAttribute('data-mixed');
  });
});
