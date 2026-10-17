import type { CSSProperties } from 'react';
import { z } from 'zod';

import type { BlockPropertyGroup } from '@craftkit/builder-schema';

/**
 * Per-block padding and margin, shared by every marketing section.
 *
 * **Steps, not lengths.** The document style law in
 * `packages/builder/schema/src/blocks/style-values.ts` refuses strings that
 * contain raw pixel lengths. Numbers are legal, so each property stores a
 * NUMBER OF STEPS and the renderer resolves it through
 * `calc(var(--t-space-unit, 4px) * N)`. This gives a person the numeric input
 * they asked for while the theme still owns the rhythm: re-pointing
 * `--t-space-unit` rescales every authored padding and margin together.
 *
 * **Optional, with no default.** A default here would restyle every existing
 * page the moment this shipped. Undefined means "the block's own spacing
 * decides", which preserves every document written before these controls
 * existed.
 */

const paddingStep = z.number().int().min(0).max(64).optional();
const marginStep = z.number().int().min(-32).max(64).optional();

/** The spacing part of a section's props. Spread into `z.object({ ... })`. */
export const sectionSpacingProps = {
  paddingBlockStart: paddingStep,
  paddingBlockEnd: paddingStep,
  paddingInlineStart: paddingStep,
  paddingInlineEnd: paddingStep,
  marginBlockStart: marginStep,
  marginBlockEnd: marginStep,
  marginInlineStart: marginStep,
  marginInlineEnd: marginStep,
};

interface SpacingPairDeclaration {
  readonly id: string;
  readonly label: string;
  readonly cellLabel: string;
}

type PairedBlockPropertyGroup = BlockPropertyGroup & {
  readonly pair: SpacingPairDeclaration;
};

function pairedGroup(id: string, label: string, cellLabel: string): PairedBlockPropertyGroup {
  return {
    tab: 'design',
    section: 'Padding & margin',
    pair: { id, label, cellLabel },
  };
}

/** Logical Start/End pairs rendered as two cells under one Inspector heading. */
export const sectionSpacingGroups: Readonly<Record<string, BlockPropertyGroup>> = {
  paddingBlockStart: pairedGroup('padding-block', 'Padding block', 'Start'),
  paddingBlockEnd: pairedGroup('padding-block', 'Padding block', 'End'),
  paddingInlineStart: pairedGroup('padding-inline', 'Padding inline', 'Start'),
  paddingInlineEnd: pairedGroup('padding-inline', 'Padding inline', 'End'),
  marginBlockStart: pairedGroup('margin-block', 'Margin block', 'Start'),
  marginBlockEnd: pairedGroup('margin-block', 'Margin block', 'End'),
  marginInlineStart: pairedGroup('margin-inline', 'Margin inline', 'Start'),
  marginInlineEnd: pairedGroup('margin-inline', 'Margin inline', 'End'),
};

/*
  `| undefined` is written out because the workspace runs
  `exactOptionalPropertyTypes`: without it a caller may omit the key but may not
  pass it as undefined, and a block's parsed props do exactly that.
*/
export interface SectionSpacingProps {
  readonly paddingBlockStart?: number | undefined;
  readonly paddingBlockEnd?: number | undefined;
  readonly paddingInlineStart?: number | undefined;
  readonly paddingInlineEnd?: number | undefined;
  readonly marginBlockStart?: number | undefined;
  readonly marginBlockEnd?: number | undefined;
  readonly marginInlineStart?: number | undefined;
  readonly marginInlineEnd?: number | undefined;
}

/**
 * The logical inline style for the chosen spacing steps.
 *
 * Returns `undefined` when nothing is set, so an unstyled block carries no
 * `style` attribute and its stylesheet wins without a specificity fight. Zero
 * is meaningful, so every property is tested against `undefined`, never
 * falsiness.
 */
export function sectionSpacingStyle(props: SectionSpacingProps): CSSProperties | undefined {
  if (
    props.paddingBlockStart === undefined &&
    props.paddingBlockEnd === undefined &&
    props.paddingInlineStart === undefined &&
    props.paddingInlineEnd === undefined &&
    props.marginBlockStart === undefined &&
    props.marginBlockEnd === undefined &&
    props.marginInlineStart === undefined &&
    props.marginInlineEnd === undefined
  ) {
    return undefined;
  }

  const style: CSSProperties = {};
  if (props.paddingBlockStart !== undefined) {
    style.paddingBlockStart = spacingStep(props.paddingBlockStart);
  }
  if (props.paddingBlockEnd !== undefined) {
    style.paddingBlockEnd = spacingStep(props.paddingBlockEnd);
  }
  if (props.paddingInlineStart !== undefined) {
    style.paddingInlineStart = spacingStep(props.paddingInlineStart);
  }
  if (props.paddingInlineEnd !== undefined) {
    style.paddingInlineEnd = spacingStep(props.paddingInlineEnd);
  }
  if (props.marginBlockStart !== undefined) {
    style.marginBlockStart = spacingStep(props.marginBlockStart);
  }
  if (props.marginBlockEnd !== undefined) {
    style.marginBlockEnd = spacingStep(props.marginBlockEnd);
  }
  if (props.marginInlineStart !== undefined) {
    style.marginInlineStart = spacingStep(props.marginInlineStart);
  }
  if (props.marginInlineEnd !== undefined) {
    style.marginInlineEnd = spacingStep(props.marginInlineEnd);
  }
  return style;
}

function spacingStep(value: number): string {
  return `calc(var(--t-space-unit, 4px) * ${String(value)})`;
}
