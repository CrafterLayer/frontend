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

import { tokenCssName, type Theme, type TokenName } from '@craftkit/builder-schema';

/** Serialize a theme into one managed `:root { … }` rule for the preview frame. */
export function themeToCssVars(theme: Theme): string {
  const declarations = (Object.entries(theme) as [TokenName, string][])
    .map(([name, value]) => `${tokenCssName(name)}: ${value};`)
    .join(' ');
  return `:root { ${declarations} }`;
}
