import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import * as Toolbar from '@radix-ui/react-toolbar';

import type { StyleSectorId } from '@craftkit/builder-schema';

import { useThemeScope } from '../../fields/use-theme-scope';
import type { ElementAction, ElementActionId } from '../../overlay/element-actions';
import type { ColorSwatch } from '../../style-manager/controls/StyleColorControl';
import { defaultSectorFor, type ElementBarModel, type QuickWriteResult } from './element-bar-model';
import {
  AI_ICON,
  ELEMENT_ACTION_ICONS,
  GRIP_ICON,
  MORE_ICON,
  QUICK_GROUP_ICONS,
  SETTINGS_ICON,
} from './ElementQuickBar.icons';
import { ELEMENT_QUICK_BAR_LABELS_EN, type ElementQuickBarLabels } from './ElementQuickBar.labels';
import { visibleGroupCount } from './measure-groups';
import { quickGroupsFor, type QuickGroup, type QuickGroupId } from './quick-bar-groups';
import { QuickGroupPanel, type NamedStyleChoice } from './QuickGroupPanel';
import '../../styles/visually-hidden.css';
import './ElementQuickBar.css';

export interface ElementQuickBarProps {
  /** Reads and writes for the focused element(s); see `createElementBarModel`. */
  readonly model: ElementBarModel;
  /** The second row, from `resolveElementActions`. Disabled entries keep their seat. */
  readonly actions: readonly ElementAction[];
  readonly onAction: (id: ElementActionId) => void;
  /** Opens the side panel at the sector matching the last group used (§A.6 "More"). */
  readonly onMore: (sector: StyleSectorId) => void;
  /** The sparkle: ask the agent about THIS element. Absent ⇒ no button. */
  readonly onEditWithAi?: (() => void) | undefined;
  /** Image/video "Replace": the host opens its asset manager. Absent ⇒ disabled. */
  readonly onReplaceMedia?: (() => void) | undefined;
  /** Escape with no popover open: focus goes back to the element on the canvas. */
  readonly onReturnFocus: () => void;
  /** Pointer-only grip that starts a tree move drag (keyboard: Move earlier/later). */
  readonly onMovePointerDown?: ((clientX: number, clientY: number) => void) | undefined;
  /** A refusal or outcome for the canvas's polite region. */
  readonly onAnnounce?: ((message: string) => void) | undefined;
  /** The EDITOR UI direction: roving arrows follow it. */
  readonly dir: 'ltr' | 'rtl';
  readonly colorTokens: readonly ColorSwatch[];
  readonly palette?: readonly ColorSwatch[] | undefined;
  readonly namedStyles?: readonly NamedStyleChoice[] | undefined;
  /** Each new value moves focus into the bar (Alt+F10 from the canvas). */
  readonly focusRequest?: number | undefined;
  readonly labels?: ElementQuickBarLabels | undefined;
}

/** Space the bar keeps for More, Edit with AI, the separator and its own padding. */
const RESERVED = 112;

/**
 * The element quick bar (style-manager DESIGN.md §A.6): the controls that
 * belong to the focused element, beside it on the canvas.
 *
 * - One WAI-ARIA toolbar (Radix): a single tab stop, roving arrows that follow
 *   the editor's direction, Home/End. Both rows are one toolbar, so the arrows
 *   walk from the last control into the actions.
 * - Each group opens a compact popover with the P6 controls; groups that do
 *   not fit fold into an overflow menu (measured, never guessed).
 * - The bar ends with More (the matching panel sector) and Edit with AI.
 * - Escape closes an open popover first, then returns focus to the element.
 *
 * CONTENT ONLY: the canvas portals this into a floating host anchored to the
 * element's rect, and the host owns position, flip and visibility.
 */
export function ElementQuickBar({
  model,
  actions,
  onAction,
  onMore,
  onEditWithAi,
  onReplaceMedia,
  onReturnFocus,
  onMovePointerDown,
  onAnnounce,
  dir,
  colorTokens,
  palette,
  namedStyles,
  focusRequest,
  labels = ELEMENT_QUICK_BAR_LABELS_EN,
}: ElementQuickBarProps) {
  const groups = quickGroupsFor(model.kind);
  const [openGroup, setOpenGroup] = useState<QuickGroupId | null>(null);
  const [lastSector, setLastSector] = useState<StyleSectorId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geometry, setGeometry] = useState({ unit: 0, available: 0 });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const { attach, scope } = useThemeScope();

  // A new element is a new bar: nothing stays open across a selection change.
  const subjectKey = `${model.kind}|${model.name}|${String(model.targetCount)}`;
  const [shownFor, setShownFor] = useState(subjectKey);
  if (shownFor !== subjectKey) {
    setShownFor(subjectKey);
    setOpenGroup(null);
    setError(null);
  }

  // Alt+F10: the canvas asks for focus by bumping a counter.
  useEffect(() => {
    if (focusRequest === undefined || focusRequest === 0) return;
    const first = rootRef.current?.querySelector<HTMLElement>('[data-bldr-quick-item]:not(:disabled)');
    first?.focus({ preventScroll: true });
  }, [focusRequest]);

  // Measure once the buttons exist, and again whenever the canvas resizes.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) return undefined;
    const measure = () => {
      const sample = root.querySelector<HTMLElement>('[data-group]');
      const layer = root.closest<HTMLElement>('.bldr-overlay');
      const measured = sample?.getBoundingClientRect().width ?? 0;
      const available = (layer?.clientWidth ?? 0) - 16;
      setGeometry((current) => {
        // Every group button is the same square, so one measurement serves
        // all of them — and it is kept when every group has folded away.
        const unit = measured > 0 ? measured : current.unit;
        return current.unit === unit && current.available === available
          ? current
          : { unit, available };
      });
    };
    measure();
    const layer = root.closest<HTMLElement>('.bldr-overlay');
    if (layer === null || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(layer);
    return () => {
      observer.disconnect();
    };
  }, []);

  const visibleCount = visibleGroupCount({
    widths: groups.map(() => geometry.unit),
    available: geometry.available,
    reserved: RESERVED,
    overflow: geometry.unit,
  });
  const visible = groups.slice(0, visibleCount);
  const folded = groups.slice(visibleCount);

  const report = (result: QuickWriteResult) => {
    if (result.ok) {
      setError(null);
      return;
    }
    setError(result.message);
    onAnnounce?.(result.message);
  };

  const activate = (group: QuickGroup) => {
    setLastSector(group.sector);
    if (group.action === true) {
      setOpenGroup(null);
      onReplaceMedia?.();
      return;
    }
    setError(null);
    setOpenGroup((current) => (current === group.id ? null : group.id));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    // The bar answers its own Escape: the canvas must not read it as "leave
    // the element". An open popover closes first (Radix handles that one);
    // with nothing open, focus returns to the element.
    event.preventDefault();
    event.stopPropagation();
    if (openGroup !== null) {
      setOpenGroup(null);
      buttonRefs.current.get(openGroup)?.focus({ preventScroll: true });
      return;
    }
    onReturnFocus();
  };

  const label = labels.toolbar.replace('{name}', model.name);
  const openLabel = openGroup === null ? '' : labels.groups[openGroup];

  return (
    <Toolbar.Root
      ref={(element) => {
        rootRef.current = element;
        attach(element);
      }}
      className="bldr-quick-bar"
      aria-label={label}
      dir={dir}
      loop
      onKeyDown={onKeyDown}
      onClick={(event) => {
        // The canvas selection path never sees a click on its own chrome.
        event.stopPropagation();
      }}
    >
      <Popover.Root
        open={openGroup !== null}
        onOpenChange={(open) => {
          if (!open) setOpenGroup(null);
        }}
      >
        <Popover.Anchor asChild>
          <div className="bldr-quick-bar__row" role="presentation">
            {onMovePointerDown === undefined ? null : (
              <span
                className="bldr-quick-bar__grip"
                data-bldr-drag-handle=""
                aria-hidden="true"
                title={labels.dragToMove}
                onPointerDown={(event) => {
                  event.preventDefault();
                  onMovePointerDown(event.clientX, event.clientY);
                }}
              >
                {GRIP_ICON}
              </span>
            )}
            {visible.map((group) => (
              <Toolbar.Button
                key={group.id}
                ref={(element) => {
                  if (element === null) buttonRefs.current.delete(group.id);
                  else buttonRefs.current.set(group.id, element);
                }}
                className="bldr-quick-bar__item"
                data-bldr-quick-item=""
                data-group={group.id}
                title={labels.groups[group.id]}
                disabled={group.action === true && onReplaceMedia === undefined}
                {...(group.action === true
                  ? {}
                  : { 'aria-haspopup': 'dialog' as const, 'aria-expanded': openGroup === group.id })}
                onClick={() => {
                  activate(group);
                }}
              >
                {QUICK_GROUP_ICONS[group.id]}
                <span className="bldr-visually-hidden">{labels.groups[group.id]}</span>
              </Toolbar.Button>
            ))}
            {folded.length === 0 ? null : (
              <DropdownMenu.Root dir={dir}>
                <DropdownMenu.Trigger asChild>
                  <Toolbar.Button
                    className="bldr-quick-bar__item"
                    data-bldr-quick-item=""
                    title={labels.overflow}
                  >
                    {MORE_ICON}
                    <span className="bldr-visually-hidden">{labels.overflow}</span>
                  </Toolbar.Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal container={scope}>
                  <DropdownMenu.Content className="bldr-quick-bar__menu" align="end" sideOffset={6}>
                    {folded.map((group) => (
                      <DropdownMenu.Item
                        key={group.id}
                        className="bldr-quick-bar__menu-item"
                        disabled={group.action === true && onReplaceMedia === undefined}
                        onSelect={() => {
                          activate(group);
                        }}
                      >
                        {QUICK_GROUP_ICONS[group.id]}
                        {labels.groups[group.id]}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
            <Toolbar.Separator className="bldr-quick-bar__separator" />
            <Toolbar.Button
              className="bldr-quick-bar__item"
              data-bldr-quick-item=""
              data-quick="more"
              title={labels.more}
              onClick={() => {
                onMore(lastSector ?? defaultSectorFor(model.kind));
              }}
            >
              {SETTINGS_ICON}
              <span className="bldr-visually-hidden">{labels.more}</span>
            </Toolbar.Button>
            {onEditWithAi === undefined ? null : (
              <Toolbar.Button
                className="bldr-quick-bar__item bldr-quick-bar__ai"
                data-bldr-quick-item=""
                data-quick="ai"
                title={labels.editWithAi}
                onClick={onEditWithAi}
              >
                {AI_ICON}
                <span className="bldr-visually-hidden">{labels.editWithAi}</span>
              </Toolbar.Button>
            )}
          </div>
        </Popover.Anchor>
        <div className="bldr-quick-bar__row bldr-quick-bar__actions" role="presentation">
          {actions.map((action) => {
            const name = labels.actions[action.id];
            const shown = action.id === 'hideOnBucket' && action.pressed === true ? labels.showOn : name;
            return (
              <Toolbar.Button
                key={action.id}
                className="bldr-quick-bar__item bldr-quick-bar__action"
                data-bldr-quick-item=""
                data-action={action.id}
                disabled={!action.enabled}
                {...(action.pressed === undefined ? {} : { 'aria-pressed': action.pressed })}
                title={
                  action.enabled
                    ? action.hint === undefined
                      ? shown
                      : `${shown} (${action.hint})`
                    : `${shown} — ${action.reason ?? ''}`
                }
                onClick={() => {
                  onAction(action.id);
                }}
              >
                {ELEMENT_ACTION_ICONS[action.id]}
                <span className="bldr-visually-hidden">{shown}</span>
              </Toolbar.Button>
            );
          })}
        </div>
        <Popover.Portal container={scope}>
          <Popover.Content
            className="bldr-quick-bar__panel"
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={8}
            dir={dir}
            aria-label={openLabel}
            onCloseAutoFocus={(event) => {
              // The anchor is the whole row, not a trigger: return to the
              // group button that opened the panel.
              event.preventDefault();
            }}
          >
            {openGroup === null ? null : (
              <>
                <p className="bldr-quick-bar__panel-title">{openLabel}</p>
                <QuickGroupPanel
                  key={`${openGroup}|${subjectKey}`}
                  group={openGroup}
                  model={model}
                  labels={labels}
                  dir={dir}
                  colorTokens={colorTokens}
                  palette={palette}
                  namedStyles={namedStyles}
                  onResult={report}
                />
                {error === null ? null : (
                  <p className="bldr-quick-bar__error" role="alert">
                    {error}
                  </p>
                )}
              </>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </Toolbar.Root>
  );
}
