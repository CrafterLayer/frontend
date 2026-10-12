/**
 * The words of "Background jobs" (2026-10-12), in both languages: the header button, the
 * jobs list, the form that starts a job and the per-page results. Kept beside the catalog
 * rather than in it, like `knowledge-labels.ts`: the catalog files are at their size limit
 * and these strings belong to one surface. Digits stay Latin in both languages, and Arabic
 * page counts agree with their number (`arabicCount`).
 */
import type { JobPageStatus, JobPhase } from '../../jobs';
import { AR_PAGES, arabicCount } from '../../preview/arabic-count';
import type { Locale } from '../model/view-types';

export interface JobsLabels {
  readonly title: string;
  readonly close: string;
  /** The header button's second line: answers waiting, batches still answering. */
  readonly openHint: (ready: number, active: number) => string | undefined;
  readonly intro: string;
  /** The list's primary action, and the form's heading. */
  readonly start: string;
  readonly formTitle: string;
  readonly halfPrice: string;
  readonly refreshAll: string;
  readonly loading: string;
  readonly empty: string;
  readonly emptyHint: string;
  /** No assistant server at all: the offline provider cannot batch. */
  readonly noServer: string;
  /** Above the server's own sentence when it cannot batch (501, 409). */
  readonly unavailable: string;
  readonly fallback: string;
  readonly form: {
    readonly back: string;
    readonly request: string;
    readonly requestPlaceholder: string;
    readonly fromDraft: string;
    readonly pages: string;
    readonly allPages: (count: number) => string;
    readonly choosePages: string;
    readonly current: string;
    readonly selectAll: string;
    readonly selectNone: string;
    readonly selected: (count: number, total: number) => string;
    readonly priceNote: string;
    readonly submit: string;
    readonly submitting: string;
    readonly cancel: string;
    readonly needsRequest: string;
    readonly needsPages: string;
    readonly tooMany: (max: number) => string;
    readonly submitted: string;
  };
  readonly row: {
    readonly pages: (count: number) => string;
    readonly phase: Readonly<Record<JobPhase, string>>;
    readonly progress: (answered: number, total: number) => string;
    readonly progressLabel: string;
    readonly missed: (count: number) => string;
    readonly canceled: (count: number) => string;
    readonly refresh: (request: string) => string;
    readonly cancel: string;
    readonly apply: string;
    readonly applying: string;
    readonly review: string;
    readonly remove: string;
    readonly removeMessage: string;
    readonly keep: string;
    readonly removeLabel: (request: string) => string;
    readonly results: string;
    readonly summary: (applied: number, total: number) => string;
  };
  readonly outcome: {
    readonly status: Readonly<Record<JobPageStatus, string>>;
    readonly appliedHint: string;
    readonly salvaged: (kept: number, dropped: number) => string;
    readonly moreIssues: (count: number) => string;
    readonly retryable: string;
    readonly retryLive: string;
    readonly retryLiveLabel: (page: string) => string;
    readonly retried: string;
  };
}

const EN: JobsLabels = {
  title: 'Background jobs',
  close: 'Close',
  openHint: (ready, active) =>
    ready > 0
      ? `${String(ready)} ready to apply`
      : active > 0
        ? `${String(active)} in progress`
        : undefined,
  intro:
    'Send one request to several pages as a background batch, at half the price of a live run. Answers take minutes, sometimes longer.',
  start: 'Run on several pages',
  formTitle: 'Run on several pages in the background',
  halfPrice: 'Half price',
  refreshAll: 'Refresh',
  loading: 'Reading jobs…',
  empty: 'No background jobs yet.',
  emptyHint: 'A change across many pages costs half as much here.',
  noServer:
    'Background jobs run on the assistant server, and this editor has none connected. Live requests still work.',
  unavailable: 'This server cannot run background jobs:',
  fallback: 'That did not work. Try again in a moment.',
  form: {
    back: 'All jobs',
    request: 'Request',
    requestPlaceholder: 'Translate every page into French',
    fromDraft: 'From your message',
    pages: 'Pages',
    allPages: (count) => `All pages (${String(count)})`,
    choosePages: 'Choose pages',
    current: 'Open now',
    selectAll: 'Select all',
    selectNone: 'Clear',
    selected: (count, total) => `${String(count)} of ${String(total)} selected`,
    priceNote:
      'Answers usually arrive within minutes and always within 24 hours; you can close the editor meanwhile. Each page then lands as its own Undo.',
    submit: 'Run in the background',
    submitting: 'Sending…',
    cancel: 'Cancel',
    needsRequest: 'Write the request first.',
    needsPages: 'Choose at least one page.',
    tooMany: (max) => `A job asks at most ${String(max)} pages.`,
    submitted: 'Sent. The job is at the top of the list.',
  },
  row: {
    pages: (count) => (count === 1 ? '1 page' : `${String(count)} pages`),
    phase: {
      'in-progress': 'In progress',
      canceling: 'Canceling',
      ready: 'Ready to apply',
      canceled: 'Canceled',
      failed: 'Failed',
      applied: 'Applied',
    },
    progress: (answered, total) => `${String(answered)} of ${String(total)} answered`,
    progressLabel: 'Pages answered',
    missed: (count) => `No answer: ${String(count)}`,
    canceled: (count) => `Canceled: ${String(count)}`,
    refresh: (request) => `Refresh “${request}”`,
    cancel: 'Cancel job',
    apply: 'Apply results',
    applying: 'Applying…',
    review: 'Show pages',
    remove: 'Remove',
    removeMessage: 'Remove this job from the list? Pages already applied stay as they are.',
    keep: 'Keep',
    removeLabel: (request) => `Remove “${request}”`,
    results: 'Results',
    summary: (applied, total) => `${String(applied)} of ${String(total)} pages applied`,
  },
  outcome: {
    status: {
      applied: 'Applied',
      refused: 'Declined',
      invalid: 'Unreadable answer',
      rejected: 'Failed the checks',
      error: 'No answer',
      missing: 'Page removed',
      skipped: 'Not sent',
    },
    appliedHint: 'One Undo takes this page back.',
    salvaged: (kept, dropped) =>
      `Applied in part: ${String(kept)} kept, ${String(dropped)} left out.`,
    moreIssues: (count) => `And ${String(count)} more.`,
    retryable: 'It may work if sent again.',
    retryLive: 'Retry live',
    retryLiveLabel: (page) => `Retry “${page}” live`,
    retried: 'Sent to the chat',
  },
};

const AR: JobsLabels = {
  title: 'المهام في الخلفية',
  close: 'إغلاق',
  openHint: (ready, active) =>
    ready > 0
      ? `جاهزة للتطبيق: ${String(ready)}`
      : active > 0
        ? `قيد التنفيذ: ${String(active)}`
        : undefined,
  intro:
    'أرسل طلبًا واحدًا إلى عدة صفحات كدفعة في الخلفية، بنصف سعر التشغيل المباشر. تصل الإجابات خلال دقائق، وقد تتأخر أحيانًا.',
  start: 'شغّل على عدة صفحات',
  formTitle: 'شغّل على عدة صفحات في الخلفية',
  halfPrice: 'نصف السعر',
  refreshAll: 'تحديث',
  loading: 'جارٍ قراءة المهام…',
  empty: 'لا مهام في الخلفية بعد.',
  emptyHint: 'التعديل على صفحات كثيرة يكلّف هنا النصف.',
  noServer:
    'تعمل المهام في الخلفية على خادم المساعد، ولا خادم متصل بهذا المحرر. الطلبات المباشرة تعمل كالمعتاد.',
  unavailable: 'لا يستطيع هذا الخادم تشغيل مهام في الخلفية:',
  fallback: 'لم ينجح ذلك. حاول مرة أخرى بعد قليل.',
  form: {
    back: 'كل المهام',
    request: 'الطلب',
    requestPlaceholder: 'ترجم كل الصفحات إلى الفرنسية',
    fromDraft: 'من رسالتك',
    pages: 'الصفحات',
    allPages: (count) => `كل الصفحات (${String(count)})`,
    choosePages: 'اختر الصفحات',
    current: 'المفتوحة الآن',
    selectAll: 'تحديد الكل',
    selectNone: 'مسح',
    selected: (count, total) => `المحدد: ${String(count)} من ${String(total)}`,
    priceNote:
      'تصل الإجابات عادةً خلال دقائق، وفي كل الأحوال خلال 24 ساعة، ويمكنك إغلاق المحرر في الأثناء. ثم تُطبَّق كل صفحة كخطوة تراجع مستقلة.',
    submit: 'شغّل في الخلفية',
    submitting: 'جارٍ الإرسال…',
    cancel: 'إلغاء',
    needsRequest: 'اكتب الطلب أولًا.',
    needsPages: 'اختر صفحة واحدة على الأقل.',
    tooMany: (max) => `الحد الأقصى للمهمة: ${String(max)} صفحة.`,
    submitted: 'أُرسلت. المهمة في أعلى القائمة.',
  },
  row: {
    pages: (count) => arabicCount(count, AR_PAGES),
    phase: {
      'in-progress': 'قيد التنفيذ',
      canceling: 'جارٍ الإلغاء',
      ready: 'جاهزة للتطبيق',
      canceled: 'أُلغيت',
      failed: 'فشلت',
      applied: 'طُبّقت',
    },
    progress: (answered, total) => `أُجيب عن ${String(answered)} من ${String(total)}`,
    progressLabel: 'الصفحات المجاب عنها',
    missed: (count) => `بلا إجابة: ${String(count)}`,
    canceled: (count) => `أُلغي: ${String(count)}`,
    refresh: (request) => `حدّث «${request}»`,
    cancel: 'ألغِ المهمة',
    apply: 'طبّق النتائج',
    applying: 'جارٍ التطبيق…',
    review: 'اعرض الصفحات',
    remove: 'احذف',
    removeMessage: 'أتحذف هذه المهمة من القائمة؟ الصفحات المطبّقة تبقى كما هي.',
    keep: 'أبقِها',
    removeLabel: (request) => `احذف «${request}»`,
    results: 'النتائج',
    summary: (applied, total) => `طُبّق على ${String(applied)} من ${String(total)}`,
  },
  outcome: {
    status: {
      applied: 'طُبّقت',
      refused: 'اعتذر النموذج',
      invalid: 'إجابة غير مقروءة',
      rejected: 'لم تجتز الفحص',
      error: 'لا إجابة',
      missing: 'حُذفت الصفحة',
      skipped: 'لم تُرسل',
    },
    appliedHint: 'تراجع واحد يعيد هذه الصفحة.',
    salvaged: (kept, dropped) => `طُبّقت جزئيًا: أُبقي ${String(kept)} وتُرك ${String(dropped)}.`,
    moreIssues: (count) => `ومشكلات أخرى: ${String(count)}.`,
    retryable: 'قد تنجح إن أُرسلت مرة أخرى.',
    retryLive: 'أعد مباشرة',
    retryLiveLabel: (page) => `أعد «${page}» مباشرة`,
    retried: 'أُرسلت إلى المحادثة',
  },
};

export function jobsLabels(locale: Locale): JobsLabels {
  return locale === 'ar' ? AR : EN;
}
