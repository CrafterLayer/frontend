import { arabicCount } from '../preview/arabic-count';

/** Every string the editor's action feedback shows (Studio Indigo, 2026-10-12). */
export interface FeedbackLabels {
  /** The toasts' landmark, read by screen readers ("Notifications"). */
  readonly region: string;
  readonly publishing: string;
  /** The site's files are ready and downloading. */
  readonly published: (files: number) => string;
  readonly publishedDetail: string;
  readonly publishFailed: string;
  readonly publishFailedDetail: string;
  readonly retry: string;
  readonly close: string;
}

export const FEEDBACK_LABELS_EN: FeedbackLabels = {
  region: 'Notifications',
  publishing: 'Publishing the site…',
  published: (files) => `Site published · ${String(files)} ${files === 1 ? 'file' : 'files'}`,
  publishedDetail: 'The files are downloading. Upload them to any static host.',
  publishFailed: 'The site was not published',
  publishFailedDetail: 'Nothing was lost. Check the page and try again.',
  retry: 'Try again',
  close: 'Close',
};

export const FEEDBACK_LABELS_AR: FeedbackLabels = {
  region: 'الإشعارات',
  publishing: 'جارٍ نشر الموقع…',
  published: (files) =>
    `نُشر الموقع · ${arabicCount(files, { one: 'ملف واحد', two: 'ملفان', few: 'ملفات', many: 'ملفًا', other: 'ملف' })}`,
  publishedDetail: 'يجري تنزيل الملفات. ارفعها إلى أي استضافة ثابتة.',
  publishFailed: 'لم يُنشر الموقع',
  publishFailedDetail: 'لم يضِع شيء. راجع الصفحة وحاول مجددًا.',
  retry: 'حاول مجددًا',
  close: 'إغلاق',
};

export function feedbackLabels(locale: 'en' | 'ar'): FeedbackLabels {
  return locale === 'ar' ? FEEDBACK_LABELS_AR : FEEDBACK_LABELS_EN;
}
