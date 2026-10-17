import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { COLOR_ROLES, isColorRole, lightTheme, paletteOf } from '@craftkit/builder-renderer';

import { ColorRoleField, type ColorRoleFieldProps } from './ColorRoleField';

/*
  Radix measures its popover before positioning it, and jsdom implements no
  ResizeObserver at all. A no-op is the honest stand-in: these tests assert what
  the popover CONTAINS and how it dismisses, never where it lands — geometry is
  a browser question and belongs in the Chromium stories.

  Object literal rather than a class of empty methods, which the workspace's
  lint refuses (`no-empty-function`) for the good reason that an empty method is
  usually an unfinished one.
*/
globalThis.ResizeObserver = class {
  observe = (): void => undefined;
  unobserve = (): void => undefined;
  disconnect = (): void => undefined;
};

afterEach(cleanup);

const palette = paletteOf(lightTheme);

function props(overrides: Partial<ColorRoleFieldProps> = {}): ColorRoleFieldProps {
  return {
    schema: z.string(),
    value: 'accent',
    path: ['props', 'background'],
    onChange: vi.fn(),
    palette,
    labelledBy: 'color-role-label',
    describedBy: 'color-role-description',
    ...overrides,
  };
}

describe('ColorRoleField', () => {
  it('shows every human role name and marks only the controlled current role', () => {
    // Mutation: render role ids as names, derive checked state locally, or paint the wrong swatch;
    // each breaks a distinct assertion in this named gate.
    render(<ColorRoleField {...props({ value: 'surfaceInverse' })} />);

    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-labelledby', 'color-role-label');
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(COLOR_ROLES.length);
    for (const entry of palette) {
      const radio = screen.getByRole('radio', { name: entry.name });
      expect(radio).toHaveAttribute(
        'aria-checked',
        entry.role === 'surfaceInverse' ? 'true' : 'false',
      );
      expect(radio).toHaveTextContent(entry.name);
      const swatch = radio.querySelector<HTMLElement>(`[data-color-role-swatch="${entry.role}"]`);
      const expectedSwatch = document.createElement('span');
      expectedSwatch.style.backgroundColor = entry.value;
      expect(swatch?.style.backgroundColor).toBe(expectedSwatch.style.backgroundColor);
    }
  });

  it('commits exactly one role string and never the swatch colour literal', async () => {
    // Mutation: committing entry.value or calling onChange twice makes this named gate fail.
    const user = userEvent.setup();
    const onChange = vi.fn<(next: unknown) => void>();
    render(<ColorRoleField {...props({ onChange })} />);

    await user.click(screen.getByRole('radio', { name: 'Accent' }));
    expect(onChange).not.toHaveBeenCalled();

    const entry = palette.find((candidate) => candidate.role === 'surfaceInverse');
    if (entry === undefined) {
      throw new Error('The palette must contain the inverse-surface role.');
    }
    await user.click(screen.getByRole('radio', { name: entry.name }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('surfaceInverse');
    const committed = onChange.mock.calls[0]?.[0];
    expect(typeof committed === 'string' && isColorRole(committed)).toBe(true);
    expect(committed).not.toBe(entry.value);
  });

  it('keeps one tab stop and moves focus and selection with every arrow direction', async () => {
    // Mutation: remove roving tabIndex/an arrow mapping or call commitRole twice per arrow; this
    // named gate loses its focus path, one tab stop, or exact callback sequence.
    const user = userEvent.setup();
    let value: (typeof COLOR_ROLES)[number] = 'surface';
    const rerenderRef: { current?: ReturnType<typeof render>['rerender'] } = {};
    const onChange = vi.fn((next: unknown) => {
      if (typeof next !== 'string' || !isColorRole(next)) {
        return;
      }
      value = next;
      rerenderRef.current?.(
        <>
          <button type="button">Before</button>
          <ColorRoleField {...props({ value, onChange })} />
          <button type="button">After</button>
        </>,
      );
    });
    const view = render(
      <>
        <button type="button">Before</button>
        <ColorRoleField {...props({ value, onChange })} />
        <button type="button">After</button>
      </>,
    );
    rerenderRef.current = view.rerender;

    screen.getByRole('button', { name: 'Before' }).focus();
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Surface' })).toHaveFocus();
    expect(screen.getAllByRole('radio').filter((radio) => radio.tabIndex === 0)).toHaveLength(1);

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Inverse surface' })).toHaveFocus();
    expect(value).toBe('surfaceInverse');

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Accent' })).toHaveFocus();
    expect(value).toBe('accent');

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Inverse surface' })).toHaveFocus();
    expect(value).toBe('surfaceInverse');

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: 'Surface' })).toHaveFocus();
    expect(value).toBe('surface');
    expect(screen.getAllByRole('radio').filter((radio) => radio.tabIndex === 0)).toHaveLength(1);
    expect(onChange.mock.calls.map(([next]) => next)).toEqual([
      'surfaceInverse',
      'accent',
      'surfaceInverse',
      'surface',
    ]);

    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('keeps a rejected arrow target as the sole tab stop and exits the group both ways', async () => {
    // Mutation: remove the focus-owned roving role and derive tabIndex only from the checked value;
    // Shift+Tab then stops on Surface again instead of leaving the rejected group.
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <button type="button">Before</button>
        <ColorRoleField {...props({ value: 'surface', onChange })} />
        <button type="button">After</button>
      </>,
    );

    const surface = screen.getByRole('radio', { name: 'Surface' });
    surface.focus();
    await user.keyboard('{ArrowRight}');
    const rejected = screen.getByRole('radio', { name: 'Inverse surface' });
    expect(rejected).toHaveFocus();
    expect(rejected).toHaveAttribute('aria-checked', 'false');
    expect(screen.getAllByRole('radio').filter((radio) => radio.tabIndex === 0)).toEqual([
      rejected,
    ]);

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();

    surface.focus();
    await user.keyboard('{ArrowRight}');
    expect(rejected).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 'surfaceInverse');
    expect(onChange).toHaveBeenNthCalledWith(2, 'surfaceInverse');
  });

  it('keeps role selection available and omits the re-theme UI without onRetheme', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorRoleField {...props({ onChange })} />);

    expect(screen.queryByRole('button', { name: /Edit the .* colour/ })).not.toBeInTheDocument();
    expect(document.body.querySelector('.bldr-color-role-field__popover')).toBeNull();

    await user.click(screen.getByRole('radio', { name: 'Inverse surface' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('surfaceInverse');
  });

  it('opens the re-theme popover and returns focus to its trigger on Escape', async () => {
    const user = userEvent.setup();
    const onRetheme = vi.fn();
    render(<ColorRoleField {...props({ onRetheme })} />);

    const trigger = screen.getByRole('button', { name: 'Edit the Accent colour' });
    await user.click(trigger);

    expect(document.body.querySelector('.bldr-color-role-field__popover')).not.toBeNull();
    expect(screen.getByText('Re-points “Accent” everywhere it is used.')).toBeVisible();

    await user.keyboard('{Escape}');
    expect(document.body.querySelector('.bldr-color-role-field__popover')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('commits a role name without re-theming', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onRetheme = vi.fn();
    render(<ColorRoleField {...props({ onChange, onRetheme })} />);

    await user.click(screen.getByRole('radio', { name: 'Inverse surface' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('surfaceInverse');
    expect(onRetheme).not.toHaveBeenCalled();
  });

  it('re-themes the current role from a Sketch drag with a six-digit hex', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onRetheme = vi.fn();
    render(<ColorRoleField {...props({ value: 'surfaceInverse', onChange, onRetheme })} />);

    await user.click(screen.getByRole('button', { name: 'Edit the Inverse surface colour' }));
    const popover = document.body.querySelector<HTMLElement>('.bldr-color-role-field__popover');
    const saturation = popover?.querySelector<HTMLDivElement>('.w-color-saturation');
    if (saturation === null || saturation === undefined) {
      throw new Error('The Sketch saturation surface must render in the re-theme popover.');
    }

    vi.spyOn(saturation, 'getBoundingClientRect').mockReturnValue({
      bottom: 160,
      height: 150,
      left: 10,
      right: 210,
      top: 10,
      width: 200,
      x: 10,
      y: 10,
      toJSON: () => ({}),
    });
    fireEvent.mouseDown(saturation, { buttons: 1, clientX: 110, clientY: 85 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 170, clientY: 45 });
    fireEvent.mouseUp(window);

    expect(onRetheme).toHaveBeenLastCalledWith(
      'surfaceInverse',
      expect.stringMatching(/^#[\da-f]{6}$/i),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('paints the picker trigger from the active live palette role', () => {
    const active = palette.find((entry) => entry.role === 'accent');
    if (active === undefined) {
      throw new Error('The palette must contain the accent role.');
    }
    const updatedValue = '#123456';
    if (active.value === updatedValue) {
      throw new Error('The replacement palette value must differ from the active value.');
    }
    const updatedPalette = palette.map((entry) =>
      entry.role === active.role ? { ...entry, value: updatedValue } : entry,
    );
    const onRetheme = vi.fn();
    const { rerender } = render(
      <ColorRoleField {...props({ value: active.role, onRetheme, palette })} />,
    );

    const lightSwatch = screen
      .getByRole('button', { name: `Edit the ${active.name} colour` })
      .querySelector<HTMLElement>('.bldr-color-role-field__swatch');
    if (lightSwatch === null) {
      throw new Error('The picker trigger must paint an active-role swatch.');
    }
    const expectedLightSwatch = document.createElement('span');
    expectedLightSwatch.style.backgroundColor = active.value;
    const lightBackground = lightSwatch.style.backgroundColor;
    expect(lightBackground).toBe(expectedLightSwatch.style.backgroundColor);

    rerender(
      <ColorRoleField {...props({ value: active.role, onRetheme, palette: updatedPalette })} />,
    );

    const updatedSwatch = screen
      .getByRole('button', { name: `Edit the ${active.name} colour` })
      .querySelector<HTMLElement>('.bldr-color-role-field__swatch');
    const updatedEntry = updatedPalette.find((entry) => entry.role === active.role);
    if (updatedSwatch === null || updatedEntry === undefined) {
      throw new Error('The replacement palette must preserve the active role and trigger swatch.');
    }
    const expectedUpdatedSwatch = document.createElement('span');
    expectedUpdatedSwatch.style.backgroundColor = updatedEntry.value;
    expect(updatedSwatch.style.backgroundColor).toBe(expectedUpdatedSwatch.style.backgroundColor);
    expect(updatedSwatch.style.backgroundColor).not.toBe(lightBackground);
  });
});
