import type { StyleState } from '@craftkit/builder-schema';

export interface BucketStateSwitcherLabels {
  readonly bucketGroup: string;
  readonly stateGroup: string;
  readonly desktop: string;
  readonly tablet: string;
  readonly mobile: string;
  /** A custom bucket chip: "≤ 600px". */
  readonly custom: (maxWidth: number) => string;
  /** The offer for a free-width device: "Edit at ≤ 700px". */
  readonly editAt: (maxWidth: number) => string;
  readonly states: Readonly<Record<StyleState, string>>;
}

export const BUCKET_STATE_SWITCHER_LABELS_EN: BucketStateSwitcherLabels = {
  bucketGroup: 'Screen size',
  stateGroup: 'State',
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
  custom: (maxWidth) => `≤ ${String(maxWidth)}px`,
  editAt: (maxWidth) => `Edit at ≤ ${String(maxWidth)}px`,
  states: {
    default: 'Default',
    hover: 'Hover',
    focus: 'Focus',
    active: 'Active',
    open: 'Open',
    'group-hover': 'Group hover',
  },
};

export const BUCKET_STATE_SWITCHER_LABELS_AR: BucketStateSwitcherLabels = {
  bucketGroup: 'حجم الشاشة',
  stateGroup: 'الحالة',
  desktop: 'سطح المكتب',
  tablet: 'لوحي',
  mobile: 'جوال',
  custom: (maxWidth) => `≤ ${String(maxWidth)}px`,
  editAt: (maxWidth) => `التحرير عند ≤ ${String(maxWidth)}px`,
  states: {
    default: 'افتراضي',
    hover: 'عند المرور',
    focus: 'عند التركيز',
    active: 'عند الضغط',
    open: 'مفتوح',
    'group-hover': 'مرور على المجموعة',
  },
};
