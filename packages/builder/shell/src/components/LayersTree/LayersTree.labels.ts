// ── block-parts (2026-10-06) ──
import { LAYERS_PART_LABELS_AR, LAYERS_PART_LABELS_EN, type LayersPartLabels } from './LayersPartRow.labels';
// ── /block-parts ──

/** Every user-facing string of the Layers navigator; the host picks one set by locale. */
export interface LayersTreeLabels {
  // ── block-parts (2026-10-06) ──
  /** A registered block's part rows (English when absent). */
  readonly parts?: LayersPartLabels | undefined;
  // ── /block-parts ──
  readonly title: string;
  readonly tree: string;
  readonly dragHandle: (name: string) => string;
  readonly dragInstructions: string;
  readonly hide: (name: string, bucket: string) => string;
  readonly hiddenElsewhere: string;
  readonly lock: (name: string) => string;
  readonly rename: string;
  readonly renameInput: (name: string) => string;
  /** Bucket names for the eye's badge and name. */
  readonly buckets: {
    readonly base: string;
    readonly tablet: string;
    readonly mobile: string;
    readonly custom: (maxWidth: number) => string;
  };
  readonly menu: {
    readonly copy: string;
    readonly cut: string;
    readonly paste: string;
    readonly copyStyle: string;
    readonly pasteStyle: string;
    readonly duplicate: string;
    readonly wrap: string;
    readonly unwrap: string;
    readonly delete: string;
    readonly rename: string;
    readonly hide: string;
    readonly lock: string;
    readonly saveTemplate: string;
    readonly makeSymbol: string;
  };
  readonly announce: {
    readonly pickedUp: (name: string) => string;
    readonly over: (name: string, level: number) => string;
    readonly cancelled: (name: string) => string;
    readonly cannotDrop: (name: string) => string;
  };
}

export const LAYERS_TREE_LABELS_EN: LayersTreeLabels = {
  parts: LAYERS_PART_LABELS_EN, // block-parts (2026-10-06)
  title: 'Layers',
  tree: 'Document structure',
  dragHandle: (name) => `Drag ${name}`,
  dragInstructions:
    'To pick up a layer, press Space or Enter. Use the up and down arrows to move it, the start and end arrows to change its level, Space or Enter to drop, and Escape to cancel.',
  hide: (name, bucket) => `Hide ${name} on ${bucket}`,
  hiddenElsewhere: 'Hidden on a wider screen',
  lock: (name) => `Lock ${name}`,
  rename: 'Rename',
  renameInput: (name) => `Name for ${name}`,
  buckets: {
    base: 'all screens',
    tablet: 'tablet',
    mobile: 'mobile',
    custom: (maxWidth) => `screens up to ${String(maxWidth)}px`,
  },
  menu: {
    copy: 'Copy',
    cut: 'Cut',
    paste: 'Paste',
    copyStyle: 'Copy style',
    pasteStyle: 'Paste style',
    duplicate: 'Duplicate',
    wrap: 'Wrap in a container',
    unwrap: 'Unwrap',
    delete: 'Delete',
    rename: 'Rename',
    hide: 'Hide / show',
    lock: 'Lock / unlock',
    saveTemplate: 'Save as template',
    makeSymbol: 'Make a symbol',
  },
  announce: {
    pickedUp: (name) => `Picked up ${name}.`,
    over: (name, level) => `${name} at level ${String(level)}.`,
    cancelled: (name) => `Moving ${name} was cancelled.`,
    cannotDrop: (name) => `${name} cannot be placed there.`,
  },
};

export const LAYERS_TREE_LABELS_AR: LayersTreeLabels = {
  parts: LAYERS_PART_LABELS_AR, // block-parts (2026-10-06)
  title: 'الطبقات',
  tree: 'بنية المستند',
  dragHandle: (name) => `اسحب ${name}`,
  dragInstructions:
    'لالتقاط طبقة اضغط المسافة أو Enter. استخدم السهمين لأعلى ولأسفل لنقلها، وسهمي البداية والنهاية لتغيير مستواها، والمسافة أو Enter للإفلات، وEscape للإلغاء.',
  hide: (name, bucket) => `إخفاء ${name} على ${bucket}`,
  hiddenElsewhere: 'مخفي على شاشة أعرض',
  lock: (name) => `قفل ${name}`,
  rename: 'إعادة تسمية',
  renameInput: (name) => `اسم ${name}`,
  buckets: {
    base: 'كل الشاشات',
    tablet: 'الجهاز اللوحي',
    mobile: 'الجوال',
    custom: (maxWidth) => `الشاشات حتى ${String(maxWidth)}px`,
  },
  menu: {
    copy: 'نسخ',
    cut: 'قص',
    paste: 'لصق',
    copyStyle: 'نسخ التنسيق',
    pasteStyle: 'لصق التنسيق',
    duplicate: 'تكرار',
    wrap: 'تغليف في حاوية',
    unwrap: 'فك التغليف',
    delete: 'حذف',
    rename: 'إعادة تسمية',
    hide: 'إخفاء / إظهار',
    lock: 'قفل / فتح القفل',
    saveTemplate: 'حفظ كقالب',
    makeSymbol: 'تحويل إلى رمز',
  },
  announce: {
    pickedUp: (name) => `التُقط ${name}.`,
    over: (name, level) => `${name} في المستوى ${String(level)}.`,
    cancelled: (name) => `أُلغي نقل ${name}.`,
    cannotDrop: (name) => `لا يمكن وضع ${name} هناك.`,
  },
};
