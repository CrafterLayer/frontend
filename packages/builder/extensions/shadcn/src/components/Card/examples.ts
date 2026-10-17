import type { JsonValue } from '@craftkit/builder-schema';

/**
 * Few-shots for AI context assembly — written FOR the model.
 *
 * Neither carries content in props, and that absence is the lesson: a card's
 * heading, body, and button are CHILD BLOCKS. An example showing text here
 * would teach the shape that makes a button inside a card impossible.
 */
export const cardExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a bordered feature card with a button at the bottom',
    node: {
      type: 'card',
      props: { tone: 'surface', padding: 'regular', radius: 'regular', bordered: true },
    },
  },
  {
    prompt: 'بطاقة داكنة بارزة بدون حدود',
    node: {
      type: 'card',
      props: {
        tone: 'inverse',
        padding: 'roomy',
        radius: 'large',
        bordered: false,
        elevation: 'strong',
      },
    },
  },
];
