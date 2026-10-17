/**
 * DirectionEditor (SPEC §4.11): the plan's look, editable in place. Every change leaves as
 * one `PlanOp` (`setMood`, `setToken`, `setFonts`); the component holds nothing the plan
 * does not.
 *
 * The mood is an inline field that reads as its line: Enter or leaving it applies, Esc
 * restores, an emptied field applies nothing. The five colours are SwatchPopovers judged by
 * the engine's contrast gate, in a group named "Colours"; the pair is a FontPairMenu.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { Locale, PlanDirectionView, PlanOp } from '../../model/view-types';
import { dentalDraft } from '../../testing/wp-13-decisions-fixtures';

import { DirectionEditor } from './DirectionEditor';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'agent',
    'components',
    'DirectionEditor',
    'DirectionEditor.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

function direction(locale: Locale = 'en'): PlanDirectionView {
  const held = dentalDraft(locale).direction;
  if (held === undefined) throw new Error('the dental plan has a direction');
  return held;
}

function mood(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Style' });
}

describe('DirectionEditor', () => {
  it('shows the mood as a field named "Style", five colours and the font pair', () => {
    render(<DirectionEditor locale="en" direction={direction()} onEdit={vi.fn()} />);
    expect(mood()).toHaveValue('Calm, clinical, teal');
    const colours = screen.getByRole('group', { name: 'Colours' });
    expect(
      within(colours)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      'Background: #F5FAFA. Change',
      'Surface: #FFFFFF. Change',
      'Text: #0E1116. Change',
      'Accent: #0F766E. Change',
      'Text on accent: #FFFFFF. Change',
    ]);
    expect(
      screen.getByRole('button', { name: 'Fonts: Reem Kufi / IBM Plex Sans Arabic' }),
    ).toBeInTheDocument();
  });

  it('applies a new mood on Enter, tidied', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn<(op: PlanOp) => void>();
    render(<DirectionEditor locale="en" direction={direction()} onEdit={onEdit} />);
    await user.clear(mood());
    await user.type(mood(), 'Warm,   bright,  coral{Enter}');
    expect(onEdit).toHaveBeenCalledWith({ kind: 'setMood', mood: 'Warm, bright, coral' });
  });

  it('applies a new mood when the field is left', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn<(op: PlanOp) => void>();
    render(<DirectionEditor locale="en" direction={direction()} onEdit={onEdit} />);
    await user.clear(mood());
    await user.type(mood(), 'Quiet and green');
    await user.tab();
    expect(onEdit).toHaveBeenCalledWith({ kind: 'setMood', mood: 'Quiet and green' });
  });

  it('restores the mood on Esc and applies nothing', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn<(op: PlanOp) => void>();
    render(<DirectionEditor locale="en" direction={direction()} onEdit={onEdit} />);
    await user.type(mood(), ' and loud');
    await user.keyboard('{Escape}');
    expect(mood()).toHaveValue('Calm, clinical, teal');
    await user.tab();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('applies nothing for an emptied or unchanged field', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn<(op: PlanOp) => void>();
    render(<DirectionEditor locale="en" direction={direction()} onEdit={onEdit} />);
    await user.clear(mood());
    await user.keyboard('{Enter}');
    await user.tab();
    await user.click(mood());
    await user.keyboard('{Enter}');
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('sends a readable colour as a setToken op', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn<(op: PlanOp) => void>();
    render(<DirectionEditor locale="en" direction={direction()} onEdit={onEdit} />);
    await user.click(screen.getByRole('button', { name: 'Accent: #0F766E. Change' }));
    const field = screen.getByRole('textbox', { name: 'Hex code' });
    await user.clear(field);
    await user.type(field, '#115e59{Enter}');
    expect(onEdit).toHaveBeenCalledWith({ kind: 'setToken', role: 'accent', hex: '#115e59' });
  });

  it('refuses an accent the text on it cannot be read on', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn<(op: PlanOp) => void>();
    render(<DirectionEditor locale="en" direction={direction()} onEdit={onEdit} />);
    await user.click(screen.getByRole('button', { name: 'Accent: #0F766E. Change' }));
    const field = screen.getByRole('textbox', { name: 'Hex code' });
    await user.clear(field);
    await user.type(field, '#99f6e4{Enter}');
    expect(screen.getByText(/^Not readable on the accent/u)).toBeInTheDocument();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('sends a chosen pair as a setFonts op', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn<(op: PlanOp) => void>();
    render(<DirectionEditor locale="en" direction={direction()} onEdit={onEdit} />);
    await user.click(
      screen.getByRole('button', { name: 'Fonts: Reem Kufi / IBM Plex Sans Arabic' }),
    );
    await user.click(screen.getByRole('menuitemradio', { name: /^Changa\s*Cairo$/u }));
    expect(onEdit).toHaveBeenCalledWith({ kind: 'setFonts', pairId: 'changa--cairo' });
  });

  it('reads an Arabic mood in its own direction', () => {
    render(<DirectionEditor locale="ar" direction={direction('ar')} onEdit={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'وصف الأسلوب' })).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('group', { name: 'الألوان' })).toBeInTheDocument();
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
