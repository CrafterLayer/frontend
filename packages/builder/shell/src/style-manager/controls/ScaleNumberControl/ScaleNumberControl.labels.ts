export interface ScaleNumberControlLabels {
  readonly mixed: string;
  readonly unset: string;
  readonly placeholder: string;
  /** The unit menu's name: "Padding unit". */
  readonly unit: (property: string) => string;
}

export const SCALE_NUMBER_CONTROL_LABELS_EN: ScaleNumberControlLabels = {
  mixed: 'Mixed',
  unset: 'Not set',
  placeholder: '—',
  unit: (property) => `${property} unit`,
};

export const SCALE_NUMBER_CONTROL_LABELS_AR: ScaleNumberControlLabels = {
  mixed: 'مختلطة',
  unset: 'غير مضبوطة',
  placeholder: '—',
  unit: (property) => `وحدة ${property}`,
};
