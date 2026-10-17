import { z } from 'zod';

import {
  findRejectedUtilities,
  partStylesProp,
  type BlockPropertyGroup,
  type PartStyle,
} from '@craftkit/builder-schema';

import { sectionSpacings } from './section-options';

/**
 * Per-section customisation, shared by every marketing block.
 *
 * ## Why these two props exist
 *
 * The blocks were fully closed: a section's side padding was a constant in the
 * shared stylesheet, so an edge-to-edge hero was not expressible at all, and
 * anything the schema had not anticipated was simply unavailable. That is a
 * template's contract, not a builder's.
 *
 * `gutter` turns the one constant nobody could reach into a choice.
 * `className` opens the rest — deliberately, and with exactly two refusals.
 */

/**
 * The breathing room at a section's inline edges.
 *
 * `none` is the point of the prop: a hero with a full-bleed image, a gallery
 * that runs to the glass, a coloured band with no inset. Every one of those was
 * impossible while the gutter was baked into the stylesheet.
 */
export const sectionGutters = sectionSpacings;

/**
 * Arbitrary Tailwind, validated.
 *
 * A class string in a document sounds like exactly the literal this project
 * refuses — and it was, until `--spacing` was bound to `--t-space-unit`. With
 * that binding `p-4` compiles to `calc(var(--t-space-unit) * 4)`: four STEPS of
 * the site's rhythm, which is the same shape as every other intent this schema
 * stores.
 *
 * So the string is allowed and only two families are refused: arbitrary values
 * in brackets, and Tailwind's own colour palette. Both are values the design
 * system cannot reach, and everything else — layout, the numeric scale, colour
 * roles, responsive and state variants — is a person or a planner customising
 * the block exactly as far as they like.
 *
 * The refusal happens HERE, at the door, so an invalid class cannot be stored
 * and then discovered when someone looks at the page.
 */
const utilityClassSchema = z
  .string()
  .max(400)
  .refine((value) => findRejectedUtilities(value).length === 0, {
    error: (issue) => {
      const rejections = findRejectedUtilities(String(issue.input));
      return rejections.map((rejection) => rejection.message).join(' ');
    },
  });

/** The customisation half of a section's props. Spread into `z.object({ ... })`. */
export const sectionCustomProps = {
  gutter: z.enum(sectionGutters).optional(),
  className: utilityClassSchema.optional(),
  // ── block-parts (2026-10-06) ──
  /* Per-part classes and direction (block-parts DESIGN §2.2), under the tokens law. */
  partStyles: partStylesProp(),
  // ── /block-parts ──
};

export const sectionCustomGroups: Readonly<Record<string, BlockPropertyGroup>> = {
  gutter: { tab: 'design', section: 'Spacing' },
  /*
    Advanced, not design. A person reaching for raw utilities has left the
    guided controls behind on purpose, and putting this beside the tone picker
    would invite it as a first resort rather than a last one.
  */
  className: { tab: 'advanced', section: 'Custom classes', kind: 'utility-classes' },
  // ── block-parts (2026-10-06) ──
  partStyles: { tab: 'advanced', section: 'Custom classes', kind: 'part-styles' },
  // ── /block-parts ──
};

// ── block-parts (2026-10-06) ──
/*
  The customisation half for CONTAINERS (Grid, Stack, PageHeader, PageFooter):
  the same gutter and classes, no `partStyles`. A container declares no parts,
  so the prop would style nothing and still show as an Inspector row.
*/
export const containerCustomProps = {
  gutter: sectionCustomProps.gutter,
  className: sectionCustomProps.className,
};

export const containerCustomGroups: Readonly<Record<string, BlockPropertyGroup>> = Object.fromEntries(
  Object.entries(sectionCustomGroups).filter(([key]) => key !== 'partStyles'),
);
// ── /block-parts ──

/*
  `| undefined` is written out because the workspace runs
  `exactOptionalPropertyTypes`: without it a caller may omit the key but may not
  pass it as undefined, and a block's parsed props do exactly that.
*/
export interface SectionCustomProps {
  readonly gutter?: (typeof sectionGutters)[number] | undefined;
  readonly className?: string | undefined;
  // ── block-parts (2026-10-06) ──
  readonly partStyles?: Readonly<Record<string, PartStyle>> | undefined;
  // ── /block-parts ──
}
