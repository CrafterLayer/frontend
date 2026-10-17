import { clsx } from 'clsx';

import { motionAttributes } from '@craftkit/builder-renderer';
import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import { progressSchema, type ProgressProps } from './schema';

const SIZE_CLASSES: Record<ProgressProps['size'], string> = {
  small: 'h-1.5',
  medium: 'h-2.5',
  large: 'h-4',
};

const VARIANT_CLASSES: Record<ProgressProps['variant'], string> = {
  accent: 'bg-accent',
  success: 'bg-success',
  neutral: 'bg-surface-inverse',
};

const RADIUS_CLASSES: Record<ProgressProps['radius'], string> = {
  none: 'rounded-none',
  small: 'rounded',
  large: 'rounded-xl',
  pill: 'rounded-full',
};

/** A determinate progress indicator that grows from the logical inline start. */
export function Progress({ node, props, isCanvas }: BlockRenderProps<ProgressProps>) {
  const part = blockPartProps({ node, props, isCanvas }, progressSchema.parts);
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);
  const boundedValue = Math.min(Math.max(props.value, 0), props.max);
  const percentage = (boundedValue / props.max) * 100;
  const roundedPercentage = Math.round(percentage);
  const labelId = `${node.id}-progress-label`;

  return (
    <div
      className={clsx('flex min-w-0 flex-col gap-2 text-text', motionClassName, props.className)}
      {...motionData}
    >
      <div className="flex min-w-0 items-baseline justify-between gap-4">
        <span
          {...part('label', {
            id: labelId,
            className: 'min-w-0 text-sm font-semibold text-balance',
          })}
        >
          {props.label}
        </span>
        {props.showValue ? (
          <span
            {...part('value', {
              className: 'shrink-0 text-sm font-medium tabular-nums text-text-muted',
            })}
          >
            {roundedPercentage}%
          </span>
        ) : null}
      </div>

      <div
        aria-labelledby={labelId}
        aria-valuemax={props.max}
        aria-valuemin={0}
        aria-valuenow={boundedValue}
        aria-valuetext={`${String(roundedPercentage)}%`}
        {...part('track', {
          className: clsx(
            'w-full overflow-hidden bg-text/10',
            SIZE_CLASSES[props.size],
            RADIUS_CLASSES[props.radius],
          ),
        })}
        role="progressbar"
      >
        <span
          aria-hidden="true"
          {...part('indicator', {
            className: clsx(
              'ms-0 me-auto block h-full transition-all duration-300 motion-reduce:transition-none',
              VARIANT_CLASSES[props.variant],
              RADIUS_CLASSES[props.radius],
            ),
          })}
          data-progress-percent={roundedPercentage}
          style={{ inlineSize: `${String(percentage)}%` }}
        />
      </div>
    </div>
  );
}
