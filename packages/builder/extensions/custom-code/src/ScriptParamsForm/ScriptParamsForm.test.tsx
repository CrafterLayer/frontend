import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ScriptParamsForm, type ScriptParamsFormProps } from './index';
import { SCRIPT_PARAMS_FORM_SPEC } from './ScriptParamsForm.fixture';

function setup(overrides: Partial<ScriptParamsFormProps> = {}) {
  const onChange = vi.fn<ScriptParamsFormProps['onChange']>();
  const props: ScriptParamsFormProps = {
    spec: SCRIPT_PARAMS_FORM_SPEC,
    values: {},
    onChange,
    ...overrides,
  };
  const view = render(<ScriptParamsForm {...props} />);
  return { ...view, onChange, props };
}

describe('ScriptParamsForm', () => {
  it('renders defaults, named native controls and associated help', () => {
    setup();
    expect(screen.getByRole('group', { name: 'Script controls' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Hello');
    expect(screen.getByRole('slider', { name: 'Speed' })).toHaveValue('1');
    expect(screen.getByRole('slider', { name: 'Speed' })).toHaveAccessibleDescription(
      'How quickly the scene moves.',
    );
    expect(screen.getByRole('spinbutton', { name: 'Seed' })).toHaveValue(1);
    expect(screen.getByRole('radiogroup', { name: 'Style' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Shape' })).toHaveValue('circle');
    expect(screen.getByRole('switch')).toHaveAccessibleName('Pointer');
    expect(screen.queryByRole('button', { name: /^Reset/u })).not.toBeInTheDocument();
  });
  it('keeps spec order, a group legend over each run of one group', () => {
    const byKey = new Map(SCRIPT_PARAMS_FORM_SPEC.map((entry) => [entry.key, entry]));
    const order = ['speed', 'title', 'pointer', 'color'];
    const { container } = setup({ spec: order.flatMap((key) => byKey.get(key) ?? []) });
    const rows = [...container.querySelectorAll('[data-param]')];
    expect(rows.map((row) => row.getAttribute('data-param'))).toEqual(order);
    const legends = [...container.querySelectorAll('legend')].map((legend) => legend.textContent);
    expect(legends).toEqual(['Motion', 'Look', 'Interaction', 'Look']);
  });
  it('shows an empty message without controls', () => {
    setup({ spec: [] });
    expect(screen.getByText('This script has no controls.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('uses Arabic labels, help, groups and explicit RTL', () => {
    const { container } = setup({ locale: 'ar-PAL', dir: 'rtl' });
    expect(screen.getByRole('group', { name: 'إعدادات السكربت' })).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('textbox', { name: 'العنوان' })).toHaveValue('Hello');
    expect(screen.getByRole('slider', { name: 'السرعة' })).toHaveAccessibleDescription(
      'سرعة حركة المشهد.',
    );
    expect(container.querySelector('.bldr-spf')).toHaveAttribute('lang', 'ar');
  });
  it('previews text and commits once on Enter, not again on blur', async () => {
    const { onChange } = setup();
    const field = screen.getByRole('textbox', { name: 'Title' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Welcome');
    expect(onChange).toHaveBeenLastCalledWith({ title: 'Welcome' }, { commit: false });
    expect(onChange.mock.calls.filter(([, change]) => change.commit)).toHaveLength(0);
    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    expect(onChange.mock.calls.filter(([, change]) => change.commit)).toEqual([
      [{ title: 'Welcome' }, { commit: true }],
    ]);
  });
  it('commits text on blur and unchanged drafts create no commit', () => {
    const { onChange } = setup();
    const field = screen.getByRole('textbox', { name: 'Title' });
    fireEvent.change(field, { target: { value: 'Welcome' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenLastCalledWith({ title: 'Welcome' }, { commit: true });
    onChange.mockClear();
    fireEvent.change(field, { target: { value: 'Hello' } });
    fireEvent.blur(field);
    expect(onChange.mock.calls.filter(([, change]) => change.commit)).toHaveLength(0);
  });
  it('previews a slider gesture and commits once on release, with clamped values', () => {
    const { onChange } = setup();
    const slider = screen.getByRole('slider', { name: 'Speed' });
    fireEvent.input(slider, { target: { value: '2' } });
    fireEvent.input(slider, { target: { value: '3' } });
    expect(onChange).toHaveBeenLastCalledWith({ speed: 3 }, { commit: false });
    fireEvent.pointerUp(slider);
    fireEvent.blur(slider);
    expect(onChange.mock.calls.filter(([, change]) => change.commit)).toEqual([
      [{ speed: 3 }, { commit: true }],
    ]);
  });
  it('commits a keyboard slider step once and resets stored overrides', async () => {
    const { onChange, props, rerender } = setup();
    const slider = screen.getByRole('slider', { name: 'Speed' });
    fireEvent.input(slider, { target: { value: '2' } });
    fireEvent.keyUp(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith({ speed: 2 }, { commit: true });
    rerender(<ScriptParamsForm {...props} values={{ speed: 2, title: 'Welcome' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reset Speed' }));
    expect(onChange).toHaveBeenLastCalledWith({ title: 'Welcome' }, { commit: true });
  });
  it('commits toggle/radio/select changes without preview calls', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenLastCalledWith({ pointer: true }, { commit: true });
    await userEvent.click(screen.getByRole('radio', { name: 'Bold' }));
    expect(onChange).toHaveBeenLastCalledWith({ style: 'bold' }, { commit: true });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Shape' }), 'star');
    expect(onChange).toHaveBeenLastCalledWith({ shape: 'star' }, { commit: true });
    expect(onChange.mock.calls.every(([, change]) => change.commit)).toBe(true);
  });
  it('reports invalid hex without emitting it, then stores a valid normalized override', async () => {
    const { onChange } = setup();
    const field = screen.getByRole('textbox', { name: 'Accent hex' });
    fireEvent.change(field, { target: { value: 'oops' } });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Use a #hex');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: '#ABCDEF' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await userEvent.tab();
    expect(onChange.mock.calls.filter(([, change]) => change.commit)).toEqual([
      [{ color: '#abcdef' }, { commit: true }],
    ]);
  });
  it('selects assets and sound references and preserves unknown stored sounds', async () => {
    const { onChange } = setup({
      assets: [{ id: 'photo', url: 'https://example.test/photo.jpg', label: 'Site photo' }],
      soundOptions: [{ value: 'lib:chime', label: { en: 'Chime', ar: 'رنين' } }],
      values: { sound: 'lib:legacy' },
    });
    expect(screen.getByRole('combobox', { name: 'Sound' })).toHaveValue('lib:legacy');
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: "Photo from the site's images" }),
      'photo',
    );
    expect(onChange).toHaveBeenLastCalledWith(
      { image: 'photo', sound: 'lib:legacy' },
      { commit: true },
    );
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sound' }), 'lib:chime');
    expect(onChange).toHaveBeenLastCalledWith({ sound: 'lib:chime' }, { commit: true });
  });
  it('picker selection commits once; cancellation leaves values untouched', async () => {
    const onPickImage = vi.fn().mockResolvedValueOnce('photo').mockResolvedValueOnce(undefined);
    const { onChange } = setup({ onPickImage });
    await userEvent.click(screen.getByRole('button', { name: 'Choose image…' }));
    expect(onPickImage).toHaveBeenLastCalledWith('image');
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ image: 'photo' }, { commit: true });
    await userEvent.click(screen.getByRole('button', { name: 'Choose image…' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it('disables all controls, including reset and host picker', async () => {
    const onPickImage = vi.fn();
    const { onChange, container } = setup({
      disabled: true,
      values: { title: 'Changed', palette: ['#abcdef'] },
      onPickImage,
    });
    for (const control of container.querySelectorAll('input, select, button'))
      expect(control).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Choose image…' }));
    await userEvent.click(screen.getByRole('switch'));
    expect(onPickImage).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps numeric input and stores only overrides, excluding unknown keys', () => {
    const { onChange } = setup({ values: { title: 'Welcome', obsolete: true } });
    const seed = screen.getByRole('spinbutton', { name: 'Seed' });
    fireEvent.change(seed, { target: { value: '999' } });
    fireEvent.keyDown(seed, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith({ seed: 99, title: 'Welcome' }, { commit: true });
  });

  it('commits native range change once even if pointerup and blur also arrive', () => {
    const { onChange } = setup();
    const slider = screen.getByRole('slider', { name: 'Speed' });
    fireEvent.input(slider, { target: { value: '2' } });
    fireEvent.change(slider, { target: { value: '2' } });
    fireEvent.pointerUp(slider);
    fireEvent.blur(slider);
    expect(onChange.mock.calls.filter(([, change]) => change.commit)).toEqual([
      [{ speed: 2 }, { commit: true }],
    ]);
  });

  it('previews native colour changes and commits on picker close', () => {
    const { onChange } = setup();
    const colour = screen.getByLabelText('Accent');
    fireEvent.input(colour, { target: { value: '#abcdef' } });
    expect(onChange).toHaveBeenLastCalledWith({ color: '#abcdef' }, { commit: false });
    fireEvent.change(colour, { target: { value: '#abcdef' } });
    fireEvent.blur(colour);
    expect(onChange.mock.calls.filter(([, change]) => change.commit)).toEqual([
      [{ color: '#abcdef' }, { commit: true }],
    ]);
  });

  it('edits custom palette swatches, enforces the six-swatch UI limit and returns to theme', async () => {
    const { onChange, props, rerender } = setup();
    await userEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    const palette = ['#e8a33d', '#2f6f73', '#f4ede1'];
    expect(onChange).toHaveBeenLastCalledWith({ palette }, { commit: true });
    rerender(<ScriptParamsForm {...props} values={{ palette }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add colour' }));
    expect(onChange).toHaveBeenLastCalledWith(
      { palette: [...palette, '#f4ede1'] },
      { commit: true },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove colour 2' }));
    expect(onChange).toHaveBeenLastCalledWith(
      { palette: ['#e8a33d', '#f4ede1'] },
      { commit: true },
    );
    rerender(
      <ScriptParamsForm
        {...props}
        values={{ palette: Array.from({ length: 6 }, () => '#abcdef') }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Add colour' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Theme' }));
    expect(onChange).toHaveBeenLastCalledWith({}, { commit: true });
  });

  it('rejects insecure image URLs and commits only a valid URL on blur', () => {
    const { onChange } = setup();
    const image = screen.getByRole('textbox', { name: 'Photo URL' });
    fireEvent.change(image, { target: { value: 'http://example.test/photo.jpg' } });
    expect(image).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Use an https:// address');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(image, { target: { value: 'https://example.test/photo.jpg' } });
    fireEvent.blur(image);
    expect(onChange).toHaveBeenLastCalledWith(
      { image: 'https://example.test/photo.jpg' },
      { commit: true },
    );
  });

  it('commits free sound text and reflects new committed host values', () => {
    const { onChange, props, rerender } = setup();
    const sound = screen.getByRole('textbox', { name: 'Sound' });
    fireEvent.change(sound, { target: { value: 'lib:chime' } });
    fireEvent.blur(sound);
    expect(onChange).toHaveBeenLastCalledWith({ sound: 'lib:chime' }, { commit: true });
    rerender(<ScriptParamsForm {...props} values={{ sound: 'lib:other', title: 'Host update' }} />);
    expect(sound).toHaveValue('lib:other');
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Host update');
  });
});
