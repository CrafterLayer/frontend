import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { StyleValue } from '@craftkit/builder-schema';

import { installBrowserStandIns } from '../../test-support';
import { ScaleNumberControl, type ScaleNumberControlProps } from './ScaleNumberControl';
import { SCALE_NUMBER_CONTROL_LABELS_AR } from './ScaleNumberControl.labels';
import { namedModel, spacingModel } from './spacing-model';

beforeAll(installBrowserStandIns);
afterEach(cleanup);

const SPACING = spacingModel(['0', 'px', '1', '2', '3', '4', '6', '8', '12']);

function setup(value: StyleValue | undefined, overrides: Partial<ScaleNumberControlProps> = {}) {
  const onCommit = vi.fn();
  render(
    <ScaleNumberControl
      label="Padding"
      value={value}
      model={SPACING}
      units={['px', 'rem', '%']}
      keywords={['auto']}
      onCommit={onCommit}
      {...overrides}
    />,
  );
  return { onCommit, input: screen.getByRole('spinbutton', { name: 'Padding' }) };
}

describe('ScaleNumberControl', () => {
  it('reads a spacing step as its pixel amount', () => {
    const { input } = setup({ kind: 'token', token: '4' });
    expect(input).toHaveValue('16');
    expect(input).toHaveAttribute('aria-valuenow', '16');
  });

  it('ArrowUp adds 1 and goes arbitrary off the scale; landing on a step writes the token', () => {
    const { onCommit, input } = setup({ kind: 'token', token: '4' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onCommit).toHaveBeenLastCalledWith({ kind: 'raw', css: '17px' });
    cleanup();
    const second = setup({ kind: 'raw', css: '15px' });
    fireEvent.keyDown(second.input, { key: 'ArrowUp' });
    expect(second.onCommit).toHaveBeenLastCalledWith({ kind: 'token', token: '4' });
  });

  it('Shift steps by 10 and Alt by 0.1', () => {
    const { onCommit, input } = setup({ kind: 'raw', css: '20px' });
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true });
    expect(onCommit).toHaveBeenLastCalledWith({ kind: 'raw', css: '10px' });
    fireEvent.keyDown(input, { key: 'ArrowUp', altKey: true });
    expect(onCommit).toHaveBeenLastCalledWith({ kind: 'raw', css: '20.1px' });
  });

  it('PageUp/PageDown move to the next scale step', () => {
    const { onCommit, input } = setup({ kind: 'raw', css: '17px' });
    fireEvent.keyDown(input, { key: 'PageUp' });
    expect(onCommit).toHaveBeenLastCalledWith({ kind: 'token', token: '6' });
    fireEvent.keyDown(input, { key: 'PageDown' });
    expect(onCommit).toHaveBeenLastCalledWith({ kind: 'token', token: '4' });
  });

  it('a typed exact value commits once, on Enter, as an arbitrary value', async () => {
    const user = userEvent.setup();
    const { onCommit, input } = setup({ kind: 'token', token: '4' });
    await user.clear(input);
    await user.type(input, '1.5rem');
    expect(onCommit).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ kind: 'raw', css: '1.5rem' });
  });

  it('a typed value that equals a step writes the step', async () => {
    const user = userEvent.setup();
    const { onCommit, input } = setup(undefined);
    await user.type(input, '32{Enter}');
    expect(onCommit).toHaveBeenCalledWith({ kind: 'token', token: '8' });
  });

  it('a typed number is an amount in the shown unit even when it is also a step name', async () => {
    const user = userEvent.setup();
    // "12" is step 12 (48px) on the scale, but the field shows px: 12px is step 3.
    const free = setup(undefined);
    await user.type(free.input, '12{Enter}');
    expect(free.onCommit).toHaveBeenCalledWith({ kind: 'token', token: '3' });
    expect(free.onCommit).not.toHaveBeenCalledWith({ kind: 'token', token: '12' });
    cleanup();
    // Tokens mode with no unit menu still reads digits in the scale's own unit (px).
    const tokens = setup({ kind: 'token', token: 'gutter' }, {
      model: spacingModel(['0', '2', '4', '6', '8', '12', '24', 'gutter']),
      units: [],
      keywords: ['gutter'],
      mode: 'tokens',
    });
    await user.clear(tokens.input);
    await user.type(tokens.input, '96{Enter}');
    expect(tokens.onCommit).toHaveBeenLastCalledWith({ kind: 'token', token: '24' });
    await user.clear(tokens.input);
    await user.type(tokens.input, 'gutter{Enter}');
    expect(tokens.onCommit).toHaveBeenLastCalledWith({ kind: 'token', token: 'gutter' });
    // A name reads as itself: no unit glued on.
    expect(tokens.input).toHaveAttribute('aria-valuetext', 'gutter');
  });

  it('tokens mode snaps a typed value to the nearest step and hides free units', async () => {
    const user = userEvent.setup();
    const { onCommit, input } = setup(undefined, { mode: 'tokens' });
    expect(screen.queryByRole('option', { name: 'rem' })).not.toBeInTheDocument();
    await user.type(input, '17{Enter}');
    expect(onCommit).toHaveBeenCalledWith({ kind: 'token', token: '4' });
  });

  it('picks a keyword from the unit menu', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup({ kind: 'token', token: '4' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Padding unit' }), 'auto');
    expect(onCommit).toHaveBeenCalledWith({ kind: 'token', token: 'auto' });
  });

  it('a keyword value reads as the keyword alone, never as an internal "keyword:" option', () => {
    setup({ kind: 'token', token: 'auto' }, { mode: 'tokens' });
    const menu = screen.getByRole('combobox', { name: 'Padding unit' });
    const names = [...menu.querySelectorAll('option')].map((option) => option.textContent);
    expect(names.some((name) => name.startsWith('keyword:'))).toBe(false);
    expect(screen.getByRole('option', { name: 'auto' })).toHaveProperty('selected', true);
  });

  it('emptying the field resets the value', async () => {
    const user = userEvent.setup();
    const { onCommit, input } = setup({ kind: 'token', token: '4' });
    await user.clear(input);
    await user.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledWith(null);
  });

  it('walks a scale of names by position', () => {
    const { onCommit, input } = setup(
      { kind: 'token', token: 'sm' },
      { model: namedModel(['none', 'sm', 'lg', 'full']), units: [] },
    );
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onCommit).toHaveBeenLastCalledWith({ kind: 'token', token: 'lg' });
  });

  it('shows Mixed for disagreeing targets and labels in Arabic', () => {
    render(
      <ScaleNumberControl
        label="الحشوة"
        value={undefined}
        model={SPACING}
        units={['px']}
        mixed
        labels={SCALE_NUMBER_CONTROL_LABELS_AR}
        onCommit={vi.fn()}
      />,
    );
    const input = screen.getByRole('spinbutton', { name: 'الحشوة' });
    expect(input).toHaveAttribute('aria-valuetext', 'مختلطة');
    expect(screen.getByRole('combobox', { name: 'وحدة الحشوة' })).toBeInTheDocument();
  });
});

describe('ScaleNumberControl scrub grip', () => {
  it('previews while dragged and commits ONCE on release, then ends the preview', () => {
    const onPreview = vi.fn();
    const { onCommit, input } = setup({ kind: 'token', token: '4' }, { scrub: true, onPreview });
    const grip = input.parentElement?.querySelector('.bldr-scale-number__scrub');
    if (!(grip instanceof HTMLElement)) throw new Error('no scrub grip');
    expect(grip).toHaveAttribute('aria-hidden', 'true');
    fireEvent.pointerDown(grip, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 4, clientY: 0 });
    expect(onPreview).toHaveBeenLastCalledWith({ kind: 'raw', css: '18px' });
    expect(input).toHaveValue('18');
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 16, clientY: 0 });
    fireEvent.pointerUp(grip, { pointerId: 1, clientX: 16, clientY: 0 });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ kind: 'token', token: '6' });
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  it('a press without travel writes nothing, and a disabled field has no grip', () => {
    const { onCommit, input } = setup({ kind: 'token', token: '4' }, { scrub: true });
    const grip = input.parentElement?.querySelector('.bldr-scale-number__scrub');
    if (!(grip instanceof HTMLElement)) throw new Error('no scrub grip');
    fireEvent.pointerDown(grip, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(grip, { pointerId: 1, clientX: 1, clientY: 0 });
    expect(onCommit).not.toHaveBeenCalled();
    cleanup();
    const disabled = setup({ kind: 'token', token: '4' }, { scrub: true, disabled: true });
    expect(disabled.input.parentElement?.querySelector('.bldr-scale-number__scrub')).toBeNull();
  });
});
