import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';
import { resolveImage, useAssetTable } from '@craftkit/builder-renderer';

import { WIDTH_CLASSES, cx } from '../section-classes';
import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion-attributes';
import { sectionSpacingStyle } from '../section-spacing';

import { imageSchema, type ImageProps } from './schema';

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
export function Image({ node, props, isCanvas }: BlockRenderProps<ImageProps>) {
  const part = blockPartProps({ node, props, isCanvas }, imageSchema.parts);
  /*
    Resolved against the site's own asset table, never against anything the
    props carry: a block that could render an address written into its props
    would be the one hole through which a generated URL reaches a visitor.
  */
  const resolved = resolveImage(props.asset, useAssetTable());
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

  const source = resolved?.kind === 'asset' ? resolved.entry.url : props.src;

  if (source === undefined) {
    if (!isCanvas) return null;

    /*
      An absence SAYS why. "Nothing in the library matched a kiln" and "the
      picture you chose was deleted" send a person to different places, and a
      dashed rectangle saying neither sends them nowhere. The reason is written
      once, by whoever produced the absence, and carried here unchanged.
    */
    const message =
      resolved?.kind === 'absent'
        ? resolved.reason
        : 'Add an image URL, or choose one from the library.';

    return (
      <div className={className} style={style} {...motionData}>
        {/*
          The empty frame is the image part too, so a double-click on it opens
          the asset picker exactly as it would on a picture.
        */}
        <div
          {...part('image', {
            className: cx(
              mediaClassName,
              'grid place-items-center border border-dashed border-text-muted px-gutter py-section-sm text-center',
              props.ratio === 'auto' ? 'min-h-48' : 'min-h-0',
            ),
          })}
        >
          {message}
        </div>
      </div>
    );
  }

  /*
    The library's own alt text is the better answer when the block has none: it
    was written by whoever put the picture in the library, describing THAT
    picture, and an empty alt on a meaningful image is a WCAG failure a person
    cannot see.
  */
  const altText =
    props.alt.trim().length > 0 || resolved?.kind !== 'asset' ? props.alt : resolved.entry.alt;
  const needsAltText = !props.decorative && altText.trim().length === 0;

  return (
    <div className={className} style={style} {...motionData}>
      <img
        {...part('image', { className: cx(mediaClassName, 'block h-auto') })}
        src={source}
        alt={props.decorative ? '' : altText}
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
