/**
 * The tokens-mode verdict on stored classes (style-manager DESIGN.md §A.2).
 *
 * Registered blocks keep the theming law: their `className` prop is checked by
 * `findRejectedUtilities` at the door. The engine, writing into such a prop in
 * `tokens` mode, must never produce a class that door refuses — so it asks the
 * same two questions here, from its own parse of the class, and a parity test
 * (`tokens-mode.test.ts`) holds both verdicts equal on a fixture list.
 *
 * One deliberate difference: a CSS-variable utility (`bg-(--ck-c-brand)`) has
 * no brackets, so the door's denylist lets it through, but it is not a theme
 * token, and tokens mode refuses it. The engine is stricter, never looser.
 */
import { DEFAULT_PALETTE_FAMILIES } from './palette-families';
import { parseClass, splitClassList } from './class-syntax';

export type TokensModeRejectionCode = 'arbitrary-value' | 'default-palette' | 'css-variable';

export interface TokensModeRejection {
  readonly utility: string;
  readonly code: TokensModeRejectionCode;
  readonly message: string;
}

const BRACKETED = /\[[^\]]*\]/u;
const PALETTE_UTILITY = new RegExp(
  `^-?[a-z-]+-(?:${DEFAULT_PALETTE_FAMILIES.join('|')})-\\d{2,3}(?:/\\d{1,3})?$`,
  'u',
);
const CSS_VARIABLE = /\((?:[a-z-]+:)?--[A-Za-z0-9_-]+\)/u;

/** Every class in the list tokens mode refuses, with the reason. */
export function tokensModeRejections(className: string): TokensModeRejection[] {
  const rejections: TokensModeRejection[] = [];
  for (const utility of splitClassList(className)) {
    const { base } = parseClass(utility);
    if (BRACKETED.test(utility)) {
      rejections.push({
        utility,
        code: 'arbitrary-value',
        message: `"${utility}" holds an exact value in brackets; tokens mode takes theme tokens and scale steps only.`,
      });
    } else if (PALETTE_UTILITY.test(base)) {
      rejections.push({
        utility,
        code: 'default-palette',
        message: `"${utility}" uses Tailwind's own palette; tokens mode takes colour roles such as bg-accent.`,
      });
    } else if (CSS_VARIABLE.test(base)) {
      rejections.push({
        utility,
        code: 'css-variable',
        message: `"${utility}" reads a CSS variable; tokens mode takes theme tokens only.`,
      });
    }
  }
  return rejections;
}
