import { clsx } from 'clsx';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import type { ButtonProps } from './schema';

const VARIANT_CLASSES: Record<ButtonProps['variant'], string> = {
  solid:
    'border-accent bg-accent text-accent-text shadow-strong hover:-translate-y-0.5 hover:shadow-elevated',
  outline: 'border-accent bg-transparent text-accent hover:bg-accent/10',
  ghost: 'border-transparent bg-transparent text-text hover:bg-accent/10 hover:text-accent',
  link: 'border-transparent bg-transparent px-0 text-accent underline-offset-4 hover:underline',
};

const SIZE_CLASSES: Record<ButtonProps['size'], string> = {
  small: 'min-h-9 gap-2 px-control-inline-sm py-control-block-sm text-sm',
  medium: 'min-h-11 gap-2 px-control-inline-md py-control-block-md',
  large: 'min-h-12 gap-3 px-control-inline-lg py-control-block-md text-lg',
};

const ALIGN_CLASSES: Record<ButtonProps['align'], string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
};

const RADIUS_CLASSES: Record<ButtonProps['radius'], string> = {
  small: 'rounded',
  large: 'rounded-xl',
  pill: 'rounded-full',
};

const ICONS: Record<Exclude<ButtonProps['icon'], 'none'>, string> = {
  arrow: '→',
  external: '↗',
  plus: '+',
  play: '▶',
};

/** A token-bound action that preserves native link and button semantics. */
export function Button({ props }: BlockRenderProps<ButtonProps>) {
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);
  const icon =
    props.icon === 'none' ? null : (
      <span aria-hidden="true" className="shrink-0 leading-none">
        {ICONS[props.icon]}
      </span>
    );
  const className = clsx(
    'inline-flex items-center border font-semibold transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transform-none',
    VARIANT_CLASSES[props.variant],
    SIZE_CLASSES[props.size],
    RADIUS_CLASSES[props.radius],
    props.width === 'full' ? 'w-full justify-center' : undefined,
    motionClassName,
    props.className,
  );
  const content = (
    <>
      {props.iconPosition === 'start' ? icon : null}
      <span>{props.label}</span>
      {props.iconPosition === 'end' ? icon : null}
    </>
  );

  return (
    <div className={clsx('flex min-w-0', ALIGN_CLASSES[props.align])}>
      {props.href === undefined ? (
        <button className={className} type={props.type} {...motionData}>
          {content}
        </button>
      ) : (
        <a
          className={className}
          href={props.href}
          target={props.openInNewTab ? '_blank' : undefined}
          rel={props.openInNewTab ? 'noreferrer noopener' : undefined}
          {...motionData}
        >
          {content}
        </a>
      )}
    </div>
  );
}
