import type { EffortLevel, EffortSelectionView } from './view-types';

/**
 * The reasoning budget a person may ask a model for (the effort menu), and its default.
 *
 * The five levels are the ones `apps/ai-server` takes in `x-craftkit-ai-effort`
 * (`CALL_EFFORT_LEVELS`), listed shallowest first. `medium` is the default
 * (owner, 2026-10-06): it is what every build ran at before the menu existed, and speed
 * ranks first. `high` and up make the server let the page plan and every section writer
 * think, which is slower and costs more, so they are a choice, never a default.
 */
export const EFFORT_LEVELS: readonly EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max'];
export const DEFAULT_EFFORT: EffortLevel = 'medium';

/** A stored or typed value as a level; `undefined` when it names none of the five. */
export function effortLevel(value: unknown): EffortLevel | undefined {
  return EFFORT_LEVELS.find((level) => level === value);
}

/**
 * The picker's state for the level in force. An unknown or missing level reads as the
 * default, and the picker is `null` when the host takes no budget (`selectable` false).
 */
export function effortSelection(
  selected: EffortLevel | undefined,
  selectable: boolean,
): EffortSelectionView | null {
  if (!selectable) return null;
  return { selected: selected ?? DEFAULT_EFFORT, options: EFFORT_LEVELS };
}
