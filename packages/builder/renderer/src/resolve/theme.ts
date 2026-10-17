/**
 * The page's token vocabulary — now OWNED by `@craftkit/builder-schema`.
 *
 * The types moved down to layer 0 in feature 013 because the AI planner is
 * layer 2, the renderer is layer 2, and ADR 0003 forbids sideways edges: the
 * planner could not import the vocabulary it generates. See
 * `packages/builder/schema/src/theme/tokens.ts` for the vocabulary itself and
 * the reasoning behind each group.
 *
 * Everything is re-exported here, so every existing import of
 * `ColorToken`, `MeasurementToken`, `TokenName`, `Theme`, or `tokenCssName`
 * from this module keeps working. New code should prefer the schema.
 *
 * `themeToCssVars` stays: serialising a theme into a `:root` rule is a
 * RENDERING concern, and layer 0 has no business knowing that a preview frame
 * exists.
 */
export {
  tokenCssName,
  type ColorToken,
  type MeasurementToken,
  type Theme,
  type TokenName,
} from '@craftkit/builder-schema';

import {
  tokenCssName,
  type DesignSystem,
  type Theme,
  type TokenName,
} from '@craftkit/builder-schema';

/** Serialize a theme into one managed `:root { … }` rule for the preview frame. */
export function themeToCssVars(theme: Theme): string {
  const declarations = (Object.entries(theme) as [TokenName, string][])
    .map(([name, value]) => `${tokenCssName(name)}: ${value};`)
    .join(' ');
  return `:root { ${declarations} }`;
}

/**
 * The custom properties a SITE paints its pages with (FR-012).
 *
 * ## Why the site is the source and not a named theme
 *
 * A site's design system IS its palette — generated for that business, checked
 * for contrast, stored with it. Painting its pages from `lightTheme` instead
 * would mean the system a person can see in the panel and the colours actually
 * on the canvas came from two different places, and only one of them was ever
 * validated.
 *
 * ## Why one rule above the pages, and not per page
 *
 * Custom properties inherit. Emitting the site's tokens ONCE, above every page,
 * is what makes "change a token, every page follows" true without regenerating
 * a single document — the pages hold no colours to regenerate. A per-page rule
 * would turn one token edit into N document writes and N undo steps.
 */
export function designSystemToCssVars(system: DesignSystem): string {
  return themeToCssVars(system.tokens);
}

/**
 * The site's tokens with a caller's explicit overrides on top.
 *
 * Overrides are kept BESIDE the system rather than folded into it: they are a
 * person pointing one role somewhere else, not a new design system, and a
 * stored site must not quietly acquire colours nobody generated for it.
 */
export function themeFromDesignSystem(system: DesignSystem, overrides: Partial<Theme> = {}): Theme {
  return { ...system.tokens, ...overrides };
}
