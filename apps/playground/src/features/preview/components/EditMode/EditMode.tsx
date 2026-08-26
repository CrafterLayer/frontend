export interface EditModeProps {
  value: boolean;
  onChange: (next: boolean) => void;
}

/**
 * Toggle between the plain preview and the B2a read-only editor canvas.
 * Pure local UI state — the document and kernel are untouched by the switch.
 */
export function EditMode({ value, onChange }: EditModeProps) {
  return (
    <label>
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      Edit mode
    </label>
  );
}
