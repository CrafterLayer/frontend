import type { JsonValue } from '@craftkit/builder-schema';

export const shimmerButtonExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a premium shimmering primary call to action',
    node: {
      type: 'shimmerButton',
      props: {
        label: 'Start building',
        href: '/signup',
        openInNewTab: false,
        type: 'button',
        tone: 'accent',
        size: 'large',
        width: 'auto',
        align: 'start',
        radius: 'pill',
        speed: 'normal',
        intensity: 'balanced',
        animate: true,
      },
    },
  },
  {
    prompt: 'زر عربي لامع بعرض كامل',
    node: {
      type: 'shimmerButton',
      props: {
        label: 'ابدأ التجربة المجانية',
        href: '/ar/signup',
        openInNewTab: false,
        type: 'button',
        tone: 'inverse',
        size: 'large',
        width: 'full',
        align: 'center',
        radius: 'large',
        speed: 'slow',
        intensity: 'subtle',
        animate: true,
      },
    },
  },
  {
    prompt: 'a static shimmering submit button for a form',
    node: {
      type: 'shimmerButton',
      props: {
        label: 'Send enquiry',
        openInNewTab: false,
        type: 'submit',
        tone: 'surface',
        size: 'medium',
        width: 'auto',
        align: 'end',
        radius: 'large',
        speed: 'brisk',
        intensity: 'strong',
        animate: false,
      },
    },
  },
];
