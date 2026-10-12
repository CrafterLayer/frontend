import { arabicCount } from '../../arabic-count';

/** Every string the restore-point panel shows or announces; the host picks EN or AR. */
export interface HistoryPanelLabels {
  readonly region: string;
  readonly title: string;
  readonly intro: string;
  readonly name: string;
  readonly namePlaceholder: string;
  readonly save: string;
  readonly status: string;
  readonly unreadable: string;
  readonly empty: string;
  /** The restore button's accessible name: it contains the visible word (WCAG 2.5.3). */
  readonly restoreNamed: (label: string) => string;
  readonly restore: string;
  readonly clear: string;
  /** The name a restore point gets when none was typed. */
  readonly defaultName: (number: number) => string;
  readonly saved: (label: string) => string;
  readonly saveFailed: string;
  readonly readFailed: (label: string) => string;
  readonly gone: (label: string) => string;
  readonly restoreFailed: (label: string, reason: string) => string;
  readonly restored: (label: string) => string;
  readonly alreadyMatches: (label: string) => string;
  readonly cleared: string;
  readonly clearFailed: string;
  readonly justNow: string;
  readonly minutesAgo: (minutes: number) => string;
  readonly hoursAgo: (hours: number) => string;
  readonly daysAgo: (days: number) => string;
  /** A size with its unit; `value` is already formatted with Latin digits. */
  readonly size: (value: string, unit: 'B' | 'kB' | 'MB') => string;
}

export const HISTORY_PANEL_LABELS_EN: HistoryPanelLabels = {
  region: 'History',
  title: 'History',
  intro:
    'A restore point keeps the whole page. Restoring one is a single change, so a single undo puts it back.',
  name: 'Name',
  namePlaceholder: 'Before the rewrite',
  save: 'Save restore point',
  status: 'History status',
  unreadable:
    'Your restore points could not be read — storage refused. They have not been deleted; try again in a moment.',
  empty:
    'Nothing kept yet. Save a restore point before a big change and this is where you come back to it.',
  restoreNamed: (label) => `Restore ${label}`,
  restore: 'Restore',
  clear: 'Clear history',
  defaultName: (number) => `Restore point ${String(number)}`,
  saved: (label) => `Saved “${label}”.`,
  saveFailed: 'That restore point could not be saved — storage refused it.',
  readFailed: (label) => `“${label}” could not be read — storage refused it. Nothing has changed.`,
  gone: (label) => `“${label}” is no longer stored.`,
  restoreFailed: (label, reason) => `“${label}” could not be restored: ${reason}`,
  restored: (label) => `Restored “${label}”. One undo puts it back.`,
  alreadyMatches: (label) => `The page already matches “${label}” — nothing to change.`,
  cleared: 'History cleared.',
  clearFailed: 'The history could not be cleared — storage refused it.',
  justNow: 'just now',
  minutesAgo: (minutes) => `${String(minutes)} min ago`,
  hoursAgo: (hours) => `${String(hours)} h ago`,
  daysAgo: (days) => `${String(days)} d ago`,
  size: (value, unit) => `${value} ${unit}`,
};

const AR_UNITS: Readonly<Record<'B' | 'kB' | 'MB', string>> = {
  B: 'بايت',
  kB: 'كيلوبايت',
  MB: 'ميغابايت',
};

export const HISTORY_PANEL_LABELS_AR: HistoryPanelLabels = {
  region: 'السجل',
  title: 'السجل',
  intro: 'تحفظ نقطة الاستعادة الصفحة كاملة. واستعادتها تغيير واحد، فتراجع واحد يلغي الاستعادة.',
  name: 'الاسم',
  namePlaceholder: 'قبل إعادة الكتابة',
  save: 'حفظ نقطة استعادة',
  status: 'حالة السجل',
  unreadable:
    'تعذّرت قراءة نقاط الاستعادة لأن التخزين رفض الطلب. لم تُحذف، ويمكن المحاولة بعد لحظات.',
  empty: 'لا شيء محفوظ بعد. نقطة الاستعادة المحفوظة قبل أي تغيير كبير تظهر هنا للعودة إليها.',
  restoreNamed: (label) => `استعادة ${label}`,
  restore: 'استعادة',
  clear: 'مسح السجل',
  defaultName: (number) => `نقطة استعادة ${String(number)}`,
  saved: (label) => `حُفظت «${label}».`,
  saveFailed: 'تعذّر حفظ نقطة الاستعادة هذه؛ رفض التخزين الطلب.',
  readFailed: (label) => `تعذّرت قراءة «${label}»؛ رفض التخزين الطلب. لم يتغيّر شيء.`,
  gone: (label) => `لم تعد «${label}» محفوظة.`,
  restoreFailed: (label, reason) => `تعذّرت استعادة «${label}»: ${reason}`,
  restored: (label) => `استُعيدت «${label}». تراجع واحد يلغي الاستعادة.`,
  alreadyMatches: (label) => `الصفحة مطابقة لـ«${label}» أصلًا؛ لا شيء لتغييره.`,
  cleared: 'مُسح السجل.',
  clearFailed: 'تعذّر مسح السجل؛ رفض التخزين الطلب.',
  justNow: 'الآن',
  // After «قبل» the dual is genitive: «قبل دقيقتين».
  minutesAgo: (minutes) =>
    `قبل ${arabicCount(minutes, { one: 'دقيقة', two: 'دقيقتين', few: 'دقائق', many: 'دقيقة' })}`,
  hoursAgo: (hours) =>
    `قبل ${arabicCount(hours, { one: 'ساعة', two: 'ساعتين', few: 'ساعات', many: 'ساعة' })}`,
  daysAgo: (days) =>
    `قبل ${arabicCount(days, { one: 'يوم', two: 'يومين', few: 'أيام', many: 'يومًا', other: 'يوم' })}`,
  size: (value, unit) => `${value} ${AR_UNITS[unit]}`,
};
