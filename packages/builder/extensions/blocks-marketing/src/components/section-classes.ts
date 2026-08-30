import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

import type {
  sectionAlignments,
  sectionDirections,
  sectionSpacings,
  sectionTones,
  sectionWidths,
  sectionWraps,
} from './section-options';

/**
 * The shared vocabulary → Tailwind mapping every marketing section reads.
 *
 * ## Why one module and not twelve
 *
 * The blocks already share their option vocabularies through
 * `section-options.ts`; twelve copies of "what does `spacing: 'lg'` look like"
 * is twelve chances for two sections to space themselves differently while
 * claiming the same value. This is the same argument `section-color.ts` and
 * `section-motion.ts` already make, applied to layout.
 *
 * ## Why the utilities are safe here and would not be in a document
 *
 * Every class below resolves through the token bridge: `bg-accent` compiles to
 * `background-color: var(--t-accent)`, not to a colour. So a utility is a
 * REFERENCE, and re-pointing one token still moves every page.
 *
 * That property depends on these strings living in COMPONENT code, where they
 * are part of the block's implementation. The moment a class string is stored
 * in a document it becomes a literal the theme cannot move, invisible to
 * `style-values.ts` — which refuses hex and px and does not see `p-4` at all.
 * The planner emits `tone: 'dark'`; this module decides what dark looks like.
 */

/**
 * The spacing and size names this project's tokens create.
 *
 * `tailwind-merge` resolves conflicts from a table of Tailwind's OWN scale, and
 * it has never heard of `section-lg` or `content-standard`. Left unconfigured
 * it treats `py-section-lg` and `py-section-sm` as unrelated, emits both, and
 * lets stylesheet order decide — which is exactly the bug where a prop appears
 * to do nothing. Measured: the merge test failed on that pair before this
 * table existed.
 */
const TOKEN_SPACING = [
  'section-sm',
  'section-md',
  'section-lg',
  'gap',
  'gap-xs',
  'gap-sm',
  'gap-lg',
  'gutter',
  'unit',
  'bar-compact',
  'bar-regular',
  'bar-tall',
  'control-block-sm',
  'control-block-md',
  'control-block-lg',
  'control-inline-sm',
  'control-inline-md',
  'control-inline-lg',
  'motion-distance',
  'motion-parallax',
];

const TOKEN_CONTAINERS = [
  'content-narrow',
  'content-standard',
  'content-wide',
  'page',
  'grid-min-track',
];

const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      p: [{ p: TOKEN_SPACING }],
      px: [{ px: TOKEN_SPACING }],
      py: [{ py: TOKEN_SPACING }],
      m: [{ m: TOKEN_SPACING }],
      mx: [{ mx: TOKEN_SPACING }],
      my: [{ my: TOKEN_SPACING }],
      gap: [{ gap: TOKEN_SPACING }],
      'max-w': [{ 'max-w': TOKEN_CONTAINERS }],
    },
  },
});

/**
 * Compose classes, with later utilities winning conflicts.
 *
 * The merge matters more than it looks: a block that sets its own padding and
 * then receives a caller override must end up with ONE padding, not two and a
 * coin flip.
 */
export function cx(...values: ClassValue[]): string {
  return merge(clsx(values));
}

type Tone = (typeof sectionTones)[number];
type Spacing = (typeof sectionSpacings)[number];
type Width = (typeof sectionWidths)[number];
type Alignment = (typeof sectionAlignments)[number];
type Direction = (typeof sectionDirections)[number];
type Wrap = (typeof sectionWraps)[number];

/**
 * A section's ground and the ink that must read on it.
 *
 * Tone is a PAIR, never a background alone: a section that set its ground
 * without setting its text inherits whatever the page had, and the one
 * combination nobody checks is dark-on-dark.
 */
export const TONE_CLASSES: Readonly<Record<Tone, string>> = {
  transparent: 'bg-transparent text-inherit',
  light: 'bg-surface text-text',
  dark: 'bg-surface-inverse text-text-inverse',
};

/** The rhythm BETWEEN sections — block padding, never margin. */
export const SPACING_CLASSES: Readonly<Record<Spacing, string>> = {
  none: 'py-0',
  sm: 'py-section-sm',
  md: 'py-section-md',
  lg: 'py-section-lg',
};

/** The rhythm INSIDE a section. */
export const GAP_CLASSES: Readonly<Record<Spacing, string>> = {
  none: 'gap-0',
  sm: 'gap-gap-sm',
  md: 'gap-gap',
  lg: 'gap-gap-lg',
};

/**
 * How wide a column of content may get.
 *
 * `full` is deliberately `max-w-none` rather than a very large width: a section
 * that means "edge to edge" and gets 1600px looks correct until someone opens
 * it on a wider screen.
 */
export const WIDTH_CLASSES: Readonly<Record<Width, string>> = {
  narrow: 'max-w-content-narrow',
  standard: 'max-w-content-standard',
  wide: 'max-w-content-wide',
  full: 'max-w-none',
};

/** Cross-axis alignment, in flex terms. */
export const ALIGN_CLASSES: Readonly<Record<Alignment, string>> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
};

/** Main-axis distribution. */
export const JUSTIFY_CLASSES: Readonly<Record<Alignment, string>> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
};

/**
 * Text alignment.
 *
 * `text-start` and `text-end`, never `text-left` and `text-right`: an Arabic
 * page aligned left is aligned to the wrong edge, and logical properties are
 * what make one stylesheet serve both directions.
 */
export const TEXT_ALIGN_CLASSES: Readonly<Record<Alignment, string>> = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
};

export const DIRECTION_CLASSES: Readonly<Record<Direction, string>> = {
  row: 'flex-row',
  column: 'flex-col',
};

export const WRAP_CLASSES: Readonly<Record<Wrap, string>> = {
  nowrap: 'flex-nowrap',
  wrap: 'flex-wrap',
};

/**
 * The outer shell every section shares: full width, its ground, its rhythm.
 *
 * `box-border` is stated rather than assumed. Tailwind's preflight sets it
 * globally, but a block rendered into a host page that resets differently would
 * otherwise have its padding added to its width — and the failure looks like a
 * horizontal scrollbar nobody can trace.
 */
export function sectionShellClasses(tone: Tone, spacing: Spacing): string {
  return cx('box-border w-full', TONE_CLASSES[tone], SPACING_CLASSES[spacing]);
}

/**
 * The inline breathing room at a section's edges.
 *
 * `none` exists because it was the missing choice. The gutter used to be a
 * constant in the shared stylesheet, which made a full-bleed hero, a gallery
 * that runs to the glass, or a coloured band with no inset impossible to
 * express — the block was closed where it most needed to be open.
 */
export const GUTTER_CLASSES: Readonly<Record<Spacing, string>> = {
  none: 'px-0',
  sm: 'px-2',
  md: 'px-gutter',
  lg: 'px-8',
};

/**
 * The content column inside that shell.
 *
 * `mx-auto` centres the column, which is what makes `max-w-*` mean anything.
 * The gutter defaults to `md` so a section that says nothing still keeps text
 * off the glass on a phone — the safe default, chosen rather than baked in.
 */
export function sectionContentClasses(
  width: Width,
  align?: Alignment,
  gutter: Spacing = 'md',
): string {
  return cx(
    'mx-auto w-full min-w-0',
    GUTTER_CLASSES[gutter],
    WIDTH_CLASSES[width],
    align === undefined ? undefined : TEXT_ALIGN_CLASSES[align],
  );
}
