import type { JsonValue } from '@craftkit/builder-schema';

/** Few-shots for AI context assembly — content is composed through slots. */
export const pageFooterExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'فوتر مقسوم مع صف سفلي منفصل',
    node: {
      type: 'pageFooter',
      props: {
        layout: 'split',
        bottomBar: true,
        align: 'start',
        spacing: 'lg',
        width: 'wide',
      },
    },
  },
  {
    prompt: 'a dark centered footer container',
    node: {
      type: 'pageFooter',
      props: {
        layout: 'centered',
        background: 'surfaceInverse',
        textColor: 'textInverse',
        spacing: 'lg',
      },
    },
  },
];
