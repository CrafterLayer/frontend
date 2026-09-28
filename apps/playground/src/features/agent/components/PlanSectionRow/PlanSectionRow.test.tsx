/**
 * PlanSectionRow (SPEC §4.11): one section of an editable plan.
 *
 * Rename in place three ways (double-click the title, F2, ⋯ → Rename): Enter saves, Esc
 * restores, and focus returns to the control the rename started from, asserted by name
 * (SPEC §6.3). Alt+↑ / Alt+↓ ask the list to move the row, even from `[⋯]`, whose menu would
 * otherwise open on ↓. The read-only row of the SPEC §7.6 E6 fallback has no controls.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { Locale, PlanSectionView } from '../../model/view-types';

import { PlanSectionRow, type PlanSectionRowProps } from './PlanSectionRow';

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
    'PlanSectionRow',
    'PlanSectionRow.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

const DOCTORS: PlanSectionView = {
  key: 'doctors',
  title: 'Doctors',
  purpose: 'The dentists and their specialties',
};

function Row(props: Partial<PlanSectionRowProps> & { readonly locale?: Locale }) {
  return (
    <ol>
      <PlanSectionRow
        locale="en"
        section={DOCTORS}
        position={5}
        editable
        canMoveUp
        canMoveDown
        canRemove
        onRename={vi.fn()}
        onMove={vi.fn()}
        onRemove={vi.fn()}
        {...props}
      />
    </ol>
  );
}

function handle(title = 'Doctors'): HTMLElement {
  return screen.getByRole('button', { name: `Reorder ${title}` });
}

function menu(title = 'Doctors'): HTMLElement {
  return screen.getByRole('button', { name: `Options for ${title}` });
}

describe('PlanSectionRow', () => {
  it('shows its node, number, title and purpose, then the handle and [⋯]', () => {
    render(<Row />);
    const row = screen.getByRole('listitem');
    expect(row).toHaveTextContent('5');
    expect(row).toHaveTextContent('Doctors');
    expect(row).toHaveTextContent('The dentists and their specialties');
    expect(handle()).toHaveAccessibleDescription('Drag to reorder, or Alt with the arrow keys');
    expect(menu()).toHaveAttribute('aria-haspopup', 'menu');
  });

  describe('rename', () => {
    it('opens on double-click with the name selected; Enter saves; focus returns to the handle', async () => {
      const user = userEvent.setup();
      const onRename = vi.fn<(title: string) => void>();
      render(<Row onRename={onRename} />);
      await user.dblClick(screen.getByText('Doctors'));
      const field = screen.getByRole('textbox', { name: 'Rename Doctors' });
      expect(field).toHaveFocus();
      expect((field as HTMLInputElement).selectionStart).toBe(0);
      expect((field as HTMLInputElement).selectionEnd).toBe('Doctors'.length);

      await user.keyboard('Our   dentists{Enter}');
      expect(onRename).toHaveBeenCalledWith('Our dentists');
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(handle()).toHaveFocus();
    });

    it('restores the name on Esc, saves nothing, and returns focus to the handle', async () => {
      const user = userEvent.setup();
      const onRename = vi.fn<(title: string) => void>();
      const onParentKey = vi.fn();
      render(
        <div onKeyDown={onParentKey}>
          <Row onRename={onRename} />
        </div>,
      );
      handle().focus();
      await user.keyboard('{F2}');
      await user.keyboard('Something else{Escape}');
      expect(onRename).not.toHaveBeenCalled();
      expect(screen.getByRole('listitem')).toHaveTextContent('Doctors');
      expect(handle()).toHaveFocus();
      expect(
        onParentKey.mock.calls.some(([event]) => (event as KeyboardEvent).key === 'Escape'),
      ).toBe(false);
    });

    it('saves nothing for an empty or unchanged name', async () => {
      const user = userEvent.setup();
      const onRename = vi.fn<(title: string) => void>();
      render(<Row onRename={onRename} />);
      handle().focus();
      await user.keyboard('{F2}');
      await user.clear(screen.getByRole('textbox'));
      await user.keyboard('{Enter}');
      handle().focus();
      await user.keyboard('{F2}{Enter}');
      expect(onRename).not.toHaveBeenCalled();
    });

    it('opens from ⋯ → Rename, and returns focus to [⋯] after Enter', async () => {
      const user = userEvent.setup();
      const onRename = vi.fn<(title: string) => void>();
      render(<Row onRename={onRename} />);
      await user.click(menu());
      await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
      const field = screen.getByRole('textbox', { name: 'Rename Doctors' });
      expect(field).toHaveFocus();
      await user.keyboard('Dentists{Enter}');
      expect(onRename).toHaveBeenCalledWith('Dentists');
      expect(menu()).toHaveFocus();
    });

    it('saves when the field is left, as a layer rename does', async () => {
      const user = userEvent.setup();
      const onRename = vi.fn<(title: string) => void>();
      render(
        <>
          <Row onRename={onRename} />
          <button type="button">Elsewhere</button>
        </>,
      );
      await user.dblClick(screen.getByText('Doctors'));
      await user.keyboard('Dentists');
      await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
      expect(onRename).toHaveBeenCalledWith('Dentists');
    });
  });

  describe('move', () => {
    it('asks for a move with Alt+↑ / Alt+↓ from the handle', async () => {
      const user = userEvent.setup();
      const onMove = vi.fn<PlanSectionRowProps['onMove']>();
      render(<Row onMove={onMove} />);
      handle().focus();
      await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
      expect(onMove.mock.calls).toEqual([
        [-1, 'handle'],
        [1, 'handle'],
      ]);
    });

    it('spends Alt+↓ on [⋯] as a move: the menu does not open', async () => {
      const user = userEvent.setup();
      const onMove = vi.fn<PlanSectionRowProps['onMove']>();
      render(<Row onMove={onMove} />);
      menu().focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
      expect(onMove).toHaveBeenCalledWith(1, 'menu');
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('does not ask at an edge', async () => {
      const user = userEvent.setup();
      const onMove = vi.fn<PlanSectionRowProps['onMove']>();
      render(<Row onMove={onMove} canMoveUp={false} />);
      handle().focus();
      await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
      expect(onMove).not.toHaveBeenCalled();
    });

    it('asks from the menu', async () => {
      const user = userEvent.setup();
      const onMove = vi.fn<PlanSectionRowProps['onMove']>();
      render(<Row onMove={onMove} />);
      await user.click(menu());
      await user.click(screen.getByRole('menuitem', { name: 'Move down' }));
      expect(onMove).toHaveBeenCalledWith(1, 'menu');
    });
  });

  it('removes from the menu when allowed', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn<PlanSectionRowProps['onRemove']>();
    render(<Row onRemove={onRemove} />);
    await user.click(menu());
    await user.click(screen.getByRole('menuitem', { name: 'Remove section' }));
    expect(onRemove).toHaveBeenCalledWith('menu');
  });

  it('marks a name another section shares, in words on its handle', () => {
    render(<Row duplicate />);
    expect(handle()).toHaveAccessibleDescription(
      'Drag to reorder, or Alt with the arrow keys Each section needs its own name',
    );
    expect(screen.getByRole('listitem')).toHaveAttribute('data-duplicate');
  });

  it('read-only: node, number and title, with no controls and no rename', async () => {
    const user = userEvent.setup();
    render(<Row editable={false} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    await user.dblClick(screen.getByText('Doctors'));
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('keeps an Arabic title in its own direction inside an English panel', () => {
    render(<Row section={{ key: 'faq', title: 'الأسئلة الشائعة' }} />);
    expect(screen.getByText('الأسئلة الشائعة')).toHaveAttribute('dir', 'rtl');
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
