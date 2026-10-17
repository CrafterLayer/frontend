import type { JsonValue } from '@craftkit/builder-schema';

/**
 * Few-shots for AI context assembly — written FOR the model.
 *
 * Both examples are containers a person actually asks for: a row that becomes
 * columns, and a column that groups things vertically. The assistant reads
 * these to learn what a stack IS, so they name the properties it will need to
 * set rather than showing an empty shell.
 */
export const stackExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'صفّ من عمودين متساويين',
    node: {
      type: 'stack',
      props: {
        direction: 'row',
        justify: 'center',
        align: 'start',
        gap: 'lg',
        wrap: 'wrap',
        width: 'wide',
      },
    },
  },
  {
    prompt: 'a vertical group with tight spacing',
    node: {
      type: 'stack',
      props: {
        direction: 'column',
        justify: 'start',
        align: 'start',
        gap: 'sm',
        wrap: 'nowrap',
        width: 'standard',
      },
    },
  },
];
