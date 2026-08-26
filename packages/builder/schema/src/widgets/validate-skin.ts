import { type BuilderError, builderError } from '../errors';
import { findJsonViolation } from '../json/json-value';
import { SKIN_STATES, type SkinDef } from './contract';

/**
 * The four-state gate: a skin ships only when loading, empty, error, AND success
 * are all present and structurally sound. Rejections name the missing states.
 */
export function validateSkin(skin: SkinDef): BuilderError[] {
  const errors: BuilderError[] = [];

  const missing = SKIN_STATES.filter((state) => {
    const subtree = skin.states[state] as SkinDef['states'][typeof state] | undefined;
    return subtree === undefined;
  });
  if (missing.length > 0) {
    errors.push(
      builderError(
        'widget/missing-states',
        `Skin "${skin.id}" is missing required state(s): ${missing.join(', ')}. All four states ship or the skin does not.`,
        ['states'],
        { missing: [...missing] },
      ),
    );
  }

  for (const state of SKIN_STATES) {
    const subtree = skin.states[state] as SkinDef['states'][typeof state] | undefined;
    if (subtree === undefined) {
      continue;
    }
    if (subtree.nodes[subtree.rootId] === undefined) {
      errors.push(
        builderError(
          'doc/root-missing',
          `Skin "${skin.id}" state "${state}" root "${subtree.rootId}" is not in its nodes.`,
          ['states', state, 'rootId'],
        ),
      );
    }
    const violation = findJsonViolation(subtree.nodes);
    if (violation !== undefined) {
      errors.push(
        builderError(
          violation.kind === 'non-finite-number' ? 'doc/non-finite-number' : 'doc/non-json-value',
          `Skin "${skin.id}" state "${state}" contains non-JSON data (${violation.kind}).`,
          ['states', state, 'nodes', ...violation.path],
        ),
      );
    }
  }

  return errors;
}
