import type { ReactNode } from 'react';

export interface ToolbarButtonProps {
  label: string;
  /** Decorative glyph; omitted callers retain the previous visible-label rendering. */
  icon?: ReactNode | undefined;
  /** Toggle state; omit entirely for ACTIONS (no aria-pressed on a non-toggle). */
  pressed?: boolean | undefined;
  disabled?: boolean | undefined;
  onActivate: () => void;
  onHoverChange?: ((label: string, anchor: HTMLButtonElement | null) => void) | undefined;
  onFocusChange?: ((label: string, anchor: HTMLButtonElement | null) => void) | undefined;
}

/**
 * One formatting control. Mouse activation must NOT move focus (the editor
 * keeps its selection and its caret), so the press is cancelled at pointer-down
 * and the command runs on click; keyboard activation therefore leaves focus on
 * the button, where the `aria-pressed` change is actually announced.
 */
export function ToolbarButton({
  label,
  icon,
  pressed,
  disabled,
  onActivate,
  onHoverChange,
  onFocusChange,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className="bldr-richtext-field__tool"
      aria-label={label}
      disabled={disabled}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      onMouseEnter={(event) => {
        onHoverChange?.(label, event.currentTarget);
      }}
      onMouseLeave={() => {
        onHoverChange?.(label, null);
      }}
      onFocus={(event) => {
        onFocusChange?.(label, event.currentTarget);
      }}
      onBlur={() => {
        onFocusChange?.(label, null);
      }}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onActivate}
    >
      {icon ?? label}
    </button>
  );
}
