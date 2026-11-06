import {
  fit,
  flex,
  FLEX_ALIGNS,
  FLEX_JUSTIFY,
  grid,
  setItem,
  type Box,
  type FitMode,
  type FlexItemOptions,
  type FlexOptions,
  type GridOptions,
} from './layout/flex';
import { PAGE_PICTURES, pageLayout, type PageOptions } from './layout/page';

export const LAYOUT_VERSION = '1.0.0';

/**
 * `s.lib.layout` (storybook pages, 2026-11-05): a small first-party flexbox for Pixi containers —
 * `flex` rows and columns (gap, padding, wrap, grow/shrink, every justify mode, right-to-left),
 * `item` per-child options, `grid` cells, `fit` contain/cover, and `page` picture/text spreads
 * that adapt to portrait and landscape. Pure maths over x, y, width and height: it never imports
 * Pixi and patches no prototype (the reasons @pixi/layout was not admitted).
 */
export function createLayoutLibrary() {
  return Object.freeze({
    version: LAYOUT_VERSION,
    aligns: FLEX_ALIGNS,
    justify: FLEX_JUSTIFY,
    pictures: PAGE_PICTURES,
    flex: (container: unknown, options?: FlexOptions) => flex(container, options),
    /** Sets a child's grow/shrink/basis/alignSelf/margin (null clears); no options reads them. */
    item: (child: unknown, options?: FlexItemOptions | null) => setItem(child, options),
    grid: (children: unknown, options?: GridOptions) => grid(children, options),
    fit: (object: unknown, box: Partial<Box>, mode?: FitMode) => fit(object, box, mode),
    page: (width: number, height: number, options?: PageOptions) =>
      pageLayout(width, height, options),
  });
}
