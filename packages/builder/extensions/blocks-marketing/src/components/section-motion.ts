import {
  motionSpecSchema,
  type BlockPropertyGroup,
  type MotionSpec,
} from '@craftkit/builder-schema';

/**
 * Per-section motion, shared by every marketing section.
 *
 * The same shape as `section-color.ts`, for the same reason: eight schemas each
 * carrying their own copy is eight chances for them to disagree.
 *
 * **Named steps, not values.** A document may not contain a timing literal any
 * more than it may contain a colour one. `duration: 'normal'` is a step this
 * project's stylesheet decides the length of; `duration: 300` would be the one
 * part of the design system a theme change could not move. The vocabulary is
 * closed, so an invented effect is refused at the door rather than rendering as
 * a section that silently never animates.
 *
 * **Optional, with no default.** Absence means stillness. A default would set
 * every existing page in motion the moment this shipped, and motion is
 * something a page opts into — not something it has to opt out of.
 */
export const sectionMotionProps = {
  motion: motionSpecSchema.optional(),
};

/**
 * Where motion lands in the inspector.
 *
 * `kind: 'motion'` is what makes the inspector draw the seven-part control
 * instead of falling through to the read-only fallback. As with `color-role`,
 * the inspector never infers this from the property's NAME — a control chosen
 * by name-guessing is a control that silently changes when someone renames a
 * prop.
 */
export const sectionMotionGroups: Readonly<Record<string, BlockPropertyGroup>> = {
  motion: { tab: 'design', section: 'Motion', kind: 'motion' },
};

/*
  `| undefined` is written out because the workspace runs
  `exactOptionalPropertyTypes`: without it a caller may omit the key but may not
  pass it as undefined, and a block's parsed props do exactly that.
*/
export interface SectionMotionProps {
  readonly motion?: MotionSpec | undefined;
}
