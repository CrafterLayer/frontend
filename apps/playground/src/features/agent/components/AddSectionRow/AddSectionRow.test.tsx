/**
 * AddSectionRow (SPEC §4.11): a text button that becomes a 32px field at the end of the
 * plan. Enter adds, Esc closes; at twelve sections it stays reachable and says why it
 * cannot add. Focus destinations are asserted by name (SPEC §6.3).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AddSectionRow } from './AddSectionRow';

const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'agent',
    'components',
    'AddSectionRow',
    'AddSectionRow.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

/** A plan with room for `room` more sections. */
function Plan({ room, onAdd }: { readonly room: number; readonly onAdd: (title: string) => void }) {
  const [left, setLeft] = useState(room);
  return (
    <AddSectionRow
      locale="en"
      canAdd={left > 0}
      onAdd={(title) => {
        onAdd(title);
        setLeft((count) => count - 1);
      }}
    />
  );
}

function button(): HTMLElement {
  return screen.getByRole('button', { name: 'Add section' });
}

function field(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Add section' });
}

describe('AddSectionRow', () => {
  it('opens into a field with focus, its placeholder the example', async () => {
    const user = userEvent.setup();
    render(<AddSectionRow locale="en" canAdd onAdd={vi.fn()} />);
    await user.click(button());
    expect(field()).toHaveFocus();
    expect(field()).toHaveAttribute('placeholder', 'Section name, e.g. Pricing');
  });

  it('adds the tidied name on Enter and stays open, empty, for the next one', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn<(title: string) => void>();
    render(<Plan room={3} onAdd={onAdd} />);
    await user.click(button());
    await user.type(field(), '  Opening   hours {Enter}');
    expect(onAdd).toHaveBeenCalledWith('Opening hours');
    expect(field()).toHaveValue('');
    expect(field()).toHaveFocus();
  });

  it('adds nothing for an empty name', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn<(title: string) => void>();
    render(<AddSectionRow locale="en" canAdd onAdd={onAdd} />);
    await user.click(button());
    await user.type(field(), '   {Enter}');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('closes on Esc without adding, and returns focus to the button', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn<(title: string) => void>();
    const onParentKey = vi.fn();
    render(
      <div onKeyDown={onParentKey}>
        <AddSectionRow locale="en" canAdd onAdd={onAdd} />
      </div>,
    );
    await user.click(button());
    await user.type(field(), 'Pricing');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(button()).toHaveFocus();
    expect(onAdd).not.toHaveBeenCalled();
    // Esc is spent here: the composer must not also act on it.
    expect(
      onParentKey.mock.calls.some(([event]) => (event as KeyboardEvent).key === 'Escape'),
    ).toBe(false);
  });

  it('adds what was typed when the field is left, as a rename saves', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn<(title: string) => void>();
    render(
      <>
        <AddSectionRow locale="en" canAdd onAdd={onAdd} />
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.click(button());
    await user.type(field(), 'Pricing');
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(onAdd).toHaveBeenCalledWith('Pricing');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('at twelve, stays in the tab order, refused, with the reason written under it', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn<(title: string) => void>();
    render(<AddSectionRow locale="en" canAdd={false} onAdd={onAdd} />);
    expect(button()).toHaveAttribute('aria-disabled', 'true');
    expect(button()).toHaveAccessibleDescription('A plan holds up to 12 sections');
    expect(screen.getByText('A plan holds up to 12 sections')).toBeVisible();
    expect(button()).not.toBeDisabled();
    await user.click(button());
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(onAdd).not.toHaveBeenCalled();
    expect(button()).toHaveFocus();
  });

  it('closes onto the button when the last free place is taken', async () => {
    const user = userEvent.setup();
    render(<Plan room={1} onAdd={vi.fn()} />);
    await user.click(button());
    await user.type(field(), 'Pricing{Enter}');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(button()).toHaveFocus();
    expect(button()).toHaveAccessibleDescription('A plan holds up to 12 sections');
  });

  it('stays closed when a place frees up again after the plan filled', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const { rerender } = render(<AddSectionRow locale="en" canAdd onAdd={onAdd} />);
    await user.click(button());
    expect(field()).toHaveFocus();
    rerender(<AddSectionRow locale="en" canAdd={false} onAdd={onAdd} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    rerender(<AddSectionRow locale="en" canAdd onAdd={onAdd} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(button()).toHaveFocus();
  });

  it('speaks Arabic in Arabic', async () => {
    const user = userEvent.setup();
    render(<AddSectionRow locale="ar" canAdd onAdd={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'إضافة قسم' }));
    expect(screen.getByRole('textbox', { name: 'إضافة قسم' })).toHaveAttribute(
      'placeholder',
      'اسم القسم، مثل «الأسعار»',
    );
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/text-align:\s*(?:left|right)/u);
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
