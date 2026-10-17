import type { JsonValue } from '@craftkit/builder-schema';

/**
 * Few-shots for AI context assembly — written FOR the model.
 *
 * An item is a heading plus whatever a person puts inside it, so both examples
 * name a real question rather than "Item 1": the assistant learns that the
 * title carries the meaning and the slot carries the answer.
 *
 * Neither sets an open state, because an item has none — the container owns it.
 */
export const accordionItemExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a question about refunds',
    node: {
      type: 'accordionItem',
      props: { title: 'Can I get a refund?' },
    },
  },
  {
    prompt: 'سؤال عن التوصيل',
    node: {
      type: 'accordionItem',
      props: { title: 'كم يستغرق التوصيل؟' },
    },
  },
];
