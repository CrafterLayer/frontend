/** Every string the code view showcase shows or announces; the host picks EN or AR. */
export interface CodeViewShowcaseLabels {
  readonly region: string;
  readonly steps: string;
  readonly opening: string;
  readonly open: string;
  readonly close: string;
  readonly undo: string;
  readonly transactions: string;
  readonly openFailed: string;
  readonly notRegistered: string;
}

export const CODE_VIEW_SHOWCASE_LABELS_EN: CodeViewShowcaseLabels = {
  region: 'Code view showcase',
  steps: 'Select a block · open code view · edit its JSON · watch one transaction · undo exactly',
  opening: 'Opening code view…',
  open: 'Open code view',
  close: 'Close code view',
  undo: 'Undo code edit',
  transactions: 'Transactions',
  openFailed: 'The code view could not be opened.',
  notRegistered: 'The code-view panel contribution is not registered.',
};

export const CODE_VIEW_SHOWCASE_LABELS_AR: CodeViewShowcaseLabels = {
  region: 'تجربة عرض الشيفرة',
  steps: 'تحديد كتلة · فتح عرض الشيفرة · تعديل شيفرتها · متابعة معاملة واحدة · تراجع دقيق',
  opening: 'جارٍ فتح عرض الشيفرة…',
  open: 'فتح عرض الشيفرة',
  close: 'إغلاق عرض الشيفرة',
  undo: 'التراجع عن تعديل الشيفرة',
  transactions: 'المعاملات',
  openFailed: 'تعذّر فتح عرض الشيفرة.',
  notRegistered: 'لوحة عرض الشيفرة غير مسجّلة.',
};
