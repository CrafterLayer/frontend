export interface StackControlLabels {
  readonly add: string;
  readonly presets: string;
  readonly none: string;
  /** "Layer 2". */
  readonly layer: (index: number) => string;
  readonly reorder: (index: number) => string;
  readonly moveEarlier: (index: number) => string;
  readonly moveLater: (index: number) => string;
  readonly remove: (index: number) => string;
  readonly empty: string;
}

export const STACK_CONTROL_LABELS_EN: StackControlLabels = {
  add: 'Add layer',
  presets: 'Presets',
  none: 'None',
  layer: (index) => `Layer ${String(index + 1)}`,
  reorder: (index) => `Reorder layer ${String(index + 1)}`,
  moveEarlier: (index) => `Move layer ${String(index + 1)} up`,
  moveLater: (index) => `Move layer ${String(index + 1)} down`,
  remove: (index) => `Remove layer ${String(index + 1)}`,
  empty: 'No layers',
};

export const STACK_CONTROL_LABELS_AR: StackControlLabels = {
  add: 'إضافة طبقة',
  presets: 'إعدادات جاهزة',
  none: 'بدون',
  layer: (index) => `الطبقة ${String(index + 1)}`,
  reorder: (index) => `إعادة ترتيب الطبقة ${String(index + 1)}`,
  moveEarlier: (index) => `نقل الطبقة ${String(index + 1)} للأعلى`,
  moveLater: (index) => `نقل الطبقة ${String(index + 1)} للأسفل`,
  remove: (index) => `حذف الطبقة ${String(index + 1)}`,
  empty: 'لا طبقات',
};
