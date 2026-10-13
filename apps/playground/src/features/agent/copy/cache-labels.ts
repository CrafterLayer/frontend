/**
 * Why a request wrote the prompt cache instead of reading it (2026-10-13), in both languages:
 * the line under a run's usage that turns "cache read 0" into a cause the person can act on.
 * The server names the cause (ai-server cache-doctor.ts); this says it. Kept beside the
 * catalog, like `site-labels.ts`: the catalog files are at their size limit.
 */
import type { AiCacheMiss, AiCacheMissReason } from '@craftkit/builder';

import type { Locale } from '../model/view-types';

import { formatNumber } from './format';

const EN: Readonly<Record<AiCacheMissReason, string>> = {
  first: 'the first request of its kind since the server started',
  expired: 'the last one was over an hour ago, so its cache had expired',
  model: 'a different model answered than last time',
  settings: 'the thinking or effort setting changed since the last request',
  rules: 'the assistant’s rules changed',
  catalog: 'the selection changed the blocks the assistant was shown',
  skills: 'different skills woke for these words',
  system: 'the instructions changed',
  tools: 'the tools changed',
  history: 'the conversation before this message changed',
  unknown: 'the same prompt was sent, but the provider did not keep it (another route or region)',
};

const AR: Readonly<Record<AiCacheMissReason, string>> = {
  first: 'أول طلب من نوعه منذ تشغيل الخادم',
  expired: 'مرّ أكثر من ساعة على الطلب السابق فانتهت صلاحية الكاش',
  model: 'أجاب نموذج غير الذي أجاب في المرة السابقة',
  settings: 'تغيّر إعداد التفكير أو الجهد منذ الطلب السابق',
  rules: 'تغيّرت قواعد المساعد',
  catalog: 'غيّر التحديد العناصر التي عُرضت على المساعد',
  skills: 'نشطت مهارات مختلفة لهذه الكلمات',
  system: 'تغيّرت التعليمات',
  tools: 'تغيّرت الأدوات',
  history: 'تغيّرت المحادثة السابقة لهذه الرسالة',
  unknown: 'أُرسل البرومبت نفسه لكن المزوّد لم يحتفظ به (مسار أو منطقة أخرى)',
};

/** "Cache not read: …", with the tokens it would have saved when the API said. */
export function cacheMissLine(locale: Locale, miss: AiCacheMiss): string {
  const arabic = locale === 'ar';
  const why = (arabic ? AR : EN)[miss.reason];
  const tokens =
    miss.missedTokens === null
      ? ''
      : arabic
        ? ` (نحو ${formatNumber(locale, miss.missedTokens)} توكن)`
        : ` (~${formatNumber(locale, miss.missedTokens)} tokens)`;
  return arabic ? `لم يُقرأ الكاش: ${why}${tokens}.` : `Cache not read: ${why}${tokens}.`;
}
