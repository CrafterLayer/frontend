import type { ThemeName } from './ThemePicker';

/** The picker's words; English by default, the host passes its editor's language. */
export interface ThemePickerLabels {
  readonly legend: string;
  readonly choices: Readonly<Record<ThemeName, string>>;
}

export const THEME_PICKER_LABELS_EN: ThemePickerLabels = {
  legend: 'Theme',
  choices: { light: 'light', dark: 'dark' },
};
