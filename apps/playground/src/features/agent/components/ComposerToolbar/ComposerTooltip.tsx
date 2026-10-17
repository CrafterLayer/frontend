import * as Tooltip from '@radix-ui/react-tooltip';
import {
  use,
  useState,
  type ComponentPropsWithRef,
  type FocusEvent,
  type PointerEvent,
  type ReactElement,
} from 'react';

import { usePortalScope, type TooltipAlign, type TooltipSide } from '../IconButton';
// The tooltip's look is IconButton's: one stylesheet for every tooltip in the panel.
import '../IconButton/IconButton.css';
import { TOOLTIP_DELAY_MS, TOOLTIP_SKIP_DELAY_MS, TooltipScopeContext } from '../IconButton/tooltip-scope';

export interface ComposerTooltipProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  /** The tooltip's first line. */
  readonly label: string;
  /** A second line: why the control is unavailable, or what it will do. */
  readonly hint?: string | undefined;
  /**
   * Never open. The tooltip stays mounted, so the trigger inside it is the same element
   * whether or not there is anything to say: a ModeMenu trigger gains its tooltip when a
   * run starts without being remounted under the person's focus.
   */
  readonly silent?: boolean | undefined;
  /** The composer sits at the panel's foot, so its tooltips open upwards by default. */
  readonly side?: TooltipSide | undefined;
  readonly align?: TooltipAlign | undefined;
  /** The trigger: a button that accepts a ref and the handlers Radix composes onto it. */
  readonly children: ReactElement;
}

/**
 * The tooltip of the composer's labelled controls: Stop, Send, ✨ Improve and the mode
 * and model triggers. IconButton draws its own; these controls are not icon-only (Stop and
 * Queued carry words, the menu triggers carry the mode's name) or draw a glyph AgentIcon
 * does not have (the sparkle), so they wrap themselves in this instead.
 *
 * It is IconButton's tooltip, factored for any trigger: the same Radix Tooltip, the same
 * shared clock (`AgentTooltipProvider`, or its own provider outside the panel), and the
 * same portal scope, read from the trigger before the layer opens so the tooltip mounts
 * inside the panel in its theme, language and direction.
 *
 * Every prop it does not know is forwarded to the trigger, so a Radix menu trigger can
 * wrap it with `asChild`: the menu's `aria-expanded`, handlers and ref reach the button.
 */
export function ComposerTooltip({
  label,
  hint,
  silent = false,
  side = 'top',
  align = 'center',
  children,
  onPointerEnter,
  onFocus,
  ...triggerProps
}: ComposerTooltipProps) {
  const sharedProvider = use(TooltipScopeContext);
  const { scope, capture } = usePortalScope();
  const [open, setOpen] = useState(false);

  const tooltip = (
    <Tooltip.Root open={open && !silent} onOpenChange={setOpen}>
      <Tooltip.Trigger
        asChild
        {...triggerProps}
        // Read the portal scope before the tooltip opens (see `usePortalScope`).
        onPointerEnter={(event: PointerEvent<HTMLButtonElement>) => {
          capture(event.currentTarget);
          onPointerEnter?.(event);
        }}
        onFocus={(event: FocusEvent<HTMLButtonElement>) => {
          capture(event.currentTarget);
          onFocus?.(event);
        }}
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal container={scope.container ?? null}>
        <Tooltip.Content
          className="ck-agent-tooltip"
          side={side}
          align={align}
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
