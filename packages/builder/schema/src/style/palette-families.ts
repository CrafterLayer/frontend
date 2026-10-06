/**
 * Tailwind's built-in colour families.
 *
 * Restated from `blocks/utility-classes.ts` (which keeps its list private) so
 * the engine can recognise `bg-blue-500` as a colour token in free mode and
 * refuse it in tokens mode. `tokens-mode.test.ts` holds the engine's verdict
 * equal to `findRejectedUtilities`, so the two lists cannot drift silently.
 */
export const DEFAULT_PALETTE_FAMILIES = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
] as const;
