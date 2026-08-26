export type ThemeName = 'light' | 'dark';

export interface ThemePickerProps {
  value: ThemeName;
  onChange: (next: ThemeName) => void;
}

/** Radio pair switching the preview theme — recolors the frame live (FR-008). */
export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <fieldset>
      <legend>Theme</legend>
      {(['light', 'dark'] as const).map((name) => (
        <label key={name}>
          <input
            type="radio"
            name="playground-theme"
            value={name}
            checked={value === name}
            onChange={() => {
              onChange(name);
            }}
          />
          {name}
        </label>
      ))}
    </fieldset>
  );
}
