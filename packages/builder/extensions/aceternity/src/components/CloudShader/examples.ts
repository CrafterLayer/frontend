import type { JsonValue } from '@craftkit/builder-schema';

/**
 * Few-shots for AI context assembly — written FOR the model.
 *
 * Both carry colour ROLES rather than sky colours, which is the lesson: a
 * cloud field that stored `#3876ba` would be the one section of a generated
 * site the design system could never re-theme.
 */
export const cloudShaderExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a hero over a soft drifting cloudy sky',
    node: {
      type: 'cloudShader',
      props: {
        detail: 'normal',
        coverage: 'scattered',
        speed: 'drifting',
        animate: true,
        minHeight: 'half',
        skyTopColor: 'accent',
        skyBottomColor: 'surface',
        cloudColor: 'textInverse',
      },
    },
  },
  {
    prompt: 'سماء غائمة كثيفة وثابتة خلف العنوان',
    node: {
      type: 'cloudShader',
      props: {
        detail: 'intricate',
        coverage: 'overcast',
        speed: 'still',
        animate: false,
        minHeight: 'screen',
        skyTopColor: 'surfaceInverse',
        skyBottomColor: 'accent',
        cloudColor: 'textInverse',
      },
    },
  },
];
