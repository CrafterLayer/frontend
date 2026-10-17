import { clsx } from 'clsx';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import type { ShineBorderProps } from './schema';

import './ShineBorder.css';

/**
 * A travelling highlight around whatever it contains.
 *
 * Adapted from Magic UI (MIT) — verbatim source at
 * `vendor/magicui/ShineBorder.upstream.tsx`, provenance and the full change
 * list in `vendor/VENDOR.md`.
 *
 * ## What the adaptation changed
 *
 * Upstream takes NUMBERS: `borderRadius={8}`, `borderWidth={1}`,
 * `duration={14}`, `color="#000000"`. Every one of those is a literal, and a
 * document holding them would be a document the theme cannot move — a black
 * shine on a terracotta brand, an 8px radius on a page whose corners are 12.
 * They became named steps that resolve to `--t-radius`, `--t-border-width`, and
 * the site's accent.
 *
 * ## What is kept verbatim, because it is worth vendoring
 *
 * The mask-composite trick that paints the gradient on the BORDER only, in the
 * stylesheet. Two masks composited with `exclude` cut the fill out of the
 * padding box and leave the ring. It is four lines and genuinely annoying to
 * rediscover.
 */
const SPEED_DURATION: Record<ShineBorderProps['speed'], string> = {
  slow: '22s',
  normal: '14s',
  brisk: '8s',
};

/*
  Multiples of the border token rather than pixel values, so the ring stays in
  proportion with every other edge when a theme changes its hairline.
*/
const WEIGHT_WIDTH: Record<ShineBorderProps['weight'], string> = {
  hairline: 'var(--t-border-width)',
  medium: 'calc(var(--t-border-width) * 2)',
  heavy: 'calc(var(--t-border-width) * 4)',
};

export function ShineBorder({ props, slots }: BlockRenderProps<ShineBorderProps>) {
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);

  return (
    <div
      className={clsx(
        'mgc-shine',
        'min-w-0 p-4',
        motionClassName,
        /* The document's own utilities go LAST, so a caller wins a conflict. */
        props.className,
      )}
      style={{
        ['--mgc-shine-duration' as string]: SPEED_DURATION[props.speed],
        ['--mgc-shine-width' as string]: WEIGHT_WIDTH[props.weight],
        ['--mgc-shine-play' as string]: props.animate ? 'running' : 'paused',
      }}
      {...motionData}
    >
      {slots['default']}
    </div>
  );
}
