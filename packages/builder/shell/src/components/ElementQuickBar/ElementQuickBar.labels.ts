import type { ElementActionId } from '../../overlay/element-actions';
import type { QuickGroupId } from './quick-bar-groups';
// ── block-parts (2026-10-06) ──
import { PART_ACTION_WORDS_EN, type PartActionWords } from './part-actions';

/** The part bar's words (block-parts §2.14): its actions, refusals and the link popover. */
export interface PartQuickBarLabels extends PartActionWords {
  readonly linkTitle: string;
  readonly linkText: string;
  readonly linkAddress: string;
  readonly page: string;
  readonly noPage: string;
  readonly invalidHref: string;
  readonly apply: string;
  readonly cancel: string;
}

export const PART_QUICK_BAR_LABELS_EN: PartQuickBarLabels = {
  ...PART_ACTION_WORDS_EN,
  linkTitle: 'Edit link',
  linkText: 'Link text',
  linkAddress: 'Link address',
  page: 'Page on this site',
  noPage: 'Choose a page',
  invalidHref: 'This address is not allowed · use https://, mailto:, tel: or a path such as /about',
  apply: 'Apply',
  cancel: 'Cancel',
};

export const PART_QUICK_BAR_LABELS_AR: PartQuickBarLabels = {
  actions: {
    editText: 'تحرير النص',
    link: 'الرابط',
    addAfter: 'إضافة عنصر بعده',
    duplicate: 'تكرار العنصر',
    moveUp: 'نقل العنصر للأعلى',
    moveDown: 'نقل العنصر للأسفل',
    remove: 'إزالة العنصر',
    scopeThis: 'تنسيق هذا العنصر وحده',
    dirAuto: 'الاتجاه حسب النص',
    dirLtr: 'من اليسار إلى اليمين',
    dirRtl: 'من اليمين إلى اليسار',
    selectBlock: 'تحديد القسم كاملًا',
  },
  alreadyFirst: 'هذا أول عنصر',
  alreadyLast: 'هذا آخر عنصر',
  notInList: 'هذا الجزء ليس داخل قائمة',
  notText: 'هذا الجزء لا يحوي نصًا',
  linkTitle: 'تحرير الرابط',
  linkText: 'نص الرابط',
  linkAddress: 'عنوان الرابط',
  page: 'صفحة من هذا الموقع',
  noPage: 'اختر صفحة',
  invalidHref: 'هذا العنوان غير مسموح · استخدم https:// أو mailto: أو tel: أو مسارًا يبدأ بـ /',
  apply: 'تطبيق',
  cancel: 'إلغاء',
};
// ── /block-parts ──

export interface ElementQuickBarLabels {
  /** Which catalogue label language the generic controls use. */
  readonly locale: 'en' | 'ar';
  /** The toolbar's accessible name; `{name}` is the element's name. */
  readonly toolbar: string;
  readonly groups: Readonly<Record<QuickGroupId, string>>;
  readonly actions: Readonly<Record<ElementActionId, string>>;
  readonly more: string;
  readonly editWithAi: string;
  readonly overflow: string;
  readonly dragToMove: string;
  readonly reset: string;
  readonly mixed: string;
  readonly href: string;
  readonly openInNewTab: string;
  readonly altText: string;
  readonly decorative: string;
  readonly iconName: string;
  readonly iconSize: string;
  readonly noStyle: string;
  readonly apply: string;
  readonly hideOn: string;
  readonly showOn: string;
  // ── block-parts (2026-10-06) ──
  /** The part bar's words. Absent ⇒ English. */
  readonly parts?: PartQuickBarLabels | undefined;
  // ── /block-parts ──
}

export const ELEMENT_QUICK_BAR_LABELS_EN: ElementQuickBarLabels = {
  locale: 'en',
  toolbar: 'Quick controls for {name}',
  groups: {
    fontSize: 'Font size',
    fontWeight: 'Font weight',
    textColor: 'Colour',
    textAlign: 'Alignment',
    lineHeight: 'Line height',
    direction: 'Direction',
    background: 'Background',
    padding: 'Spacing',
    gap: 'Gap',
    flexDirection: 'Flex direction',
    align: 'Align and justify',
    radius: 'Corner radius',
    border: 'Border',
    shadow: 'Shadow',
    replace: 'Replace media',
    fit: 'Fit',
    aspect: 'Aspect ratio',
    alt: 'Alternative text',
    link: 'Link',
    stylePreset: 'Style preset',
    hoverPreset: 'Hover effect',
    icon: 'Icon',
    iconSize: 'Icon size',
    motion: 'Animation',
  },
  actions: {
    selectParent: 'Select parent',
    duplicate: 'Duplicate',
    delete: 'Delete',
    moveEarlier: 'Move earlier',
    moveLater: 'Move later',
    wrap: 'Wrap in container',
    unwrap: 'Unwrap',
    copyStyle: 'Copy style',
    pasteStyle: 'Paste style',
    saveTemplate: 'Save as template',
    animate: 'Animate',
    hideOnBucket: 'Hide on this device',
    deselect: 'Deselect',
  },
  more: 'More',
  editWithAi: 'Edit with AI',
  overflow: 'More controls',
  dragToMove: 'Drag to move',
  reset: 'Reset',
  mixed: 'Mixed',
  href: 'Link address',
  openInNewTab: 'Open in a new tab',
  altText: 'Alternative text',
  decorative: 'Decorative (no text)',
  iconName: 'Icon name',
  iconSize: 'Size in pixels',
  noStyle: 'No style',
  apply: 'Apply',
  hideOn: 'Hide on this device',
  showOn: 'Show on this device',
  // ── block-parts (2026-10-06) ──
  parts: PART_QUICK_BAR_LABELS_EN,
  // ── /block-parts ──
};

export const ELEMENT_QUICK_BAR_LABELS_AR: ElementQuickBarLabels = {
  locale: 'ar',
  toolbar: 'أدوات سريعة لـ {name}',
  groups: {
    fontSize: 'حجم الخط',
    fontWeight: 'سماكة الخط',
    textColor: 'اللون',
    textAlign: 'المحاذاة',
    lineHeight: 'ارتفاع السطر',
    direction: 'الاتجاه',
    background: 'الخلفية',
    padding: 'المسافات',
    gap: 'الفجوة',
    flexDirection: 'اتجاه العناصر',
    align: 'المحاذاة والتوزيع',
    radius: 'استدارة الزوايا',
    border: 'الحدود',
    shadow: 'الظل',
    replace: 'استبدال الوسائط',
    fit: 'الملاءمة',
    aspect: 'نسبة العرض إلى الارتفاع',
    alt: 'النص البديل',
    link: 'الرابط',
    stylePreset: 'نمط جاهز',
    hoverPreset: 'تأثير التمرير',
    icon: 'الأيقونة',
    iconSize: 'حجم الأيقونة',
    motion: 'الحركة',
  },
  actions: {
    selectParent: 'تحديد العنصر الأب',
    duplicate: 'تكرار',
    delete: 'حذف',
    moveEarlier: 'نقل للأمام',
    moveLater: 'نقل للخلف',
    wrap: 'تغليف في حاوية',
    unwrap: 'إزالة التغليف',
    copyStyle: 'نسخ التنسيق',
    pasteStyle: 'لصق التنسيق',
    saveTemplate: 'حفظ كقالب',
    animate: 'تحريك',
    hideOnBucket: 'إخفاء على هذا الجهاز',
    deselect: 'إلغاء التحديد',
  },
  more: 'المزيد',
  editWithAi: 'تعديل بالذكاء الاصطناعي',
  overflow: 'أدوات إضافية',
  dragToMove: 'اسحب للنقل',
  reset: 'إعادة تعيين',
  mixed: 'مختلط',
  href: 'عنوان الرابط',
  openInNewTab: 'فتح في علامة تبويب جديدة',
  altText: 'النص البديل',
  decorative: 'زخرفي (بلا نص)',
  iconName: 'اسم الأيقونة',
  iconSize: 'الحجم بالبكسل',
  noStyle: 'بلا نمط',
  apply: 'تطبيق',
  hideOn: 'إخفاء على هذا الجهاز',
  showOn: 'إظهار على هذا الجهاز',
  // ── block-parts (2026-10-06) ──
  parts: PART_QUICK_BAR_LABELS_AR,
  // ── /block-parts ──
};
