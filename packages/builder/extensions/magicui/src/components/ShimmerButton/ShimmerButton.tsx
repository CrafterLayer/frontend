import { clsx } from 'clsx';
import type { MouseEvent as ReactMouseEvent } from 'react';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import { shimmerButtonSchema, type ShimmerButtonProps } from './schema';

import './ShimmerButton.css';

const TONE_CLASSES: Record<ShimmerButtonProps['tone'], string> = {
  accent: 'border-accent bg-accent text-accent-text shadow-strong',
  inverse: 'border-surface-inverse bg-surface-inverse text-text-inverse shadow-strong',
  surface: 'border-text/15 bg-surface text-text shadow-soft',
};

const TONE_SHIMMER: Record<ShimmerButtonProps['tone'], string> = {
  accent: 'var(--t-accent-text)',
  inverse: 'var(--t-text-inverse)',
  surface: 'var(--t-accent)',
};

const SIZE_CLASSES: Record<ShimmerButtonProps['size'], string> = {
  small: 'min-h-9 px-control-inline-sm py-control-block-sm text-sm',
  medium: 'min-h-11 px-control-inline-md py-control-block-md',
  large: 'min-h-12 px-control-inline-lg py-control-block-md text-lg',
};

const ALIGN_CLASSES: Record<ShimmerButtonProps['align'], string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
};

const RADIUS_CLASSES: Record<ShimmerButtonProps['radius'], string> = {
  small: 'rounded',
  large: 'rounded-xl',
  pill: 'rounded-full',
};

const SPEED_DURATION: Record<ShimmerButtonProps['speed'], string> = {
  slow: '4.8s',
  normal: '3.2s',
  brisk: '2s',
};

const INTENSITY_STRENGTH: Record<ShimmerButtonProps['intensity'], string> = {
  subtle: '18%',
  balanced: '32%',
  strong: '48%',
};

/** A semantic action with one restrained, token-bound travelling highlight. */
export function ShimmerButton({ node, props, isCanvas }: BlockRenderProps<ShimmerButtonProps>) {
  const part = blockPartProps({ node, props, isCanvas }, shimmerButtonSchema.parts);
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);
  const actionClassName = clsx(
    'mgc-shimmer-button',
    'inline-flex items-center justify-center overflow-hidden border font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transform-none',
    TONE_CLASSES[props.tone],
    SIZE_CLASSES[props.size],
    RADIUS_CLASSES[props.radius],
    props.width === 'full' ? 'w-full' : undefined,
    motionClassName,
    props.className,
  );
  const style = {
    ['--mgc-shimmer-color' as string]: TONE_SHIMMER[props.tone],
    ['--mgc-shimmer-duration' as string]: SPEED_DURATION[props.speed],
    ['--mgc-shimmer-strength' as string]: INTENSITY_STRENGTH[props.intensity],
    ['--mgc-shimmer-play' as string]: props.animate ? 'running' : 'paused',
  };
  const content = (
    <span {...part('label', { className: 'mgc-shimmer-button__label' })}>{props.label}</span>
  );
  const guardCanvasAction = (event: ReactMouseEvent<HTMLElement>) => {
    if (isCanvas) event.preventDefault();
  };

  return (
    <div className={clsx('flex min-w-0', ALIGN_CLASSES[props.align])}>
      {props.href === undefined ? (
        <button
          {...part('button', { className: actionClassName })}
          style={style}
          type={props.type}
          onClick={guardCanvasAction}
          data-shimmer-animate={props.animate ? 'true' : 'false'}
          {...motionData}
        >
          {content}
        </button>
      ) : (
        <a
          {...part('button', { className: actionClassName })}
          style={style}
          href={props.href}
          target={props.openInNewTab ? '_blank' : undefined}
          rel={props.openInNewTab ? 'noreferrer noopener' : undefined}
          onClick={guardCanvasAction}
          data-shimmer-animate={props.animate ? 'true' : 'false'}
          {...motionData}
        >
          {content}
        </a>
      )}
    </div>
  );
}
