import {
  customCodeClassNames,
  customCodeIconNames,
  customCodeTreeSchema,
  isCustomCodeIconName,
} from '../custom-code/custom-code-tree';
import { findCssRejection } from '../custom-code/custom-css';
import { unknownUtilityClasses } from '../custom-code/utility-vocabulary';
import type { MediaRecipe } from './types';

/**
 * Every reason the AI door would refuse a recipe, as sentences: the tree
 * schema (tags, attributes, pairs, content model), classes no utility or hook
 * generates, icon names no set has, and a refused stylesheet. Empty means the
 * recipe goes through. The builders' tests assert it for every output; a tool
 * may call it as a last guard before it emits steps.
 */
export function mediaRecipeProblems(recipe: MediaRecipe): readonly string[] {
  const problems: string[] = [];
  const parsed = customCodeTreeSchema.safeParse(recipe.tree);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      problems.push(`${issue.path.map(String).join('.')}: ${issue.message}`);
    }
  }
  for (const className of customCodeClassNames(recipe.tree)) {
    for (const unknown of unknownUtilityClasses(className)) problems.push(`unknown class ${unknown}`);
  }
  for (const name of customCodeIconNames(recipe.tree)) {
    if (!isCustomCodeIconName(name)) problems.push(`unknown icon ${name}`);
  }
  const css = findCssRejection(recipe.css);
  if (css !== undefined) problems.push(`css refused: ${css.reason}`);
  return problems;
}
