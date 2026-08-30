import './Image.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';
import { sectionMotionAttributes } from '../section-motion';
import { sectionSpacingStyle } from '../section-spacing';

import type { ImageProps } from './schema';

/** A publish-safe image whose empty and accessibility guidance exists only on the canvas. */
export function Image({ props, isCanvas }: BlockRenderProps<ImageProps>) {
  /*
    Motion arrives as attributes, never as inline style, so the stylesheet stays
    the one place any timing lives. `class` is pulled out because React spells
    it `className`; the rest spread onto the wrapper for the CSS to match.
  */
  const { class: motionClassName, ...motionData } = sectionMotionAttributes(props);
  const className = [
    `mkt-image mkt-image--fit-${props.fit} mkt-image--ratio-${props.ratio} ` +
      `mkt-image--radius-${props.radius} mkt-image--width-${props.width} ` +
      `mkt-image--align-${props.align}`,
    motionClassName ?? '',
  ]
    .filter((name) => name !== '')
    .join(' ');
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
        <div className="mkt-image__placeholder">Add an image URL.</div>
      </div>
    );
  }

  const needsAltText = !props.decorative && props.alt.trim().length === 0;

  return (
    <div className={className} style={style} {...motionData}>
      <img
        className="mkt-image__media"
        src={props.src}
        alt={props.decorative ? '' : props.alt}
        loading="lazy"
        decoding="async"
      />
      {isCanvas && needsAltText ? (
        <p className="mkt-image__warning">This image needs alt text.</p>
      ) : null}
    </div>
  );
}
