/** Every string the source workspace shows or announces; the host picks EN or AR. */
export interface CodeWorkspaceLabels {
  /** The region's accessible name (overridden by the `label` prop when given). */
  readonly region: string;
  readonly emptyTitle: string;
  readonly emptyHint: string;
  readonly source: string;
  readonly file: string;
  readonly reveal: string;
  readonly saving: string;
  readonly save: string;
  readonly editor: string;
  readonly unsaved: string;
  readonly matches: string;
}

export const CODE_WORKSPACE_LABELS_EN: CodeWorkspaceLabels = {
  region: 'Page source workspace',
  emptyTitle: 'No authored source is open',
  emptyHint: 'Select a code-backed page or an element in its preview.',
  source: 'Source',
  file: 'File',
  reveal: 'Reveal selected element',
  saving: 'Saving…',
  save: 'Save source',
  editor: 'Source code',
  unsaved: 'Source has unsaved changes.',
  matches: 'Source matches the saved project revision.',
};

export const CODE_WORKSPACE_LABELS_AR: CodeWorkspaceLabels = {
  region: 'مساحة عمل شيفرة الصفحة',
  emptyTitle: 'لا توجد شيفرة مكتوبة مفتوحة',
  emptyHint: 'تظهر الشيفرة هنا عند اختيار صفحة مبنية بالشيفرة أو عنصر في معاينتها.',
  source: 'الشيفرة',
  file: 'الملف',
  reveal: 'إظهار العنصر المحدد',
  saving: 'جارٍ الحفظ…',
  save: 'حفظ الشيفرة',
  editor: 'الشيفرة المصدرية',
  unsaved: 'في الشيفرة تغييرات غير محفوظة.',
  matches: 'الشيفرة مطابقة لنسخة المشروع المحفوظة.',
};
