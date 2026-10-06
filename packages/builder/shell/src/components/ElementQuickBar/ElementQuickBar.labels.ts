import type { ElementActionId } from '../../overlay/element-actions';
import type { QuickGroupId } from './quick-bar-groups';

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
};
