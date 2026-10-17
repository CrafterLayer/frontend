import type { CSSProperties } from 'react';
import { z } from 'zod';

import type { BlockPropertyGroup } from '@craftkit/builder-schema';

/**
 * Per-block colour, shared by every marketing section.
 *
 * Two decisions are worth stating, because both are the reason this file exists
 * rather than the same six lines copied into eight schemas.
 *
 * **Roles, not values.** A document may not contain a colour literal —
 * `packages/builder/schema/src/style-values.ts` refuses hex outright — so what a
 * person picks is a ROLE and what lands in the document is the role's name.
 * Re-pointing the theme then repaints every page ever authored, which is the
 * whole reason the refusal is worth its inconvenience.
 *
 * **Optional, with no default.** A default here would repaint every existing
 * page the moment this shipped: a hero that has always been transparent would
 * quietly acquire a surface ground because a new property arrived with an
 * opinion. Undefined means "the section's tone decides", which is exactly what
 * every document written before today already relies on.
 */
export const sectionBackgrounds = ['surface', 'surfaceInverse', 'accent'] as const;
export const sectionTextColors = ['text', 'textInverse', 'textMuted', 'accentText'] as const;

/** The colour half of a section's props. Spread into `z.object({ ... })`. */
export const sectionColorProps = {
  background: z.enum(sectionBackgrounds).optional(),
  textColor: z.enum(sectionTextColors).optional(),
};

/**
 * Where those two land in the inspector.
 *
 * `kind: 'color-role'` is what makes the inspector draw swatches instead of a
 * select. The inspector never infers this from a property being called
 * "background" — a control chosen by name-guessing is a control that silently
 * changes when someone renames a prop.
 */
export const sectionColorGroups: Readonly<Record<string, BlockPropertyGroup>> = {
  background: { tab: 'design', section: 'Colour', kind: 'color-role' },
  textColor: { tab: 'design', section: 'Colour', kind: 'color-role' },
};

/*
  `| undefined` is written out because the workspace runs
  `exactOptionalPropertyTypes`: without it a caller may omit the key but may not
  pass it as undefined, and a block's parsed props do exactly that.
*/
export interface SectionColorProps {
  readonly background?: (typeof sectionBackgrounds)[number] | undefined;
  readonly textColor?: (typeof sectionTextColors)[number] | undefined;
}

/**
 * The inline style a section applies for its chosen roles.
 *
 * Returns `undefined` rather than an empty object when nothing is chosen, so an
 * unstyled section carries no `style` attribute at all and the stylesheet's tone
 * rules win without a specificity fight.
 */
export function sectionColorStyle(props: SectionColorProps): CSSProperties | undefined {
  if (props.background === undefined && props.textColor === undefined) return undefined;
  const style: CSSProperties = {};
  if (props.background !== undefined) style.background = `var(--t-${kebab(props.background)})`;
  if (props.textColor !== undefined) style.color = `var(--t-${kebab(props.textColor)})`;
  return style;
}

/** `surfaceInverse` → `surface-inverse`: the renderer's own token spelling. */
export function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}
