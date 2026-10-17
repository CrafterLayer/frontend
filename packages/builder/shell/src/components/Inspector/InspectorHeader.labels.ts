import { BACK_TO_REGION } from './constants';

/** The Inspector head's strings; the Inspector picks EN or AR by its `locale`. */
export interface InspectorHeaderLabels {
  readonly title: string;
  readonly clearSelection: string;
  readonly backToRegion: string;
  readonly selectedBlock: string;
  readonly within: (regionName: string) => string;
  readonly bucket: (bucket: string) => string;
  readonly editingOverrides: (bucket: string) => string;
}

export const INSPECTOR_HEADER_LABELS_EN: InspectorHeaderLabels = {
  title: 'Inspector',
  clearSelection: 'Clear selection',
  backToRegion: BACK_TO_REGION,
  selectedBlock: 'Selected block',
  within: (regionName) => `in ${regionName}`,
  bucket: (bucket) => bucket,
  editingOverrides: (bucket) => `Editing ${bucket} overrides`,
};

const BUCKET_AR: Readonly<Record<string, string>> = { tablet: 'الجهاز اللوحي', mobile: 'الجوال' };

export const INSPECTOR_HEADER_LABELS_AR: InspectorHeaderLabels = {
  title: 'الخصائص',
  clearSelection: 'إلغاء التحديد',
  backToRegion: 'العودة إلى القسم',
  selectedBlock: 'الكتلة المحددة',
  within: (regionName) => `داخل ${regionName}`,
  bucket: (bucket) => BUCKET_AR[bucket] ?? bucket,
  editingOverrides: (bucket) => `تعديل خصائص ${BUCKET_AR[bucket] ?? bucket}`,
};
