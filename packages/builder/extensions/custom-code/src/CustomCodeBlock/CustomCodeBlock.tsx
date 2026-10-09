import { CustomCode } from '@craftkit/builder-renderer';
import type { BlockRenderProps } from '@craftkit/builder-schema';

import type { CustomCodeBlockProps } from './schema';
import { findCssRejection, scopeCustomCodeCss } from './scope-css';

/**
 * The block wrapper: scoped CSS, then the tree.
 *
 * The renderer package owns the walk (`CustomCode`) because the tolerant read,
 * the depth ceiling, and the component-reference resolution are rendering
 * concerns shared by the canvas and the static export. This file owns only
 * what is specific to the BLOCK: its stored props, and the stylesheet that
 * belongs to this one region. The region's `js` is handed straight through:
 * `CustomCode` puts it on the wrapper as `data-ck-js` (never a `<script>`).
 */
export function CustomCodeBlock({ node, props, isCanvas }: BlockRenderProps<CustomCodeBlockProps>) {
  const css = scopeCustomCodeCss(props.css, node.id);
  /*
    A refused stylesheet is dropped WHOLE — one bad rule and nothing in it
    applies. That is the right thing to publish and the wrong thing to hide:
    a person looking at the canvas sees their panel unstyled and no reason
    why. (The first live user hit exactly this: an external image URL the
    sanitizer of the day refused, and every other rule in the sheet vanished
    with it, silently.) On the canvas the reason is shown, in the same voice
    UnknownBlock uses; the published page never carries the note.
  */
  const rejection = isCanvas ? findCssRejection(props.css) : undefined;
  return (
    <>
      {css === undefined ? null : <style>{css}</style>}
      {rejection === undefined ? null : (
        <p className="bldr-unknown-block" role="note" data-css-rejected={rejection.reason}>
          Custom CSS not applied: <code>{rejection.reason}</code> is not allowed here. Remove it and
          the rest of the stylesheet will apply.
        </p>
      )}
      <CustomCode tree={props.tree} hostId={node.id} isCanvas={isCanvas} js={props.js} />
    </>
  );
}
