import { StaticDocument, type BuilderDocument, type StaticDocumentProps } from '@craftkit/builder';

export interface GeneratedSitesProps {
  /** The document to render and measure. Produced offline, from a fixed seed. */
  readonly document: BuilderDocument;
  /** The registry the blocks resolve through. */
  readonly blocks: StaticDocumentProps['blocks'];
  /**
   * The width to render at.
   *
   * A real width, applied as a hard `inline-size` — not a scaled-down preview.
   * The gate measures `getBoundingClientRect`, and a transform would report the
   * scaled numbers, which are not the numbers a person's browser produces.
   */
  readonly width: number;
}

/**
 * A generated page, rendered at one width so the quality gate can measure it.
 *
 * ## Why this exists as a component
 *
 * The gate's layout half needs a rendered page and nothing else — no editor, no
 * canvas chrome, no selection outlines. Measuring the real canvas would measure
 * the editor's own furniture along with the page, and every overlap between a
 * toolbar and a heading would be reported as a page defect.
 *
 * So this is the page ALONE, in the same static renderer the published site
 * uses. What CI measures is therefore what a visitor would see, which is the
 * only version of the page the gate has any business having an opinion about.
 */
export function GeneratedSites({ document, blocks, width }: GeneratedSitesProps) {
  return (
    <div
      data-generated-site=""
      data-width={String(width)}
      style={{
        inlineSize: `${String(width)}px`,
        maxInlineSize: `${String(width)}px`,
        // The page decides its own height; the gate only ever asks about width.
        overflow: 'hidden',
      }}
    >
      <StaticDocument document={document} blocks={blocks} />
    </div>
  );
}
