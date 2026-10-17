import { THEME_PICKER_LABELS_EN, type ThemePickerLabels } from './ThemePicker.labels';

export type ThemeName = 'light' | 'dark';

export interface ThemePickerProps {
  value: ThemeName;
  onChange: (next: ThemeName) => void;
  labels?: ThemePickerLabels | undefined;
}

/** Radio pair switching the preview theme — recolors the frame live (FR-008). */
export function ThemePicker({
  value,
  onChange,
  labels = THEME_PICKER_LABELS_EN,
}: ThemePickerProps) {
  return (
    <fieldset>
      <legend>{labels.legend}</legend>
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
          {labels.choices[name]}
        </label>
      ))}
    </fieldset>
  );
}
