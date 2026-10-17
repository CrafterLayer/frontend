import { ChromeButton } from '@craftkit/builder';
import type { ComponentPropsWithRef, MouseEvent, ReactNode } from 'react';

import './RecordButton.css';

/**
 * - `primary`: the one Indigo fill a record may carry (Try again, Finish the rest, Write the
 *   failed section again). SPEC §2.1 rule 3: Indigo is the primary action.
 * - `secondary`: a Sheet button with a Rule border (Undo build, Undo, Redo build).
 * - `text`: Indigo words, no box (Show on page, Remove empty sections, Page history). Its hover
 *   is the Wash under the same words: hover never turns anything Indigo.
 */
export type RecordButtonTone = 'primary' | 'secondary' | 'text';

type NativeProps = Omit<
  ComponentPropsWithRef<'button'>,
  'type' | 'children' | 'disabled' | 'aria-disabled' | 'aria-pressed'
>;

export interface RecordButtonProps extends NativeProps {
  readonly tone: RecordButtonTone;
  readonly children: ReactNode;
  /**
   * `aria-disabled`: still focusable, still described by what it points at (`aria-describedby`),
   * but a press does nothing. Never `disabled`, which drops it from the tab order exactly when
   * the person needs to hear why (a revived Undo, SPEC §4.8).
   */
  readonly unavailable?: boolean | undefined;
}

/**
 * A record's footer button (SPEC §4.6: at most one primary and one secondary, then `[⋯]`),
 * drawn over the shell's ChromeButton at the panel's 32px control height (44px on a coarse
 * pointer, SPEC §6.4) in Read type, weight 500.
 */
export function RecordButton({
  tone,
  unavailable = false,
  className,
  onClick,
  children,
  ...rest
}: RecordButtonProps) {
  const common = {
    ...rest,
    className: className === undefined ? 'ck-agent-button' : `ck-agent-button ${className}`,
    size: 'lg' as const,
    'data-ck-tone': tone,
    'aria-disabled': unavailable ? true : undefined,
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      if (unavailable) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    },
  };
  return tone === 'primary' ? (
    <ChromeButton {...common} variant="primary">
      {children}
    </ChromeButton>
  ) : (
    <ChromeButton {...common} variant="quiet">
      {children}
    </ChromeButton>
  );
}
