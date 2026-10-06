export interface StyleColorControlLabels {
  readonly tokens: string;
  readonly palette: string;
  readonly custom: string;
  readonly hex: string;
  readonly opacity: string;
  readonly mixed: string;
  readonly unset: string;
  /** "Contrast 2.9:1 — below 4.5:1". */
  readonly lowContrast: (ratio: string, target: string) => string;
  readonly fixContrast: string;
}

export const STYLE_COLOR_CONTROL_LABELS_EN: StyleColorControlLabels = {
  tokens: 'Theme colours',
  palette: 'Site palette',
  custom: 'Custom colour',
  hex: 'Hex colour',
  opacity: 'Opacity',
  mixed: 'Mixed',
  unset: 'Not set',
  lowContrast: (ratio, target) => `Contrast ${ratio}:1, below ${target}:1`,
  fixContrast: 'Use accessible colour',
};

export const STYLE_COLOR_CONTROL_LABELS_AR: StyleColorControlLabels = {
  tokens: 'ألوان السمة',
  palette: 'لوحة ألوان الموقع',
  custom: 'لون مخصّص',
  hex: 'اللون بصيغة hex',
  opacity: 'العتامة',
  mixed: 'مختلطة',
  unset: 'غير مضبوط',
  lowContrast: (ratio, target) => `التباين ${ratio}:1، أقل من ${target}:1`,
  fixContrast: 'استخدم لونًا مقروءًا',
};
