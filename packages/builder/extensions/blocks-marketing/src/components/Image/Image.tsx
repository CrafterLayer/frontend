import type { BlockRenderProps } from '@craftkit/builder-schema';

import { WIDTH_CLASSES, cx } from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion';
import { sectionSpacingStyle } from '../section-spacing';

import type { ImageProps } from './schema';

const ALIGNMENT_CLASSES: Record<ImageProps['align'], string> = {
  start: 'ms-0 me-auto',
  center: 'mx-auto',
  end: 'ms-auto me-0',
};

const FIT_CLASSES: Record<ImageProps['fit'], string> = {
  cover: 'object-cover',
  contain: 'object-contain',
  fill: 'object-fill',
};

const RATIO_CLASSES: Record<ImageProps['ratio'], string> = {
  auto: 'aspect-auto',
  square: 'aspect-square',
  wide: 'aspect-video',
  portrait: 'aspect-3/4',
};

const RADIUS_CLASSES: Record<ImageProps['radius'], string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-base',
  full: 'rounded-full',
};

/** A publish-safe image whose empty and accessibility guidance exists only on the canvas. */
export function Image({ props, isCanvas }: BlockRenderProps<ImageProps>) {
  /* Motion arrives as attributes; `class` is pulled out because React spells it `className`. */
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const className = cx(
    'box-border w-full max-w-full bg-surface text-text-muted',
    WIDTH_CLASSES[props.width],
    ALIGNMENT_CLASSES[props.align],
    motionClassName,
    props.className,
  );
  const mediaClassName = cx(
    'box-border w-full max-w-full bg-inherit',
    FIT_CLASSES[props.fit],
    RATIO_CLASSES[props.ratio],
    RADIUS_CLASSES[props.radius],
  );
  const colorStyle = sectionColorStyle(props);
  const spacingStyle = sectionSpacingStyle(props);
  const style =
    colorStyle === undefined && spacingStyle === undefined
      ? undefined
      : { ...colorStyle, ...spacingStyle };

  if (props.src === undefined) {
    if (!isCanvas) return null;

    return (
      <div className={className} style={style} {...motionData}>
        <div
          className={cx(
            mediaClassName,
            'grid place-items-center border border-dashed border-text-muted px-gutter py-section-sm text-center',
            props.ratio === 'auto' ? 'min-h-48' : 'min-h-0',
          )}
        >
          Add an image URL.
        </div>
      </div>
    );
  }

  const needsAltText = !props.decorative && props.alt.trim().length === 0;

  return (
    <div className={className} style={style} {...motionData}>
      <img
        className={cx(mediaClassName, 'block h-auto')}
        src={props.src}
        alt={props.decorative ? '' : props.alt}
        loading="lazy"
        decoding="async"
      />
      {isCanvas && needsAltText ? (
        <p className="mt-gap-xs mb-0 text-start text-sm leading-normal font-semibold text-inherit">
          This image needs alt text.
        </p>
      ) : null}
    </div>
  );
}
