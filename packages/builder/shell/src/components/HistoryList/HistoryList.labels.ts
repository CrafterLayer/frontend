import type { Author } from '@craftkit/builder-schema';

/** Every user-facing string of the History list; the host picks one set by locale. */
export interface HistoryListLabels {
  /** BCP 47 tag for relative times ("2 minutes ago" / "قبل دقيقتين"). */
  readonly locale: string;
  readonly title: string;
  readonly start: string;
  readonly empty: string;
  readonly current: string;
  readonly undone: string;
  readonly author: Readonly<Record<Author, string>>;
  /** Names for single-command steps; grouped steps already carry their own label. */
  readonly commands: Readonly<Record<string, string>>;
  readonly jumpTo: (label: string) => string;
  readonly jumped: (label: string) => string;
}

export const HISTORY_LIST_LABELS_EN: HistoryListLabels = {
  locale: 'en',
  title: 'Edit history',
  start: 'Opened',
  empty: 'No edits yet. Every change you or the assistant make appears here.',
  current: 'Current state',
  undone: 'Undone',
  author: { user: 'You', ai: 'Assistant', codeview: 'Code view' },
  commands: {
    setProp: 'Edit',
    insertNode: 'Insert',
    insertComposition: 'Insert template',
    removeNode: 'Delete',
    moveNode: 'Move',
    duplicateNode: 'Duplicate',
    setTreeNode: 'Replace element',
    patchTreeNode: 'Edit element',
    insertTreeNode: 'Insert element',
    removeTreeNode: 'Delete element',
    moveTreeNode: 'Move element',
    duplicateTreeNode: 'Duplicate element',
    wrapTreeNode: 'Wrap',
    unwrapTreeNode: 'Unwrap',
    formatTreeText: 'Format text',
  },
  jumpTo: (label) => `Go back to: ${label}`,
  jumped: (label) => `Now at: ${label}`,
};

export const HISTORY_LIST_LABELS_AR: HistoryListLabels = {
  locale: 'ar',
  title: 'سجل التعديلات',
  start: 'عند الفتح',
  empty: 'لا تعديلات بعد. يظهر هنا كل تغيير تجريه أنت أو المساعد.',
  current: 'الحالة الحالية',
  undone: 'متراجَع عنه',
  author: { user: 'أنت', ai: 'المساعد', codeview: 'عرض الشيفرة' },
  commands: {
    setProp: 'تعديل',
    insertNode: 'إدراج',
    insertComposition: 'إدراج قالب',
    removeNode: 'حذف',
    moveNode: 'نقل',
    duplicateNode: 'تكرار',
    setTreeNode: 'استبدال عنصر',
    patchTreeNode: 'تعديل عنصر',
    insertTreeNode: 'إدراج عنصر',
    removeTreeNode: 'حذف عنصر',
    moveTreeNode: 'نقل عنصر',
    duplicateTreeNode: 'تكرار عنصر',
    wrapTreeNode: 'تغليف',
    unwrapTreeNode: 'فك التغليف',
    formatTreeText: 'تنسيق النص',
  },
  jumpTo: (label) => `العودة إلى: ${label}`,
  jumped: (label) => `الآن عند: ${label}`,
};
