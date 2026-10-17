import { validateDesignSystem, type DesignSystem } from '@craftkit/builder-schema';

import { StageRejectedError } from './errors';
import { stageRecord } from './shape';
import type { DesignSystemResponse } from '../wire';

/**
 * What the design-system stage must produce.
 *
 * The validator is the schema's own — the same one the theme layer uses — so a
 * palette that passes here is one the product can actually render, including
 * its contrast pairings. Re-implementing the check would produce a second
 * opinion about what a valid design system is, and the day the two disagreed
 * the pipeline would ship a palette the theme refuses.
 */
export function validateStageDesignSystem(response: DesignSystemResponse): DesignSystem {
  const answer = stageRecord(
    'design-system',
    response,
    'A design-system answer must be an object carrying a design system.',
  );
  const result = validateDesignSystem(answer['designSystem']);
  if (!result.ok) {
    throw new StageRejectedError(
      'design-system',
      result.issues.map((issue) => issue.message),
    );
  }
  return result.system;
}
