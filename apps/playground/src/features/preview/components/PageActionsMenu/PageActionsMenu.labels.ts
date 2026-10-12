import { arabicCount, type ArabicCountForms } from '../../arabic-count';

/** Every string the page actions menu shows or announces; the host picks EN or AR. */
export interface PageActionsMenuLabels {
  readonly trigger: (title: string) => string;
  readonly triggerTitle: string;
  readonly menu: (title: string) => string;
  readonly open: string;
  readonly rename: string;
  readonly changeRoute: string;
  readonly duplicate: string;
  readonly moveUp: string;
  readonly moveDown: string;
  readonly currentHome: string;
  readonly makeHome: string;
  readonly settings: string;
  readonly clear: string;
  readonly deletePage: string;
  readonly lastPage: string;
  readonly chooseHome: string;
  readonly confirmTitle: (title: string) => string;
  /** The first sentence of the confirmation when the home page is deleted. */
  readonly homeMoves: (title: string) => string;
  readonly unlinks: (linkCount: number) => string;
  readonly removesOnce: string;
  readonly cancel: string;
  readonly deleteAndUnlink: string;
}

export const PAGE_ACTIONS_MENU_LABELS_EN: PageActionsMenuLabels = {
  trigger: (title) => `Actions for ${title}`,
  triggerTitle: 'Page actions',
  menu: (title) => `${title} actions`,
  open: 'Open page',
  rename: 'Rename',
  changeRoute: 'Change route',
  duplicate: 'Duplicate',
  moveUp: 'Move up',
  moveDown: 'Move down',
  currentHome: 'Current home page',
  makeHome: 'Make home',
  settings: 'SEO and settings',
  clear: 'Clear page',
  deletePage: 'Delete page',
  lastPage: 'The final page can be cleared, but not deleted.',
  chooseHome: 'Choose a new home page first.',
  confirmTitle: (title) => `Delete ${title}?`,
  homeMoves: (title) => `Home will move to ${title}.`,
  unlinks: (linkCount) =>
    `${String(linkCount)} internal link${linkCount === 1 ? '' : 's'} will be removed in the same change.`,
  removesOnce: 'This removes the page in one undoable change.',
  cancel: 'Cancel',
  deleteAndUnlink: 'Delete and unlink',
};

/** «رابط داخلي واحد», «رابطان داخليان», «3 روابط داخلية», «11 رابطًا داخليًا». */
const AR_INTERNAL_LINKS: ArabicCountForms = {
  one: 'رابط داخلي واحد',
  two: 'رابطان داخليان',
  few: 'روابط داخلية',
  many: 'رابطًا داخليًا',
  other: 'رابط داخلي',
};

export const PAGE_ACTIONS_MENU_LABELS_AR: PageActionsMenuLabels = {
  trigger: (title) => `إجراءات ${title}`,
  triggerTitle: 'إجراءات الصفحة',
  menu: (title) => `قائمة إجراءات ${title}`,
  open: 'فتح الصفحة',
  rename: 'إعادة التسمية',
  changeRoute: 'تغيير المسار',
  duplicate: 'تكرار',
  moveUp: 'نقل لأعلى',
  moveDown: 'نقل لأسفل',
  currentHome: 'الصفحة الرئيسية الحالية',
  makeHome: 'جعلها الصفحة الرئيسية',
  settings: 'الإعدادات والظهور في البحث',
  clear: 'تفريغ الصفحة',
  deletePage: 'حذف الصفحة',
  lastPage: 'يمكن تفريغ الصفحة الأخيرة، لكن لا يمكن حذفها.',
  chooseHome: 'يلزم اختيار صفحة رئيسية جديدة أولًا.',
  confirmTitle: (title) => `حذف «${title}»؟`,
  homeMoves: (title) => `ستنتقل الصفحة الرئيسية إلى «${title}».`,
  // The verb comes first, so it stays singular whatever the count: «سيُزال رابطان».
  unlinks: (linkCount) => `سيُزال ${arabicCount(linkCount, AR_INTERNAL_LINKS)} في التغيير نفسه.`,
  removesOnce: 'يحذف هذا الإجراء الصفحة في تغيير واحد يمكن التراجع عنه.',
  cancel: 'إلغاء',
  deleteAndUnlink: 'حذف الصفحة وإزالة الروابط',
};
