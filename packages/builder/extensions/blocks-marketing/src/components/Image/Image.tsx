import './Image.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import { sectionColorStyle } from '../section-color';

import type { ImageProps } from './schema';

/** A publish-safe image whose empty and accessibility guidance exists only on the canvas. */
export function Image({ props, isCanvas }: BlockRenderProps<ImageProps>) {
  const className =
    `mkt-image mkt-image--fit-${props.fit} mkt-image--ratio-${props.ratio} ` +
    `mkt-image--radius-${props.radius} mkt-image--width-${props.width} ` +
    `mkt-image--align-${props.align}`;

  if (props.src === undefined) {
    if (!isCanvas) return null;

    return (
      <div className={className} style={sectionColorStyle(props)}>
        <div className="mkt-image__placeholder">Add an image URL.</div>
      </div>
    );
  }

  const needsAltText = !props.decorative && props.alt.trim().length === 0;

  return (
    <div className={className} style={sectionColorStyle(props)}>
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
