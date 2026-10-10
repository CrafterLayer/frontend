/**
 * The form's own words, in both UI languages. Param labels and help come from
 * the spec (bilingual by contract); these are the words around them.
 */
export interface ScriptParamsFormStrings {
  formLabel: string;
  empty: string;
  theme: string;
  custom: string;
  addColour: string;
  removeColour: (index: number) => string;
  swatch: (index: number) => string;
  hex: (label: string) => string;
  reset: (label: string) => string;
  none: string;
  chooseImage: string;
  imageAsset: (label: string) => string;
  imageUrl: (label: string) => string;
  invalidImage: string;
  invalidHex: string;
  on: string;
  off: string;
}

export const SCRIPT_PARAMS_FORM_LABELS_EN: ScriptParamsFormStrings = {
  formLabel: 'Script controls',
  empty: 'This script has no controls.',
  theme: 'Theme',
  custom: 'Custom',
  addColour: 'Add colour',
  removeColour: (index) => `Remove colour ${String(index)}`,
  swatch: (index) => `Colour ${String(index)}`,
  hex: (label) => `${label} hex`,
  reset: (label) => `Reset ${label}`,
  none: 'None',
  chooseImage: 'Choose image…',
  imageAsset: (label) => `${label} from the site's images`,
  imageUrl: (label) => `${label} URL`,
  invalidImage: 'Use an https:// address, an image data URL or a site image.',
  invalidHex: 'Use a #hex colour, like #e8a33d.',
  on: 'On',
  off: 'Off',
};

export const SCRIPT_PARAMS_FORM_LABELS_AR: ScriptParamsFormStrings = {
  formLabel: 'إعدادات السكربت',
  empty: 'لا توجد إعدادات لهذا السكربت.',
  theme: 'ألوان القالب',
  custom: 'مخصص',
  addColour: 'إضافة لون',
  removeColour: (index) => `إزالة اللون ${String(index)}`,
  swatch: (index) => `اللون ${String(index)}`,
  hex: (label) => `${label} بصيغة hex`,
  reset: (label) => `إعادة ${label} للافتراضي`,
  none: 'بلا',
  chooseImage: 'اختيار صورة…',
  imageAsset: (label) => `${label} من صور الموقع`,
  imageUrl: (label) => `رابط ${label}`,
  invalidImage: 'استخدم رابط https:// أو صورة data أو صورة من الموقع.',
  invalidHex: 'استخدم لوناً بصيغة ‎#hex مثل ‎#e8a33d.',
  on: 'تشغيل',
  off: 'إيقاف',
};

export function scriptParamsFormStrings(locale: string | undefined): ScriptParamsFormStrings {
  return locale?.toLowerCase().startsWith('ar') === true
    ? SCRIPT_PARAMS_FORM_LABELS_AR
    : SCRIPT_PARAMS_FORM_LABELS_EN;
}
