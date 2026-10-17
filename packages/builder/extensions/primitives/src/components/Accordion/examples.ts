import type { JsonValue } from '@craftkit/builder-schema';

/**
 * Few-shots for AI context assembly — written FOR the model.
 *
 * Both are shapes a person actually asks for, and both SET the properties the
 * assistant will need rather than showing an empty shell: an FAQ, where only
 * one answer should be open at a time, and a specification list, where a reader
 * legitimately wants to compare several sections side by side.
 */
export const accordionExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'an FAQ section',
    node: {
      type: 'accordion',
      props: {
        mode: 'single',
        collapsible: true,
        defaultOpen: 'first',
        motion: { reveal: 'fade-up' },
      },
    },
  },
  {
    prompt: 'قائمة مواصفات المنتج، بحيث يقدر يفتح أكثر من قسم',
    node: {
      type: 'accordion',
      props: { mode: 'multiple', collapsible: true, defaultOpen: 'none' },
    },
  },
];
