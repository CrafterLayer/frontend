/**
 * Every string the Inspector's field library shows or announces, in both
 * editor locales. A field reads them through `useFieldLabels()`; the locale is
 * the one `FieldServicesProvider` was given (English when no provider exists).
 */
export type FieldLocale = 'en' | 'ar';

export interface FieldLabels {
  readonly empty: string;
  readonly items: (count: number) => string;
  readonly fields: (count: number) => string;
  readonly yes: string;
  readonly no: string;
  readonly richTextLoading: string;
  readonly richTextFailed: string;
  readonly retry: string;
  readonly linkText: string;
  readonly linkAddress: string;
  readonly linkPage: string;
  readonly linkPageNone: string;
  readonly linkRefused: string;
  readonly imageAddress: string;
  readonly imageRefused: string;
  readonly chooseFromLibrary: string;
  readonly hideLibrary: string;
  readonly libraryLabel: string;
  readonly filterPictures: string;
  readonly noImage: string;
  readonly removeImage: string;
  readonly removedReason: string;
  readonly assetId: string;
  readonly assetChosen: (description: string) => string;
  readonly assetHeld: (id: string) => string;
  readonly assetAbsent: (reason: string) => string;
  readonly keyLabel: string;
  readonly valueLabel: string;
  readonly addEntry: string;
  readonly removeEntry: (key: string) => string;
  readonly duplicateKey: (key: string) => string;
  readonly partStylesNone: string;
  readonly resetPart: (label: string) => string;
  readonly partReset: (label: string) => string;
  readonly partDirection: (dir: string) => string;
  readonly partClasses: (count: number) => string;
}

export const FIELD_LABELS_EN: FieldLabels = {
  empty: 'Empty',
  items: (count) => (count === 1 ? '1 item' : `${String(count)} items`),
  fields: (count) => (count === 1 ? '1 field' : `${String(count)} fields`),
  yes: 'Yes',
  no: 'No',
  richTextLoading: 'Loading the text editor…',
  richTextFailed: 'The text editor could not be loaded.',
  retry: 'Retry',
  linkText: 'Link text',
  linkAddress: 'Link address',
  linkPage: 'Link to a page',
  linkPageNone: 'Choose a page…',
  linkRefused:
    'That address is not allowed: use http(s), mailto, tel, or a path starting with /, # or ?.',
  imageAddress: 'Image address',
  imageRefused:
    'That image address is not allowed: use http(s), a path starting with /, or a library picture.',
  chooseFromLibrary: 'Choose from library',
  hideLibrary: 'Hide library',
  libraryLabel: 'Site pictures',
  filterPictures: 'Filter pictures',
  noImage: 'No image',
  removeImage: 'Remove image',
  removedReason: 'Removed in the editor',
  assetId: 'Asset id',
  assetChosen: (description) => `Chosen: ${description}`,
  assetHeld: (id) => `Library picture ${id}`,
  assetAbsent: (reason) => `No image (${reason})`,
  keyLabel: 'Name',
  valueLabel: 'Value',
  addEntry: 'Add entry',
  removeEntry: (key) => `Remove ${key}`,
  duplicateKey: (key) => `“${key}” is already used.`,
  partStylesNone: 'No part has its own style yet.',
  resetPart: (label) => `Reset ${label}`,
  partReset: (label) => `${label} reset`,
  partDirection: (dir) => `Direction ${dir.toUpperCase()}`,
  partClasses: (count) => (count === 1 ? '1 class' : `${String(count)} classes`),
};

/**
 * Arabic counts take four forms: one, two (the dual), three to ten (the
 * plural), and eleven upward (the singular accusative) — "3 عناصر" but
 * "11 عنصرًا". A single "N items" template reads as a mistake to a native
 * reader, so the forms are spelled out.
 */
function arabicCount(
  count: number,
  [one, two, few, many]: readonly [string, string, string, string],
): string {
  if (count === 1) return one;
  if (count === 2) return two;
  const tail = count % 100;
  if (tail >= 3 && tail <= 10) return `${String(count)} ${few}`;
  return `${String(count)} ${many}`;
}

export const FIELD_LABELS_AR: FieldLabels = {
  empty: 'فارغ',
  items: (count) => arabicCount(count, ['عنصر واحد', 'عنصران', 'عناصر', 'عنصرًا']),
  fields: (count) => arabicCount(count, ['حقل واحد', 'حقلان', 'حقول', 'حقلًا']),
  yes: 'نعم',
  no: 'لا',
  richTextLoading: 'جارٍ تحميل محرّر النص…',
  richTextFailed: 'تعذّر تحميل محرّر النص.',
  retry: 'إعادة المحاولة',
  linkText: 'نص الرابط',
  linkAddress: 'عنوان الرابط',
  linkPage: 'رابط إلى صفحة',
  linkPageNone: 'اختر صفحة…',
  linkRefused:
    'هذا العنوان غير مسموح: استخدم http(s) أو mailto أو tel أو مسارًا يبدأ بـ / أو # أو ?.',
  imageAddress: 'عنوان الصورة',
  imageRefused: 'عنوان الصورة غير مسموح: استخدم http(s) أو مسارًا يبدأ بـ / أو صورة من المكتبة.',
  chooseFromLibrary: 'اختر من المكتبة',
  hideLibrary: 'إخفاء المكتبة',
  libraryLabel: 'صور الموقع',
  filterPictures: 'تصفية الصور',
  noImage: 'بلا صورة',
  removeImage: 'إزالة الصورة',
  removedReason: 'أُزيلت في المحرّر',
  assetId: 'معرّف الصورة',
  assetChosen: (description) => `المختارة: ${description}`,
  assetHeld: (id) => `صورة من المكتبة ${id}`,
  assetAbsent: (reason) => `بلا صورة (${reason})`,
  keyLabel: 'الاسم',
  valueLabel: 'القيمة',
  addEntry: 'إضافة سطر',
  removeEntry: (key) => `إزالة ${key}`,
  duplicateKey: (key) => `الاسم «${key}» مستخدم من قبل.`,
  partStylesNone: 'لا يوجد جزء بتنسيق خاص بعد.',
  resetPart: (label) => `إعادة ضبط ${label}`,
  partReset: (label) => `أُعيد ضبط ${label}`,
  partDirection: (dir) => `الاتجاه ${dir.toUpperCase()}`,
  partClasses: (count) => arabicCount(count, ['صنف واحد', 'صنفان', 'أصناف', 'صنفًا']),
};

export const FIELD_LABELS: Readonly<Record<FieldLocale, FieldLabels>> = {
  en: FIELD_LABELS_EN,
  ar: FIELD_LABELS_AR,
};
