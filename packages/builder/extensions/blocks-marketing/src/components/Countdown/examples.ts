import type { JsonValue } from '@craftkit/builder-schema';

export const countdownExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'عد تنازلي لافتتاح المتجر الجديد مع زر تسجيل',
    node: {
      type: 'countdown',
      props: {
        eyebrow: 'الافتتاح الكبير',
        heading: 'نفتح أبوابنا قريبًا',
        body: 'خصم ٢٠٪ لأول مئة زائر.',
        target: '2027-01-15T18:00:00+03:00',
        timezoneLabel: 'بتوقيت الرياض',
        dateLanguage: 'ar',
        startsLabel: 'يبدأ',
        endedMessage: 'افتتحنا! نسعد بزيارتكم.',
        daysLabel: 'يوم',
        hoursLabel: 'ساعة',
        minutesLabel: 'دقيقة',
        secondsLabel: 'ثانية',
        remainingLabel: 'الوقت المتبقي',
        actionLabel: 'احجز مكانك',
        actionHref: '/ar/register',
        variant: 'cards',
        tone: 'dark',
      },
    },
  },
  {
    prompt: 'a product launch countdown with a waitlist button',
    node: {
      type: 'countdown',
      props: {
        eyebrow: 'Launch day',
        heading: 'Version 3 lands in',
        target: '2027-02-09T17:00:00Z',
        timezoneLabel: 'UTC',
        endedMessage: 'Version 3 is out — update now.',
        actionLabel: 'Join the waitlist',
        actionHref: '/waitlist',
        showSeconds: true,
        variant: 'cards',
        align: 'center',
        tone: 'light',
      },
    },
  },
  {
    prompt: 'a minimal conference countdown without seconds',
    node: {
      type: 'countdown',
      props: {
        heading: 'Designing for Arabic — the conference',
        body: 'Two days of talks and workshops in Dubai.',
        target: '2027-04-20T09:30:00+04:00',
        timezoneLabel: 'Dubai time (UTC+4)',
        showSeconds: false,
        variant: 'minimal',
        align: 'start',
        width: 'standard',
      },
    },
  },
];
