import type { TokenName } from '@craftkit/builder-schema';

export interface DesignSystemPanelLabels {
  readonly region: string;
  readonly regenerate: string;
  readonly sections: string;
  readonly colours: string;
  readonly typography: string;
  readonly shape: string;
  readonly spacing: string;
  readonly colourTokens: string;
  readonly measurementTokens: string;
  readonly palette: string;
  readonly paletteEmpty: string;
  readonly addColour: string;
  readonly colourName: string;
  readonly colourValue: string;
  readonly remove: (name: string) => string;
  readonly valueOf: (name: string) => string;
  readonly fontRole: string;
  readonly roles: Readonly<Record<'sans' | 'serif' | 'mono', string>>;
  readonly typeScale: string;
  readonly radius: string;
  readonly shadows: string;
  readonly spacingScale: string;
  readonly widths: string;
  readonly preview: string;
  /** "radius sm" from "radiusSm"; override to translate token names. */
  readonly token: (token: TokenName) => string;
  readonly commitToken: (token: string) => string;
  readonly commitColour: (name: string) => string;
  readonly commitRemoveColour: (name: string) => string;
  readonly commitFont: (role: string, family: string) => string;
  readonly commitUpload: (family: string) => string;
}

/** Camel to words, so "surfaceInverse" reads as a person would say it. */
export function readableToken(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/gu, '$1 $2').toLowerCase();
}

export const DESIGN_SYSTEM_PANEL_LABELS_EN: DesignSystemPanelLabels = {
  region: 'Design system',
  regenerate: 'Regenerate',
  sections: 'Design system sections',
  colours: 'Colours',
  typography: 'Typography',
  shape: 'Radius & shadows',
  spacing: 'Spacing & widths',
  colourTokens: 'Colour tokens',
  measurementTokens: 'Measurement tokens',
  palette: 'Site palette',
  paletteEmpty: 'No palette colours yet. Add one, or generate shades below.',
  addColour: 'Add colour',
  colourName: 'New colour name',
  colourValue: 'New colour value',
  remove: (name) => `Remove ${name}`,
  valueOf: (name) => `${name} value`,
  fontRole: 'Font role',
  roles: { sans: 'Sans (body & headings)', serif: 'Serif', mono: 'Mono' },
  typeScale: 'Type scale',
  radius: 'Radius',
  shadows: 'Shadows',
  spacingScale: 'Spacing',
  widths: 'Widths',
  preview: 'Preview',
  token: readableToken,
  commitToken: (token) => `Design token · ${token}`,
  commitColour: (name) => `Palette colour · ${name}`,
  commitRemoveColour: (name) => `Remove palette colour · ${name}`,
  commitFont: (role, family) => `Font · ${role} · ${family}`,
  commitUpload: (family) => `Upload font · ${family}`,
};

export const DESIGN_SYSTEM_PANEL_LABELS_AR: DesignSystemPanelLabels = {
  region: 'نظام التصميم',
  regenerate: 'أعد التوليد',
  sections: 'أقسام نظام التصميم',
  colours: 'الألوان',
  typography: 'الخطوط',
  shape: 'الزوايا والظلال',
  spacing: 'المسافات والعروض',
  colourTokens: 'رموز الألوان',
  measurementTokens: 'رموز القياسات',
  palette: 'لوحة ألوان الموقع',
  paletteEmpty: 'لا توجد ألوان في اللوحة بعد. أضف لونًا أو ولّد درجات أدناه.',
  addColour: 'أضف لونًا',
  colourName: 'اسم اللون الجديد',
  colourValue: 'قيمة اللون الجديد',
  remove: (name) => `احذف ${name}`,
  valueOf: (name) => `قيمة ${name}`,
  fontRole: 'دور الخط',
  roles: { sans: 'بلا زوائد (النص والعناوين)', serif: 'بزوائد', mono: 'أحادي المسافة' },
  typeScale: 'سلّم الأحجام',
  radius: 'الزوايا',
  shadows: 'الظلال',
  spacingScale: 'المسافات',
  widths: 'العروض',
  preview: 'معاينة',
  token: readableToken,
  commitToken: (token) => `رمز التصميم · ${token}`,
  commitColour: (name) => `لون اللوحة · ${name}`,
  commitRemoveColour: (name) => `حذف لون اللوحة · ${name}`,
  commitFont: (role, family) => `الخط · ${role} · ${family}`,
  commitUpload: (family) => `رفع خط · ${family}`,
};
