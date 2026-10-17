export interface SymbolsPanelLabels {
  readonly title: string;
  readonly empty: string;
  readonly list: string;
  readonly instances: (count: number) => string;
  readonly makeTitle: string;
  readonly makeName: string;
  readonly make: string;
  readonly rename: (name: string) => string;
  readonly editMaster: string;
  readonly closeMaster: string;
  readonly masterOutline: (name: string) => string;
  readonly masterText: (element: string) => string;
  readonly masterClasses: (element: string) => string;
  readonly remove: string;
  readonly inUse: (count: number) => string;
  readonly detachAll: string;
  readonly cancel: string;
  readonly instanceTitle: (name: string) => string;
  readonly missing: string;
  readonly overrides: string;
  readonly noOverrides: string;
  readonly overridden: string;
  readonly fields: Readonly<Record<'text' | 'className' | 'attributes', string>>;
  readonly reset: (what: string) => string;
  readonly resetAll: string;
  readonly push: string;
  readonly detach: string;
  readonly commit: {
    readonly make: (name: string) => string;
    readonly rename: (name: string) => string;
    readonly master: (name: string) => string;
    readonly remove: (name: string) => string;
    readonly removeDetach: (name: string) => string;
    readonly detach: (name: string) => string;
    readonly push: (name: string) => string;
    readonly reset: (name: string) => string;
  };
}

export const SYMBOLS_PANEL_LABELS_EN: SymbolsPanelLabels = {
  title: 'Symbols',
  empty: 'No symbols yet. Select a composed region and make it a symbol to reuse it.',
  list: 'Site symbols',
  instances: (count) => (count === 1 ? '1 instance' : `${String(count)} instances`),
  makeTitle: 'Make this region a symbol',
  makeName: 'Symbol name',
  make: 'Make into symbol',
  rename: (name) => `Name of ${name}`,
  editMaster: 'Edit master',
  closeMaster: 'Close master',
  masterOutline: (name) => `Master of ${name}`,
  masterText: (element) => `Text of ${element}`,
  masterClasses: (element) => `Classes of ${element}`,
  remove: 'Delete',
  inUse: (count) =>
    `${String(count)} instance${count === 1 ? '' : 's'} still use this symbol. Detaching turns each into a plain region with the same look.`,
  detachAll: 'Detach instances and delete',
  cancel: 'Cancel',
  instanceTitle: (name) => `Instance of ${name}`,
  missing: 'This instance’s symbol is missing from the library. Detach it or delete it.',
  overrides: 'Overrides on this instance',
  noOverrides: 'No overrides: this instance shows the master exactly.',
  overridden: 'Overridden',
  fields: { text: 'text', className: 'classes', attributes: 'attributes' },
  reset: (what) => `Reset ${what}`,
  resetAll: 'Reset all overrides',
  push: 'Push overrides to master',
  detach: 'Detach instance',
  commit: {
    make: (name) => `Make symbol · ${name}`,
    rename: (name) => `Rename symbol · ${name}`,
    master: (name) => `Edit master · ${name}`,
    remove: (name) => `Delete symbol · ${name}`,
    removeDetach: (name) => `Delete symbol, detach instances · ${name}`,
    detach: (name) => `Detach instance · ${name}`,
    push: (name) => `Push overrides to master · ${name}`,
    reset: (name) => `Reset override · ${name}`,
  },
};

export const SYMBOLS_PANEL_LABELS_AR: SymbolsPanelLabels = {
  title: 'الرموز',
  empty: 'لا توجد رموز بعد. اختر منطقة مركّبة واجعلها رمزًا لإعادة استخدامها.',
  list: 'رموز الموقع',
  instances: (count) => `${String(count)} نسخة`,
  makeTitle: 'اجعل هذه المنطقة رمزًا',
  makeName: 'اسم الرمز',
  make: 'حوّل إلى رمز',
  rename: (name) => `اسم ${name}`,
  editMaster: 'حرّر الأصل',
  closeMaster: 'أغلق الأصل',
  masterOutline: (name) => `أصل ${name}`,
  masterText: (element) => `نص ${element}`,
  masterClasses: (element) => `فئات ${element}`,
  remove: 'احذف',
  inUse: (count) => `ما زالت ${String(count)} نسخة تستخدم هذا الرمز. الفصل يحوّل كل نسخة إلى منطقة عادية بالمظهر نفسه.`,
  detachAll: 'افصل النسخ واحذف',
  cancel: 'إلغاء',
  instanceTitle: (name) => `نسخة من ${name}`,
  missing: 'رمز هذه النسخة غير موجود في المكتبة. افصلها أو احذفها.',
  overrides: 'التعديلات على هذه النسخة',
  noOverrides: 'لا تعديلات: هذه النسخة تطابق الأصل تمامًا.',
  overridden: 'معدّل',
  fields: { text: 'النص', className: 'الفئات', attributes: 'الخصائص' },
  reset: (what) => `أعد ضبط ${what}`,
  resetAll: 'أعد ضبط كل التعديلات',
  push: 'انقل التعديلات إلى الأصل',
  detach: 'افصل النسخة',
  commit: {
    make: (name) => `إنشاء رمز · ${name}`,
    rename: (name) => `إعادة تسمية رمز · ${name}`,
    master: (name) => `تحرير الأصل · ${name}`,
    remove: (name) => `حذف رمز · ${name}`,
    removeDetach: (name) => `حذف رمز وفصل النسخ · ${name}`,
    detach: (name) => `فصل نسخة · ${name}`,
    push: (name) => `نقل التعديلات إلى الأصل · ${name}`,
    reset: (name) => `إعادة ضبط تعديل · ${name}`,
  },
};
