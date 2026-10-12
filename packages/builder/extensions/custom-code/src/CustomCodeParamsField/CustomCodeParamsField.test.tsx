import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import {
  customCodeJsMeta,
  customCodeJsParams,
  customJs,
  type FieldProps,
} from '@craftkit/builder-schema';

import { builderCustomCode } from '../index';
import { CustomCodeParamsField } from './index';
import { SCENE_PICTURES, SCENE_SPEC, sceneSiblings } from './CustomCodeParamsField.fixture';

function setup(overrides: Partial<FieldProps> = {}) {
  const onChange = vi.fn<(next: unknown) => void>();
  const props: FieldProps = {
    schema: customCodeJsParams(),
    value: undefined,
    path: ['props', 'jsParams'],
    onChange,
    siblings: sceneSiblings(),
    ...overrides,
  };
  const view = render(<CustomCodeParamsField {...props} />);
  return { ...view, onChange };
}

function paramOrder(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll('[data-param]')].map((row) =>
    row.getAttribute('data-param'),
  );
}

describe('the field types (registered by declaration)', () => {
  const types = builderCustomCode.contributes?.fieldTypes ?? [];
  const params = types.find((type) => type.id === 'craftkit.custom-code.script-params');
  const meta = types.find((type) => type.id === 'craftkit.custom-code.script-meta');

  it('matches jsParams by the customCodeJsParams() marker only, never by shape or name', () => {
    expect(params?.match(customCodeJsParams())).toBe(100);
    expect(params?.match(customCodeJsParams().unwrap().default({}) as z.ZodType)).toBe(100);
    // The same record shape without the marker, and the other Studio prop, stay unclaimed.
    expect(params?.match(z.record(z.string(), z.number()))).toBe(0);
    expect(params?.match(customCodeJsMeta())).toBe(0);
    expect(params?.match(customJs())).toBe(0);
  });

  it('asks for its siblings and hides only when there is nothing to tune', () => {
    expect(params?.siblings).toBe(true);
    const hidden = params?.hidden;
    expect(typeof hidden).toBe('function');
    if (typeof hidden !== 'function') return;
    expect(hidden({ value: undefined, siblings: [] })).toBe(true);
    expect(hidden({ value: { seed: 2 }, siblings: [] })).toBe(false);
    expect(hidden({ value: undefined, siblings: sceneSiblings() })).toBe(false);
  });

  it('hides jsMeta always, found by the customCodeJsMeta() marker', () => {
    expect(meta?.match(customCodeJsMeta())).toBe(100);
    expect(meta?.match(customCodeJsParams())).toBe(0);
    expect(meta?.match(z.object({ params: z.array(z.unknown()) }))).toBe(0);
    expect(meta?.hidden).toBe(true);
  });

  it('loads the scene settings lazily; the Studio data has no component to load', async () => {
    const loaded = await params?.load();
    expect(loaded?.default).toBe(CustomCodeParamsField);
    await expect(meta?.load()).rejects.toThrow(/written by the Studio/u);
  });
});

describe('CustomCodeParamsField', () => {
  it('renders one named control per spec entry, in spec order', () => {
    const { container } = setup();
    expect(paramOrder(container)).toEqual(SCENE_SPEC.map((entry) => entry.key));
    expect(screen.getByRole('slider', { name: 'Speed' })).toHaveAttribute('max', '3');
    expect(screen.getByRole('spinbutton', { name: 'Count' })).toHaveValue(40);
    expect(screen.getByLabelText('Tint')).toHaveAttribute('type', 'color');
    expect(screen.getByRole('textbox', { name: 'Tint hex' })).toHaveValue('#e8a33d');
    expect(screen.getByRole('radiogroup', { name: 'Colours' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Shape' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Follow the pointer' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Hello');
    expect(screen.getByRole('textbox', { name: 'Backdrop URL' })).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('combobox', { name: 'Chime' })).toHaveValue('');
    // The bank's sounds are the choices, labelled in the editor's language.
    expect(
      within(screen.getByRole('combobox', { name: 'Chime' })).getAllByRole('option').length,
    ).toBeGreaterThan(2);
  });

  it('commits a gesture once, merged into the stored record (keys outside the spec kept)', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: { legacy: 'kept', count: 12 } });
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Night sky');
    // Typing previews inside the form; nothing reaches the kernel yet.
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ legacy: 'kept', count: 12, title: 'Night sky' });
  });

  it('does not write a value equal to its default', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: { interactive: true } });
    await user.click(screen.getByRole('switch', { name: 'Follow the pointer' }));
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('Reset restores the default by removing the stored value', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: { speed: 2.5, legacy: 1 } });
    expect(screen.queryByRole('button', { name: 'Reset Count' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Reset Speed' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ legacy: 1 });
  });

  it('makes no write when a gesture ends where it started', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: { title: 'Kept' } });
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Other');
    await user.clear(title);
    await user.type(title, 'Kept');
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reads Arabic labels from the spec and lays the form out right to left', () => {
    const { container } = setup({ locale: 'ar' });
    const form = screen.getByRole('group', { name: 'إعدادات السكربت' });
    expect(form).toHaveAttribute('dir', 'rtl');
    expect(form).toHaveAttribute('lang', 'ar');
    expect(screen.getByRole('textbox', { name: 'العنوان' })).toHaveValue('Hello');
    expect(screen.getByRole('switch', { name: 'تتبع المؤشر' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'الشكل' })).toBeInTheDocument();
    // Addresses stay left to right inside the Arabic form.
    expect(screen.getByRole('textbox', { name: 'رابط الخلفية' })).toHaveAttribute('dir', 'ltr');
    expect(paramOrder(container)).toEqual(SCENE_SPEC.map((entry) => entry.key));
  });

  it('with no spec, gives each stored key a plain control by its value type', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ siblings: [], value: { count: 4, glow: true, label: 'Hi' } });
    expect(screen.getByRole('spinbutton', { name: 'Count' })).toHaveValue(4);
    expect(screen.getByRole('switch', { name: 'Glow' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('textbox', { name: 'Label' })).toHaveValue('Hi');
    // Nothing reads as changed: the stored value IS the default here.
    expect(screen.queryByRole('button', { name: /^Reset/u })).toBeNull();
    await user.click(screen.getByRole('switch', { name: 'Glow' }));
    expect(onChange).toHaveBeenCalledWith({ count: 4, glow: false, label: 'Hi' });
  });

  it('says so when there is nothing to tune (a host without the hidden rule)', () => {
    setup({ siblings: [], value: undefined });
    expect(screen.getByText('This script has no controls.')).toBeInTheDocument();
  });

  it("offers the host's picture library to an image param, by asset id", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ assetLibrary: SCENE_PICTURES });
    const library = await screen.findByRole('combobox', {
      name: "Backdrop from the site's images",
    });
    expect(within(library).getByRole('option', { name: 'Ember wash' })).toBeInTheDocument();
    await user.selectOptions(library, 'ember-wash');
    expect(onChange).toHaveBeenCalledWith({ backdrop: 'ember-wash' });
  });

  it('reads no library when the scene has no image param', () => {
    const list = vi.fn(() => SCENE_PICTURES.list());
    setup({
      assetLibrary: { list },
      siblings: sceneSiblings(SCENE_SPEC.filter((entry) => entry.type !== 'image')),
    });
    expect(list).not.toHaveBeenCalled();
  });

  it('disables every control, Reset included', () => {
    setup({ disabled: true, value: { speed: 2 } });
    expect(screen.getByRole('slider', { name: 'Speed' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Follow the pointer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset Speed' })).toBeDisabled();
  });
});
