import { clsx } from 'clsx';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import type { SeparatorProps } from './schema';

const TONE_CLASSES: Record<SeparatorProps['tone'], string> = {
  subtle: 'border-text/15',
  accent: 'border-accent',
  inverse: 'border-text-inverse/35',
};

const LABEL_CLASSES: Record<SeparatorProps['tone'], string> = {
  subtle: 'text-text-muted',
  accent: 'text-accent',
  inverse: 'text-text-inverse',
};

const STYLE_CLASSES: Record<SeparatorProps['style'], string> = {
  solid: 'border-solid',
  dashed: 'border-dashed',
  dotted: 'border-dotted',
};

const HORIZONTAL_THICKNESS_CLASSES: Record<SeparatorProps['thickness'], string> = {
  hairline: 'border-t',
  medium: 'border-t-2',
  strong: 'border-t-4',
};

const VERTICAL_THICKNESS_CLASSES: Record<SeparatorProps['thickness'], string> = {
  hairline: 'border-s',
  medium: 'border-s-2',
  strong: 'border-s-4',
};

const HORIZONTAL_SPACING_CLASSES: Record<SeparatorProps['spacing'], string> = {
  none: 'my-0',
  compact: 'my-3',
  regular: 'my-6',
  roomy: 'my-10',
};

const VERTICAL_SPACING_CLASSES: Record<SeparatorProps['spacing'], string> = {
  none: 'mx-0',
  compact: 'mx-3',
  regular: 'mx-6',
  roomy: 'mx-10',
};

function lineClasses(props: SeparatorProps, labelled: boolean): string {
  return clsx(
    props.orientation === 'horizontal'
      ? labelled
        ? 'h-0 min-w-6 flex-1'
        : 'h-0 w-full'
      : labelled
        ? 'min-h-6 w-0 flex-1'
        : 'min-h-12 w-0 self-stretch',
    props.orientation === 'horizontal'
      ? HORIZONTAL_THICKNESS_CLASSES[props.thickness]
      : VERTICAL_THICKNESS_CLASSES[props.thickness],
    TONE_CLASSES[props.tone],
    STYLE_CLASSES[props.style],
  );
}

/** A semantic divider whose orientation, weight, rhythm, and label stay token-bound. */
export function Separator({ props }: BlockRenderProps<SeparatorProps>) {
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);
  const spacingClass =
    props.orientation === 'horizontal'
      ? HORIZONTAL_SPACING_CLASSES[props.spacing]
      : VERTICAL_SPACING_CLASSES[props.spacing];
  const className = clsx(
    props.orientation === 'horizontal'
      ? 'flex w-full items-center gap-3'
      : 'flex min-h-24 w-6 self-stretch flex-col items-center gap-3',
    spacingClass,
    motionClassName,
    props.className,
  );

  if (props.label === undefined) {
    return (
      <div
        className={clsx(className, lineClasses(props, false))}
        role="separator"
        aria-orientation={props.orientation}
        {...motionData}
      />
    );
  }

  return (
    <div
      className={className}
      role="separator"
      aria-orientation={props.orientation}
      aria-label={props.label}
      {...motionData}
    >
      <span aria-hidden="true" className={lineClasses(props, true)} />
      <span
        className={clsx(
          'shrink-0 text-xs leading-tight font-medium whitespace-nowrap',
          props.orientation === 'vertical' ? '-rotate-90' : undefined,
          LABEL_CLASSES[props.tone],
        )}
      >
        {props.label}
      </span>
      <span aria-hidden="true" className={lineClasses(props, true)} />
    </div>
  );
}
