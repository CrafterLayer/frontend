import type { JsonValue } from '@craftkit/builder-schema';

/** Few-shot examples for AI context assembly. */
export const gridExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'شبكة من ثلاثة أعمدة متساوية',
    node: {
      type: 'grid',
      props: {
        columns: '3',
        gap: 'md',
        align: 'start',
        justify: 'start',
        flow: 'row',
        width: 'wide',
      },
    },
  },
  {
    prompt: 'a dense four-column grid with generous gaps',
    node: {
      type: 'grid',
      props: {
        columns: '4',
        gap: 'lg',
        align: 'start',
        justify: 'center',
        flow: 'dense',
        width: 'wide',
      },
    },
  },
];
