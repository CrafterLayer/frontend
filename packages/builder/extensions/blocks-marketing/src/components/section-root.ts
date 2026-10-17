import type { CSSProperties } from 'react';

import { cx, sectionShellClasses } from './section-classes';
import { sectionColorStyle, type SectionColorProps } from './section-color';
import type { SectionCustomProps } from './section-custom';
import type { SectionMotionProps } from './section-motion';
import { sectionMotionAttributes } from './section-motion-attributes';
import type { sectionSpacings, sectionTones } from './section-options';
import { sectionSpacingStyle, type SectionSpacingProps } from './section-spacing';
import { sectionTypographyClasses, type SectionTypographyProps } from './section-typography';

/**
 * The `<section>` element's attributes from the shared section props — its
 * ground and rhythm, the `@container` its children measure, typography, motion,
 * colour roles, logical spacing and the caller's classes — in the one order
 * every marketing section applies them (Timeline, Countdown and the rest spell
 * the same lines out inline). Render-only: it reaches the renderer through
 * `section-motion-attributes`, so no schema may import it.
 */
export interface SectionRootInput
  extends
    SectionColorProps,
    SectionMotionProps,
    SectionSpacingProps,
    SectionTypographyProps,
    Pick<SectionCustomProps, 'className'> {
  readonly tone: (typeof sectionTones)[number];
  readonly spacing: (typeof sectionSpacings)[number];
}

export interface SectionRootAttributes {
  readonly className: string;
  readonly style: CSSProperties | undefined;
  /** The motion data attributes (`data-ck-motion` …); spread beside the class. */
  readonly motion: Readonly<Record<string, string>>;
}

export function sectionRootAttributes(props: SectionRootInput): SectionRootAttributes {
  const { class: motionClassName, ...motion } = sectionMotionAttributes(props);
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  return {
    className: cx(
      sectionShellClasses(props.tone, props.spacing),
      '@container',
      sectionTypographyClasses(props),
      motionClassName,
      props.className,
    ),
    style:
      colorStyle === undefined && spacingStyle === undefined
        ? undefined
        : { ...colorStyle, ...spacingStyle },
    motion,
  };
}

/** Secondary text: the muted role on a light ground, the section's own ink dimmed on a dark one. */
export function mutedTextClasses(tone: (typeof sectionTones)[number]): string {
  return tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted';
}
