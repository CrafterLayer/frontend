export interface DesignLibraryTransferLabels {
  readonly title: string;
  readonly export: string;
  readonly exported: (fileName: string) => string;
  readonly import: string;
  readonly chooseFile: string;
  readonly reading: string;
  readonly preview: string;
  readonly systemName: (from: string, to: string) => string;
  readonly tokens: (count: number) => string;
  readonly palette: string;
  readonly styles: string;
  readonly fonts: string;
  readonly counts: (added: number, changed: number, removed: number) => string;
  readonly keptInUse: (ids: string) => string;
  readonly replace: string;
  readonly confirm: string;
  readonly cancel: string;
  readonly done: string;
  readonly commit: (name: string) => string;
}

export const DESIGN_LIBRARY_TRANSFER_LABELS_EN: DesignLibraryTransferLabels = {
  title: 'Import & export design system',
  export: 'Export design system',
  exported: (fileName) => `Saved ${fileName}.`,
  import: 'Import design system',
  chooseFile: 'Design file (.json)',
  reading: 'Reading the file…',
  preview: 'What the import changes',
  systemName: (from, to) => (from === to ? `System: ${to}` : `System: ${from} → ${to}`),
  tokens: (count) => `${String(count)} token${count === 1 ? '' : 's'} change`,
  palette: 'Palette',
  styles: 'Named styles',
  fonts: 'Fonts',
  counts: (added, changed, removed) => `${String(added)} added, ${String(changed)} changed, ${String(removed)} removed`,
  keptInUse: (ids) => `Kept because they are in use: ${ids}`,
  replace: 'Remove entries the file does not have (entries in use are kept)',
  confirm: 'Import',
  cancel: 'Cancel',
  done: 'Imported. One Undo restores the previous design.',
  commit: (name) => `Import design system · ${name}`,
};

export const DESIGN_LIBRARY_TRANSFER_LABELS_AR: DesignLibraryTransferLabels = {
  title: 'استيراد نظام التصميم وتصديره',
  export: 'صدّر نظام التصميم',
  exported: (fileName) => `حُفظ ${fileName}.`,
  import: 'استورد نظام التصميم',
  chooseFile: 'ملف التصميم (‎.json)',
  reading: 'تجري قراءة الملف…',
  preview: 'ما سيغيّره الاستيراد',
  systemName: (from, to) => (from === to ? `النظام: ${to}` : `النظام: ${from} ← ${to}`),
  tokens: (count) => `يتغيّر ${String(count)} رمزًا`,
  palette: 'اللوحة',
  styles: 'الأنماط المسمّاة',
  fonts: 'الخطوط',
  counts: (added, changed, removed) => `${String(added)} مضاف، ${String(changed)} معدّل، ${String(removed)} محذوف`,
  keptInUse: (ids) => `أُبقي عليها لأنها مستخدمة: ${ids}`,
  replace: 'احذف ما ليس في الملف (يبقى المستخدم منها)',
  confirm: 'استورد',
  cancel: 'إلغاء',
  done: 'تم الاستيراد. تراجع واحد يعيد التصميم السابق.',
  commit: (name) => `استيراد نظام التصميم · ${name}`,
};
