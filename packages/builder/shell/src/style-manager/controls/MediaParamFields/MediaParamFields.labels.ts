export interface MediaParamFieldsLabels {
  /** The group's accessible name. */
  readonly group: string;
  /** The choice that removes the param, so the runtime's own default applies. */
  readonly byDefault: string;
  /** Words for the closed values (`dots`, `true`, `slow`, `a` …); an unknown value shows as written. */
  readonly values: Readonly<Record<string, string>>;
  /** "Saved" hint under a text row after Enter or leaving the field. */
  readonly commitHint: string;
}

export const MEDIA_PARAM_FIELDS_LABELS_EN: MediaParamFieldsLabels = {
  group: 'Media settings',
  byDefault: 'Default',
  values: {
    dots: 'Dots',
    counter: 'Counter',
    none: 'None',
    true: 'On',
    false: 'Off',
    slow: 'Slow',
    normal: 'Normal',
    fast: 'Fast',
    a: 'First (monthly)',
    b: 'Second (yearly)',
  },
  commitHint: 'Press Enter to save',
};

export const MEDIA_PARAM_FIELDS_LABELS_AR: MediaParamFieldsLabels = {
  group: 'إعدادات الوسائط',
  byDefault: 'الافتراضي',
  values: {
    dots: 'نقاط',
    counter: 'عدّاد',
    none: 'بدون',
    true: 'تشغيل',
    false: 'إيقاف',
    slow: 'بطيئة',
    normal: 'عادية',
    fast: 'سريعة',
    a: 'الأول (شهري)',
    b: 'الثاني (سنوي)',
  },
  commitHint: 'اضغط Enter للحفظ',
};
