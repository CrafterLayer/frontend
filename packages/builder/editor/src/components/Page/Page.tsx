import './Page.css';

import { findCssRejection, scopeCustomCodeCss } from '@craftkit/builder-custom-code';
import type { BlockRenderProps } from '@craftkit/builder-schema';

import type { z } from 'zod';

import type { pageSchema } from './schema';

type PageProps = z.output<typeof pageSchema.props>;

/** The document root: a main landmark flowing its default slot in order. */
export function Page({ node, props, slots, isCanvas }: BlockRenderProps<PageProps>) {
  /*
    Scoped to the page root's own node, through the same door a region's CSS
    passes: the refusal list is shared, and a rule written here still cannot
    reach outside this document. That matters where a builder canvas renders a
    document inside an application that has its own stylesheet — an unscoped
    `body { … }` from a generated page would restyle the editor around it.

    `@keyframes` and `@font-face` survive the scoping untouched (they carry no
    selectors), which is exactly why this layer exists.
  */
  const pageCss = scopeCustomCodeCss(props.pageCss, node.id);
  // Same rule as a region: a refused sheet is dropped whole, and on the canvas
  // the reason is said rather than left for the person to guess at.
  const rejection = isCanvas ? findCssRejection(props.pageCss) : undefined;
  return (
    <main
      className="bldr-page"
      aria-label={props.title === '' ? undefined : props.title}
      data-content-width={props.contentWidth}
      data-ck={node.id}
      lang={props.lang === '' ? undefined : props.lang}
    >
      {pageCss === undefined ? null : <style>{pageCss}</style>}
      {rejection === undefined ? null : (
        <p className="bldr-unknown-block" role="note" data-css-rejected={rejection.reason}>
          Page CSS not applied: <code>{rejection.reason}</code> is not allowed here. Remove it and
          the rest of the stylesheet will apply.
        </p>
      )}
      {slots['default']}
    </main>
  );
}
