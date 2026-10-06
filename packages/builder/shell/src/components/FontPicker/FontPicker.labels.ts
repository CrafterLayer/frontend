export interface FontPickerLabels {
  readonly title: string;
  readonly search: string;
  readonly arabicOnly: string;
  readonly category: string;
  readonly categories: Readonly<Record<'all' | 'sans' | 'serif' | 'display' | 'mono', string>>;
  readonly list: string;
  readonly current: string;
  readonly none: string;
  readonly sampleLatin: string;
  readonly sampleArabic: string;
  readonly uploaded: string;
  readonly upload: string;
  readonly uploadFile: string;
  readonly uploadFamily: string;
  readonly uploadWeight: string;
  readonly uploadVariable: string;
  readonly uploadNotice: string;
  readonly uploadRefusals: Readonly<Record<'not-woff2' | 'too-large' | 'empty' | 'bad-family', string>>;
  readonly uploadDone: (family: string) => string;
}

export const FONT_PICKER_LABELS_EN: FontPickerLabels = {
  title: 'Fonts',
  search: 'Search fonts',
  arabicOnly: 'Arabic fonts only',
  category: 'Style',
  categories: { all: 'All', sans: 'Sans', serif: 'Serif', display: 'Display', mono: 'Mono' },
  list: 'Font families',
  current: 'in use',
  none: 'No font matches.',
  sampleLatin: 'The quick brown fox jumps',
  sampleArabic: 'نص عربي جميل للتجربة',
  uploaded: 'Uploaded',
  upload: 'Upload a font',
  uploadFile: 'WOFF2 file (up to 600 kB)',
  uploadFamily: 'Family name',
  uploadWeight: 'Weight',
  uploadVariable: 'Variable (100–900)',
  uploadNotice: 'Upload only fonts you have the right to use on the web.',
  uploadRefusals: {
    'not-woff2': 'That file is not a WOFF2 font. Convert it to .woff2 first.',
    'too-large': 'That font is larger than 600 kB. Subset it or pick fewer weights.',
    empty: 'That file is empty.',
    'bad-family': 'A family name is letters, digits, spaces, "_" or "-", up to 64 characters.',
  },
  uploadDone: (family) => `Uploaded ${family}.`,
};

export const FONT_PICKER_LABELS_AR: FontPickerLabels = {
  title: 'الخطوط',
  search: 'ابحث عن خط',
  arabicOnly: 'الخطوط العربية فقط',
  category: 'النمط',
  categories: { all: 'الكل', sans: 'بلا زوائد', serif: 'بزوائد', display: 'عناوين', mono: 'أحادي المسافة' },
  list: 'عائلات الخطوط',
  current: 'مستخدم',
  none: 'لا يوجد خط مطابق.',
  sampleLatin: 'The quick brown fox jumps',
  sampleArabic: 'نص عربي جميل للتجربة',
  uploaded: 'مرفوع',
  upload: 'ارفع خطًا',
  uploadFile: 'ملف WOFF2 (حتى 600 ك.ب)',
  uploadFamily: 'اسم العائلة',
  uploadWeight: 'السماكة',
  uploadVariable: 'متغيّر (100–900)',
  uploadNotice: 'ارفع فقط خطوطًا يحق لك استخدامها على الويب.',
  uploadRefusals: {
    'not-woff2': 'هذا الملف ليس خط WOFF2. حوّله إلى ‎.woff2 أولًا.',
    'too-large': 'حجم الخط أكبر من 600 ك.ب. قلّل الحروف أو السماكات.',
    empty: 'الملف فارغ.',
    'bad-family': 'اسم العائلة أحرف لاتينية وأرقام ومسافات و"_" أو "-"، حتى 64 حرفًا.',
  },
  uploadDone: (family) => `رُفع ${family}.`,
};
