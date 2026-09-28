import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useRef, type KeyboardEvent, type PointerEvent, type Ref } from 'react';

import { MENU_ITEM_KEY, t } from '../../copy';
import type { Locale, RecordMenuItem } from '../../model/view-types';
import { IconButton, usePortalScope } from '../IconButton';

import './RecordMenu.css';

export interface RecordMenuProps {
  readonly locale: Locale;
  /**
   * What this record offers, in order (`BuildRecordView.menu` and its siblings). The
   * producer decides what applies; the menu renders exactly this list, and nothing at all
   * when it is empty.
   */
  readonly items: readonly RecordMenuItem[];
  readonly onSelect: (item: RecordMenuItem) => void;
  /**
   * Where focus goes after `item` runs (SPEC §6.3), when it is not the trigger: Reuse
   * request returns the composer's textarea. `null` or `undefined` means the trigger.
   *
   * A named destination rather than a `focus()` call inside `onSelect`: the open menu traps
   * focus, so a focus moved during `onSelect` is pulled straight back into it.
   */
  readonly focusAfterSelect?:
    ((item: RecordMenuItem) => HTMLElement | null | undefined) | undefined;
  /**
   * The `[⋯]` button. A dialog opened from the menu (Restore page…) returns focus here when
   * it closes, since the menu item it was opened from no longer exists.
   */
  readonly triggerRef?: Ref<HTMLButtonElement> | undefined;
  /** Appended to the trigger's class. */
  readonly className?: string | undefined;
}

/**
 * A record's `[⋯]` menu (SPEC §4.15): Restore page to before this request, Reuse request,
 * the copy actions, View as code, Technical details.
 *
 * A Radix DropdownMenu, so the keyboard map is the platform's (SPEC §6.7): Enter, Space or
 * ↓ opens it on the first item; ↑ ↓ move and wrap; Home and End jump; typing a letter
 * finds an item; Esc closes it and focus returns to `[⋯]`. The menu follows the locale's
 * direction and opens inside the panel, so it keeps the panel's theme and Arabic type.
 */
export function RecordMenu({
  locale,
  items,
  onSelect,
  focusAfterSelect,
  triggerRef,
  className,
}: RecordMenuProps) {
  const { scope, capture } = usePortalScope();
  const chosen = useRef<RecordMenuItem | null>(null);

  if (items.length === 0) return null;

  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  // The menu opens on pointerdown or a key; read its portal scope first.
  const captureScope = (
    event: PointerEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
  ) => {
    capture(event.currentTarget);
  };

  return (
    <DropdownMenu.Root dir={dir}>
      <DropdownMenu.Trigger asChild>
        <IconButton
          ref={triggerRef}
          icon="more"
          label={t(locale, 'menu.label')}
          tooltipSide="top"
          tooltipAlign="end"
          className={className}
          onPointerDown={captureScope}
          onKeyDown={captureScope}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={scope.container ?? null}>
        <DropdownMenu.Content
          className="ck-agent-menu"
          side="bottom"
          align="end"
          sideOffset={4}
          collisionPadding={8}
          loop
          // `dir` comes from Root, which stamps it on the content; `lang` is ours to set.
          lang={locale}
          onCloseAutoFocus={(event) => {
            const item = chosen.current;
            chosen.current = null;
            if (item === null) return;
            const destination = focusAfterSelect?.(item);
            if (destination === null || destination === undefined) return;
            event.preventDefault();
            destination.focus();
          }}
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item}
              className="ck-agent-menu__item"
              onSelect={() => {
                chosen.current = item;
                onSelect(item);
              }}
            >
              {t(locale, MENU_ITEM_KEY[item])}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
