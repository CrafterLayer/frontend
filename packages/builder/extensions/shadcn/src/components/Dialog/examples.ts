import type { JsonValue } from '@craftkit/builder-schema';

export const dialogExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'confirmation dialog for publishing a website',
    node: {
      type: 'dialog',
      props: {
        triggerLabel: 'Publish changes',
        title: 'Ready to publish this version?',
        body: 'Your latest changes will become visible to every visitor. You can publish another version at any time.',
        primaryAction: { label: 'Publish now', href: '/publish' },
        secondaryAction: { label: 'Review settings', href: '/settings/publishing' },
        closeLabel: 'Close publish dialog',
        size: 'sm',
        tone: 'surface',
        triggerVariant: 'primary',
        initialFocus: 'close',
        showCloseButton: true,
        closeOnEscape: true,
        closeOnOverlay: true,
        closeOnAction: true,
      },
    },
  },
  {
    prompt: 'نافذة حوار عربية لحجز استشارة',
    node: {
      type: 'dialog',
      props: {
        triggerLabel: 'احجز استشارة',
        title: 'لنبدأ من التحدي الحقيقي',
        body: 'اختر موعداً يناسبك وسنرسل لك أسئلة قصيرة تساعدنا على جعل المكالمة مفيدة من الدقيقة الأولى.',
        primaryAction: { label: 'اختر موعداً', href: '/book' },
        secondaryAction: { label: 'تعرّف على المنهجية', href: '/method' },
        closeLabel: 'أغلق نافذة الحجز',
        size: 'md',
        tone: 'inverse',
        triggerVariant: 'secondary',
        initialFocus: 'primary',
        showCloseButton: true,
        closeOnEscape: true,
        closeOnOverlay: false,
        closeOnAction: true,
      },
    },
  },
];
