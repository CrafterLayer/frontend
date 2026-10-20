import type { ErrorClass } from '../model/view-types';
import type { Key } from './keys';

export const FOLLOWUP_KEYS = [
  'followup.chooseTarget',
  'error.sourceChanged.title',
  'error.sourceChanged.cause',
] as const;

export const FOLLOWUP_EN = {
  'followup.chooseTarget':
    'Which existing item should change? Select it on the canvas or mention it, then send the request again.',
  'error.sourceChanged.title': 'Your newer changes were kept',
  'error.sourceChanged.cause':
    'The content changed while this edit was prepared. Try again to use the current version.',
} as const;

export const FOLLOWUP_AR = {
  'followup.chooseTarget':
    'ما العنصر المطلوب تعديله؟ يمكن تحديده على اللوحة أو الإشارة إليه، ثم إرسال الطلب مجددًا.',
  'error.sourceChanged.title': 'حُفظت التعديلات الأحدث',
  'error.sourceChanged.cause':
    'تغيّر المحتوى أثناء إعداد هذا التعديل. يمكن إعادة المحاولة باستخدام النسخة الحالية.',
} as const;

/** ErrorRecord's cause line by class; `unknown` has none (SPEC §4.14). */
export const ERROR_CAUSE_KEY = {
  unreachable: 'error.unreachable.cause',
  timeout: 'error.timeout.cause',
  busy: 'error.busy.cause',
  declined: 'error.declined.cause',
  invalid: 'error.invalid.cause',
  tooLarge: 'error.tooLarge.cause',
  offline: 'error.offline.cause',
  unknown: null,
  sourceChanged: 'error.sourceChanged.cause',
} as const satisfies Readonly<Record<ErrorClass, Key | null>>;
