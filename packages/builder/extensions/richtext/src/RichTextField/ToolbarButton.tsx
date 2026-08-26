export interface ToolbarButtonProps {
  label: string;
  /** Toggle state; omit entirely for ACTIONS (no aria-pressed on a non-toggle). */
  pressed?: boolean | undefined;
  disabled?: boolean | undefined;
  onActivate: () => void;
}

/**
 * One formatting control. Mouse activation must NOT move focus (the editor
 * keeps its selection and its caret), so the press is cancelled at pointer-down
 * and the command runs on click; keyboard activation therefore leaves focus on
 * the button, where the `aria-pressed` change is actually announced.
 */
export function ToolbarButton({ label, pressed, disabled, onActivate }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className="bldr-richtext-field__tool"
      disabled={disabled}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onActivate}
    >
      {label}
    </button>
  );
}
