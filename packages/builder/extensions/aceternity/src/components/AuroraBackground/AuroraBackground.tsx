import { clsx } from 'clsx';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import type { AuroraBackgroundProps } from './schema';

import './AuroraBackground.css';

/**
 * A slow, drifting gradient behind a section.
 *
 * Adapted from Aceternity UI (MIT) — verbatim source at
 * `vendor/aceternity/AuroraBackground.upstream.tsx`, provenance and the full
 * list of changes in `vendor/VENDOR.md`.
 *
 * ## What the adaptation changed, and why it mattered
 *
 * Upstream hard-codes Tailwind's own palette into the gradient
 * (`--blue-500`, `--indigo-300`, `--violet-200`) and its layout into arbitrary
 * values. Copied as-is, every generated site would have carried the same blue
 * aurora regardless of its brand — at the top of the page, where people look
 * first. The gradients are rewritten in terms of `--t-*`, so the effect follows
 * the generated design system instead of contradicting it.
 *
 * ## Why there is no animation engine here
 *
 * The drift is a CSS keyframe animation on a pseudo-element. Upstream reaches
 * for `framer-motion` in several of its components; this one does not need to,
 * and keeping it engine-free is what lets the published page render the effect
 * without downloading anything.
 */
const INTENSITY_OPACITY: Record<AuroraBackgroundProps['intensity'], string> = {
  subtle: '0.25',
  normal: '0.45',
  bold: '0.7',
};

/*
  Ground and ink as a PAIR, never a ground alone. A section that set its
  background without setting its text inherits whatever the page had, and the
  one combination nobody checks is light-on-light.
*/
const TONE_CLASSES: Record<AuroraBackgroundProps['tone'], string> = {
  transparent: 'bg-transparent text-inherit',
  light: 'bg-surface text-text',
  dark: 'bg-surface-inverse text-text-inverse',
};

export function AuroraBackground({ props, slots }: BlockRenderProps<AuroraBackgroundProps>) {
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);

  return (
    <div
      className={clsx(
        'acy-aurora',
        'flex w-full flex-col justify-center',
        TONE_CLASSES[props.tone],
        motionClassName,
        /* The document's own utilities go LAST, so a caller wins a conflict. */
        props.className,
      )}
      /*
        Two custom properties rather than four variant classes. Intensity and
        drift are read by the stylesheet, which keeps every gradient stop in one
        place — the alternative is a class per level and the same gradient
        written three times.
      */
      style={{
        ['--acy-aurora-opacity' as string]: INTENSITY_OPACITY[props.intensity],
        ['--acy-aurora-play' as string]: props.animate ? 'running' : 'paused',
      }}
      data-acy-aurora-min-height={props.minHeight}
      {...motionData}
    >
      {slots['default']}
    </div>
  );
}
