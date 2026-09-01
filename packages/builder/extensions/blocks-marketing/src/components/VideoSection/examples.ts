import type { JsonValue } from '@craftkit/builder-schema';

export const videoSectionExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a premium split video section with a silent motion study and a CTA',
    node: {
      type: 'videoSection',
      props: {
        eyebrow: 'Motion, with restraint',
        heading: 'Preview a focused visual story without distracting the page',
        body: 'This silent nature study demonstrates responsive framing and native playback while final campaign media is prepared.',
        src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        videoLabel: 'Silent close-up motion study of a flower',
        caption: 'A silent macro nature study used as a playback-ready example.',
        cta: { label: 'Explore the workflow', href: '#workflow', newTab: false },
        layout: 'split',
        mediaPosition: 'end',
        videoFit: 'cover',
        preload: 'metadata',
        muted: true,
        loop: true,
        align: 'start',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
      },
    },
  },
  {
    prompt: 'قسم فيديو عربي مركزي لعرض قصة علامة تجارية',
    node: {
      type: 'videoSection',
      props: {
        eyebrow: 'حركة هادئة',
        heading: 'مشهد بصري يحافظ على التركيز ويمنح الصفحة إيقاعاً أجمل',
        body: 'دراسة طبيعية صامتة توضّح طريقة عرض الفيديو المتجاوب قبل إضافة الفيلم النهائي للحملة.',
        src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        videoLabel: 'دراسة حركة صامتة مقرّبة لزهرة',
        caption: 'مشهد طبيعي صامت ومجهّز لتجربة تشغيل الفيديو.',
        cta: { label: 'اكتشف المجموعة', href: '/collection', newTab: false },
        layout: 'centered',
        mediaPosition: 'end',
        videoFit: 'contain',
        preload: 'metadata',
        muted: true,
        loop: true,
        align: 'center',
        tone: 'dark',
        spacing: 'lg',
        width: 'wide',
      },
    },
  },
];
