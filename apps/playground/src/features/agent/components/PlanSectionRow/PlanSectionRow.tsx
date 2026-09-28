import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import { formatNumber, t } from '../../copy';
import { resolveDir } from '../../model/resolve-dir';
import type { Locale, PlanSectionView } from '../../model/view-types';
import { IconButton, usePortalScope } from '../IconButton';
import '../RecordMenu/RecordMenu.css';
import { RunGlyph } from '../RunGlyph';

import './PlanSectionRow.css';

/** The row's two controls: where a keyboard move started, and where focus returns. */
export type PlanRowControl = 'handle' | 'menu';

/** How the list is dragging this row (PlanSectionList owns the drag). */
export interface PlanRowDrag {
  /** Block-axis offset in px: the pointer's for the lifted row, ±one row for the others. */
  readonly offset: number;
  /** This is the row under the pointer. */
  readonly lifted: boolean;
}

export interface PlanSectionRowProps {
  readonly locale: Locale;
  readonly section: PlanSectionView;
  /** 1-based, in page order. */
  readonly position: number;
  /**
   * The handle, the inline rename and `[⋯]`. False draws the read-only row of the SPEC §7.6
   * E6 fallback: node, number and title.
   */
  readonly editable: boolean;
  /** Another section has the same name (PlanProblem `duplicateTitle`): marked, and said. */
  readonly duplicate?: boolean | undefined;
  /** Whether the plan would take a move one step up / down (Alt+↑ / Alt+↓, the menu). */
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  /** Whether the plan would take this row's removal. */
  readonly canRemove: boolean;
  /**
   * Why Remove is unavailable when the plan is at its floor (`plan.min`). Given, the item
   * stays reachable, `aria-disabled`, with this reason under it; otherwise an unavailable
   * Remove is disabled outright.
   */
  readonly removeReason?: string | undefined;
  readonly onRename: (title: string) => void;
  readonly onMove: (delta: -1 | 1, from: PlanRowControl) => void;
  readonly onRemove: (from: PlanRowControl) => void;
  /** The handle's pointerdown, for PlanSectionList's drag. */
  readonly onHandlePointerDown?: ((event: PointerEvent<HTMLButtonElement>) => void) | undefined;
  readonly drag?: PlanRowDrag | undefined;
  /** `view-transition-name` for the plan-to-build morph (SPEC §5 moment 4). */
  readonly transitionName?: string | undefined;
}

/**
 * The engine's limit on a section title (`validate-page-plan.ts`: `sections[].title`, 80
 * characters). A longer name would be refused by the model without a word.
 */
const TITLE_MAX_LENGTH = 80;

function tidy(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

/** Where a rename started, so Enter and Esc can put focus back there. */
type RenameOrigin = PlanRowControl | 'title';

/**
 * One section of an editable page plan (SPEC §4.11 PlanSectionRow, frame §3.7), 32px (44 on
 * a coarse pointer):
 *
 *   ○ 5  Doctors                    [⠿] [⋯]
 *
 * From the inline start: the node, a waiting ring on the dashed pencil spine; the number
 * (Figure, Slate); the title (Read, Ink); at 400px and up the section's purpose, inline in
 * Slate; and at the inline END the drag handle and `[⋯]`. The handle sits at the end, as
 * iOS places its reorder control, so the titles do not move when the plan inks into the
 * build (SPEC §5 moment 4).
 *
 * Rename: double-click the title, F2 anywhere in the row, or `[⋯]` → Rename. The title
 * becomes a 32px input whose text starts exactly where the title's did; Enter saves, Esc
 * restores, and focus returns to the control the rename started from. Leaving the field
 * saves it, as a layer rename does.
 *
 * Move: Alt+↑ / Alt+↓ from either control, or `[⋯]` → Move up / Move down (the drag
 * alternatives WCAG 2.5.7 requires). The row only asks; PlanSectionList keeps focus on the
 * same control of the moved row, and the controller announces the move.
 */
export function PlanSectionRow({
  locale,
  section,
  position,
  editable,
  duplicate = false,
  canMoveUp,
  canMoveDown,
  canRemove,
  removeReason,
  onRename,
  onMove,
  onRemove,
  onHandlePointerDown,
  drag,
  transitionName,
}: PlanSectionRowProps) {
  const uiDir = locale === 'ar' ? 'rtl' : 'ltr';
  const duplicateId = useId();
  const reasonId = useId();
  const { scope, capture } = usePortalScope();
  const [rename, setRename] = useState<{ readonly from: RenameOrigin } | null>(null);
  const [name, setName] = useState(section.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  /** Guards the blur a closing input may still fire after Enter or Esc settled it. */
  const renaming = useRef(false);
  /** Where focus goes once the rename settles; `null` when it settled by leaving the field. */
  const returnTo = useRef<PlanRowControl | null>(null);
  /** The menu item chosen, read when the menu hands focus back. */
  const chosen = useRef<'rename' | null>(null);

  // The input takes focus with its text selected; a settled rename returns focus.
  useLayoutEffect(() => {
    if (rename !== null) {
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }
    const target = returnTo.current;
    returnTo.current = null;
    if (target === 'menu') menuRef.current?.focus();
    else if (target === 'handle') handleRef.current?.focus();
  }, [rename]);

  const startRename = (from: RenameOrigin) => {
    if (!editable) return;
    renaming.current = true;
    setName(section.title);
    setRename({ from });
  };

  const finishRename = (save: boolean, restoreFocus: boolean) => {
    if (!renaming.current || rename === null) return;
    renaming.current = false;
    const title = tidy(name);
    if (save && title !== '' && title !== section.title) onRename(title);
    returnTo.current = restoreFocus ? (rename.from === 'menu' ? 'menu' : 'handle') : null;
    setRename(null);
  };

  const controlOf = (target: EventTarget): PlanRowControl =>
    target instanceof Element && target.closest('[data-control="menu"]') !== null
      ? 'menu'
      : 'handle';

  /*
    In the capture phase, before the controls' own handlers: `[⋯]`'s Radix trigger opens its
    menu on ArrowDown whatever the modifiers, so Alt+↓ must be spent before it gets there.
    Keys from the open menu (a portal, but still this row's React subtree) and from the
    rename field are theirs.
  */
  const onKeyDownCapture = (event: KeyboardEvent<HTMLLIElement>) => {
    if (!editable || rename !== null) return;
    const target = event.target;
    if (target instanceof HTMLInputElement) return;
    if (target instanceof Element && target.closest('[role="menu"]') !== null) return;
    if (event.key === 'F2') {
      event.preventDefault();
      event.stopPropagation();
      startRename(controlOf(target));
      return;
    }
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    // Spent even at the edge, where nothing moves: it must never reach the trigger.
    event.preventDefault();
    event.stopPropagation();
    const delta = event.key === 'ArrowUp' ? -1 : 1;
    if (delta === -1 ? canMoveUp : canMoveDown) onMove(delta, controlOf(target));
  };

  const style: CSSProperties = {
    ...(transitionName === undefined ? {} : { viewTransitionName: transitionName }),
    ...(drag === undefined || drag.offset === 0 ? {} : { translate: `0 ${String(drag.offset)}px` }),
  };

  const captureScope = (
    event: PointerEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
  ) => {
    capture(event.currentTarget);
  };

  const title = section.title;
  const purpose = section.purpose;

  return (
    <li
      className="ck-agent-plan-row"
      data-key={section.key}
      data-editable={editable ? '' : undefined}
      data-renaming={rename === null ? undefined : ''}
      data-lifted={drag?.lifted === true ? '' : undefined}
      data-duplicate={duplicate ? '' : undefined}
      style={style}
      onKeyDownCapture={onKeyDownCapture}
    >
      <RunGlyph state="waiting" className="ck-agent-plan-row__node" />
      <span className="ck-agent-plan-row__number" aria-hidden="true">
        {formatNumber(locale, position)}
      </span>
      {rename === null ? (
        <>
          <span
            className="ck-agent-plan-row__title"
            onDoubleClick={
              editable
                ? () => {
                    startRename('title');
                  }
                : undefined
            }
          >
            <bdi dir={resolveDir(title, uiDir)}>{title}</bdi>
          </span>
          {purpose === undefined ? null : (
            <span className="ck-agent-plan-row__purpose">
              <bdi dir={resolveDir(purpose, uiDir)}>{purpose}</bdi>
            </span>
          )}
        </>
      ) : (
        <input
          ref={inputRef}
          type="text"
          className="ck-agent-plan-row__rename"
          aria-label={t(locale, 'plan.row.rename.aria', { title })}
          autoComplete="off"
          maxLength={TITLE_MAX_LENGTH}
          value={name}
          dir={resolveDir(name, uiDir)}
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              finishRename(true, true);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              finishRename(false, true);
            }
          }}
          onBlur={() => {
            finishRename(true, false);
          }}
        />
      )}
      {duplicate ? (
        <span id={duplicateId} hidden>
          {t(locale, 'plan.duplicate')}
        </span>
      ) : null}
      {editable && rename === null ? (
        <span className="ck-agent-plan-row__actions">
          <IconButton
            ref={handleRef}
            icon="grip"
            label={t(locale, 'plan.row.reorder', { title })}
            hint={t(locale, 'plan.row.drag')}
            describedBy={duplicate ? duplicateId : undefined}
            tooltipSide="top"
            tooltipAlign="end"
            className="ck-agent-plan-row__handle"
            data-control="handle"
            onPointerDown={onHandlePointerDown}
          />
          <DropdownMenu.Root dir={uiDir}>
            <DropdownMenu.Trigger asChild>
              <IconButton
                ref={menuRef}
                icon="more"
                label={t(locale, 'plan.row.menu', { title })}
                tooltipSide="top"
                tooltipAlign="end"
                className="ck-agent-plan-row__more"
                data-control="menu"
                onPointerDown={captureScope}
                onKeyDown={captureScope}
              />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal container={scope.container ?? null}>
              <DropdownMenu.Content
                className="ck-agent-menu ck-agent-plan-row__menu"
                side="bottom"
                align="end"
                sideOffset={4}
                collisionPadding={8}
                loop
                lang={locale}
                onCloseAutoFocus={(event) => {
                  if (chosen.current !== 'rename') return;
                  // The rename field has focus; the trigger must not take it back.
                  chosen.current = null;
                  event.preventDefault();
                  inputRef.current?.focus();
                }}
              >
                <DropdownMenu.Item
                  className="ck-agent-menu__item"
                  onSelect={() => {
                    chosen.current = 'rename';
                    startRename('menu');
                  }}
                >
                  {t(locale, 'plan.row.rename')}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="ck-agent-menu__item"
                  disabled={!canMoveUp}
                  onSelect={() => {
                    onMove(-1, 'menu');
                  }}
                >
                  {t(locale, 'plan.row.moveUp')}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="ck-agent-menu__item"
                  disabled={!canMoveDown}
                  onSelect={() => {
                    onMove(1, 'menu');
                  }}
                >
                  {t(locale, 'plan.row.moveDown')}
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="ck-agent-plan-row__separator" />
                {canRemove || removeReason === undefined ? (
                  <DropdownMenu.Item
                    className="ck-agent-menu__item"
                    disabled={!canRemove}
                    onSelect={() => {
                      onRemove('menu');
                    }}
                  >
                    {t(locale, 'plan.row.remove')}
                  </DropdownMenu.Item>
                ) : (
                  /*
                    At the floor Remove stays reachable, so the reason is heard as well as
                    seen: `aria-disabled`, described by the reason, and choosing it keeps the
                    menu open and does nothing (a Radix `disabled` item is skipped).
                  */
                  <DropdownMenu.Item
                    className="ck-agent-menu__item ck-agent-plan-row__refused"
                    aria-disabled="true"
                    aria-describedby={reasonId}
                    data-refused=""
                    onSelect={(event) => {
                      event.preventDefault();
                    }}
                  >
                    <span>{t(locale, 'plan.row.remove')}</span>
                    <span id={reasonId} className="ck-agent-plan-row__reason">
                      {removeReason}
                    </span>
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </span>
      ) : null}
    </li>
  );
}
