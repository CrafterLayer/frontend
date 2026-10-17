import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';

import { useThemeScope } from '../../../fields/use-theme-scope';
import { VALUE_SOURCE_DOT_LABELS_EN, type ValueSourceDotLabels } from './ValueSourceDot.labels';
import type { ValueOrigin } from './value-origin';

import './ValueSourceDot.css';

export interface ValueSourceDotProps {
  /** Where the value the control shows comes from. */
  readonly origin: ValueOrigin;
  /** The person-facing property name ("Padding"), used in the accessible name. */
  readonly property: string;
  /** The class behind the value, exactly as written. */
  readonly className?: string | undefined;
  /** The family also has classes at `sm:`/`xl:`/`@md:`: the panel leaves them alone. */
  readonly customBreakpoint?: boolean | undefined;
  /**
   * Removes ONLY the class behind this value. Offered when the value is set
   * here: an inherited value has nothing here to remove.
   */
  readonly onReset?: (() => void) | undefined;
  readonly labels?: ValueSourceDotLabels | undefined;
}

/**
 * Value provenance (style-manager DESIGN.md §A.5).
 *
 * A dot beside every control, coloured by where its value comes from: set
 * here, inherited from a larger screen, inherited from the Default state, or
 * from a named style. Hovering shows the class behind the value; pressing
 * opens a card that names it and offers a Reset that removes that one class —
 * the answer to "why is this 24px and how do I undo just this?".
 */
export function ValueSourceDot({
  origin,
  property,
  className,
  customBreakpoint = false,
  onReset,
  labels = VALUE_SOURCE_DOT_LABELS_EN,
}: ValueSourceDotProps) {
  const [open, setOpen] = useState(false);
  const { attach, scope } = useThemeScope();
  const originText = labels.origin[origin];
  const canReset = origin === 'here' && onReset !== undefined;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          ref={attach}
          type="button"
          className="bldr-value-source-dot"
          data-origin={origin}
          data-custom-breakpoint={customBreakpoint ? '' : undefined}
          aria-label={labels.name(property, originText)}
          // The hover card: a pointer resting on the dot reads the class behind
          // the value without a click; pressing opens the card with Reset.
          title={className === undefined || className === '' ? originText : `${originText} · ${className}`}
        >
          <span className="bldr-value-source-dot__mark" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal container={scope}>
        <Popover.Content
          className="bldr-value-source-dot__card"
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
        >
          <p className="bldr-value-source-dot__origin" data-origin={origin}>
            {originText}
          </p>
          {className === undefined || className === '' ? null : (
            <p className="bldr-value-source-dot__class">
              <span className="bldr-value-source-dot__class-heading">{labels.classHeading}</span>
              <code>{className}</code>
            </p>
          )}
          {customBreakpoint ? (
            <p className="bldr-value-source-dot__note">{labels.customBreakpoint}</p>
          ) : null}
          {canReset ? (
            <button
              type="button"
              className="bldr-value-source-dot__reset"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
            >
              {labels.reset}
            </button>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
