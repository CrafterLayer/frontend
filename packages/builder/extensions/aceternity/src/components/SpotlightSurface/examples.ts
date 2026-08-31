import type { JsonValue } from '@craftkit/builder-schema';

export const spotlightSurfaceExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a restrained Aceternity-inspired spotlight behind a premium hero',
    node: {
      type: 'spotlightSurface',
      props: {
        variant: 'soft',
        position: 'center',
        intensity: 'balanced',
        tone: 'dark',
        minHeight: 'compact',
        animate: true,
      },
    },
  },
  {
    prompt: 'خلفية ضوء مزدوجة لقسم دعوة لاتخاذ إجراء',
    node: {
      type: 'spotlightSurface',
      props: {
        variant: 'dual',
        position: 'start',
        intensity: 'subtle',
        tone: 'light',
        minHeight: 'auto',
      },
    },
  },
];
