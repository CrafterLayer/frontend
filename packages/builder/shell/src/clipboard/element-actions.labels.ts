/**
 * The words element actions use — in history labels ("Duplicate · Heading
 * “Our story”") and in the announcements a screen reader hears. The host
 * picks one set by locale (style-manager DESIGN.md §0 law 3).
 */
export interface ElementActionLabels {
  readonly duplicate: string;
  readonly delete: string;
  readonly wrap: string;
  readonly unwrap: string;
  readonly moveEarlier: string;
  readonly moveLater: string;
  readonly move: string;
  readonly hide: string;
  readonly show: string;
  readonly lock: string;
  readonly unlock: string;
  readonly rename: string;
  readonly paste: string;
  readonly cut: string;
  readonly insert: string;
  readonly pasteStyle: string;
  /** "3 elements" — the name of a multi-selection in a history label. */
  readonly count: (count: number) => string;
  readonly copied: (name: string) => string;
  readonly styleCopied: (name: string) => string;
  readonly nothingSelected: string;
  readonly notAnElement: string;
  readonly clipboardEmpty: string;
  readonly styleClipboardEmpty: string;
  readonly noPasteTarget: string;
  readonly cannotMove: string;
  readonly done: (label: string) => string;
  readonly refused: (label: string, reason: string) => string;
}

export const ELEMENT_ACTION_LABELS_EN: ElementActionLabels = {
  duplicate: 'Duplicate',
  delete: 'Delete',
  wrap: 'Wrap',
  unwrap: 'Unwrap',
  moveEarlier: 'Move earlier',
  moveLater: 'Move later',
  move: 'Move',
  hide: 'Hide',
  show: 'Show',
  lock: 'Lock',
  unlock: 'Unlock',
  rename: 'Rename',
  paste: 'Paste',
  cut: 'Cut',
  insert: 'Insert',
  pasteStyle: 'Paste style',
  count: (count) => `${String(count)} elements`,
  copied: (name) => `Copied ${name}`,
  styleCopied: (name) => `Copied the style of ${name}`,
  nothingSelected: 'Select an element first',
  notAnElement: 'This works on elements inside a custom section',
  clipboardEmpty: 'The clipboard holds no element',
  styleClipboardEmpty: 'Copy a style first',
  noPasteTarget: 'Select an element or a custom section to paste into',
  cannotMove: 'It cannot move further',
  done: (label) => label,
  refused: (label, reason) => `${label} refused: ${reason}`,
};

export const ELEMENT_ACTION_LABELS_AR: ElementActionLabels = {
  duplicate: 'تكرار',
  delete: 'حذف',
  wrap: 'تغليف',
  unwrap: 'فك التغليف',
  moveEarlier: 'نقل إلى الأمام',
  moveLater: 'نقل إلى الخلف',
  move: 'نقل',
  hide: 'إخفاء',
  show: 'إظهار',
  lock: 'قفل',
  unlock: 'فتح القفل',
  rename: 'إعادة تسمية',
  paste: 'لصق',
  cut: 'قص',
  insert: 'إدراج',
  pasteStyle: 'لصق التنسيق',
  count: (count) => `${String(count)} عناصر`,
  copied: (name) => `نُسخ ${name}`,
  styleCopied: (name) => `نُسخ تنسيق ${name}`,
  nothingSelected: 'حدّد عنصرًا أولًا',
  notAnElement: 'يعمل هذا على العناصر داخل قسم مخصّص',
  clipboardEmpty: 'لا تحوي الحافظة عنصرًا',
  styleClipboardEmpty: 'انسخ تنسيقًا أولًا',
  noPasteTarget: 'حدّد عنصرًا أو قسمًا مخصّصًا للّصق فيه',
  cannotMove: 'لا يمكن نقله أكثر',
  done: (label) => label,
  refused: (label, reason) => `رُفض ${label}: ${reason}`,
};
