/**
 * Utility classes a DOCUMENT may hold.
 *
 * ## Why this is allowed at all
 *
 * The first version of this project banned every Tailwind class from a
 * document, on the grounds that `p-4` is a literal. That was wrong, and the
 * reason it was wrong is worth stating precisely: in Tailwind v4 the numeric
 * scale multiplies `--spacing`, and this workspace binds `--spacing` to
 * `--t-space-unit`. So `p-4` compiles to `calc(var(--t-space-unit) * 4)`. It is
 * FOUR STEPS of the site's own rhythm, not sixteen pixels — exactly the shape
 * the intent-only law already permits, since `style-values.ts` refuses `'16px'`
 * and accepts `4`.
 *
 * Banning the whole system to catch two bad cases cost every block the ability
 * to be customised at all.
 *
 * ## What is refused, and why each one
 *
 * Two families, and only two:
 *
 * 1. **Arbitrary values** — `p-[17px]`, `bg-[#ff0000]`, `w-[42rem]`. A length
 *    or a colour wearing brackets. Nothing behind it moves when a theme
 *    changes, which is the entire failure this rule exists to prevent.
 * 2. **The default palette** — `bg-blue-500`, `text-gray-700`. A real colour
 *    with no token behind it, and no binding can give it one. This is the one
 *    that quietly destroys a generated site's identity: a page half in brand
 *    colours and half in Tailwind blue reads as broken rather than as themed.
 *
 * Everything else is permitted, including responsive and state variants, which
 * is what makes a block genuinely customisable: `sm:flex-row`, `lg:p-8`,
 * `hover:bg-accent`, `dark:text-text-inverse`.
 */

export type UtilityRejectionCode = 'arbitrary-value' | 'default-palette';

export interface UtilityRejection {
  /** The offending class, exactly as written. */
  utility: string;
  code: UtilityRejectionCode;
  message: string;
}

/**
 * Tailwind's built-in colour families.
 *
 * Listed rather than pattern-matched on "word-number", because `grid-cols-3`,
 * `gap-4`, and `z-10` all have that shape and every one of them is fine.
 */
const DEFAULT_PALETTE_FAMILIES = [
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

/*
  A default-palette colour, with any variant prefix and any opacity suffix:
  `hover:bg-blue-500`, `text-gray-700/50`, `dark:border-rose-300`.
*/
const DEFAULT_PALETTE = new RegExp(
  `(?:^|:)-?[a-z-]+-(?:${DEFAULT_PALETTE_FAMILIES.join('|')})-\\d{2,3}(?:/\\d{1,3})?$`,
);

/** Anything in square brackets is a value the theme cannot reach. */
const ARBITRARY_VALUE = /\[[^\]]*\]/;

/** Split a class attribute the way a browser does. */
export function splitUtilities(value: string): string[] {
  return value.split(/\s+/).filter((utility) => utility !== '');
}

/**
 * Every reason this class list may not be stored in a document.
 *
 * Returns an empty array for an acceptable list, so a caller reads it the same
 * way it reads every other validator in this package.
 */
export function findRejectedUtilities(value: string): UtilityRejection[] {
  const rejections: UtilityRejection[] = [];

  for (const utility of splitUtilities(value)) {
    if (ARBITRARY_VALUE.test(utility)) {
      rejections.push({
        utility,
        code: 'arbitrary-value',
        message: `"${utility}" hard-codes a value in brackets. Nothing behind it moves when the theme changes — use a scale step such as p-4, or a token such as bg-accent.`,
      });
      continue;
    }

    if (DEFAULT_PALETTE.test(utility)) {
      rejections.push({
        utility,
        code: 'default-palette',
        message: `"${utility}" uses Tailwind's own palette, which the site's design system cannot reach. Use a colour role such as bg-accent, text-text-muted, or bg-surface-inverse.`,
      });
    }
  }

  return rejections;
}

/** Whether a class list may be stored in a document. */
export function isStorableUtilityClass(value: string): boolean {
  return findRejectedUtilities(value).length === 0;
}
