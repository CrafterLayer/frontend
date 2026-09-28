import { ChromeButton } from '@craftkit/builder';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  use,
  useId,
  useState,
  type ComponentPropsWithRef,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';

import { AgentIcon, type AgentIconName } from '../AgentIcon';
import './IconButton.css';
import { TOOLTIP_DELAY_MS, TOOLTIP_SKIP_DELAY_MS, TooltipScopeContext } from './tooltip-scope';
import { usePortalScope } from './use-portal-scope';

/** Which side of the button its tooltip opens on. Block sides only: the panel is narrow. */
export type TooltipSide = 'top' | 'bottom';

/**
 * Which of the button's edges the tooltip lines up with, in the reading direction. A
 * button at the panel's inline end (the header's New conversation, a record's `[⋯]`)
 * takes `end`, so its tooltip grows back into the panel instead of out over the canvas.
 */
export type TooltipAlign = 'start' | 'center' | 'end';

type NativeButtonProps = Omit<
  ComponentPropsWithRef<'button'>,
  | 'children'
  | 'type'
  | 'title'
  | 'disabled'
  | 'aria-label'
  | 'aria-pressed'
  | 'aria-disabled'
  | 'aria-describedby'
>;

export interface IconButtonProps extends NativeButtonProps {
  readonly icon: AgentIconName;
  /** The accessible name, and the tooltip's text: the two are always the same words. */
  readonly label: string;
  /**
   * A second tooltip line, also the button's accessible description: why it is
   * unavailable, or what it will do ("Available when the current work ends").
   */
  readonly hint?: string | undefined;
  /** Ids of elements elsewhere that also describe the button, read after the hint. */
  readonly describedBy?: string | undefined;
  /**
   * `aria-disabled`: still focusable and still explained by its tooltip, but a press does
   * nothing. The panel never uses `disabled`, which drops the button out of the tab order
   * and silences its tooltip, exactly when the person most needs to hear why.
   */
  readonly unavailable?: boolean | undefined;
  /** A toggle's state (`aria-pressed`). Leave it out for a plain action. */
  readonly pressed?: boolean | undefined;
  readonly tooltipSide?: TooltipSide | undefined;
  readonly tooltipAlign?: TooltipAlign | undefined;
}

/**
 * The panel's icon-only button (SPEC §4.21): the shell's ChromeButton, one AgentIcon and a
 * Radix Tooltip. 32px on a fine pointer, 44px on a coarse one; its accessible name is the
 * tooltip's text.
 *
 * It accepts everything a popup trigger sets (`ref`, `aria-expanded`, `aria-haspopup`,
 * handlers), so a Radix `DropdownMenu.Trigger asChild` or `Popover.Trigger asChild` can
 * wrap it directly.
 *
 * The glyph is static JSX (AgentIcon), so it is the same DOM node for the button's whole
 * life: a re-render between pointerdown and pointerup cannot take the press away
 * (the v1 first-click bug, `IconButton.test.tsx`).
 */
export function IconButton({
  icon,
  label,
  hint,
  describedBy,
  unavailable = false,
  pressed,
  tooltipSide = 'bottom',
  tooltipAlign = 'center',
  className,
  onClick,
  onPointerDown,
  onKeyDown,
  onPointerEnter,
  onFocus,
  ...rest
}: IconButtonProps) {
  const sharedProvider = use(TooltipScopeContext);
  const hintId = useId();
  const { scope, capture } = usePortalScope();
  const [tooltipOpen, setTooltipOpen] = useState(false);
  // The menu or popover this button opened is open: its tooltip would sit on top of it.
  const expanded = rest['aria-expanded'] === true || rest['aria-expanded'] === 'true';
  const description = [hint === undefined ? undefined : hintId, describedBy]
    .filter((id) => id !== undefined)
    .join(' ');

  const common = {
    ...rest,
    className:
      className === undefined ? 'ck-agent-icon-button' : `ck-agent-icon-button ${className}`,
    size: 'lg' as const,
    /*
      Always present, even when empty. Radix points an open trigger's description at its
      tooltip, and this tooltip only repeats the name: "Conversations, button,
      Conversations". An explicit value on the child wins over the Slot's.
    */
    'aria-describedby': description === '' ? undefined : description,
    'aria-disabled': unavailable ? true : undefined,
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      if (unavailable) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    },
    // A menu or popover trigger opens on pointerdown or a key, not on click.
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (!unavailable) onPointerDown?.(event);
    },
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (!unavailable) onKeyDown?.(event);
    },
    // Read the portal scope before the tooltip opens: hover opens it on the pointermove
    // after this enter, and focus opens it in the same event, after this handler.
    onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => {
      capture(event.currentTarget);
      onPointerEnter?.(event);
    },
    onFocus: (event: FocusEvent<HTMLButtonElement>) => {
      capture(event.currentTarget);
      onFocus?.(event);
    },
    children: (
      <>
        <AgentIcon name={icon} />
        {hint === undefined ? null : (
          <span id={hintId} hidden>
            {hint}
          </span>
        )}
      </>
    ),
  };

  const button =
    pressed === undefined ? (
      <ChromeButton {...common} variant="icon" aria-label={label} />
    ) : (
      <ChromeButton {...common} variant="toggle" aria-label={label} aria-pressed={pressed} />
    );

  const tooltip = (
    <Tooltip.Root open={tooltipOpen && !expanded} onOpenChange={setTooltipOpen}>
      <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
      <Tooltip.Portal container={scope.container ?? null}>
        <Tooltip.Content
          className="ck-agent-tooltip"
          side={tooltipSide}
          align={tooltipAlign}
          sideOffset={6}
          collisionPadding={8}
          lang={scope.lang}
          dir={scope.dir}
        >
          <span className="ck-agent-tooltip__label">{label}</span>
          {hint === undefined ? null : <span className="ck-agent-tooltip__hint">{hint}</span>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );

  return sharedProvider ? (
    tooltip
  ) : (
    <Tooltip.Provider delayDuration={TOOLTIP_DELAY_MS} skipDelayDuration={TOOLTIP_SKIP_DELAY_MS}>
      {tooltip}
    </Tooltip.Provider>
  );
}
