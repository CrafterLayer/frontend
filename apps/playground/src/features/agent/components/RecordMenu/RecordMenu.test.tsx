/**
 * RecordMenu (SPEC §4.15): a record's `[⋯]`, a Radix DropdownMenu over an IconButton.
 *
 * What is ours to prove, beyond Radix's own menu: the items are exactly the record's list,
 * in its order, in the panel's words; the keyboard map of SPEC §6.7 works (↑ ↓ Home End,
 * Esc back to the trigger); focus lands where each action names (SPEC §6.3: "Menus closing
 * → their trigger", unless the action sends it elsewhere, as Reuse sends it to the
 * composer); and the menu opens inside the panel, in the panel's language and direction.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { RecordMenuItem } from '../../model/view-types';

import { RecordMenu } from './RecordMenu';

/* Radix measures its menu before positioning it; jsdom has no ResizeObserver. Geometry
   belongs to the Chromium stories. */
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'RecordMenu', 'RecordMenu.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

const BUILD_MENU: readonly RecordMenuItem[] = ['restore', 'reuse', 'copySummary', 'technical'];

function trigger(name = 'More options'): HTMLElement {
  return screen.getByRole('button', { name });
}

function menuItems(): HTMLElement[] {
  return within(screen.getByRole('menu')).getAllByRole('menuitem');
}

describe('RecordMenu', () => {
  it('draws nothing when the record offers nothing', () => {
    const { container } = render(<RecordMenu locale="en" items={[]} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is an icon button named in the panel’s words, announcing a menu', () => {
    render(<RecordMenu locale="ar" items={BUILD_MENU} onSelect={vi.fn()} />);
    const button = trigger('خيارات أخرى');
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('lists exactly the record’s items, in its order, in the locale', async () => {
    const user = userEvent.setup();
    render(<RecordMenu locale="en" items={['reuse', 'copyError']} onSelect={vi.fn()} />);
    await user.click(trigger());
    expect(menuItems().map((item) => item.textContent)).toEqual([
      'Reuse request',
      'Copy error details',
    ]);
  });

  it('moves through the items with the arrow keys, Home and End, and wraps', async () => {
    const user = userEvent.setup();
    render(<RecordMenu locale="en" items={BUILD_MENU} onSelect={vi.fn()} />);
    await user.tab();
    expect(trigger()).toHaveFocus();

    await user.keyboard('{Enter}');
    const items = menuItems();
    expect(items).toHaveLength(4);
    await waitFor(() => {
      expect(items[0]).toHaveFocus();
    });

    await user.keyboard('{ArrowDown}');
    expect(items[1]).toHaveFocus();
    await user.keyboard('{End}');
    expect(items[3]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(items[0]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(items[3]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(items[0]).toHaveFocus();
  });

  it('opens on ArrowDown as well', async () => {
    const user = userEvent.setup();
    render(<RecordMenu locale="en" items={BUILD_MENU} onSelect={vi.fn()} />);
    // Found before it opens: an open modal menu hides the rest of the page, trigger included.
    const button = trigger();
    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on Escape and returns focus to its trigger', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<RecordMenu locale="en" items={BUILD_MENU} onSelect={onSelect} />);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    await waitFor(() => {
      expect(trigger()).toHaveFocus();
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('runs the chosen item, then returns focus to its trigger', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<RecordMenu locale="en" items={BUILD_MENU} onSelect={onSelect} />);
    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('copySummary');
    expect(screen.queryByRole('menu')).toBeNull();
    await waitFor(() => {
      expect(trigger()).toHaveFocus();
    });
  });

  it('runs an item chosen with the pointer', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<RecordMenu locale="en" items={BUILD_MENU} onSelect={onSelect} />);
    await user.click(trigger());
    await user.click(screen.getByRole('menuitem', { name: 'Reuse request' }));
    expect(onSelect).toHaveBeenCalledWith('reuse');
  });

  it('sends focus where the chosen action names, instead of the trigger', async () => {
    const user = userEvent.setup();
    const composer = createRef<HTMLTextAreaElement>();
    render(
      <>
        <textarea aria-label="Your request" ref={composer} />
        <RecordMenu
          locale="en"
          items={BUILD_MENU}
          onSelect={vi.fn()}
          focusAfterSelect={(item) => (item === 'reuse' ? composer.current : null)}
        />
      </>,
    );
    await user.click(trigger());
    await user.click(screen.getByRole('menuitem', { name: 'Reuse request' }));
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Your request' })).toHaveFocus();
    });

    // An action that names nothing still goes back to the trigger.
    await user.click(trigger());
    await user.click(screen.getByRole('menuitem', { name: 'Copy summary' }));
    await waitFor(() => {
      expect(trigger()).toHaveFocus();
    });
  });

  it('opens inside the panel, in the panel’s language and direction', async () => {
    const user = userEvent.setup();
    render(
      <div className="ck-agent" data-testid="panel" lang="ar" dir="rtl">
        <RecordMenu locale="ar" items={['reuse', 'copyAnswer']} onSelect={vi.fn()} />
      </div>,
    );
    await user.click(trigger('خيارات أخرى'));
    const menu = screen.getByRole('menu');
    expect(screen.getByTestId('panel')).toContainElement(menu);
    expect(menu).toHaveAttribute('dir', 'rtl');
    expect(menu).toHaveAttribute('lang', 'ar');
    expect(menuItems().map((item) => item.textContent)).toEqual([
      'إعادة استخدام الطلب',
      'نسخ الإجابة',
    ]);
  });

  it('hands its trigger to the caller, for a dialog that must return focus to it', () => {
    const triggerRef = createRef<HTMLButtonElement>();
    render(
      <RecordMenu locale="en" items={BUILD_MENU} onSelect={vi.fn()} triggerRef={triggerRef} />,
    );
    expect(triggerRef.current).toBe(trigger());
  });
});

describe('RecordMenu.css', () => {
  it('floats on the Sheet with the e2 treatment and the decision radius', () => {
    const menu = /\.ck-agent-menu\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(menu).toMatch(/background-color:\s*var\(--bldr-surface\)/);
    expect(menu).toMatch(/box-shadow:\s*var\(--bldr-shadow-floating\)/);
    expect(menu).toMatch(/border:[^;]*var\(--bldr-surface-border\)/);
    expect(menu).toMatch(/border-radius:\s*var\(--bldr-radius-lg\)/);
  });

  it('gives items the panel’s row height and highlights them with the Wash, never Indigo', () => {
    const item = /\.ck-agent-menu__item\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(item).toMatch(/min-block-size:\s*var\(--bldr-agent-row-height\)/);
    const highlighted =
      /\.ck-agent-menu__item\[data-highlighted\]\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(highlighted).toMatch(/background-color:\s*var\(--bldr-surface-hover\)/);
    expect(highlighted).not.toMatch(/--bldr-accent/);
  });

  it('uses logical properties only', () => {
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX/,
    );
  });
});
