import { type ColorToken, tokenCssName, type Theme } from './theme';

/**
 * The page's palette, as something a person can be OFFERED.
 *
 * A theme is a flat token assignment, which is all a renderer needs and not
 * nearly enough for a colour control: to draw a picker you have to know which
 * keys are colours at all (`radius` and `gap` are not), what to call each one to
 * a person, and which are foregrounds meant to sit on which grounds.
 *
 * The reason this exists rather than a free colour picker: a document may not
 * contain a colour LITERAL. `packages/builder/schema/src/style-values.ts`
 * rejects hex outright, and that refusal is what makes a page re-themeable at
 * all — every block references a role, and re-pointing the role repaints the
 * whole page. So the picker offers ROLES, and what lands in the document is the
 * role's name. The hex below is only ever used to draw the swatch.
 */

/**
 * The theme's colour half, named rather than subtracted.
 *
 * It was once `Exclude<TokenName, 'radius' | 'gap'>`, which quietly meant "every
 * token we have not thought to remove" — so the first measurement token anyone
 * added would have arrived in the colour picker as a role. `ColorToken` states
 * the membership instead, and `ROLE_NAMES` below still fails to compile if a
 * colour is added without a human-readable name.
 */
export type ColorRole = ColorToken;

export interface PaletteEntry {
  /** What the document stores. Never a colour value. */
  readonly role: ColorRole;
  /** What a person reads in the picker. */
  readonly name: string;
  /** Resolved value for the swatch only — never written to a document. */
  readonly value: string;
  /** The custom property a block reads, e.g. `--t-accent`. */
  readonly cssVar: string;
  /** Whether this role is ink or a ground, which is what makes a pairing legible. */
  readonly kind: 'ground' | 'ink';
}

/**
 * Names are the person's, not the code's. `surfaceInverse` is what the type
 * calls it; "Inverse surface" is what someone choosing a colour reads.
 */
const ROLE_NAMES: Readonly<Record<ColorRole, { name: string; kind: 'ground' | 'ink' }>> = {
  surface: { name: 'Surface', kind: 'ground' },
  surfaceInverse: { name: 'Inverse surface', kind: 'ground' },
  accent: { name: 'Accent', kind: 'ground' },
  text: { name: 'Text', kind: 'ink' },
  textInverse: { name: 'Inverse text', kind: 'ink' },
  textMuted: { name: 'Muted text', kind: 'ink' },
  accentText: { name: 'On accent', kind: 'ink' },
};

/** The declared colour roles, in the order a picker should show them. */
export const COLOR_ROLES: readonly ColorRole[] = [
  'surface',
  'surfaceInverse',
  'accent',
  'text',
  'textInverse',
  'textMuted',
  'accentText',
];

export function isColorRole(value: string): value is ColorRole {
  return Object.hasOwn(ROLE_NAMES, value);
}

/**
 * The palette a control can render for a given theme.
 *
 * Derived from the theme rather than duplicated beside it: a theme that gains a
 * colour gains a swatch here for free, and one that renames a key breaks at the
 * type level instead of silently offering a role nothing resolves.
 */
export function paletteOf(theme: Theme): readonly PaletteEntry[] {
  return COLOR_ROLES.map((role) => ({
    role,
    name: ROLE_NAMES[role].name,
    value: theme[role],
    cssVar: tokenCssName(role),
    kind: ROLE_NAMES[role].kind,
  }));
}
