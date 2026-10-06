export interface PaletteRampEditorLabels {
  readonly title: string;
  readonly name: string;
  readonly color: string;
  readonly picker: string;
  readonly invalid: string;
  readonly shades: string;
  readonly brandStep: string;
  readonly contrast: string;
  readonly step: string;
  readonly white: string;
  readonly black: string;
  readonly add: string;
  /** "Adds 11 colours: brand-50 … brand-950". */
  readonly addHint: (first: string, last: string, count: number) => string;
  /** "3 existing colours will be replaced". */
  readonly replaces: (count: number) => string;
  readonly added: (count: number) => string;
  readonly fail: string;
  readonly commitLabel: (name: string) => string;
}

export const PALETTE_RAMP_EDITOR_LABELS_EN: PaletteRampEditorLabels = {
  title: 'Generate shades',
  name: 'Colour name',
  color: 'Brand colour',
  picker: 'Pick the brand colour',
  invalid: 'Not a colour. Try #0f766e, rgb(15 118 110) or oklch(52% 0.1 180).',
  shades: 'Shades',
  brandStep: 'your colour',
  contrast: 'Contrast',
  step: 'Shade',
  white: 'On white',
  black: 'On black',
  add: 'Add shades to palette',
  addHint: (first, last, count) => `Adds ${String(count)} colours: ${first} … ${last}`,
  replaces: (count) => `${String(count)} existing colour${count === 1 ? '' : 's'} will be replaced`,
  added: (count) => `Added ${String(count)} colours to the palette.`,
  fail: 'fails',
  commitLabel: (name) => `Palette shades · ${name}`,
};

export const PALETTE_RAMP_EDITOR_LABELS_AR: PaletteRampEditorLabels = {
  title: 'توليد درجات اللون',
  name: 'اسم اللون',
  color: 'لون العلامة',
  picker: 'اختر لون العلامة',
  invalid: 'ليست قيمة لون. جرّب ‎#0f766e أو rgb(15 118 110) أو oklch(52% 0.1 180).',
  shades: 'الدرجات',
  brandStep: 'لونك',
  contrast: 'التباين',
  step: 'الدرجة',
  white: 'على الأبيض',
  black: 'على الأسود',
  add: 'أضف الدرجات إلى اللوحة',
  addHint: (first, last, count) => `يضيف ${String(count)} لونًا: ${first} … ${last}`,
  replaces: (count) => `سيُستبدل ${String(count)} من الألوان الموجودة`,
  added: (count) => `أُضيف ${String(count)} لونًا إلى اللوحة.`,
  fail: 'غير مقروء',
  commitLabel: (name) => `درجات اللوحة · ${name}`,
};
