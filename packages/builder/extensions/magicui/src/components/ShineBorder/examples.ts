import type { JsonValue } from '@craftkit/builder-schema';

/**
 * Few-shots for AI context assembly — written FOR the model.
 *
 * Both put the shine on ONE thing. The block's description says never more than
 * one per page, and an example showing two would teach the opposite of the rule
 * it is meant to reinforce.
 */
export const shineBorderExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'highlight the recommended plan',
    node: {
      type: 'shineBorder',
      props: { speed: 'normal', weight: 'hairline', animate: true },
    },
  },
  {
    prompt: 'إطار لامع هادئ حول زر البدء',
    node: {
      type: 'shineBorder',
      props: { speed: 'slow', weight: 'medium', animate: true },
    },
  },
];
