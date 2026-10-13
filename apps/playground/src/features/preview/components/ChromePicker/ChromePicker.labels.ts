import type { ChromeChoice } from './chrome-theme';

/** The picker's words; English by default, the host passes its editor's language. */
export interface ChromePickerLabels {
  readonly legend: string;
  readonly choices: Readonly<Record<ChromeChoice, string>>;
  /** Each option's spoken name: it names its subject ("Editor dark"); see ChromePicker. */
  readonly optionName: (choice: string) => string;
}

export const CHROME_PICKER_LABELS_EN: ChromePickerLabels = {
  legend: 'Editor',
  choices: { system: 'system', light: 'light', dark: 'dark' },
  optionName: (choice) => `Editor ${choice}`,
};
