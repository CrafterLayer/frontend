import type { JsonValue } from '@craftkit/builder-schema';

/**
 * Few-shots for AI context assembly — written FOR the model.
 *
 * Slot values are node ids: the referenced rich text, navigation, CTA, or
 * stack blocks own all authored content. PageHeader owns only their placement.
 */
export const pageHeaderExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'هيدر بكتلة علامة في البداية وروابط في الوسط وزر في النهاية',
    node: {
      type: 'pageHeader',
      props: {
        layout: 'split',
        background: 'surface',
        textColor: 'text',
      },
      slots: {
        start: ['brand-text'],
        center: ['primary-navigation'],
        end: ['shop-action'],
      },
    },
  },
  {
    prompt: 'a dark sticky header whose three regions are independently replaceable',
    node: {
      type: 'pageHeader',
      props: {
        layout: 'navStart',
        sticky: true,
        translucent: true,
        background: 'surfaceInverse',
        textColor: 'textInverse',
        width: 'wide',
      },
      slots: {
        start: ['identity-group'],
        center: ['section-links'],
        end: ['account-actions'],
      },
    },
  },
];
