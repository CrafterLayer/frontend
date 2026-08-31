import type { JsonValue } from '@craftkit/builder-schema';

export const dotPatternSurfaceExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a subtle dot-pattern surface behind a centered call to action',
    node: {
      type: 'dotPatternSurface',
      props: {
        density: 'balanced',
        size: 'fine',
        intensity: 'subtle',
        tone: 'muted',
        fade: 'soft',
        maskPosition: 'center',
        animate: false,
        padding: 'roomy',
        radius: 'large',
      },
    },
  },
  {
    prompt: 'an accent dot field focused on the content start edge',
    node: {
      type: 'dotPatternSurface',
      props: {
        density: 'dense',
        size: 'regular',
        intensity: 'balanced',
        tone: 'accent',
        fade: 'strong',
        maskPosition: 'inlineStart',
        animate: true,
        padding: 'regular',
        radius: 'regular',
      },
    },
  },
  {
    prompt: 'خلفية نقاط عربية هادئة تتركز عند بداية المحتوى',
    node: {
      type: 'dotPatternSurface',
      props: {
        density: 'sparse',
        size: 'bold',
        intensity: 'subtle',
        tone: 'accent',
        fade: 'soft',
        maskPosition: 'inlineStart',
        animate: false,
        padding: 'roomy',
        radius: 'large',
      },
    },
  },
];
