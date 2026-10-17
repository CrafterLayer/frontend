import type { TopBarDevice } from './TopBar';

/** Every string the top bar shows or announces; the host picks EN or AR by locale. */
export interface TopBarLabels {
  readonly toolbar: string;
  readonly devices: string;
  readonly device: Readonly<Record<TopBarDevice, string>>;
  readonly undo: string;
  readonly redo: string;
  readonly preview: string;
  readonly publish: string;
  readonly publishOptions: string;
  readonly publishingOff: string;
}

export const TOP_BAR_LABELS_EN: TopBarLabels = {
  toolbar: 'Editor toolbar',
  devices: 'Preview device',
  device: { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' },
  undo: 'Undo',
  redo: 'Redo',
  preview: 'Preview',
  publish: 'Publish',
  publishOptions: 'Publish options',
  publishingOff: 'Publishing is not connected',
};

export const TOP_BAR_LABELS_AR: TopBarLabels = {
  toolbar: 'شريط أدوات المحرر',
  devices: 'جهاز المعاينة',
  device: { desktop: 'سطح المكتب', tablet: 'جهاز لوحي', mobile: 'جوال' },
  undo: 'تراجع',
  redo: 'إعادة',
  preview: 'معاينة',
  publish: 'نشر',
  publishOptions: 'خيارات النشر',
  publishingOff: 'النشر غير متصل',
};
