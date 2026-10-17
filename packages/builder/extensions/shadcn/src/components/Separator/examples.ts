import type { JsonValue } from '@craftkit/builder-schema';

export const separatorExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a subtle horizontal divider between content sections',
    node: {
      type: 'separator',
      props: {
        orientation: 'horizontal',
        tone: 'subtle',
        style: 'solid',
        spacing: 'regular',
        thickness: 'hairline',
      },
    },
  },
  {
    prompt: 'a labelled accent divider for the next chapter',
    node: {
      type: 'separator',
      props: {
        label: 'Next chapter',
        orientation: 'horizontal',
        tone: 'accent',
        style: 'solid',
        spacing: 'roomy',
        thickness: 'medium',
      },
    },
  },
  {
    prompt: 'فاصل أفقي بعنوان تفاصيل إضافية',
    node: {
      type: 'separator',
      props: {
        label: 'تفاصيل إضافية',
        orientation: 'horizontal',
        tone: 'subtle',
        style: 'dashed',
        spacing: 'regular',
        thickness: 'hairline',
      },
    },
  },
  {
    prompt: 'a strong vertical accent separator',
    node: {
      type: 'separator',
      props: {
        orientation: 'vertical',
        tone: 'accent',
        style: 'solid',
        spacing: 'compact',
        thickness: 'strong',
      },
    },
  },
];
