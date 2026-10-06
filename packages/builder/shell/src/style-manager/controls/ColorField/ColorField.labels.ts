export interface ColorFieldLabels {
  readonly mixed: string;
  readonly unset: string;
  /** The trigger's accessible name: "Background colour: Accent". */
  readonly trigger: (property: string, value: string) => string;
  /** The trigger's warning mark: "Low contrast". */
  readonly lowContrast: string;
}

export const COLOR_FIELD_LABELS_EN: ColorFieldLabels = {
  mixed: 'Mixed',
  unset: 'None',
  trigger: (property, value) => `${property}: ${value}`,
  lowContrast: 'Low contrast',
};

export const COLOR_FIELD_LABELS_AR: ColorFieldLabels = {
  mixed: 'مختلطة',
  unset: 'بلا لون',
  trigger: (property, value) => `${property}: ${value}`,
  lowContrast: 'تباين منخفض',
};
