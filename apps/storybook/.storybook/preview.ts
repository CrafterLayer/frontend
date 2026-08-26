import type { Preview } from '@storybook/react-vite';

import '@craftkit/ui/styles.css';

/**
 * Direction global (008 §10 review fix): stories declaring
 * `globals: { direction: 'rtl' }` were rendering LTR — `direction` is not a
 * Storybook built-in, so nothing applied it. RTL coverage is a standing
 * requirement of this repository, and the RTL stories are the evidence for it.
 */
const preview = {
  initialGlobals: {
    direction: 'ltr',
  },
  globalTypes: {
    direction: {
      description: 'Content direction applied to the story root',
      toolbar: {
        title: 'Direction',
        icon: 'transfer',
        items: [
          { value: 'ltr', title: 'LTR' },
          { value: 'rtl', title: 'RTL' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const direction = context.globals['direction'] === 'rtl' ? 'rtl' : 'ltr';
      // The story's own root carries the direction: logical properties then
      // mirror exactly as they do inside a real RTL document.
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('dir', direction);
      }
      return Story();
    },
  ],
  parameters: {
    a11y: {
      test: 'error',
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
} satisfies Preview;

export default preview;
